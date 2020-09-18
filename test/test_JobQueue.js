const { assert, expect } = require('chai')
, { timeout } = require('../lib/tools/Defer')
, { EqualityComparer } = require('../lib/collections/EqualityComparer')
, { assertThrowsAsync } = require('../lib/tools/AssertAsync')
, { ProgressNumeric } = require('../lib/Progress')
, { Job, JobQueue, symbolRun, symbolDone, symbolFailed, symbolIdle } = require('../lib/JobQueue')
, { JobQueueCapabilities } = require('../lib/JobQueueCapabilities');

// process.on('unhandledRejection', (reason, p) => {
//	 console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
//	 // application specific logging, throwing an error, or other logic here
// });


class NoEq extends EqualityComparer {
	equals(x, y) {
		return false;
	};
};


describe(Job.name, () => {
	it('should allow for additional properties', async() => {
		const j = new Job(async() => await timeout(55), "foo");

		assert.strictEqual(j.name, "foo");
		j.properties.set('batz', 1337);
		j.properties.set('blah', 42);
		assert.strictEqual(j.properties.get('batz'), 1337);
		assert.strictEqual(j.properties.get('blah'), 42);

		assert.isTrue(j.createTime instanceof Date);
		assert.isFalse(j.wasStarted);
		assert.isFalse(j.isStopped);
		assert.strictEqual(0, j.runDurationMs);

		assert.throws(() => j.startTime);
		assert.throws(() => j.stopTime);

		const rp = j.run();
		assert.doesNotThrow(() => j.startTime);
		await timeout(15);
		assert.isAtLeast(j.runDurationMs, 10);
		await rp;
		assert.doesNotThrow(() => j.stopTime);
		assert.isAtLeast(j.runDurationMs, 50);
	});
});

describe(JobQueue.name, () => {
	it('should throw if given invalid parameters', () => {
		assert.throws(() => {
			new Job();
		});
		assert.throws(() => {
			new Job("ASD");
		});
		assert.throws(() => {
			new JobQueue(0);
		});
		assert.throws(() => {
			new JobQueue(-15);
		});
		assert.throws(() => {
			(new JobQueue()).addSyncJob(42);
		});

		(() => {
			const jq = new JobQueue(1);
			assert.throws(() => {
				jq.addJob(42);
			});
			assert.doesNotThrow(() => {
				jq.addJob(() => {});
			});
		})();

		(() => {
			const jq = new JobQueueCapabilities(2.5, false);
			assert.throws(() => {
				jq.addJob(42);
			});
			assert.throws(() => {
				jq.addJob(async() => 42, 0);
			});
			assert.throws(() => {
				jq.addJob(async() => 42, true);
			});
			assert.doesNotThrow(() => {
				const x = Job.fromSyncFunction(() => 42);
				x.cost = 1;
				jq.addJob(x);
			});
		})();
	});

	it('should create jobs from synchronous functions', async() => {
		assert.throws(() => {
			Job.fromSyncFunction(42);
		});

		const j1 = Job.fromSyncFunction(() => 42);
		j1.cost = 42;
		assert.isFalse(j1.supportsProgress);
		assert.isTrue(j1.hasCost);
		assert.strictEqual(j1.cost, 42);

		assert.throws(() => {
			j1.cost = true;
		});

		assert.throws(() => {
			j1.progress = 'progress';
		});
		const p = new ProgressNumeric(1, 10);
		assert.doesNotThrow(() => {
			j1.progress = p;
			assert.strictEqual(j1.progress, p);
		});

		await j1.run();
		assert.strictEqual(j1.result, 42);
	});

	it('should handle misconfigured or failed jobs', async function() {
		const q = new JobQueue();
		q.pause();

		const j1 = new Job(() => { return 42; });
		const j2 = new Job(() => { throw new Error('42') });
		const j3 = new Job(async() => { throw new Error('42') });

		let numJobsFailed = 0;
		q.observableFailed.subscribe(jEvt => {
			if (numJobsFailed < 1) {
				// j1
				assert.isTrue(jEvt.error.message.startsWith('The promiseProducer does not produce a Promise or is not an async function'));
			} else {
				// j2 & j3
				assert.isTrue(jEvt.error.message.startsWith('42'))
			}

			numJobsFailed++;
		});

		q.addJob(j1).addJob(j2).addJob(j3);

		q.resume();

		await timeout(50);
		assert.isTrue(j1.hasFailed && j2.hasFailed && j3.hasFailed);
		assert.strictEqual(q.numJobsDone, 0);
		assert.strictEqual(q.numJobsFailed, 3);
		assert.strictEqual(q.workDone, 0);
		assert.strictEqual(q.workFailed, 3);
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
		assert.strictEqual(q.numJobsRunning, 1);

		const secondJob = new Job(() => new Promise((resolve, reject) => {
			setTimeout(resolve, 250);
		}));
		secondJob.on(symbolRun, () => secondJobStarted = true);
		
		q.addJob(secondJob);
		await timeout(50);
		assert.isTrue(!firstJobFinished && !secondJobStarted,
			'The first Job should not be finished and the second must not have started');
		assert.isTrue(q.backlog > 0, 'The backlog of the queue should not be empty.');
		assert.isTrue(q.load > 1, 'The load should be greater one, since there are jobs waiting.');

		await secondJob.donePromise;
	});

	it('should be able to process sync functions as Jobs, too', async function() {
		const q = new JobQueue(1);

		/** @type {Job.<number>} */
		let job = null;

		q.observableRun.subscribe(jqEvt => {
			assert.isTrue(jqEvt.job.isRunning);
		});

		q.observableDone.subscribe(next => {
			assert.isTrue(next.job instanceof Job);
			job = next.job;
		});
		
		q.addSyncJob(() => 42);
		await timeout(50);

		assert.strictEqual(job.result, 42);
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
		assert.isTrue(j1.isRunning);
		assert.isTrue(q.isWorking && !q.isBusy && !j1.isDone);
		assert.throws(() => {
			const x = `${j1.result}`;
		});
		q.addJob(j2);
		await timeout(50);
		assert.isTrue(q.isWorking && q.isBusy);

		await timeout(250);
		assert.isTrue(!q.isWorking && j1.isDone && j2.isDone);
	});

	it('should not do work on queues that are paused', async() => {
		const q = new JobQueue();

		let idleReceived = false;
		q.observableIdle.subscribe(next => {
			idleReceived = true;
		});

		assert.isFalse(idleReceived);
		q.pause();
		await timeout(10);
		assert.isTrue(idleReceived);
	});

	it('should allow to clear the backlog on paused queues', async() => {
		const q = new JobQueue(1);
		q.pause();
		q.addJob(() => 42);

		await timeout(50); // wait some time just to make sure

		assert.strictEqual(q.currentJobs.size, 0);
		assert.strictEqual(q.queue.size, 1);

		const jobs = q.clearBacklog();
		assert.strictEqual(jobs.length, 1);
		assert.strictEqual(q.currentJobs.size, 0);
		assert.strictEqual(q.queue.size, 0);
	});

	it('should respect pausing and resuming a queue', async() => {
		const q = new JobQueue(1);
		const j1 = new Job(() => new Promise((resolve, reject) => {
			setTimeout(resolve, 100);
		}));
		const j2 = new Job(() => new Promise((resolve, reject) => {
			setTimeout(resolve, 100);
		}));

		let idleReceived = false;
		q.observableIdle.subscribe(next => {
			idleReceived = true;
		});

		q.addJob(j1);
		q.addJob(j2);
		await timeout(50);
		assert.strictEqual(q.load, 2);
		assert.strictEqual(q.utilization, 1);
		assert.isTrue(q.isBusy && !j1.isDone && !j2.isDone);

		q.pause();
		await timeout(125);
		assert.isTrue(idleReceived);
		assert.isTrue(q.isPaused && q.isIdle && j1.isDone && !j2.isDone);

		assert.isTrue(q.backlog > 0); // j2 is still there and waiting

		q.resume();
		await timeout(150);
		assert.isTrue(!q.isBusy && q.isIdle && !q.isPaused && j2.isDone);
	});

	it('should be able to run jobs to completion', async function() {
		const q = new JobQueue(1);

		let numIdleRcvd = 0;
		const idleSubs = q.observableIdle.subscribe(() => {
			numIdleRcvd++;
		});

		await q.runToCompletion();
		assert.strictEqual(q.numJobsDone, 0);
		assert.strictEqual(numIdleRcvd, 1);

		q.pause().addSyncJobs(() => 42, () => { throw '42'; });

		await assertThrowsAsync(async() => {
			await q.runToCompletion();
		});
		assert.strictEqual(q.numJobsDone, 1);
		assert.strictEqual(q.numJobsFailed, 1);
		assert.strictEqual(numIdleRcvd, 1);

		q.pause().addSyncJob(() => 43);
		await q.runToCompletion();
		assert.strictEqual(q.numJobsDone, 2);
		assert.strictEqual(q.numJobsFailed, 1);
		assert.strictEqual(numIdleRcvd, 2);

		q.addJobs(
			async() => await timeout(50),
			async() => 42
		);
		// The queue is not paused so these will be run right away
		await timeout(25);
		assert.strictEqual(q.numJobsDone, 2);
		assert.strictEqual(q.currentJobs.size, 1);
		assert.strictEqual(q.backlog, 1);
		
		await q.runToCompletion();
		assert.strictEqual(q.numJobsDone, 4);
		assert.strictEqual(q.currentJobs.size, 0);
		assert.strictEqual(q.backlog, 0);

		idleSubs.unsubscribe();
	});

	it('should not emit idle if paused and jobs are enqueued', async() => {
		const q = new JobQueue(1);

		let idleReceived = false;
		q.observableIdle.subscribe(jqEvt => {
			idleReceived = true;
		});

		q.addJob(async() => await timeout(100));

		await timeout(25);
		q.pause();
		q._runNext();

		await timeout(25);
		assert.isFalse(idleReceived);
	});

	it('should allow removing jobs while they are on the backlog', async() => {
		const q = new JobQueue(1).pause();

		const j1 = new Job(async() => await timeout(100), 'j1')
		, j2 = new Job(async() => await timeout(75));

		assert.isTrue(j1.name === 'j1' && j2.name === void 0);
		assert.throws(() => {
			j2.name = 5;
		});
		assert.doesNotThrow(() => {
			j2.name = void 0;
			j2.name = 'j2';
		});

		assert.isFalse(q.hasJob(j1));
		assert.isFalse(q.hasJob(j2));
		assert.isFalse(q.isJobRunning(j1));
		assert.isFalse(q.isJobRunning(j2));

		q.addJob(j1).resume();
		await timeout(25);
		assert.isTrue(q.isJobRunning(j1));
		assert.throws(() => {
			q.removeJobFromBacklog(j1);
		});
		q.addJob(j2);
		await timeout(25);
		assert.isTrue(q.isJobRunning(j1));
		assert.isTrue(q.hasJob(j2));
		assert.isFalse(q.isJobRunning(j2));

		assert.throws(() => {
			q.removeJobFromBacklog(j2, new NoEq());
		});
		assert.doesNotThrow(() => {
			q.removeJobFromBacklog(j2);
		});
		assert.isFalse(q.hasJob(j2));

		await timeout(75);
		assert.isFalse(q.isJobRunning(j1));
		assert.isTrue(j1.isDone);
		assert.isFalse(j2.isDone);
	});
});
