const { assert, expect } = require('chai')
, { timeout } = require('../lib/tools/Defer')
, { assertThrowsAsync } = require('../lib/tools/AssertAsync')
, { Calendar, CalendarEventSimple, CalendarScheduler, CalendarError } = require('../lib/CalendarScheduler')
, IcalExpander = require('ical-expander');


Date.prototype.stdTimezoneOffset = function () {
	var jan = new Date(this.getFullYear(), 0, 1);
	var jul = new Date(this.getFullYear(), 6, 1);
	return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
};

Date.prototype.isDstObserved = function () {
	return this.getTimezoneOffset() < this.stdTimezoneOffset();
};


class Block {
	/**
	 * @param {string} type
	 */
	constructor(type) {
		this.type = type;
		/** @type {Map.<string, string>} */
		this.props = new Map();
		/** @type {Array.<Block>} */
		this.blocks = [];
		/** @type {Block} */
		this.parent = null;
	};

	tryGetSubBlock(type) {
		for (const block of this.blocks) {
			if (block.type === type) {
				return block;
			}
			const sub = block.tryGetSubBlock(type);
			if (sub instanceof Block) {
				return sub;
			}
		}
		return null;
	};

	/**
	 * @param {string} type
	 * @returns {Block}
	 */
	enterBlock(type) {
		const b = new Block(type);
		b.parent = this;
		this.blocks.push(b);
		return b;
	};

	/**
	 * @returns {Block}
	 */
	exitBlock() {
		return this.parent;
	};

	toString() {
		return `BEGIN:${this.type}\n${[...this.props.entries()].map(e => `${e[0]}:${e[1]}`).join("\n")}\n${this.blocks.map(b => b.toString().trim()).join("\n")}${this.blocks.length === 0 ? '' : "\n"}END:${this.type}`;
	};

	/**
	 * @param {Array.<string>} lines
	 * @returns {Block}
	 */
	static fromLines(lines) {
		let b = new Block(lines[0].split(':')[1]);

		lines.slice(1, lines.length - 1).forEach((l, idx) => {
			const s = l.trim().split(':');
			if (s[0] === 'BEGIN') {
				b = b.enterBlock(s[1]);
			} else if (s[0] === 'END') {
				b = b.exitBlock();
			} else {
				b.props.set(s[0], s[1]);
			}
		});

		return b;
	};
};

/** @type {Object.<string, string>} */
const tzdata = JSON.parse(require('fs').readFileSync(require('path').resolve('./node_modules/ical-expander/zones-compiled.json')).toString('utf8'));
/** @type {Map.<string, Block>} */
const tzdataAsBlocks = new Map(Object.keys(tzdata).map(k => {
	return [k, Block.fromLines(tzdata[k].split("\n"))];
}));

const offsetNow = (() => {
	const minutes = (new Date).getTimezoneOffset()
	, hours = Math.abs(minutes / 60)
	, mins = Number.isInteger(hours) ? 0 : Math.abs(60 * (hours - (hours | 0)))
	, pad = v => v < 10 ? `0${v}` : `${v}`;

	return `${minutes <= 0 ? '+' : '-'}${pad(hours)}${pad(mins)}`;
})();

const getMatchingTimezoneBlock = () => {
	const isDst = (new Date).isDstObserved();

	for (const block of tzdataAsBlocks.values()) {
		/** @type {Block} */
		let sub = null;
		if (isDst) {
			sub = block.tryGetSubBlock('DAYLIGHT');
		} else {
			sub = block.tryGetSubBlock('STANDARD');
		}

		if (sub === null) {
			continue;
		}


		const prop = isDst ? 'TZOFFSETTO' : 'TZOFFSETFROM';
		if (sub.props.has(prop) && sub.props.get(prop) === offsetNow) {
			return block;
		}
	}
	return null;
};

const tzBlock = getMatchingTimezoneBlock();
if (!tzBlock) {
	throw new Error('Cannot determine Timezone!');
}

const vcal =
`BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:IoT
X-WR-TIMEZONE:UTC
${tzBlock.toString()}
__EVENTS__
END:VCALENDAR`;


const vcal2data =
`BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:IoT
X-WR-TIMEZONE:UTC
${tzBlock.toString()}

BEGIN:VEVENT
DTSTART;TZID=${tzBlock.props.get('TZID')}:20180813T182300
DTEND;TZID=${tzBlock.props.get('TZID')}:20180813T191300
DTSTAMP:20180813T170945Z
UID:2rbhrjl1dks9udnbe53trrqh1v@google.com
RECURRENCE-ID;TZID=${tzBlock.props.get('TZID')}:20180813T080000
CLASS:PRIVATE
CREATED:20180811T042104Z
DESCRIPTION:off
LAST-MODIFIED:20180813T162103Z
LOCATION:
SEQUENCE:21
STATUS:CONFIRMED
SUMMARY:X
TRANSP:OPAQUE
END:VEVENT

BEGIN:VEVENT
DTSTART;TZID=${tzBlock.props.get('TZID')}:20180812T192000
DTEND;TZID=${tzBlock.props.get('TZID')}:20180812T201000
DTSTAMP:20180813T170945Z
UID:2rbhrjl1dks9udnbe53trrqh1v@google.com
RECURRENCE-ID;TZID=${tzBlock.props.get('TZID')}:20180812T080000
CLASS:PRIVATE
CREATED:20180811T042104Z
DESCRIPTION:on
LAST-MODIFIED:20180812T171102Z
LOCATION:
SEQUENCE:12
STATUS:CONFIRMED
SUMMARY:
TRANSP:OPAQUE
END:VEVENT

BEGIN:VEVENT
DTSTART;TZID=${tzBlock.props.get('TZID')}:20180811T003000
DTEND;TZID=${tzBlock.props.get('TZID')}:20180811T012000
RRULE:FREQ=DAILY
EXDATE;TZID=${tzBlock.props.get('TZID')}:20180811T003000
DTSTAMP:20180813T170945Z
UID:0ncfkb1dtno38j02srjptr8n02@google.com
CREATED:20180811T091156Z
DESCRIPTION:off
LAST-MODIFIED:20180811T094425Z
LOCATION:
SEQUENCE:7
STATUS:CONFIRMED
SUMMARY:
TRANSP:OPAQUE
END:VEVENT

BEGIN:VEVENT
DTSTART;TZID=${tzBlock.props.get('TZID')}:20180811T080000
DTEND;TZID=${tzBlock.props.get('TZID')}:20180811T085000
RRULE:FREQ=DAILY
EXDATE;TZID=${tzBlock.props.get('TZID')}:20180811T080000
DTSTAMP:20180813T170945Z
UID:2rbhrjl1dks9udnbe53trrqh1v@google.com
CLASS:PRIVATE
CREATED:20180811T042104Z
DESCRIPTION:on
LAST-MODIFIED:20180811T091123Z
LOCATION:
SEQUENCE:10
STATUS:CONFIRMED
SUMMARY:
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR`;


/**
 * @param {Date} start 
 * @param {string} id
 * @return {string}
 */
const createVEvent = (start, id, durationMSecs = 60*1e3) => {
	const end = new Date(+start + durationMSecs),
		toVEventTime = date => {
			/** @type {Date} */
			const d = date
			, pad = n => n < 10 ? `0${n}` : `${n}`;

			//'2018 08 11 T 08 39 00' -- w/o spaces!
			return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
		};

	return `
BEGIN:VEVENT
DTSTART;TZID=${tzBlock.props.get('TZID')}:${toVEventTime(start)}
DTEND;TZID=${tzBlock.props.get('TZID')}:${toVEventTime(end)}
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
		new IcalExpander({ ics: createVCalendar([createVEvent(new Date, 'foo')]) });
		done();
	});

	it('should be able to detect and return recurrence-exceptions', async() => {
		const c = new Calendar('x', () => vcal2data);
		await c.refresh();
		let events = c.expander.betweenWithExceptions(
			new Date(2018, 7, 13, 18, 21, 0),
			new Date(2018, 7, 13, 18, 23, 0)
		);

		assert.strictEqual(events.events.length + events.occurrences.length, 1);

		// 2018/08/13 T18:23:00
		// 2018/08/13 T19:13:00
		events = c.expander.betweenWithExceptions(
			new Date(2018, 7, 13, 19, 12, 55),
			new Date(2018, 7, 13, 19, 12, 57)
		);

		assert.strictEqual(events.events.length + events.occurrences.length, 1);
	});

	it('should throw if given invalid parameters', async() => {
		const cx = new Calendar('bla', () => '', 5000);

		await assertThrowsAsync(async() => {
			let threw = false;
			let _e = null;
			try {
			await cx.refresh();
			} catch (e) {
				_e = e;
				threw = true;
			} finally {
				assert.isTrue(threw);
				throw _e;
			}
		});

		assert.throws(() => {
			const c = new CalendarScheduler();
			c._unscheduleCalendar(cx);
		});

		assert.throws(() => {
			const c = new CalendarScheduler();
			c.getObservableForSchedule(cx);
		}, /^The\scalendar\swith\sID/i);

		assert.throws(() => {
			new Calendar('bla', () => '', 4900);;
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

		assert.throws(() => {
			const s = new CalendarScheduler();
			s.lookAheadSecs = s.scheduleIntervalSecs - 1;
		}, /lookAheadSecs is not a number or less than scheduleIntervalSecs/i);

		assert.throws(() => {
			const s = new CalendarScheduler();
			s.lookAheadSecs = true;
		}, /lookAheadSecs is not a number or less than scheduleIntervalSecs/i);

		assert.doesNotThrow(() => {
			const s = new CalendarScheduler();
			s.lookAheadSecs = s.scheduleIntervalSecs;
		});

		assert.strictEqual(CalendarScheduler.oneMinuteInSecs * 60, CalendarScheduler.oneHourInSecs);
		assert.strictEqual(CalendarScheduler.oneHourInSecs * 24, CalendarScheduler.oneDayInSecs);
		assert.strictEqual(CalendarScheduler.oneDayInSecs * 7, CalendarScheduler.oneWeekInSecs);

		const cs = new CalendarScheduler();
		const c8 = createEmptyCalendar('c8');
		assert.throws(() => {
			new CalendarError(42, c8);
		}, /The given scheduler is not an instance of CalendarScheduler./i);
		assert.throws(() => {
			new CalendarError(cs, true);
		}, /The given calendar is not an instance of Calendar./i);
		assert.doesNotThrow(() => {
			const ce = new CalendarError(cs, c8);
			assert.isTrue(ce.error instanceof Error);
			assert.strictEqual(ce.error.message, '<undefined>');
		});
	});

	it('should not throw when adding calendars that fail to update', async() => {
		const c = new Calendar('c', async() => { await timeout(20); throw '42'; });
		const s = new CalendarScheduler();

		await s.addCalendar(c, true);
		s.removeCalendar(c);

		const now = +new Date;
		await s.addCalendar(c, false);
		assert.isBelow((+new Date) - now, 10); // because we are not waiting!
		s.removeAllSchedules();
	});

	it('should schedule its global updates automatically when adding a calendar', async() => {
		const c = createEmptyCalendar('foo');
		const orgIcs = c.icsProvider;
		c.refreshInterval = 100;
		let scheduled = 0;
		c.icsProvider = async() => {
			scheduled++;
			return await orgIcs();
		};

		const s = new CalendarScheduler();
		assert.strictEqual(s.scheduleIntervalSecs, CalendarScheduler.oneMinuteInSecs * .5); // The default

		await s.addSchedule(c);
		await timeout(150);
		// This test will make sure that scheduling has happened in coverage
		assert.isAtLeast(scheduled, 1);
		s.removeCalendar(c);
	});

	it('should apply and remove filters from Calendars', async() => {
		const vCal = createVCalendar([ createVEvent(new Date, '123') ]);
		const c = new Calendar('cal', () => vCal);
		await c.refresh();

		const f = evt => evt.uid === '456';

		c.setFilter(f);
		assert.strictEqual(c._filter, f);
		assert.strictEqual(c.events.length, 0);

		c.removeFilter();
		assert.notEqual(c._filter, f);
		assert.strictEqual(c.events.length, 1);
		assert.strictEqual(c.events[0].uid, '123');
	});

	it('should not allow duplicate calendars or removing of unknown calendars', async() => {
		const cs = new CalendarScheduler();
		const c1 = createEmptyCalendar('c1');
		
		await cs.addCalendar(c1, true);

		await assertThrowsAsync(async () => {
			await cs.addCalendar(c1);
		});

		assert.throws(() => {
			const c3 = createEmptyCalendar('xx');
			cs.removeCalendar(c3);
		});

		const removed = cs.removeAllSchedules();
		assert.strictEqual(removed.length, 1);
		assert.strictEqual(removed[0], c1);
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

		const ces = new CalendarEventSimple(new Calendar('foo', () => ''), null);
		assert.isTrue(ces.isBeginOfEvent);
		assert.isFalse(ces.isEndOfEvent);
		
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
			assert.strictEqual(evt.summary, 'null');
			assert.strictEqual(evt.description, 'null');
			assert.strictEqual(evt.descriptionJson, null);
		};

		cs.observable.subscribe(subscriber);
		await cs.addCalendar(c);

		const fooEvents = cs._scheduledEvents.get(c);
		assert.strictEqual(fooEvents.length, 2);
		assert.isTrue(fooEvents[0].eventId.startsWith('e1.start_') || fooEvents[0].eventId.startsWith('e2.start_'));
		assert.isTrue(fooEvents[1].eventId.startsWith('e1.start_') || fooEvents[1].eventId.startsWith('e2.start_'));

		await timeout(3000); // both events should have triggered in the meantime

		assert.strictEqual(numEventsOcurred, 2);
		assert.strictEqual(fooEvents.length, 0);

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
		const fooEvents = cs._scheduledEvents.get(c);
		assert.strictEqual(fooEvents.length, 2);
		assert.isTrue(fooEvents[0].eventId.startsWith('e1.start_') || fooEvents[0].eventId.startsWith('e2.start_'));
		assert.isTrue(fooEvents[1].eventId.startsWith('e1.start_') || fooEvents[1].eventId.startsWith('e2.start_'));

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
		const fooEvents = cs._scheduledEvents.get(c);
		assert.strictEqual(fooEvents.length, 2);
		assert.isTrue(fooEvents[0].eventId.startsWith('e1.start_') || fooEvents[0].eventId.startsWith('e2.start_'));
		assert.isTrue(fooEvents[1].eventId.startsWith('e1.start_') || fooEvents[1].eventId.startsWith('e2.start_'));

		cs.removeCalendar(c);
	});

	it('should only observe events from subscribed calendars', async function() {
		this.timeout(5000);
		const cs = new CalendarScheduler(5);

		const c = new Calendar('foo', () => {
			return createVCalendar([
				createVEvent(new Date((+new Date) + 1.25e3), 'e1'),
				createVEvent(new Date((+new Date) + 2.50e3), 'e2')
			]);
		}, 25000);

		assert.throws(() => {
			cs.removeCalendar(c);
		});

		const addPromise = cs.addCalendar(c, true);
		await timeout(50);
		let observed = 0;
		cs.getObservableForSchedule(c).subscribe(evt => {
			assert.strictEqual(evt.calendar, c);
			observed++;
		});
		await addPromise;
		await timeout(3000);

		assert.strictEqual(observed, 2);

		assert.doesNotThrow(() => {
			cs.removeCalendar(c);
		});

		assert.isTrue(!cs.hasSchedule(c));
	});

	it('should un-schedule events from disabled calendars', async function() {
		this.timeout(10000);
		const cs = new CalendarScheduler(5);

		assert.strictEqual(cs._schedulerInterval, null);

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
		await timeout(500);
		assert.isTrue(cs._schedulerInterval !== null);
		await timeout(2500);

		assert.strictEqual(occurred.length, 1);
		c.isEnabled = false;
		await timeout(3500);

		assert.strictEqual(cs._scheduledEvents.get(c).length, 0);
		cs.removeCalendar(c);
	});

	it('should never schedule initially disabled calendars', async function() {
		const cs = new CalendarScheduler(5);

		const c = new Calendar('foo', () => {
			return createVCalendar([
				createVEvent(new Date((+new Date) + 1.2e3), 'e1'),
				createVEvent(new Date((+new Date) + 2.0e3), 'e2')
			]);
		}, 25000);

		c.isEnabled = false;

		await cs.addCalendar(c, true);

		assert.strictEqual(cs._scheduledEvents.get(c).length, 0);
		expect(cs._scheduledEvents.get(c)).to.deep.equal([]);

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

	it('should provide preliminary events of all of its schedules', async() => {
		const now = new Date;
		const cs = new CalendarScheduler();
		const c1 = new Calendar('c1', () => createVCalendar([
			createVEvent(new Date(+now + 1e3), 'c1e1')
		]));
		const c2 = new Calendar('c2', () => createVCalendar([
			createVEvent(new Date(+now + 2e3), 'c2e1')
		]));

		// The expander is not init'ed so it shouldn't yield any events..
		let pEvents = [...c1.preliminaryEvents(new Date(+now - 5e3), new Date(+now + 5e3))];
		assert.strictEqual(pEvents.length, 0);

		await Promise.all([ c1.refresh(), c2.refresh() ]);

		pEvents = [...c1.preliminaryEvents(new Date(+now - 5e3), now)];
		assert.strictEqual(pEvents.length, 0);
		pEvents = [...c1.preliminaryEvents(new Date(+now + 500), new Date(+now + 1500))];
		assert.strictEqual(pEvents.length, 1);


		await cs.addCalendar(c1);
		await cs.addCalendar(c2);

		pEvents = [...cs.preliminaryEvents(now, new Date(+now + 2.5e3))]
			.sort((p1, p2) => +p1.dateTime < +p2.dateTime ? -1 : 1);
		assert.strictEqual(pEvents.length, 2);
		assert.strictEqual(pEvents[0].schedule, c1);
		assert.strictEqual(pEvents[1].schedule, c2);
		
		cs.removeAllSchedules();
	});
});


module.exports = Object.freeze({
	createVEvent,
	createVCalendar,
	createEmptyCalendar
});