const EventEmitter = require('events').EventEmitter
, Rx = require('rxjs')
, Observable = Rx.Observable
, { Schedule, ScheduleEvent } = require('./Schedule');


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
   * @template T Must be of type ScheduleEvent or more derived.
   * @returns {Observable.<T|ScheduleEvent>}
   */
  get observable() {
    return this._observable;
  };

  /**
   * @template T Must be of type ScheduleEvent or more derived.
   * @param {T|Schedule} schedule
   * @returns {Observable.<T|ScheduleEvent>} An Observable for the designated schedule.
   */
  getObservableForSchedule(schedule) {
    return this.observable.filter(evt => evt.schedule === schedule);
  };
};

module.exports = Object.freeze({
  Scheduler
});
