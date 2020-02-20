const { defer } = require('../tools/Defer')
, { wrapError } = require('../tools/Error')
, EventEmitter = require('events').EventEmitter
, { Observable, Subscription, fromEvent } = require('rxjs')
, { Progress } = require('./Progress')
, { ProcessWrapper } = require('./ProcessWrapper')
, { Queue, ConstrainedQueue } = require('./collections/Queue')
, { EqualityComparer } = require('./collections/EqualityComparer')
, { DictionaryMapBased } = require('./collections/Dictionary')
, symbolRun = Symbol('run')
, symbolDone = Symbol('done')
, symbolFailed = Symbol('failed')
, symbolIdle = Symbol('idle');



class JobEvent {
  /**
   * @param {Job} job 
   * @param {Error|any} error 
   */
  constructor(job, error = void 0) {
    this.job = job;
    /** @type {Error|null} */
    this.error = error ? wrapError(error) : null;
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
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Job extends EventEmitter {
  /**
   * @param {() => Promise.<T>} promiseProducer A function returning a Promise
   * or an async function (essentially the same). If you want to use a sync
	 * function, call Job::fromSyncFunction(fn) instead.
	 * @param {String} [name] Optional. Defaults to undefined. Give an optional
	 * name to this job.
	 * @see {fromSyncFunction()}
   */
  constructor(promiseProducer, name = void 0) {
    super();
    if (!(promiseProducer instanceof Function)) {
      throw new Error(`The given promiseProducer is not a function.`);
    }
		this._promiseProducer = promiseProducer;
    this._name = name;
    this._wasStarted = false;
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
    this.observableRun = Object.freeze(fromEvent(this, symbolRun));
    /** @type {Observable.<JobEvent>} */
    this.observableDone = Object.freeze(fromEvent(this, symbolDone));
    /** @type {Observable.<JobEvent>} */
    this.observableFailed = Object.freeze(fromEvent(this, symbolFailed));

    this._createTime = new Date();
    /** @type {Date} */
    this._startTime = null;
    /** @type {Date} */
    this._stopTime = null;

    /** @type {DictionaryMapBased.<any, any>} */
    this._properties = new DictionaryMapBased();
  };

  /**
   * @returns {DictionaryMapBased.<any, any>} A map with arbitrary properties or date
   * associated with this Job.
   */
  get properties() {
    return this._properties;
  };

  /**
   * @returns {Boolean} True, iff this Job was started. This is also true for done or
   * failed Jobs or those that are currently running.
   */
  get wasStarted() {
    return this._wasStarted;
  };

  /**
   * @returns {Boolean} True, iff this Job was previously started and is now either
   * done or has failed.
   */
  get isStopped() {
    return this._isDone || this._hasFailed;
  };
  
  /**
   * @returns {Date} The timestamp of when this Job was created.
   */
  get createTime() {
    return new Date(+this._createTime);
  };

  /**
   * @returns {Date} The timestamp of when this Job was started.
   * @throws {Error} If the Job was not yet started.
   */
  get startTime() {
    if (!this.wasStarted ) {
      throw new Error('This Job was not yet started.');
    }
    return new Date(+this._startTime);
  };

  /**
   * @returns {Date} The timestamp of when this Job was stopped (when it finished
   * with success or failed).
   * @throws {Error} If the Job was not yet stopped.
   */
  get stopTime() {
    if (!this.isStopped) {
      throw new Error('This Job has not yet stopped.');
    }
    return new Date(+this._stopTime);
  };

  /**
   * @returns {Number} Amount of milliseconds between start- and stop-time of this
   * Job. If the Job was not yet started, returns 0. If it is still running, returns
   * the time between start and now, otherwise between start and stop.
   */
  get runDurationMs() {
    if (!this.wasStarted) {
      return 0;
    }
    const stopDate = this.isStopped ? this.stopTime : new Date();
    return (stopDate) - (+this.startTime);
  };
	
	/**
	 * @returns {undefined|String} The name of this Job.
	 */
  get name() {
    return this._name;
  };

  /**
   * @param {undefined|String} value The name of this Job.
   * @throws {Error} If the value is neither undefined nor a string.
   */
  set name(value) {
    if (value !== void 0 && typeof value !== 'string') {
      throw new Error(`The given value for name must be undefined or a string.`);
    }
    this._name = value;
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
   * @returns {Progress.<TProgress>} The Progress-instance of type TProgress.
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
    if (Object.prototype.toString.call(value) === '[object Number]' && !isNaN(value) && value > 0) {
      this._cost = value;
    } else if (value === void 0) {
      this._cost = void 0;
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

  /**
   * @returns {Boolean}
   */
  get isDone() {
    return this._isDone;
  };

  /**
   * @returns {Boolean}
   */
  get hasFailed() {
    return this._hasFailed;
  };

  /**
   * @returns {Boolean}
   */
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
    /* Someone has to catch this Promise and it's not guaranteed that some 3rd party
     * is observing this. If so, then this empty handler will not interfere with it
     * but make sure that we do not get unhandled promise-rejection warnings. */
    this.donePromise.catch(_ => {});
    
    this._startTime = new Date();
    this._wasStarted = true;
    this._isRunning = true;
    // Only emit this when we changed this Job's state to running.
    this.emit(symbolRun, new JobEvent(this));

    try {
      const promise = this._promiseProducer();
      if (!(promise instanceof Promise)) {
        throw new Error(`The promiseProducer does not produce a Promise or is not an async function.`);
      }
      this._result = await promise;
      this._isDone = true;
      this._hasFailed = false;
      this._deferred.resolve(this.result);
      this.emit(symbolDone, new JobEvent(this));
      return this.result;
    } catch (e) {
      this._isDone = false;
      this._hasFailed = true;
      this._deferred.reject(e);
      this.emit(symbolFailed, new JobEvent(this, e));
      throw e;
    } finally {
      this._isRunning = false;
      this._stopTime = new Date();
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

    const job = new Job(() => new Promise((resolve, reject) => {
      const obs = processWrapper.runObservable();
      const subs = obs.subscribe(
        procOut => progress.reportProgress(procOut),
        procErr => {
          subs.unsubscribe();
          reject(procErr);
        },
        () => resolve(processWrapper.result)
      );
    }));

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
   * @param {Error|any} [error] Optional. Defaults to undefined.
   */
  constructor(queue, job, error = void 0) {
    this.queue = queue;
    this.job = job;
    /** @type {Error|null} */
    this.error = error ? wrapError(error) : null;
  };
};



/**
 * A standard queue for jobs that can handle parallel jobs up to a
 * specified degree of parallelism. This queue will run jobs whenever
 * there is space on it (i.e. it cannot be paused/resumed). Emits the
 * same events as Job using the class JobQueueEvent.
 */
class JobQueue extends EventEmitter {
  /**
   * 
   * @param {number} [numParallel] Optional. Defaults to 1. 
   */
  constructor(numParallel = 1) {
    super();

    if (isNaN(numParallel) || !isFinite(numParallel) || numParallel < 1) {
      throw new Error(`The value "${numParallel}" for the parameter numParallel is invalid. Only positive integers may be supplied.`);
    }
    /** @type {Queue.<Job>} */
    this.queue = new Queue();
    /** @type {ConstrainedQueue.<Job>} */
    this.currentJobs = new ConstrainedQueue(numParallel);

    this.numParallel = numParallel;

    /** @type {Observable.<JobQueueEvent>} */
    this.observableRun = Object.freeze(fromEvent(this, symbolRun));
    /** @type {Observable.<JobQueueEvent>} */
    this.observableDone = Object.freeze(fromEvent(this, symbolDone));
    /** @type {Observable.<JobQueueEvent>} */
    this.observableFailed = Object.freeze(fromEvent(this, symbolFailed));
    /** @type {Observable.<JobQueueEvent>} */
    this.observableIdle = Object.freeze(fromEvent(this, symbolIdle));

    this._isPaused = false;

    this._workDone = 0;
    this._workFailed = 0;
    this._numJobsDone = 0;
    this._numJobsFailed = 0;
  };

  /**
   * @returns {number} A value indicating how much work has been done in terms
   * of number of Jobs or their cost, depending on the queue's type.
   */
  get workDone() {
    return this._workDone;
  };

  /**
   * @returns {number} A value indicating how much work has been failed in terms
   * of number of Jobs or their cost, depending on the queue's type.
   */
  get workFailed() {
    return this._workFailed;
  };

  /**
   * @returns {number} A value indicating how many Jobs have been done.
   */
  get numJobsDone() {
    return this._numJobsDone;
  };

  /**
   * @returns {number} A value indicating how many Jobs have failed.
   */
  get numJobsFailed() {
    return this._numJobsFailed;
  };

  /**
   * @returns {Boolean}
   */
  get isPaused() {
    return this._isPaused;
  };

  /**
   * Pauses this queue, which results in no Jobs being further pushed on the
   * internal processing queue. Note that already running jobs cannot be
   * paused. If the queue is currently busy, you need to wait for the Idle-
   * event by subscribing to the Observable.
   * 
   * @see {symbolIdle}
   * @see {this.observableIdle}
   * @returns {this}
   */
  pause() {
    this._isPaused = true;
    setTimeout(() => {
      if (this.isPaused && this.isIdle) {
        this.emit(symbolIdle, new JobQueueEvent(this));
      }
    }, 0);
    return this;
  };

  /**
   * Un-pauses this queue and immediately checks for work that can be done.
   * 
   * @returns {this}
   */
  resume() {
    this._isPaused = false;
    setTimeout(this._runNext.bind(this), 0);
    return this;
  };

  /**
   * Runs all jobs currently enqueued and then resolves when all are done. If
   * the queue was paused, it will be resumed. Adding more jobs while this call
   * is not resolved will defer it.
   * 
   * @returns {Promise.<void>} That will resolve if the queue's current load
   * is 0 (no jobs running and none in the backlog) or once it reaches 0 (if
   * all currently enqueued jobs are done). The Promise is rejected if any of
   * the jobs fails.
   */
  runToCompletion() {
    return new Promise((resolve, reject) => {
      const checkDone = () => {
        if (this.load === 0) {
          this.emit(symbolIdle, new JobQueueEvent(this));
          resolve();
          return true;
        }
        return false;
      };

      if (checkDone()) {
        return;
      }

      /** @type {Array.<Subscription>} */
      const subscriptions = [];

      const unsubscribeAll = () => {
        subscriptions.forEach(subs => subs.unsubscribe());
      };

      subscriptions.push(this.observableDone.subscribe(jqEvt => {
        if (checkDone()) {
          unsubscribeAll();
        }
      }));

      subscriptions.push(this.observableFailed.subscribe(jqEvt => {
        unsubscribeAll();
        reject(jqEvt.error);
      }));

      this.resume();
    });
  };

  /**
   * @returns {number} A number that represents the ratio between all current
   * and enqueued jobs and this queue's parallelism. Numbers greater 1 indicate
   * that there are jobs in the backlog. 0 Means the queue is idle and 1 means
   * that it is using its full degree of parallelism and no jobs are waiting.
   */
  get load() {
    const numJobs = this.backlog + this.numJobsRunning;
    return numJobs / this.numParallel;
  };

  /**
   * @returns {number} A number indicating the queue's utilization in terms
   * of a ratio of how many jobs are currently running and how many could be
   * run. This number is therefore in the range [0, 1]. Unlike load, this
   * property does not consider jobs in the backlog.
   */
  get utilization() {
    return this.numJobsRunning / this.numParallel;
  };

  /**
   * @returns {number} The amount of jobs currently running.
   */
  get numJobsRunning() {
		return this.currentJobs.size;
  };

  /**
   * @returns {number} The amount of jobs on this queue that are waiting
   * to be processed.
   */
  get backlog() {
		return this.queue.size;
  };

  /**
   * @returns {boolean} True if there are no jobs currently processing.
   */
  get isIdle() {
    return this.numJobsRunning === 0;
  };

  /**
   * @returns {boolean} True if there are any current jobs running.
   */
  get isWorking() {
    return this.numJobsRunning > 0;
  };

  /**
   * @returns {boolean} True iff the queue is busy and all of its slots
   * are currently used actively by jobs (the number of active jobs is
   * equal to maximum degree of parallelism).
   */
  get isBusy() {
    return this.numJobsRunning === this.numParallel;
  };

  /**
   * Removes all jobs from the backlog and returns them.
   * 
   * @template T
   * @returns {Array.<Job.<T>>} An array with all not yet run jobs.
   */
  clearBacklog() {
		const backlogJobs = Array.from(this.queue.entries());
    this.queue.clear();
		return backlogJobs;
  };

  /**
   * Determines if a specific Job is on the backlog of this JobQueue.
   * 
   * @param {Job.<T>} job The job to check for
   * @param {EqualityComparer.<Job.<T>>} [eqComparer] Optional. A comparer
   * to use for checking for equality. Defaults to the DefaultEqualityComparer
   * which uses the identity operator.
   * @returns {Boolean} True, iff the Job is in the backlog.
   */
  hasJob(job, eqComparer = EqualityComparer.default) {
    return this.queue.has(job, eqComparer);
  };

  /**
   * Determines if a specific Job is currently runnung on this JobQueue.
   * 
   * @param {Job.<T>} job The Job to check for
   * @param {EqualityComparer.<Job.<T>>} [eqComparer] Optional. A comparer
   * to use for checking for equality. Defaults to the DefaultEqualityComparer
   * which uses the identity operator.
   * @returns {Boolean} True, iff this JobQueue is currently processing
   * the given job.
   */
  isJobRunning(job, eqComparer = EqualityComparer.default) {
    return this.currentJobs.has(job, eqComparer);
  };

  /**
   * 
   * @param {Job.<T>} job The Job to remove from the backlog.
   * @param {EqualityComparer.<Job.<T>>} [eqComparer] Optional. A comparer
   * to use for checking for equality. Defaults to the DefaultEqualityComparer
   * which uses the identity operator.
   * @returns {this}
   */
  removeJobFromBacklog(job, eqComparer = EqualityComparer.default) {
    this.queue.takeOutItem(job, eqComparer);
    return this;
  };

  /**
   * @template T
   * @param {() => T} job A synchronous function to be used as a Job.
   * @returns {this}
   */
  addSyncJob(job) {
    return this.addJob(Job.fromSyncFunction(job));
  };

  /**
   * @template T
   * @param {...(() => T)} jobs Many synchronous functions to add as Jobs.
   * @returns {this}
   */
  addSyncJobs(...jobs) {
    jobs.forEach(job => this.addSyncJob(job));
    return this;
  };

  /**
   * Add a Job to this Queue. Can either be an instance of Job or an
   * async function.
   * 
   * @template T
   * @param {Job.<T>|(() => Promise.<T>)} job
   * @returns {this}
   */
  addJob(job) {
    if (!(job instanceof Job)) {
      if (job instanceof Function) {
        job = new Job(job);
      } else {
        throw new Error(`The given Job is not an instance of Job nor is it an instance of Function.`);
      }
		}
		
		this.queue.enqueue(job);
    setTimeout(this._runNext.bind(this), 0);
    return this;
  };

  /**
   * @template T
   * @param {...(Job.<T>|(() => Promise.<T>))} jobs
   * @returns {this}
   */
  addJobs(...jobs) {
    jobs.forEach(job => this.addJob(job));
    return this;
  };

  _runNext() {
    if (this.isPaused) {
      if (this.isIdle) {
        this.emit(symbolIdle, new JobQueueEvent(this));
      }
      return;
    }

    if (this.isBusy) {
      return;
		}
		
		if (this.queue.isEmpty) {
      return;
    }
    
		const nextJob = this.queue.dequeue();
    
    const finalFunc = (() => {
			this.currentJobs.takeOutItem(nextJob);
      setTimeout(this._runNext.bind(this), 0);
		}).bind(this);
		
		this.currentJobs.enqueue(nextJob);
    
    nextJob.run().then(val => {
      this._numJobsDone++;
      this._workDone += (nextJob.hasCost ? nextJob.cost : 1);
      finalFunc();
      this.emit(symbolDone, new JobQueueEvent(this, nextJob));
    }).catch(err => {
      this._numJobsFailed++;
      this._workFailed += (nextJob.hasCost ? nextJob.cost : 1);
      finalFunc();
      this.emit(symbolFailed, new JobQueueEvent(this, nextJob, err));
    });

    // Emit now, after having called Job::run()
    this.emit(symbolRun, new JobQueueEvent(this, nextJob));
  };
};

module.exports = Object.freeze({
  symbolRun,
  symbolDone,
  symbolFailed,
  symbolIdle,
  JobEvent,
  Job,
  JobQueueEvent,
  JobQueue
});