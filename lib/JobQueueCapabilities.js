const {Job, JobQueue} = require('./JobQueue');


/**
 * @template T
 */
class JobWithCost extends Job {
  /**
   * @template T
   * @param {() => Promise.<T>} promiseProducer 
   * @param {number} cost a number that assigns a cost to this Job. If this
   * job is used in a queue that can handle jobs with cost, then this job will
   * only be run if the queue has enough free capabilities/resources to run it.
   */
  constructor(promiseProducer, cost) {
    super(promiseProducer);
    if (isNaN(cost) || cost <= 0) {
      throw new Error('The cost must be a positive number.');
    }
    this.cost = cost;
  };
};

class JobQueueCapabilities extends JobQueue {
  /**
   * @param {number} capabilities 
   * @param {boolean} allowExclusiveJobs boolean that indicates whether jobs
   * that require the whole queue's capabilities are allowed on this queue.
   * Such jobs have a cost equal to or higher than the queue's capabilities.
   */
  constructor(capabilities, allowExclusiveJobs = false) {
    super();
    if (isNaN(capabilities) || capabilities <= 0) {
      throw new Error('The capabilities must be a positive number.');
    }
    this.capabilities = capabilities;
    this.allowExclusiveJobs = !!allowExclusiveJobs;

    /** @type {Array.<JobWithCost>} */
    this.queue = [];
  };

  /**
   * Only returns true, iff the remaining capabilities are exactly 0 (zero).
   */
  get isBusy() {
    return this.capabilitiesFree === 0;
  };

  /**
   * Returns the remaining capabilities. Exclusive jobs may use more capabilities
   * than this queue provides. However, this property can at minimum only return
   * 0 (zero) (i.e. not negative values).
   */
  get capabilitiesFree() {
    return Math.max(0, this.capabilities - this.currentJobs.map(j => j.cost).reduce((a, b) => a + b, 0));
  };

  /**
   * @param {JobWithCost|Function.<JobWithCost>} job 
   */
  addJob(job) {
    if (job instanceof Function) {
      job = job();
    }

    if (!(job instanceof JobWithCost)) {
      throw new Error(`The given job is not an instance of ${JobWithCost.name}.`);
    }

    if (job.cost >= this.capabilities && !this.allowExclusiveJobs) {
      throw new Error(`The job's cost of ${job.cost} exceeds the queue's capabilities of ${this.capabilities} and this queue does not allow such (exclusive) jobs.`);
    }

    this.queue.push(job);
    setTimeout(this._runNext.bind(this), 0);
    return this;
  };

  _runNext() {
    if (this.queue.length === 0) {
      return;
    }

    // Check next job's cost
    const nextJob = this.queue[0];
    if (nextJob.cost > this.capabilitiesFree && this.currentJobs.length > 0) {
      return; // Wait for more jobs to finish
    }

    super._runNext();
  };
};


module.exports = Object.freeze({
  JobWithCost,
  JobQueueCapabilities
});