const { defer } = require('../tools/Defer')
, EventEmitter = require('events').EventEmitter
, Rx = require('rxjs')
, Observable = Rx.Observable
, { Progress } = require('./Progress')
, { ProcessWrapper } = require('./ProcessWrapper')
, symbolRun = Symbol('run')
, symbolDone = Symbol('done')
, symbolFailed = Symbol('failed');



class JobEvent {
  /**
   * @param {Job} job 
   * @param {Error|any} error 
   */
  constructor(job, error = void 0) {
    this.job = job;
    this.error = error;
  };
};



/**
 * The events emitted are (using the declared/exported symbols and the
 * class JobEvent):
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

    /** @type {number} */
    this._cost = void 0;

    /** @type {Observable.<JobEvent>} */
    this.observableRun = Object.freeze(Observable.fromEvent(this, symbolRun));
    /** @type {Observable.<JobEvent>} */
    this.observableDone = Object.freeze(Observable.fromEvent(this, symbolDone));
    /** @type {Observable.<JobEvent>} */
    this.observableFailed = Object.freeze(Observable.fromEvent(this, symbolFailed));
  };

  /**
   * Creates a job from a synchronous function by wrapping it into an
   * async function.
   * 
   * @param {Function} func A function that does synchronous work and
   * returns a value (i.e. its result is not awaited).
   * @returns {Job}
   */
  static fromSyncFunction(func) {
    if (!(func instanceof Function)) {
      throw new Error(`The parameter func must be of type Function.`);
    }

    return new Job(async() => {
      return func();
    });
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

  get hasCost() {
    return !isNaN(this._cost) && this._cost > 0;
  };

  /**
   * @param {number|undefined} [value] the new value to use as cost. Set to undefined to
   * disable the usage of cost.
   */
  set cost(value = void 0) {
    if (value === void 0 || (!isNaN(value) && value > 0)) {
      this._cost = value;
    } else {
      throw new Error(`The cost given was '${value}' but only undefined or positive numbers are supported.`);
    }
  };

  /**
   * @returns {number|undefined}
   */
  get cost() {
    return this._cost;
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
    this.emit(symbolRun, new JobEvent(this));
    this._isRunning = true;
    try {
      const promise = this._promiseProducer();
      if (!(promise instanceof Promise)) {
        throw new Error(`The promiseProducer does not produce a Promise or is not an async function.`);
      }
      this._result = await promise;
      this._isDone = true;
      this._hasFailed = false;
      this._isRunning = false;
      this._deferred.resolve(this.result);
      this.emit(symbolDone, new JobEvent(this));
      return this.result;
    } catch (e) {
      this._isDone = false;
      this._hasFailed = true;
      this._isRunning = false;
      this._deferred.reject(e);
      this.emit(symbolFailed, new JobEvent(this, e));
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
 * This class is used as event that is emitted by the JobQueue.
 */
class JobQueueEvent {
  /**
   * 
   * @param {JobQueue} queue 
   * @param {Job} job 
   * @param {Error|any} error 
   */
  constructor(queue, job, error = void 0) {
    this.queue = queue;
    this.job = job;
    this.error = error;
  };
};



/**
 * A standard queue for jobs that can handle parallel jobs up to a
 * specified degree of parallelism. This queue will run jobs whenever
 * there is space on it (i.e. it cannot be paused/resumed). Emits the
 * same events as Job using the class JobQueueEvent.
 */
class JobQueue extends EventEmitter {
  constructor(numParallel = 1) {
    super();

    if (isNaN(numParallel) || !isFinite(numParallel) || numParallel < 1) {
      throw new Error(`The value "${numParallel}" for the parameter numParallel is invalid. Only positive integers may be supplied.`);
    }
    /** @type {Array.<Job>} */
    this.queue = [];
    /** @type {Array.<Job>} */
    this.currentJobs = [];

    this.numParallel = numParallel;

    /** @type {Observable.<JobQueueEvent>} */
    this.observableRun = Object.freeze(Observable.fromEvent(this, symbolRun));
    /** @type {Observable.<JobQueueEvent>} */
    this.observableDone = Object.freeze(Observable.fromEvent(this, symbolDone));
    /** @type {Observable.<JobQueueEvent>} */
    this.observableFailed = Object.freeze(Observable.fromEvent(this, symbolFailed));
  };

  /**
   * @returns {number} a number that represents the ratio between all current
   * and enqueued jobs and this queue's parallelism. Numbers greater 1 indicate
   * that there are jobs in the backlog. 0 Means the queue is idle and 1 means
   * that it is using it's full degree of parallelism and no jobs are waiting.
   */
  get load() {
    const numJobs = this.backlog + this.currentJobs.length;
    return numJobs / this.numParallel;
  };

  /**
   * @returns {number} The amount of jobs on this queue that are waiting
   * to be processed.
   */
  get backlog() {
    return this.queue.length;
  };

  /**
   * @returns {boolean} true if there are no jobs currently processing.
   */
  get isIdle() {
    return this.currentJobs.length === 0;
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
   * Removes all jobs from the backlog and returns them.
   * 
   * @template T
   * @returns {Array.<Job.<T>>} an array with all not yet run jobs.
   */
  clearBacklog() {
    return this.queue.splice(0, this.queue.length);
  };

  /**
   * @template T
   * @param {Job.<T>|(() => Promise.<T>)} job 
   */
  addJob(job) {
    if (!(job instanceof Job)) {
      if (job instanceof Function) {
        job = new Job(job);
      } else {
        throw new Error(`The given Job is not an instance of Job nor is it an instance of Function.`);
      }
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
    this.emit(symbolRun, new JobQueueEvent(this. nextJob));
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
      this.emit(symbolDone, new JobQueueEvent(this, nextJob));
      finalFunc();
    }).catch(err => {
      this.emit(symbolFailed, new JobQueueEvent(this, nextJob, err));
      finalFunc();
    });
  };
};

module.exports = Object.freeze({
  symbolRun,
  symbolDone,
  symbolFailed,
  JobEvent,
  Job,
  JobQueueEvent,
  JobQueue
});