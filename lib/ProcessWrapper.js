const cp = require('child_process')
, EventEmitter = require('events').EventEmitter
, Rx = require('rxjs')
, Observable = Rx.Observable
, fromEvent = Rx.fromEvent
, { mergeObjects } = require('../tools/Objects')
, symbolProcessOutput = Symbol('processOutput');



/**
 * General purpose class that can represent any result of a terminated Process.
 */
class ProcessResult {
  constructor() { };
};


/**
 * Inherits from ProcessResult and represents an errored Process. This class
 * is usually used for Processes that did not even start or were impossible
 * to launch with the given configuration. A Process that started but errored
 * then is usually terminated with an instance of ProcessExit.
 */
class ProcessErrorResult extends ProcessResult {
  /**
   * @param {any} error 
   */
  constructor(error) {
    super();
    this.error = error;
  };
};


/**
 * Inherits from ProcessResult and represents the details of an exited Process.
 * This result can either be positive (non-faulted) or negative. The result will
 * provide details about the termination, such as exit-code, signal (if available)
 * or the contents of stderr and stdout (if configured to be used).
 */
class ProcessExit extends ProcessResult {
  /**
   * @param {boolean} faulted
   * @param {number} code 
   * @param {string|null} signal 
   * @param {string|null} stdOut 
   * @param {string|null} stdErr 
   */
  constructor(faulted, code, signal, stdOut, stdErr) {
    super();
    this.faulted = faulted;
    this.code = code;
    this.signal = signal;
    this.stdOut = stdOut;
    this.stdErr = stdErr;
  };
}


/**
 * This class is used for whenever a wrapped Process generates any kind
 * of output.
 */
class ProcessOutput {
  /**
   * @param {'stdout'|'stderr'} streamType 
   * @param {Buffer|String} chunk 
   */
  constructor(streamType, chunk) {
    this.streamType = streamType;
    this.chunk = chunk;
  };

  get isStdOut() {
    return this.streamType === 'stdout';
  };

  get isStdErr() {
    return this.streamType === 'stderr';
  };

  /**
   * Provides the chunk as string, converted to utf-8.
   */
  get asString() {
    return this.chunk instanceof Buffer ?
      this.chunk.toString('utf-8') : this.chunk;
  };
}


/**
 * Wraps (the execution of) a Process that is created using child_process.
 * Provides convenient async behavior and Observables as well as eventing.
 */
class ProcessWrapper extends EventEmitter {
  /**
   * @param {string} command 
   * @param {Array.<string>} args 
   * @param {SpawnOptions|Object} options The same options that child_process.spawn(..) supports.
   */
  constructor(command, args = [], options = {}) {
    super();

    this.command = command;
    this.args = args;
    this.options = options;

    this._wasStarted = false;
    this._isRunning = false;

    /** @type {Observable.<ProcessOutput>} */
    this._observable = fromEvent(this, symbolProcessOutput);

    /** @type {ProcessResult} */
    this._processResult = void 0;

    /** @type {NodeJS.Process} */
    this._process = void 0;
  };

  /**
   * Returns the underlying process as returned by child_process.
   * 
   * @throws {Error} if this process was not yet started.
   * @returns {NodeJS.Process}
   */
  get process() {
    if (!this.wasStarted) {
      throw new Error('This process was not yet started.');
    }
    return this._process;
  };

  /**
   * @returns {Boolean}
   */
  get wasStarted() {
    return this._wasStarted;
  };

  /**
   * @returns {Boolean}
   */
  get isRunning() {
    return this._isRunning;
  };

  /**
   * Creates and returns a general Observable for any output of this Process. The
   * Observable will just observe any emits. Thus it never errors and never drains.
   * 
   * @returns {Observable.<ProcessOutput>}
   */
  get observable() {
    return this._observable;
  };

  /**
   * This property will yield a value once the Process terminated. Note that in the
   * API of Observable, the complete()-function does not support arguments, so that
   * we cannot pass in the result there.
   * Instead the wrapper guarantees that, once the Process terminated, its result
   * will be made available before any events are omitted or complete() gets called.
   * 
   * @returns {ProcessResult|ProcessErrorResult|ProcessExit}
   */
  get result() {
    return this._processResult;
  };

  /**
   * The default action to run this process. At the moment it defaults to spawn().
   * The default behavior may change in the future, so do not rely on this method
   * and use the specialized instantiation methods, if you require e.g. fork()
   * instead of spawn().
   * However regardless, this method guarantees that the process will be executed
   * and that its result can be observed or obtained by awaiting its termination
   * (that depends on the behavior of 'emitOnly').
   * 
   * @param {boolean} emitOnly If set to true, the resulting value of the resolving
   * Promise will be empty (i.e. stdout and stderr will be empty and not be collected
   * while the process is running; instead, all output is emitted (events and obser-
   * vable) while the process is running). It is recommended to set this to true, if
   * the underlying process outputs a lot of data to the std-streams. That data would
   * otherwise be held in the node.js process. However, if set to false, the resulting
   * value of the Promise will be the process' entire output.
   */
  async run(emitOnly = true) {
    if (this.isRunning) {
      throw new Error('The process is already running.');
    }
    return await this.spawnAsync(emitOnly);
  };

  /**
   * The default action to start and observe this process. At the moment it defaults
   * to spawn() and thus spawnObservable(). The default behavior may change in the future,
   * so do not rely on this method and use the specialized instantiation methods, if you
   * require e.g. fork() instead of spawn().
   * However regardless, this method guarantees that the process will be executed and that
   * its result can be observed. When the process errors or terminates, the observable will
   * forward those errors or call onComplete() accordingly.
   * 
   * @returns {Observable.<ProcessOutput>}
   */
  runObservable() {
    return this.spawnObservable();
  };

  /**
   * Calls 'spawnAsync(emitOnly=true)' so that the entire Process becomes
   * observable while it runs. When the process errors or finishes, the
   * observable will output an error or complete, respectively.
   * 
   * @returns {Observable.<ProcessOutput>}
   */
  spawnObservable() {
    return new Observable(async subs => {
      const subscription = fromEvent(this, symbolProcessOutput)
        .subscribe(next => {
          subs.next(next);
        });

      try {
        await this.spawnAsync(true);
        subs.complete();
      } catch (e) {
        subs.error(e);
      } finally {
        subscription.unsubscribe();
      }
    });
  };

  /**
   * Launches the process using spawn().
   * 
   * @param {boolean} emitOnly Has the same effect as 'run(emitOnly)', please refer
   * to the documentation there.
   * @returns {Promise.<ProcessResult>} The Promise will be rejected if the process
   * exits with a non-zero result or if, when spawning it, an error occurs. In the 
   * first case, the result will be of type ProcessExit, while in the latter case, it
   * will be of type ProcessErrorResult. Both types inherit from ProcessResult.
   */
  spawnAsync(emitOnly = true) {
    return new Promise((resolve, reject) => {
      
      if (this.isRunning) {
        throw new Error('The process is already running.');
      }
      this._isRunning = true;

      /**
       * @param {ProcessResult} procExit 
       */
      const shutdownFunc = procExit => {
        this._isRunning = false;
        this._processResult = procExit;

        if (procExit instanceof ProcessErrorResult
          || (procExit instanceof ProcessExit && procExit.faulted)) {
          reject(procExit);
        } else {
          resolve(procExit);
        }
      };
    
      /**
       * @param {'stdout'|'stderr'} streamName 
       * @param {Buffer|String} chunk 
       * @param {Array.<String>} streamArr 
       */
      const dataFn = (streamName, chunk, streamArr) => {
        const out = new ProcessOutput(streamName, chunk);
        if (!emitOnly) {
          streamArr.push(out.asString);
        }
        this.emit(symbolProcessOutput, out);
      };

      const stdOut = [], stdErr = [];
      const options = mergeObjects({}, this.options);
      options.stdio = 'pipe';

      const proc = cp.spawn(this.command, this.args, this.options)
        .once('error', err =>
          shutdownFunc(new ProcessErrorResult(err)))
        .once('exit', (code, sig) =>
          shutdownFunc(new ProcessExit(
            code !== 0, code, sig, stdOut.join(''), stdErr.join(''))));

      this._wasStarted = true;

      proc.stdout.on('data', chunk => dataFn('stdout', chunk, stdOut));
      proc.stderr.on('data', chunk => dataFn('stderr', chunk, stdErr));

      // Expose, after everything is set up:
      this._process = proc;
    });
  };
};


module.exports = Object.freeze({
  ProcessResult,
  ProcessErrorResult,
  ProcessExit,
  ProcessOutput,
  ProcessWrapper,
  symbolProcessOutput
});