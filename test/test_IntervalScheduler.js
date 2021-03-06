const { assert, expect } = require('chai')
, { timeout } = require('../lib/tools/Defer')
, { assertThrowsAsync } = require('../lib/tools/AssertAsync')
, { Schedule, ScheduleEvent } = require('../lib/Schedule')
, { Interval, IntervalScheduler, IntervalEventSimple
	} = require('../lib/IntervalScheduler');


describe('IntervalScheduler', () => {
	it('should throw if given invalid parameters', async() => {
		assert.throws(() => new Interval(0, () => {}));
		assert.throws(() => new Interval(30, () => {}, null));
		assert.throws(() => {
			const i = new Interval(30, () => {});
			i.finish();
		});
		assert.throws(() => new Interval(1, {}));
		assert.doesNotThrow(() => {
			const i = new Interval(1);
			assert.isTrue(i.itemProducer instanceof Function);
			assert.strictEqual(i.itemProducer(), void 0); // the default
		});
		assert.doesNotThrow(() => {
			const i = new Interval(30, () => 42, 3, true, false);
			i.finish();
			assert.strictEqual(i.numOccurred, 3);
		});
		assert.throws(() => {
			const i = new Interval(30, () => {});
			i.finalize();
		});
		assert.doesNotThrow(() => {
			const i = new IntervalScheduler();
			i._isInterval(new Interval(10, () => {}));
		});
		assert.throws(() => {
			const i = new IntervalScheduler();
			i._isInterval(null);
		});
		assert.throws(() => {
			const is = new IntervalScheduler();
			const i = new Interval(20, () => {});
			is._getIntervalId(i);
		});
		assert.throws(() => {
			const is = new IntervalScheduler();
			const i = new Interval(20, () => {});

			try {
				is.addInterval(i);
				is.addInterval(i);
			} catch (e) {
				// We gotta clean it up
				is.removeInterval(i);
				throw e;
			}
		});
		assert.throws(() => {
			const is = new IntervalScheduler();
			const i = new Interval(20, () => {});
			is.removeInterval(i);
		});
		assert.throws(() => {
			new IntervalEventSimple(null, 42);
		});
		assert.throws(() => {
			new ScheduleEvent(null, 42);
		});
		await assertThrowsAsync(async() => {
			const is = new IntervalScheduler();
			const i = new Interval(30, () => 42, 3, true, true, false); // trigger initially..
			is.addInterval(i); // Nothing will happen because it's not enabled
			await timeout(75);
			assert.strictEqual(i.numOccurred, 0); // because it's disabled..

			const iId = Object.keys(is._intervalIds)[0];
			delete is._intervalIds[iId]; // Now interfere with internals to provoke an error

			try {
				is._getIntervalId(i);
			} catch (e) {
				// Restore internals..
				is._intervalIds[iId] = i;
				is.removeInterval(i);
				throw e; 
			}
		});

		let sched = new Schedule();
		assert.strictEqual(sched.enabled, true);
		
		sched = new Schedule(false);
		assert.strictEqual(sched.enabled, false);
		sched = new Schedule(true);
		assert.strictEqual(sched.enabled, true);
	});

	it('should be able to handle multiple different Intervals', async function() {
		this.timeout(3000);
		const s = new IntervalScheduler();

		/** @type {Array.<IntervalEventSimple>} */
		const observed = [];
		s.observable.subscribe(val => observed.push(val));

		const i1 = new Interval(500, async () => {
			await timeout(250);
			return 'i1';
		}, -1, true, true); // initial, wait
		const i2 = new Interval(750, () => 'i2', -1, false, false); // no initial, no wait

		s.addInterval(i1);
		s.addInterval(i2);

		// It should return the correct interval-id:
		const intId2 = s._getIntervalId(i2);
		assert.strictEqual(intId2, 'i_1'); // because IDs start at 0, then post-increment

		await timeout(300);
		assert.strictEqual(observed.length, 1);
		assert.strictEqual(observed[0].scheduleItem, 'i1');

		await timeout(800); // now i1 should have fired twice and i2 once
		assert.strictEqual(observed.length, 3);
		assert.isTrue(observed[1].scheduleItem === 'i2' || observed[2].scheduleItem === 'i2');

		assert.isTrue(s.hasSchedule(i1));
		assert.isTrue(s.hasInterval(i2));
		const r = s.removeAllSchedules();

		assert.strictEqual(r.length, 2);
		assert.isTrue((r[0] === i1 && r[1] === i2) || (r[0] === i2 && r[1] === i1));
		
		assert.isFalse(s.hasInterval(i1));
		assert.isFalse(s.hasSchedule(i2));
	});

	it('should honor disabled intervals and not execute them', async() => {
		const s = new IntervalScheduler();

		let cnt = 0;
		const i1 = new Interval(200, () => cnt++, -1, false, false, false);

		s.addInterval(i1);
		await timeout(500);

		assert.strictEqual(cnt, 0);

		i1.isEnabled = true
		await timeout(400);
		assert.strictEqual(cnt, 2);

		s.removeInterval(i1);
	});

	it('should trigger special Intervals once if requested', async() => {
		const is = new IntervalScheduler();
		const i = new Interval(25, () => 42, 1, true, true, true);
		is.addInterval(i);

		await timeout(75);
		assert.strictEqual(i.numOccurred, 1);
		is.removeInterval(i);

		const i2 = new Interval(25, () => 43, 1, true, true, false);
		is.addInterval(i2);
		await timeout(75);
		assert.strictEqual(i2.numOccurred, 0);
		i2.enabled = true;
		is._scheduleInterval(Object.keys(is._intervalIds)[0], i2);
		await timeout(50);
		assert.strictEqual(i2.numOccurred, 1);
		is.removeInterval(i2);
	});

	it('should be possible to observe only particular schedules', async function() {
		const s = new IntervalScheduler();

		const i1 = new Interval(
			150, async () => {await timeout(1); return 'i1'}, 3, true, true);
		const i2 = new Interval(
			75, async () => {await timeout(1); return 'i2'}, -1, true, true);

		s.addInterval(i1);
		s.addInterval(i2);

		/** @type {Array.<IntervalEventSimple>} */
		const obs_all = [];
		/** @type {Array.<IntervalEventSimple>} */
		const obs_i1 = [];

		let obs_i1_finished = false;
		/** @type {Array.<IntervalEventSimple>} */
		const obs_i1_separate = [];
		const i1_observable = s.getObservableForSchedule(i1);
		i1_observable.subscribe(i => obs_i1_separate.push(i),
			e => { throw e; }, () => obs_i1_finished = true);

		s.observable.subscribe(i => {
			if (i.schedule === i1) {
				obs_i1.push(i);
			}
			obs_all.push(i);
		}, e => { throw e; }, () => { throw 'should never complete!'; });

		await timeout(1100); // i1 = 3x, i2 = 12-14x

		assert.isAbove(obs_all.length, 13); // 15 or more, but due to tight timings we require only 13 or more
		assert.strictEqual(obs_i1.length, 3);

		assert.strictEqual(obs_i1_separate.length, 3);
		assert.isTrue(obs_i1_separate.filter(i => i.schedule === i1).length === 3);
		assert.isTrue(obs_i1_finished);

		obs_i1_finished = false;
		s.getObservableForSchedule(i1).subscribe(() =>{
			throw new Error('This should not happen.');
		}, e => { throw e; }, () => {
			obs_i1_finished = true;
		});

		await timeout(5);
		assert.isTrue(obs_i1_finished);

		s.removeInterval(i1);
		s.removeInterval(i2);
	});

	it('should be possible to schedule limited intervals', async function() {
		const s = new IntervalScheduler();

		const i1 = new Interval(
			100, async () => {await timeout(1); return 'i1'}, 3, true, true);

		s.addInterval(i1);

		/** @type {Array.<IntervalEventSimple>} */
		const obs_all = [];

		s.observable.subscribe(i => {
			obs_all.push(i);
		}, e => { throw e; }, () => { throw 'should never complete!'; });
		
		await timeout(550);
		assert.strictEqual(obs_all.length, 3);

		obs_i1_finished = false;
		s.getObservableForSchedule(i1).subscribe(() =>{
			throw new Error('This should not happen.');
		}, e => { throw e; }, () => {
			obs_i1_finished = true;
		});

		await timeout(5);
		assert.isTrue(obs_i1_finished);

		s.removeInterval(i1);
	});

	it('should provide preliminary events according to the settings', done => {
		// triggerInitially=true, maxNum = 3
		const i = new Interval(50, null, 3, true, true);
		const exR = /after and\/or before must be Date objects. Interval does not support unbounded intervals./i;

		assert.throws(() => {
			[...i.preliminaryEvents()];
		}, exR);
		assert.throws(() => {
			[...i.preliminaryEvents(new Date)];
		}, exR);
		assert.throws(() => {
			[...i.preliminaryEvents(void 0, new Date)];
		}, exR);
		assert.throws(() => {
			const st = new Date;
			// start after end..
			[...i.preliminaryEvents(new Date(+st + 100), new Date(+st))];
		}, /The Date for after happens after the Date for before./i);

		// trigger once + once within the 75 msecs
		let start = new Date;
		let pEvents = [...i.preliminaryEvents(start, new Date(+start + 75))];
		assert.strictEqual(pEvents.length, 2);
		assert.strictEqual(+pEvents[0].dateTime, +start);
		assert.strictEqual(+pEvents[1].dateTime, +start + 50);

		pEvents = [...i.preliminaryEvents(start, new Date(+start + 5000))];
		assert.strictEqual(pEvents.length, 3); // maxNumTriggers..

		// Now let's disable triggerInitially..
		i.triggerInitially = false;
		pEvents = [...i.preliminaryEvents(start, new Date(+start + 75))];
		assert.strictEqual(pEvents.length, 1);
		assert.strictEqual(+pEvents[0].dateTime, +start + 50);

		done();
	});

	it('should provide preliminary events of all of its schedules', done => {
		const s = new IntervalScheduler();
		const i1 = new Interval(50, null, 3, true, true);
		const i2 = new Interval(30, null, 3, true, false); // triggerInit=false

		s.addInterval(i1).addSchedule(i2);

		const start = new Date;
		const pEvents = [...s.preliminaryEvents(start, new Date(+start + 75))]
			.sort((p1, p2) => +p1.dateTime < +p2.dateTime ? -1 : 1);
		assert.strictEqual(pEvents.length, 4);
		assert.strictEqual(pEvents[0].schedule, i1);
		assert.strictEqual(pEvents[1].schedule, i2);
		assert.strictEqual(pEvents[2].schedule, i1);
		assert.strictEqual(pEvents[3].schedule, i2);

		s.removeAllSchedules();

		done();
	});
});