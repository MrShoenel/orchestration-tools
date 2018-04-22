const { assert, expect } = require('chai')
, { deferMocha, timeout } = require('../tools/Defer')
, { Job } = require('../lib/JobQueue')
, { JobQueueCapabilities } = require('../lib/JobQueueCapabilities')
, { symbolRun, symbolDone, symbolFailed } = require('../lib/JobQueue');



describe('JobQueueCapabilities', () => {
  it('should throw if given invalid parameters', () => {
    assert.throws(() => {
      const j = new Job(() => { throw 'Bla'; });
      j.cost = 0;
    });
    assert.throws(() => {
      new JobQueueCapabilities(0);
    });
    assert.throws(() => {
      new JobQueueCapabilities(-1);
    });
    assert.throws(() => {
      const q = new JobQueueCapabilities(1, false);
      const j = new Job(() => 'BLA');
      j.cost =  1.1;
      q.addJob(j);
    });
  });

  it('should use the whole available capacity', async function() {
    const q = new JobQueueCapabilities(2.5, false);
    assert.isTrue(!q.allowExclusiveJobs && !q.isBusy && !q.isWorking);
    assert.approximately(q.capabilitiesFree, 2.5, 1e-12);

    const j1 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 100);
    }));
    j1.cost = 0.9;
    const j2 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }));
    j2.cost = 0.9;
    const j3 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }));
    j3.cost = 0.8;

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

    const j1 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 100);
    }));
    j1.cost = 1.5;
    const j2 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 150);
    }));
    j2.cost = 1.5;
    const j3 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }));
    j3.cost = 3.55;

    q.addJob(j1).addJob(j2).addJob(j3);
    await timeout(25);
    assert.isTrue(j1.isRunning && j2.isRunning && !j3.isRunning && !j3.isDone);
    await timeout(100);
    assert.isTrue(j1.isDone && j2.isRunning && !j3.isRunning && !j3.isDone);
    await timeout(150)
    assert.isTrue(j1.isDone && j2.isDone && j3.isRunning);
  });

  it('should be able to run exclusive jobs that require the full capabilities', async function() {
    const q = new JobQueueCapabilities(3, true);

    const j1 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 100);
    }));
    j1.cost = 2.5;
    const j2 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 125);
    }));
    j2.cost = 10;

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