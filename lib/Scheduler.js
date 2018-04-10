const EventEmitter = require('events').EventEmitter
, Rx = require('rxjs')
, Observable = Rx.Observable;


/**
 * Generic scheduler class that can emit events of type T. The purpose
 * of this scheduler is to notify when an event occurs or something should
 * be executed. It shall be used as base-class to other schedulers. It is
 * not to be used for executing jobs, use an appropriate queue for that.
 * 
 * @author Sebastian Hönel <development@hoenel.net>
 * @template T
 */
class Scheduler extends EventEmitter {
  /**
   * @param {Symbol} schedulerSymbol
   */
  constructor(schedulerSymbol) {
    super();
    this._observable = Observable.fromEvent(this, schedulerSymbol);
  };

  /**
   * Returns the same Observable<T> to every subscriber.
   * 
   * @template T
   * @returns {Observable.<T>}
   */
  get observable() {
    return this._observable;
  };
};

module.exports = Object.freeze({
  Scheduler
});
