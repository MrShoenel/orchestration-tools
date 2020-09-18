const { assert, expect } = require('chai')
, { timeout } = require('../tools/Defer')
, { assertThrowsAsync } = require('../tools/AssertAsync')
, { Schedule, ScheduleEvent, PreliminaryScheduleEvent } = require('../lib/Schedule')
, { ManualSchedule, ManualScheduler, ManualScheduleEventSimple, symbolManualSchedulerEvent
	} = require('../lib/ManualScheduler');


describe('ManualScheduler', () => {
	it('should throw if given invalid parameters', () => {
		const scheduler = new ManualScheduler();

		assert.throws(() => {
			scheduler._isManualSchedule(42);
		});

		assert.throws(() => {
			scheduler._getManualScheduleId(new ManualSchedule());
		});

		assert.throws(() => {
			const m = new ManualSchedule();
			scheduler.manualSchedules.push(m);
			scheduler._getManualScheduleId(m);
		});
		scheduler.manualSchedules.pop();

		assert.throws(() => {
			m = new ManualSchedule()
			scheduler.addManualSchedule(m);
			scheduler.addManualSchedule(m);
		});

		assert.throws(() => {
			scheduler.removeManualSchedule(new ManualSchedule());
		});

		assert.throws(() => {
			m = new ManualSchedule(false);
			m.trigger(42);
		})
	});

	it('should be able to handle multiple different ManualSchedules', async function() {
		this.timeout(3000);
		const m = new ManualScheduler();

		/** @type {Array.<ManualScheduleEventSimple>} */
		const observed = [];
		m.observable.subscribe(val => observed.push(val));

		const m1 = new ManualSchedule();
		const m2 = new ManualSchedule();

		m.addManualSchedule(m1);
		m.addManualSchedule(m2);

		assert.isTrue(m.hasManualSchedule(m1));
		assert.isTrue(m.hasManualSchedule(m2));

		setTimeout(() => {
			m1.trigger('m1');
		}, 25);
		setTimeout(() => {
			m2.triggerNext('m2');
		}, 50);
		
		await timeout(75);
		assert.strictEqual(observed.length, 2);
		assert.strictEqual(observed[0].scheduleItem, 'm1');
		assert.strictEqual(observed[1].scheduleItem, 'm2');

		assert.isTrue(m.hasSchedule(m1));
		assert.isTrue(m.hasManualSchedule(m2));
		const r = m.removeAllSchedules();

		assert.strictEqual(r.length, 2);
		assert.isTrue((r[0] === m1 && r[1] === m2) || (r[0] === m2 && r[1] === m1));
		
		assert.isFalse(m.hasManualSchedule(m1));
		assert.isFalse(m.hasSchedule(m2));
	});

	it('should be possible to observe only particular schedules', async() => {
		const m = new ManualScheduler();

		/** @type {Array.<ManualScheduleEventSimple>} */
		const observed = [];

		const m1 = new ManualSchedule();
		const m2 = new ManualSchedule();

		m.addManualSchedule(m1).addManualSchedule(m2);

		m.getObservableForSchedule(m2).subscribe(next => {
			observed.push(next);
		});

		m1.trigger('m1_1');
		m2.trigger('m2_1');

		m1.trigger('m1_2');
		m2.trigger('m2_2');

		await timeout(50);

		assert.strictEqual(observed.length, 2);
		assert.strictEqual(observed[0].schedule, m2);
		assert.strictEqual(observed[0].scheduleItem, 'm2_1');
		assert.strictEqual(observed[1].schedule, m2);
		assert.strictEqual(observed[1].scheduleItem, 'm2_2');
		
		m.removeManualSchedule(m1);
		m.removeManualSchedule(m2);
	});

	it('should not forward errors from schedules or complete', async() => {
		const s = new ManualScheduler();
		const m = new ManualSchedule();
		s.addSchedule(m);

		let hadErrorS = false;
		let wasCompleteS = false;
		s.observable.subscribe(() =>{}, err => {
			hadErrorS = true;
		}, () => wasCompleteS = true);

		let hadErrorM = false;
		let wasCompleteM = false;
		s.getObservableForSchedule(m).subscribe(() =>{}, err => {
			hadErrorM = true;
		}, () => wasCompleteM = true);

		m.triggerError(42);

		await timeout(50);
		assert.isFalse(hadErrorS);
		assert.isTrue(hadErrorM);
		assert.isFalse(wasCompleteM);

		m.triggerComplete();
		await timeout(50);
		assert.isFalse(wasCompleteM);
		assert.isFalse(wasCompleteS);

		let m2Complete = false;
		const m2 = new ManualSchedule();
		s.addSchedule(m2).getObservableForSchedule(m2).subscribe(()=>{},e=>{}, () => m2Complete = true);
		m2.triggerComplete();

		await timeout(50);
		assert.isTrue(m2Complete);
		assert.isFalse(wasCompleteS);

		s.removeSchedule(m);
	});

	it('should provide preliminary events of all of its schedules', done => {
		const ms = new ManualScheduler();
		ms.addSchedule(new ManualSchedule(true));

		// There are no preliminary events for ManualSchedule and ManualScheduler.
		// However, sub-classes of ManualSchedule may yield preliminary events.
		let pEvents = [...ms.preliminaryEvents()];
		assert.isTrue(Array.isArray(pEvents));
		assert.strictEqual(pEvents.length, 0);


		class MySched extends ManualSchedule {
			constructor() {
				super(true);
				this.bla = 42;
			};

			/**
			 * @returns {IterableIterator.<PreliminaryScheduleEvent.<MySched, number>>}
			 */
			*preliminaryEvents() {
				while (this.bla <= 43) {
					yield new PreliminaryScheduleEvent(new Date, this, this.bla++);
				}
			};
		};

		ms.addManualSchedule(new MySched());
		pEvents = [...ms.preliminaryEvents()];
		assert.isTrue(Array.isArray(pEvents));
		assert.strictEqual(pEvents.length, 2);
		assert.strictEqual(pEvents[0].preliminaryItem, 42);
		assert.strictEqual(pEvents[1].preliminaryItem, 43);

		done();
	});
});