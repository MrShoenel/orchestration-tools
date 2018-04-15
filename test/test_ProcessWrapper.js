const { assert, expect } = require('chai')
, path = require('path')
, { timeout, defer } = require('../tools/Defer')
, { assertThrowsAsync } = require('../tools/AssertAsync')
, { ProcessOutput, ProcessWrapper, ProcessResult, ProcessExit, ProcessErrorResult, symbolProcessOutput } = require('../lib/ProcessWrapper')
, { JobWithCost } = require('../lib/JobQueueCapabilities')
, { Progress } = require('../lib/Progress');


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
    default:
      throw new Error(`Test with ID '${testId}' is not known.`);
  }
}


// We need to do this or the tests fail
(global.describe || (() => {}))('ProcessWrapper', () => {
  const thisFile = path.resolve(__filename);

  it('should create a nicely observable process', function() {
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

    return deferred.promise;
  });

  it('should handle failing processes correctly', async function() {
    const pw = new ProcessWrapper('node', [thisFile, 'proctest2']);

    await assertThrowsAsync(async () => {
      await pw.run(false);
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

  it('should be perfectly fine to represent a process as a Job', async() => {
    const pw = new ProcessWrapper('node', [thisFile, 'proctest1']);
    const job = JobWithCost.fromJob(JobWithCost.fromProcess(pw), 2.5);

    const arr = [];
    pw.observable.subscribe(output => arr.push(output));

    await job.run();

    assert.isTrue(job.result instanceof ProcessExit);
    assert.isTrue(arr.length === 1 && arr[0] instanceof ProcessOutput);
    assert.isTrue(arr[0].isStdOut);
    assert.strictEqual(arr[0].asString, "hi\n");
  });
});
