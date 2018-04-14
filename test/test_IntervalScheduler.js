const { assert, expect } = require('chai')
, { timeout } = require('../tools/Defer')
, { assertThrowsAsync } = require('../tools/AssertAsync')
, { Interval, IntervalScheduler, IntervalEventSimple
  } = require('../lib/IntervalScheduler');


describe('IntervalScheduler', () => {
  it('should throw if given invalid parameters', () => {
    assert.throws(() => new Interval(0, () => {}));
    assert.throws(() => new Interval(1));
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

    await timeout(300);
    assert.strictEqual(observed.length, 1);
    assert.strictEqual(observed[0].scheduleItem, 'i1');

    await timeout(800); // now i1 should have fired twice and i2 once
    assert.strictEqual(observed.length, 3);
    assert.isTrue(observed[1].scheduleItem === 'i2' || observed[2].scheduleItem === 'i2');

    s.removeInterval(i1);
    s.removeInterval(i2);
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

    await timeout(1050); // i1 = 3x, i2 = 12-14x

    assert.isAbove(obs_all.length, 14); // 15 or more
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
});