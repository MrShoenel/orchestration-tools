const { assert, expect } = require('chai')
, { timeout } = require('../tools/Defer')
, { assertThrowsAsync } = require('../tools/AssertAsync')
, { Calendar, CalendarEventSimple, CalendarScheduler, symbolCalendarEvent } = require('../lib/CalendarScheduler')
, ical = require('ical.js');


const vcal =
`BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:IoT
X-WR-TIMEZONE:UTC
__EVENTS__
END:VCALENDAR`;

/**
 * @param {Date} start 
 * @param {string} id
 * @return {string}
 */
const createVEvent = (start, id, durationMSecs = 60*1e3) => {
  const end = new Date(+start + durationMSecs),
    toVEventTime = date => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.[0-9]+[a-z]+$/i, '') + 'Z';
    }
  return `
BEGIN:VEVENT
DTSTART:${toVEventTime(start)}
DTEND:${toVEventTime(end)}
UID:${id}
CREATED:${toVEventTime(start)}
SEQUENCE:0
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
`.trim();
};

/**
 * @param {string} nameOrId 
 * @returns {Calendar}
 */
const createEmptyCalendar = nameOrId => {
  return new Calendar(nameOrId, () => createVCalendar([]));
};

/**
 * @param {Array.<string>} events 
 */
const createVCalendar = events => {
  return vcal.replace('__EVENTS__', events.join("\n")).trim();
};


describe('CalendarScheduler', () => {
  it ('should work with our iCal generator', done => {
    ical.parse(createVCalendar([createVEvent(new Date, 'foo')]));
    done();
  });

  it('should throw if given invalid parameters', async () => {
    await assertThrowsAsync(async () => {
      const c = new Calendar('bla', () => '', 5000);
      await c.refresh();
    });

    await assertThrowsAsync(async () => {
      const c = new Calendar('bla', () => '', 4900);
    });

    assert.throws(() => {
      new Calendar('');
    });

    assert.throws(() => {
      new Calendar('cal', 'icsProvider');
    });

    assert.throws(() => {
      const c = new Calendar('cal', () => {});
      c.setFilter(null);
    });

    assert.throws(() => {
      const c = new Calendar('cal', () => {});
      c.createFiltered(() => false, '');
    });

    await assertThrowsAsync(async() => {
      const c = new Calendar('cal', async() => 42);
      await c.refresh();
    });

    assert.throws(() => {
      new CalendarScheduler('4.9');
    });

    assert.throws(() => {
      new CalendarScheduler(4.9);
    });

    assert.throws(() => {
      const c = new CalendarScheduler();
      c._isCalendar(null);
    });

    assert.throws(() => {
      const c = new CalendarScheduler();
      c.removeCalendar(null);
    });
  });

  it('should apply and remove filters from Calendars', done => {
    const c = new Calendar('cal', () => {});
    const i = () => ['something else'];

    c.setFilter(i);
    assert.strictEqual(c._filter()[0], 'something else');
    assert.strictEqual(c._filter, i);

    c.removeFilter();
    assert.notEqual(c._filter, i);
    done();
  });

  it('should not allow duplicate calendars or removing of unknown calendars', async() => {
    const cs = new CalendarScheduler();
    const c1 = createEmptyCalendar('a');
    const c2 = createEmptyCalendar('a');
    
    await cs.addCalendar(c1, true);

    await assertThrowsAsync(async () => {
      await cs.addCalendar(c2);
    });

    assert.throws(() => {
      const c3 = createEmptyCalendar('xx');
      cs.removeCalendar(c3);
    });

    cs.removeCalendar(c1);
  });

  it('should unschedule updates of a calendar that was removed in the meantime', async() => {
    const cs = new CalendarScheduler(5); // lookahead is 2*5=10

    const c = new Calendar('foo', () => {
      return createVCalendar([
        createVEvent(new Date((+new Date) + 2e3), 'e1', 5e3)
      ]);
    }, 5000);

    await cs.addCalendar(c, true);
    assert.isTrue(cs._scheduledCalendarUpdates.hasOwnProperty('foo'));

    cs.removeCalendar(c);
    assert.isFalse(cs._scheduledCalendarUpdates.hasOwnProperty('foo'));
  });

  it('should schedule events that are in the future', async function() {
    this.timeout(6000);
    
    const cs = new CalendarScheduler();
    const c = new Calendar('foo', () => {
      return createVCalendar([
        createVEvent(new Date((+new Date) + 2.1e3), 'e1'),
        createVEvent(new Date((+new Date) + 2.3e3), 'e2')
      ]);
    }, 5000);

    let numEventsOcurred = 0;

    /** @param {CalendarEventSimple} evt */
    const subscriber = evt => {
      numEventsOcurred++;
      assert.isTrue(evt.id === 'e1' || evt.id === 'e2');
    };

    cs.observable.subscribe(subscriber);
    await cs.addCalendar(c);

    // access internal property for this test:
    assert.isTrue(cs._scheduledEvents.hasOwnProperty('foo'));
    assert.isTrue(cs._scheduledEvents.foo.hasOwnProperty('e1.start'));
    assert.isTrue(cs._scheduledEvents.foo.hasOwnProperty('e2.start'));

    await timeout(3000); // both events should have triggered in the meantime

    assert.strictEqual(numEventsOcurred, 2);
    assert.strictEqual(Object.keys(cs._scheduledEvents.foo).length, 0);

    // Important, otherwise it will keep setting timeout to update itself.
    // This would lead to mocha hanging.
    cs.removeCalendar(c);
    assert.isFalse(cs._scheduledEvents.hasOwnProperty('foo'));
  });

  it('should un-schedule events if they get cancelled', async function() {
    this.timeout(5000);
    const cs = new CalendarScheduler();
    const c = new Calendar('foo', async() => {
      return createVCalendar([
        createVEvent(new Date((+new Date) + 1.3e3), 'e1'),
        createVEvent(new Date((+new Date) + 1.7e3), 'e2')
      ]);
    }, 5000);

    cs.observable.subscribe(_ => {
      throw new Error('The events should never occur!');
    });

    await cs.addCalendar(c);
    // access internal property for this test:
    assert.isTrue(cs._scheduledEvents.hasOwnProperty('foo'));
    assert.isTrue(cs._scheduledEvents.foo.hasOwnProperty('e1.start'));
    assert.isTrue(cs._scheduledEvents.foo.hasOwnProperty('e2.start'));

    await timeout(200);
    cs.removeCalendar(c);
    await timeout(2000); // Redundant, but this gives the subscriber
    // the potential chance to be triggered (which it should not!)

    assert.isFalse(cs._scheduledEvents.hasOwnProperty('foo'));
  });

  it('should schedule also end-events, if within lookahead', async function() {
    this.timeout(10000);
    const cs = new CalendarScheduler(5); // lookahead is 2*5=10

    const c = new Calendar('foo', () => {
      return createVCalendar([
        createVEvent(new Date((+new Date) + 2e3), 'e1', 5e3)
      ]);
    }, 5000);

    await cs.addCalendar(c, true);
    // access internal property for this test:
    assert.isTrue(cs._scheduledEvents.hasOwnProperty('foo'));
    assert.isTrue(cs._scheduledEvents.foo.hasOwnProperty('e1.start'));
    assert.isTrue(cs._scheduledEvents.foo.hasOwnProperty('e1.end'));

    cs.removeCalendar(c);
  });

  it('should un-schedule events from disabled calendars', async function() {
    this.timeout(10000);
    const cs = new CalendarScheduler(5);

    const occurred = [];
    cs.observable.subscribe(v => {
      if (v.isBeginOfEvent) {
        occurred.push(v);
      }
    });

    const c = new Calendar('foo', () => {
      return createVCalendar([
        createVEvent(new Date((+new Date) + 2.5e3), 'e1'),
        createVEvent(new Date((+new Date) + 6.0e3), 'e2')
      ]);
    }, 25000);

    await cs.addCalendar(c);
    await timeout(3000);

    assert.strictEqual(occurred.length, 1);
    c.isEnabled = false;
    await timeout(3500);

    assert.isTrue(Object.keys(cs._scheduledEvents.foo).length === 0);
    cs.removeCalendar(c);
  });

  it('should work with filtered calendars', async function() {
    this.timeout(8000);

    const cs = new CalendarScheduler();

    const c_all = new Calendar('all', () => {
      const now = (+new Date);
      return createVCalendar([
        createVEvent(new Date(now + 0.75e3), 'e1'),
        createVEvent(new Date(now + 1.00e3), 'e2a'),
        createVEvent(new Date(now + 1.25e3), 'e1'),
        createVEvent(new Date(now + 1.50e3), 'e1'),
        createVEvent(new Date(now + 1.75e3), 'e1'),
        createVEvent(new Date(now + 2.00e3), 'e2b')
      ]);
    });
    const c_derived = c_all.createFiltered(evt => evt.uid.startsWith('e2'));

    /** @type {Array.<String>} */
    let occurred = [];
    cs.observable.subscribe(v => {
      if (v.isBeginOfEvent) {
        occurred.push(v.id);
      }
    });

    await cs.addCalendar(c_derived);

    await timeout(3000);

    assert.strictEqual(occurred.length, 2);
    assert.isTrue(occurred[0] === 'e2a' && occurred[1] === 'e2b');

    cs.removeCalendar(c_derived);
  });

  it('should work with filtered calendars (new method using filters)', async function() {
    this.timeout(8000);

    const cs = new CalendarScheduler();

    const c_all = new Calendar('all', async() => {
      const now = (+new Date);
      return createVCalendar([
        createVEvent(new Date(now + 0.75e3), 'e1'),
        createVEvent(new Date(now + 1.00e3), 'e2a'),
        createVEvent(new Date(now + 1.25e3), 'e1'),
        createVEvent(new Date(now + 1.50e3), 'e1'),
        createVEvent(new Date(now + 1.75e3), 'e1'),
        createVEvent(new Date(now + 2.00e3), 'e2b')
      ]);
    });
    c_all.setFilter(evt => evt.uid.startsWith('e2'));

    /** @type {Array.<String>} */
    let occurred = [];
    cs.observable.subscribe(v => {
      if (v.isBeginOfEvent) {
        occurred.push(v.id);
      }
    });

    await cs.addCalendar(c_all);

    await timeout(3000);

    assert.strictEqual(occurred.length, 2);
    assert.isTrue(occurred[0] === 'e2a' && occurred[1] === 'e2b');

    cs.removeCalendar(c_all);
  });
});