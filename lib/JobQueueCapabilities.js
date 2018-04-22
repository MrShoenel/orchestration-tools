const { Job, JobQueue } = require('./JobQueue');


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
   * @template T
   * @param {Job|(() => Promise.<T>)} job 
   * @param {number} [cost]
   */
  addJob(job, cost = void 0) {
    if (!(job instanceof Job)) {
      if (job instanceof Function) {
        job = new Job(job);
      } else {
        throw new Error(`The given Job is not an instance of Job nor is it an instance of Function.`);
      }
    }

    if (!job.hasCost && (isNaN(cost) || cost <= 0)) {
      throw new Error(`You must provide a valid value for parameter cost. Given: '${cost}'`);
    }
    job.cost = cost || job.cost;

    if (job.cost >= this.capabilities && !this.allowExclusiveJobs) {
      throw new Error(`The job's cost of ${job.cost} exceeds the queue's capabilities of ${this.capabilities} and this queue does not allow such (exclusive) jobs.`);
    }

    return super.addJob(job);
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
  JobQueueCapabilities
});