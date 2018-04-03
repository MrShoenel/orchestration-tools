const { assert, expect } = require('chai')
, { deferMocha, timeout } = require('../tools/Defer')
, { Job, JobQueue, symbolRun, symbolDone, symbolFailed } = require('../lib/JobQueue');


describe('JobQueue', () => {
  it('should throw if given invalid parameters', () => {
    assert.throws(() => {
      new Job('foo');
    });
    assert.throws(() => {
      new JobQueue(0);
    });
    assert.throws(() => {
      new JobQueue(-15);
    });
  });

  it('should behave as a 1-capacity serial fifo-queue if not used parallel', async function() {
    this.timeout(600);
    let firstJobFinished = false, secondJobStarted = false;

    const q = new JobQueue(1);
    assert.isTrue(!q.isBusy && !q.isWorking, 'The queue should not be busy or working.');
    const job = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }));
    job.on(symbolDone, _ => {
      firstJobFinished = true;
      assert.isTrue(!secondJobStarted, 'The second job should not have been started yet.');
    });

    q.addJob(job);
    await timeout(50);
    // The Job should have been started in the meantime..
    assert.isTrue(q.isBusy && q.isWorking, 'The queue should be busy and working here.');

    const secondJob = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }));
    secondJob.on(symbolRun, () => secondJobStarted = true);
    
    q.addJob(secondJob);
    await timeout(50);
    assert.isTrue(!firstJobFinished && !secondJobStarted,
      'The first Job should not be finished and the second must not have started');

    await secondJob.donePromise;
  });

  it('should be able to process jobs in parallel', async function() {
    this.timeout(600);

    const q = new JobQueue(2);
    const j1 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }));
    const j2 = new Job(() => new Promise((resolve, reject) => {
      setTimeout(resolve, 250);
    }));

    q.addJob(j1);
    await timeout(50);
    assert.isTrue(q.isWorking && !q.isBusy && !j1.isDone);
    q.addJob(j2);
    await timeout(50);
    assert.isTrue(q.isWorking && q.isBusy);

    await timeout(250);
    assert.isTrue(!q.isWorking && j1.isDone && j2.isDone);
  });
});
