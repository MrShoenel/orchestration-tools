const { assert, expect } = require('chai')
, { deferMocha, timeout } = require('../tools/Defer')
, { Job, JobQueue } = require('../lib/JobQueue')
, { ProgressNumeric } = require('../lib/Progress');


describe('Progress', () => {
  it('should throw if given invalid parameters', () => {
    assert.throws(() => {
      new ProgressNumeric(2, 1);
    });
    assert.throws(() => {
      new ProgressNumeric(-1, 1);
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
    }), p);

    const jobPromise = j.run();

    await timeout(10);
    assert.equal(j.progress, 0);
    await timeout(60);
    assert.approximately(j.progress, 0.5, 1e-12);
    await jobPromise;
    await timeout(5);
    assert.equal(j.progress, 1);
  });
});
