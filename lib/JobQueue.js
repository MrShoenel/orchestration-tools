const { defer } = require('../tools/Defer')
, { Rx } = require('rxjs')
, { Progress } = require('./Progress')
, EventEmitter = require('events').EventEmitter
, { ProcessWrapper } = require('./ProcessWrapper')
, symbolRun = Symbol('run')
, symbolDone = Symbol('done')
, symbolFailed = Symbol('failed');




/**
 * The events emitted are (using the declared/exported symbols):
 * - 'run' (immediately triggered before the job is run)
 * - 'done' (if successfully ran to completion, includes the result)
 * - 'failed' (if failed with an error, includes the error)
 * 
 * @template T
 */
class Job extends EventEmitter {
  /**
   * @template T
   * @param {() => Promise.<T>} promiseProducer A function returning a Promise
   * or an async function (essentially the same).
   */
  constructor(promiseProducer) {
    super();
    if (!(promiseProducer instanceof Function)) {
      throw new Error(`The given promiseProducer is not a function.`);
    }
    this._promiseProducer = promiseProducer;
    this._isRunning = false;
    this._isDone = false;
    this._hasFailed = false;
    /** @type {T} */
    this._result = void 0;
    this._deferred = defer();

    /** @type {Progress} */
    this._progressInstance = void 0;
  };

  /**
   * Use this setter to give this Job an instance of Progress that may be used
   * by the scheduler for this Job. This Job itself does not observe the instance
   * or subscribe to its observables.
   * 
   * @param {Progress} progress
   */
  set progress(progress) {
    if (!(progress instanceof Progress)) {
      throw new Error('The progress must be an instance of Progress.');
    }
    this._progressInstance = progress;
  };

  /**
   * @template TProgress
   * @returns {Progress} The Progress-instance of type TProgress.
   */
  get progress() {
    return this._progressInstance;
  };

  /**
   * @returns {boolean} Whether or not this Job is/was equipped with an instance of Progress.
   */
  get supportsProgress() {
    return this._progressInstance instanceof Progress;
  };

  get isDone() {
    return this._isDone;
  };

  get hasFailed() {
    return this._hasFailed;
  };

  get isRunning() {
    return this._isRunning;
  };

  /**
   * A promise that can be used to await this Job's final state.
   * If resolved, will resolve with this Job's result. The promise
   * returned by run() should only be used by the queue.
   * 
   * @template T
   * @returns {Promise.<T>}
   */
  get donePromise() {
    return this._deferred.promise;
  };

  /**
   * @template T
   * @returns {T}
   */
  get result() {
    if (!this.isDone) {
      throw new Error(`This job is not yet done or has failed.`);
    }
    return this._result;
  };

  /**
   * @template T
   * @returns {Promise.<T>} the Promise that will resolve with the
   * job's result.
   */
  async run() {
    this.emit(symbolRun);
    this._isRunning = true;
    try {
      const promise = this._promiseProducer();
      if (!(promise instanceof Promise)) {
        throw new Error(`The promiseProducer does not produce a Promise.`);
      }
      this._result = await promise;
      this._isDone = true;
      this._hasFailed = false;
      this._isRunning = false;
      this._deferred.resolve(this.result);
      this.emit(symbolDone, this.result);
      return this.result;
    } catch (e) {
      this._isDone = false;
      this._hasFailed = true;
      this._isRunning = false;
      this._deferred.reject(e);
      this.emit(symbolFailed, e);
      throw e;
    }
  };

  /**
   * Convenience function to create a Job from a ProcessWrapper. Once run, the
   * Job will run the ProcessWrapper as Observable. All observed output is then
   * reported as Progress, as the Job will be decorated with a Progress-instance
   * of type ProcessOutput.
   * 
   * @param {ProcessWrapper} processWrapper
   * @returns {Job}
   */
  static fromProcess(processWrapper) {
    const progress = new Progress();

    const job = new Job(async () => {
      const deferred = defer();

      const obs = processWrapper.runObservable();
      const subs = obs.subscribe(
        procOut => progress.reportProgress(procOut),
        procErr => {
          subs.unsubscribe();
          deferred.reject(procErr);
        },
        () => deferred.resolve(processWrapper.result)
      );

      return await deferred.promise;
    });

    job.progress = progress;
    return job;
  };
};




/**
 * A standard queue for jobs that can handle parallel jobs up to a
 * specified degree of parallelism. This queue will run jobs whenever
 * there is space on it (i.e. it cannot be paused/resumed).
 */
class JobQueue {
  constructor(numParallel = 1) {
    if (isNaN(numParallel) || !isFinite(numParallel) || numParallel < 1) {
      throw new Error(`The value "${numParallel}" for the parameter numParallel is invalid. Only positive integers may be supplied.`);
    }
    /** @type {Array.<Job>} */
    this.queue = [];
    /** @type {Array.<Job>} */
    this.currentJobs = [];

    this.numParallel = numParallel;
  };

  /**
   * @returns {boolean} true if there are any current jobs running.
   */
  get isWorking() {
    return this.currentJobs.length > 0;
  };

  /**
   * @returns {boolean} true iff the queue is busy and all of its slots
   * are currently used actively by jobs (the number of active jobs is
   * equal to maximum degree of parallelism).
   */
  get isBusy() {
    return this.currentJobs.length === this.numParallel;
  };

  /**
   * @param {() => Promise.<any>|Job} job
   * @returns {JobQueue} this
   */
  addJob(job) {
    if (!(job instanceof Job)) {
      job = new Job(job);
    }

    this.queue.push(job);
    setTimeout(this._runNext.bind(this), 0);
    return this;
  };

  _runNext() {
    if (this.isBusy) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }
    
    const nextJob = this.queue.shift();
    const promise = nextJob.run();
    if (!(promise instanceof Promise)) {
      throw new Error('This job does not produce a promise!');
    }

    this.currentJobs.push(nextJob);
    const finalFunc = (() => {
      this.currentJobs.splice(this.currentJobs.findIndex(j => j === nextJob), 1);
      setTimeout(this._runNext.bind(this), 0);
    }).bind(this);

    promise.then(val => {
      finalFunc();
    }).catch(err => {
      finalFunc();
      throw err;
    });
  };
};

module.exports = Object.freeze({
  symbolRun,
  symbolDone,
  symbolFailed,
  Job,
  JobQueue
});