const { assert, expect } = require('chai')
, { timeout } = require('../tools/Defer')
, { assertThrowsAsync } = require('../tools/AssertAsync')
, { Schedule, ScheduleEvent } = require('../lib/Schedule')
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
      m2.trigger('m2');
    }, 50);
    
    await timeout(75);
    assert.strictEqual(observed.length, 2);
    assert.strictEqual(observed[0].scheduleItem, 'm1');
    assert.strictEqual(observed[1].scheduleItem, 'm2');

    m.removeManualSchedule(m1);
    m.removeManualSchedule(m2);
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
});