const { assert, expect } = require('chai')
, path = require('path')
, { timeout, defer } = require('../lib/tools/Defer')
, { assertThrowsAsync } = require('../lib/tools/AssertAsync')
, { ProcessOutput, ProcessWrapper, ProcessResult, ProcessExit, ProcessErrorResult, symbolProcessOutput } = require('../lib/ProcessWrapper')
, { Progress } = require('../lib/Progress')
, { Job } = require('../lib/JobQueue');


let idx = process.argv.findIndex(a => a.startsWith('proctest'));
if (idx >= 0) {
	const testId = process.argv[idx].split('proctest')[1];

	switch (testId) {
		case '1':
			setTimeout(() => {
				console.log('hi')
				process.exit(0);
			}, 200);
			break;
		case '2':
			throw new Error('I fault!'); // will exit with code 1
			break;
		case '3':
			setTimeout(() => {
				console.log('static!');
				process.exit(0);
			}, 200);
			break;
		default:
			throw new Error(`Test with ID '${testId}' is not known.` + testId);
	}
}


// We need to do this or the tests fail
(global.describe || (() => {}))('ProcessWrapper', () => {
	const thisFile = path.resolve(__filename);

	it('should create a nicely observable process', async function() {
		this.timeout(9999);
		const deferred = defer();

		/** @type {Array.<ProcessOutput>} */
		const output = [];
		const pw = new ProcessWrapper('node', [thisFile, 'proctest1']);
		pw.runObservable().subscribe(
			next => {
				output.push(next);
			},
			erro => {
				deferred.reject(erro);
			},
			() => {
				assert.isTrue(0 === pw.result.code);
				assert.isFalse(pw.result.faulted);
				assert.strictEqual(pw.result.stdOut, '');
				assert.strictEqual(pw.result.stdErr, '');

				assert.isTrue(output.length === 1);
				assert.isTrue(output[0] instanceof ProcessOutput);
				assert.isTrue(output[0].isStdOut);
				assert.strictEqual(output[0].asString, "hi\n");

				deferred.resolve();
			}
		);

		await assertThrowsAsync(async () => {
			await pw.run(); // because it's already running
		});

		await assertThrowsAsync(async () => {
			await pw.spawnAsync(); // because it's already running
		});

		return deferred.promise;
	});

	it('should create jobs from ProcessWrapper objects', async function() {
		this.timeout(5000);
		const pw = new ProcessWrapper('node', [thisFile, 'proctest3']);

		const j = Job.fromProcess(pw);
		assert.isTrue(j.supportsProgress);
		let hadProgress = false;
		j.progress.observable.subscribe(prog => {
			assert.isTrue(prog instanceof ProcessOutput);
			assert.isTrue(prog.isStdOut);
			assert.isFalse(prog.isStdErr);
			assert.strictEqual(prog.asString.trim(), 'static!');
			hadProgress = true;
		});

		await j.run();
		assert.isTrue(hadProgress);
	});

	it('should handle failing processes correctly', async function() {
		this.timeout(5000);
		const pw = new ProcessWrapper('node', [thisFile, 'proctest2']);

		assert.isFalse(pw.isRunning);
		assert.isFalse(pw.wasStarted);
		assert.throws(() => {
			const p = pw.process;
		})

		await assertThrowsAsync(async () => {
			const prom = pw.run(false);
			await timeout(5);

			assert.isTrue(pw.isRunning);
			assert.isTrue(pw.wasStarted);
			assert.doesNotThrow(() => {
				const p = pw.process;
				assert.isAbove(p.pid, 0);
			});

			await prom;
			assert.isFalse(pw.isRunning);
		});

		assert.isTrue(pw.result instanceof ProcessExit);
		assert.isTrue(pw.result.faulted);
		assert.isTrue(pw.result.stdErr.indexOf('I fault!') >= 0);
	});

	it('should handle improperly configured processes that fail immediately', async() => {
		const pw = new ProcessWrapper('ni_de' /* typo of 'node' */, [thisFile, 'proctest1']);

		await assertThrowsAsync(async() => {
			await pw.run(false);
		});

		assert.isTrue(pw.result instanceof ProcessErrorResult);
		assert.isTrue(pw.result.hasOwnProperty('error') && pw.result.error instanceof Error);
		assert.strictEqual(pw.result.error.code, 'ENOENT');
	});

	it('should handle observed errors when wrapped in a Job correctly', async() => {
		const pw = new ProcessWrapper('ni_de' /* typo of 'node' */, [thisFile, 'proctest1']);

		const j = Job.fromProcess(pw);

		await assertThrowsAsync(async() => {
			await j.run();
		});
	});

	it('should be perfectly fine to represent a process as a Job', async function() {
		this.timeout(5000);
		const pw = new ProcessWrapper('node', [thisFile, 'proctest1']);
		const job = Job.fromProcess(pw);
		job.cost = 2.5;

		const arr = [];
		pw.observable.subscribe(output => arr.push(output));

		await job.run();

		assert.isTrue(job.result instanceof ProcessExit);
		assert.isTrue(arr.length === 1 && arr[0] instanceof ProcessOutput);
		assert.isTrue(arr[0].isStdOut);
		assert.strictEqual(arr[0].asString, "hi\n");
	});

	it('should handle default arguments correctly', async() => {
		const pw = new ProcessWrapper('foo');
		assert.isTrue(pw.args instanceof Array && pw.args.length === 0);
		assert.strictEqual(Object.keys(pw.options).length, 0)
	});

	it('should work with strings and buffers equally', done => {
		const po1 = new ProcessOutput('stdout', 'foobar123');
		const po2 = new ProcessOutput('stdout', Buffer.from('foobar123'));

		assert.strictEqual(po1.asString, po2.asString);

		done();
	});
});
