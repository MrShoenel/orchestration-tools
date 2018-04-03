const { assert, expect } = require('chai')
, { deferMocha, timeout } = require('../tools/Defer')
, { JobWithCost, JobQueueCapabilities } = require('../lib/JobQueueCapabilities')
, { symbolRun, symbolDone, symbolFailed } = require('../lib/JobQueue');



describe('JobQueueCapabilities', () => {
  it('should throw if given invalid parameters', () => {
    assert.throws(() => {
      new JobWithCost(() => { throw 'Bla'; }, 0);
    });
    assert.throws(() => {
      new JobQueueCapabilities(0);
    });
    assert.throws(() => {
      new JobQueueCapabilities(-1);
    });
    assert.throws(() => {
      const q = new JobQueueCapabilities(1, false);
      q.addJob(new JobWithCost(() => 'BLA', 1.1));
    });
  });

  it('should use the whole available capacity', async function() {
    const q = new JobQueueCapabilities(2.5, false);
    assert.isTrue(!q.allowExclusiveJobs && !q.isBusy && !q.isWorking);
    assert.approximately(q.capabilitiesFree, 2.5, 1e-12);

    const j1 = new JobWithCost(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 100);
    }), 0.9);
    const j2 = new JobWithCost(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }), 0.9);
    const j3 = new JobWithCost(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }), 0.8);

    q.addJob(j1);
    q.addJob(j2);
    q.addJob(j3);
    await timeout(50);
    assert.isTrue(j1.isRunning && j2.isRunning && !j3.isRunning);
    await timeout(75);
    assert.isTrue(j1.isDone && !j2.isDone && j2.isRunning && !j3.isDone && j3.isRunning);
  });

  it('should finish other jobs until there is enough capacity for an expensive job', async function() {
    const q = new JobQueueCapabilities(3.6, false);

    const j1 = new JobWithCost(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 100);
    }), 1.5);
    const j2 = new JobWithCost(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 125);
    }), 1.5);
    const j3 = new JobWithCost(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }), 3.55);

    q.addJob(j1).addJob(j2).addJob(j3);
    await timeout(50);
    assert.isTrue(j1.isRunning && j2.isRunning && !j3.isRunning && !j3.isDone);
    await timeout(60);
    assert.isTrue(j1.isDone && j2.isRunning && !j3.isRunning && !j3.isDone);
    await timeout(50)
    assert.isTrue(j1.isDone && j2.isDone && j3.isRunning);
  });

  it('should be able to run exclusive jobs that require the full capabilities', async function() {
    const q = new JobQueueCapabilities(3, true);

    const j1 = new JobWithCost(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 100);
    }), 2.5);
    const j2 = new JobWithCost(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 125);
    }), 10);

    q.addJob(j1).addJob(j2);
    await timeout(50);
    assert.isTrue(j1.isRunning && !j2.isRunning && !j2.isDone);
    assert.approximately(q.capabilitiesFree, 0.5, 1e-12);

    await timeout(75);
    assert.isTrue(j1.isDone && j2.isRunning);
    assert.strictEqual(q.capabilitiesFree, 0);

    await j2.donePromise;
    await timeout(10); // Give the queue the chance to clean up that done job
    assert.strictEqual(q.capabilitiesFree, 3);
    assert.isTrue(!q.isWorking && !q.isBusy && j2.isDone);
  });
});