const { assert, expect } = require('chai')
, { timeout } = require('../tools/Defer')
, { assertThrowsAsync } = require('../tools/AssertAsync')
, { Interval, IntervalScheduler } = require('../lib/IntervalScheduler');


describe('IntervalScheduler', () => {
  it('should throw if given invalid parameters', () => {
    assert.throws(() => new Interval(0, () => {}));
    assert.throws(() => new Interval(1));
  });

  it('should be able to handle multiple different Intervals', async() => {
    const s = new IntervalScheduler();

    const observed = [];
    s.observable.subscribe(val => observed.push(val));

    const i1 = new Interval(50, async () => {
      await timeout(25);
      return 'i1';
    }, true, true); // initial, wait
    const i2 = new Interval(75, () => 'i2', false, false); // no initial, no wait

    s.addInterval(i1);
    s.addInterval(i2);

    await timeout(30);
    assert.strictEqual(observed.length, 1);
    assert.strictEqual(observed[0], 'i1');

    await timeout(80); // now i1 should have fired twice and i2 once
    assert.strictEqual(observed.length, 3);
    assert.isTrue(observed[1] === 'i2' || observed[2] === 'i2');

    s.removeInterval(i1);
    s.removeInterval(i2);
  });

  it('should honor disabled intervals and not execute them', async() => {
    const s = new IntervalScheduler();

    let cnt = 0;
    const i1 = new Interval(20, () => cnt++, false, false, true);

    s.addInterval(i1);
    await timeout(50);

    assert.strictEqual(cnt, 0);

    i1.isDisabled = false;
    await timeout(40);
    assert.strictEqual(cnt, 2);

    s.removeInterval(i1);
  });
});