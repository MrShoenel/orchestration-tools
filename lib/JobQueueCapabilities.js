const { Job, JobQueue, JobQueueCapacityPolicy } = require('./JobQueue');


class JobQueueCapabilities extends JobQueue {
	/**
	 * @param {number} capabilities 
	 * @param {boolean} [allowExclusiveJobs] Optional. Defaults to false. A
	 * boolean that indicates whether jobs that require the whole queue's
	 * capabilities are allowed on this queue. Such jobs have a cost equal
	 * to or higher than the queue's capabilities.
	 * @param {Number} [capacity] Optional. The maximum capacity of this
	 * JobQueue. Only has an effect if the chosen policy is not set to
	 * ignore excess items. The maximum capacity is the total amount of
	 * Jobs either currently running or in the backlog this JobQueue can
	 * accomodate.
	 * @param {JobQueueCapacityPolicy|Number} Optional. The policy to
	 * use when the maximum capacity is reached, and new items are being
	 * enqueued.
	 */
	constructor(capabilities, allowExclusiveJobs = false, capacity = Number.MAX_SAFE_INTEGER, capacityPolicy = JobQueueCapacityPolicy.Ignore) {
		super(Number.MAX_SAFE_INTEGER, capacity, capacityPolicy);
		if (isNaN(capabilities) || capabilities <= 0) {
			throw new Error('The capabilities must be a positive number.');
		}
		this.capabilities = capabilities;
		this.allowExclusiveJobs = !!allowExclusiveJobs;
	};

	/**
	 * @returns {number} the total cost of all jobs that need to be run.
	 */
	get backlogCost() {
		return this.queue.map(job => job.cost).reduce((a, b) => a + b, 0);
	};

	/**
	 * @returns {number} A number that indicates the ratio between currently
	 * running and enqueued jobs and this queue's capabilities. 0 means that
	 * the queue is idle; a value close or equal to one means that the queue
	 * runs at or near its full capacity and a value greater than one means
	 * that there are exclusive jobs or a non-empty backlog of waiting jobs.
	 * Albeit overwritten, this property can be perfectly used to compare the
	 * load of parallel job queues.
	 */
	get load() {
		const totalCost = this.backlogCost + this.capabilitiesUsed;
		return totalCost / this.capabilities;
	};

	/**
	 * @returns {number} A number indicating the utilization of this queue in
	 * terms of a ratio between used capabilities and available capabilities.
	 * Note that, if this queue allows exclusive jobs, the utilization may be
	 * greater than 100%. The range therefore is [0, infinity].
	 */
	get utilization() {
		return this.capabilitiesUsed / this.capabilities;
	};

	/**
	 * Only returns true, iff the remaining capabilities are exactly 0 (zero).
	 */
	get isBusy() {
		return this.capabilitiesFree === 0;
	};

	/**
	 * @returns {number} the accumulated cost of all currently running jobs.
	 */
	get capabilitiesUsed() {
		return this.currentJobs.map(j => j.cost).reduce((a, b) => a + b, 0);
	};

	/**
	 * Returns the remaining capabilities. Exclusive jobs may use more capabilities
	 * than this queue provides. However, this property can at minimum only return
	 * 0 (zero) (i.e. not negative values).
	 */
	get capabilitiesFree() {
		return Math.max(0, this.capabilities - this.capabilitiesUsed);
	};

	/**
	 * @template T
	 * @override
	 * @param {Job|producerHandler.<Promise.<T>>} job 
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

		if (!job.hasCost && (Object.prototype.toString.call(cost) !== '[object Number]' || cost <= 0)) {
			throw new Error(`You must provide a valid value for parameter cost. Given: '${cost}'`);
		}
		job.cost = cost || job.cost;

		if (job.cost >= this.capabilities && !this.allowExclusiveJobs) {
			throw new Error(`The job's cost of ${job.cost} exceeds the queue's capabilities of ${this.capabilities} and this queue does not allow such (exclusive) jobs.`);
		}

		return super.addJob(job);
	};

	/**
	 * @protected
	 * @override
	 */
	_runNext() {
		// Check next job's cost
		if (this.backlog > 0 && this.queue.peekIndex(0).cost > this.capabilitiesFree && this.numJobsRunning > 0) {
			return; // Wait for more jobs to finish
		}

		super._runNext();
	};
};


module.exports = Object.freeze({
	JobQueueCapabilities
});