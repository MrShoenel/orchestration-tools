const EventEmitter = require('events').EventEmitter
, Rx = require('rxjs')
, Observable = Rx.Observable
, symbolProgress = Symbol('progress');


/**
 * A class used to report progress of any kind. Supports events through
 * EventEmitter, own callbacks or being used as an Observable.
 * 
 * @template T
 */
class Progress extends EventEmitter {
  /**
   * @template T
   * @param {(progress: T) => ()} handler a callback to be invoked for every
   * progress reported. If not provided, you may subscribe to the events of
   * this class or use the provided Observable.
   */
  constructor(handler = void 0) {
    super();
    this.handler = handler;
    /** @type {T} */
    this.lastProgress = void 0;
  };

  /**
   * @template T
   * @param {T} progress the item that represents the progress
   * @returns {Progress} this
   */
  reportProgress(progress) {
    this.lastProgress = progress;
    setTimeout(() => {
      this.emit(symbolProgress, progress);
      if (this.handler instanceof Function) {
        this.handler(progress);
      }
    }, 0);
    return this;
  };

  /**
   * Returns an Rx.Observable that will emit events whenever they
   * are reported to its subscribers.
   * 
   * @template T the underlying type for the progress
   * @returns {Observable.<T>}
   */
  get observable() {
    return Rx.Observable.fromEvent(this, symbolProgress);
  };
};


/**
 * A simple class to report numeric progress within a range
 * (typically [0, 1]), but any other positive range is good, too.
 */
class ProgressNumeric extends Progress {
  /**
   * @param {number} progressMin the lowest possible value for the progress
   * @param {number} progressMax the largest possible value for the progress
   * @param {(progress: number) => ()} handler a callback to be invoked for every
   * progress reported. If not provided, you may subscribe to the events of
   * this class or use the provided Observable.
   */
  constructor(progressMin = 0, progressMax = 1, handler = void 0) {
    super(handler);
    if (isNaN(progressMin) || isNaN(progressMax)) {
      throw new Error('Both progressMin and progressMax must be numeric.');
    }
    if (progressMin < 0 || progressMax < progressMin) {
      throw new Error('Both progressMin and progressMax must be positive and progressMax must be greater than progressMin.');
    }

    this.progressMin = progressMin;
    this.progressMax = progressMax;
    this.progressRange = progressMax - progressMin;
  };

  get percent() {
    return (this.lastProgress - this.progressMin) / this.progressRange;
  };

  /**
   * @param {number} progress the numeric progress
   */
  reportProgress(progress) {
    if (isNaN(progress) || progress < this.progressMin || progress > this.progressMax) {
      throw new Error(`The value "${progress}" is out of range.`);
    }

    return super.reportProgress(progress);
  };
};

module.exports = Object.freeze({
  Progress,
  ProgressNumeric,
  symbolProgress
});