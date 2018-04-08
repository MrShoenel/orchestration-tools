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
const createVEvent = (start, id) => {
  const end = new Date(+start + 60 * 1e3),
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
    assert.isTrue(cs._scheduledEvents.hasOwnProperty('foo.e1'));
    assert.isTrue(cs._scheduledEvents.hasOwnProperty('foo.e2'));

    await timeout(3000); // both events should have triggered in the meantime

    assert.strictEqual(numEventsOcurred, 2);
    assert.strictEqual(Object.keys(cs._scheduledEvents).length, 0);

    // Important, otherwise it will keep setting timeout to update itself.
    // This would lead to mocha hanging.
    cs.removeCalendar(c);
  });

  it('should un-schedule events if they get cancelled', async function() {
    this.timeout(5000);
    const cs = new CalendarScheduler();
    const c = new Calendar('foo', () => {
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
    assert.isTrue(cs._scheduledEvents.hasOwnProperty('foo.e1'));
    assert.isTrue(cs._scheduledEvents.hasOwnProperty('foo.e2'));

    await timeout(200);
    cs.removeCalendar(c);
    await timeout(2000); // Redundant, but this gives the subscriber
    // the potential chance to be triggered

    assert.strictEqual(Object.keys(cs._scheduledEvents).length, 0);
  });
});