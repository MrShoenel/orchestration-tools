const { assert, expect } = require('chai')
, { timeout } = require('../tools/Defer')
, { Job, JobQueue } = require('../lib/JobQueue')
, { Progress, ProgressNumeric } = require('../lib/Progress');


describe('Progress', () => {
  it('should throw if given invalid parameters', () => {
    assert.throws(() => {
      new ProgressNumeric(2, 1);
    });
    assert.throws(() => {
      new ProgressNumeric(-1, 1);
    });
    assert.throws(() => {
      new ProgressNumeric('-1', false);
    });

    const p = new ProgressNumeric(1, 10);
    assert.throws(() => {
      p.reportProgress(0.9)
    });
  });

  it('should report progress', async function() {
    const q = new JobQueue(1);
    const p = new ProgressNumeric(0, 1);
    const j = new Job(() => new Promise(async (resolve, reject) => {
      await timeout(5);
      p.reportProgress(0);
      await timeout(50);
      p.reportProgress(.5);
      await timeout(50);
      p.reportProgress(1);

      resolve();
    }));
    j.progress = p;

    assert.strictEqual(p.percent, 0);

    const jobPromise = j.run();

    await timeout(20);
    assert.equal(j.progress.last, 0);
    await timeout(60);
    assert.approximately(j.progress.last, 0.5, 1e-12);
    await jobPromise;
    await timeout(5);
    assert.equal(j.progress.last, 1);
  });

  it('should trigger our handler if we provide one', async function() {
    this.timeout(3500);
    let lastItem = null;
    const p = new Progress(progressItem => {
      lastItem = progressItem;
    });

    let wasObserved = false;
    p.observable.subscribe(evtItem => {
      expect(evtItem).to.deep.equal({ f: 42 });
      wasObserved = true;
    });

    p.reportProgress({ f: 42 });
    await timeout(25);
    assert.isTrue(lastItem !== null);
    expect(lastItem).to.deep.equal({ f: 42 });

    assert.isTrue(wasObserved);
  });
});
