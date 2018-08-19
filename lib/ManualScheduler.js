const { Schedule, ScheduleEvent, PreliminaryScheduleEvent, symbolScheduleError, symbolScheduleComplete } = require('./Schedule')
, { Scheduler } = require('./Scheduler')
, { EventEmitter } = require('events')
, { Observable, Subscription, pipe, fromEvent} = require('rxjs')
, { map } = require('rxjs/operators')
, symbolManualSchedulerEvent = Symbol('manualSchedulerEvent');


/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class ManualScheduler extends Scheduler {
  constructor() {
    super(symbolManualSchedulerEvent);
    
    /** @type {Array.<ManualSchedule>} */
    this.manualSchedules = [];
    /** @type {Object.<string, ManualSchedule>} */
    this._manualScheduleIds = {};
    this._manualScheduleId = 0;

    /** @type {Object.<string, Subscription>} */
    this._subscriptions = {};
  };

  /**
   * @param {ManualSchedule} schedule
   * @throws {Error} if schedule is not of type ManualSchedule
   * @returns {boolean}
   */
  _isManualSchedule(schedule) {
    if (!(schedule instanceof ManualSchedule)) {
      throw new Error('The given schedule is not an instance of ManualSchedule');
    }
    return true;
  };

  /**
   * @param {ManualSchedule} manualSchedule 
   * @returns {string}
   */
  _getManualScheduleId(manualSchedule) {
    this._isManualSchedule(manualSchedule);
    if (!this.hasManualSchedule(manualSchedule)) {
      throw new Error('This manualSchedule was not previously added.');
    }

    for (let key of Object.keys(this._manualScheduleIds)) {
      if (this._manualScheduleIds[key] === manualSchedule) {
        return key;
      }
    }

    throw new Error(`There is no ID for the manualSchedule.`);
  };

  /**
   * Calls hasManualSchedule() with the given Schedule.
   * 
   * @param {ManualSchedule} schedule
   * @returns {boolean}
   */
  hasSchedule(schedule) {
    return this.hasManualSchedule(schedule);
  };

  /**
   * @param {ManualSchedule} manualSchedule
   * @returns {boolean}
   */
  hasManualSchedule(manualSchedule) {
    return this._isManualSchedule(manualSchedule) &&
      this.manualSchedules.findIndex(i => i === manualSchedule) >= 0;
  };

  /**
   * Calls addManualSchedule() with the given Schedule.
   * 
   * @param {Schedule|ManualSchedule} schedule
   * @returns {this}
   */
  addSchedule(schedule) {
    return this.addManualSchedule(schedule);
  };

  /**
   * @param {ManualSchedule} manualSchedule
   * @returns {this}
   */
  addManualSchedule(manualSchedule) {
    if (this.hasManualSchedule(manualSchedule)) {
      throw new Error('This manualSchedule has been added already.');
    }

    this.manualSchedules.push(manualSchedule);

    const id = `i_${this._manualScheduleId++}`;
    this._manualScheduleIds[id] = manualSchedule;
    this._subscriptions[id] = manualSchedule.observable.subscribe(next => {
      this.emit(symbolManualSchedulerEvent, new ManualScheduleEventSimple(manualSchedule, next));
    },
    /* We are not re-throwing that error on our Observable, because than it
     * would error and prevent other Schedule's events. To get a Schedule's
     * errors, observe the Schedule manually. We'll have to register an empty
     * handler so that the error is not thrown globally through rxjs.
    */
    error => { },
    /* We are not observing on-complete as well, as there may be other Schedules. */
    () => { });

    return this;
  };

  /**
   * Calls removeManualSchedule() with the given Schedule.
   * 
   * @param {ManualSchedule} schedule
   * @returns {this}
   */
  removeSchedule(schedule) {
    return this.removeManualSchedule(schedule);
  };

  /**
   * Removes all ManualSchedules from this scheduler. This will lead to
   * un-scheduling all of the schedules.
   * 
   * @inheritDoc
   * @returns {Array.<ManualSchedule>}
   */
  removeAllSchedules() {
    const manualScheds = this.manualSchedules.slice(0);
    manualScheds.forEach(ms => this.removeSchedule(ms));
    return manualScheds;
  };

  /**
   * @param {ManualSchedule} manualSchedule
   * @returns {this}
   */
  removeManualSchedule(manualSchedule) {
    if (!this.hasManualSchedule(manualSchedule)) {
      throw new Error('This manualSchedule was not previously added.');
    }

    const id = this._getManualScheduleId(manualSchedule);
    delete this._manualScheduleIds[id];
    this._subscriptions[id].unsubscribe();
    delete this._subscriptions[id];

    this.manualSchedules.splice(this.manualSchedules.findIndex(ms => ms === manualSchedule), 1);
    return this;
  };

  /**
   * @returns {Observable.<ManualScheduleEventSimple>}
   */
  get observable() {
    return super.observable;
  };

  /**
   * Directly obtains and returns a ManualSchedule's Observable. However, its items
   * are mapped to ManualScheduleEventSimple objects, to conform with the type of
   * this method.
   * 
   * @template T Must be of type ScheduleEvent or more derived.
   * @param {T|Schedule|ManualSchedule} schedule
   * @returns {Observable.<T|ScheduleEvent|ManualScheduleEventSimple>} An Observable
   * for the designated schedule.
   */
  getObservableForSchedule(schedule) {
    this._getManualScheduleId(schedule); // Will throw if schedule is not valid
    return schedule.observable.pipe(map(item => new ManualScheduleEventSimple(schedule, item)));
  };

  /**
   * @inheritdoc
   * @param {Date} [after] Optional. Defaults to undefined.
   * @param {Date} [before] Optional. Defaults to undefined.
   * @returns {IterableIterator.<PreliminaryScheduleEvent.<ManualSchedule, any>>}
   */
  *preliminaryEvents(after = void 0, before = void 0) {
    for (const sched of this.manualSchedules) {
      for (const pre of sched.preliminaryEvents(...arguments)) {
        yield pre;
      }
    }
  };
};


/**
 * @template T
 * 
 * Sebastian Hönel <development@hoenel.net>
 */
class ManualSchedule extends Schedule {
  /**
   * @param {boolean} [enabled] Optional. Defaults to true.
   */
  constructor(enabled = true) {
    super(!!enabled);

    this._emitter = new EventEmitter();
    this._observable = new Observable(subscriber => {
      fromEvent(this._emitter, symbolManualSchedulerEvent).subscribe(nextVal => {
        subscriber.next(nextVal);
      });

      fromEvent(this._emitter, symbolScheduleError).subscribe(nextErr => {
        subscriber.error(nextErr);
      });

      fromEvent(this._emitter, symbolScheduleComplete).subscribe(() => {
        subscriber.complete();
      });
    });
  };

  /**
   * @returns {Observable.<T>}
   */
  get observable() {
    return this._observable;
  };

  /**
   * @throws {Error} If this Schedule is not enabled.
   */
  _requireIsEnabled() {
    if (!this.isEnabled) {
      throw new Error('This ManualSchedule is not enabled.');
    }
  };

  /**
   * The main method to trigger an event on this schedule, that will be observed
   * by the scheduler.
   * 
   * @deprecated Use triggerNext() instead. This method will be removed in v3.x!
   * @param {T} item 
   * @returns {this}
   */
  trigger(item) {
    this._requireIsEnabled();
    this._emitter.emit(symbolManualSchedulerEvent, item);
    return this;
  };

  /**
   * Calls trigger() and has been added for compatibility reasons to Observable.
   * 
   * @param {T} item
   * @returns {this}
   */
  triggerNext(item) {
    return this.trigger(item);
  };

  /**
   * Will emit an error on this schedule's Observable. Note that the Observable
   * will end then (i.e. no new items or complete will be emitted).
   * 
   * @param {any} error
   * @returns {this}
   */
  triggerError(error) {
    this._requireIsEnabled();
    this._emitter.emit(symbolScheduleError, error);
    return this;
  };

  /**
   * Will trigger this schedule's Observable's complete-function. Note that the
   * Observable will end then (i.e. no new items or complete will be emitted).
   * 
   * @returns {this}
   */
  triggerComplete() {
    this._requireIsEnabled();
    this._emitter.emit(symbolScheduleComplete);
    return this;
  };
};


/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class ManualScheduleEventSimple extends ScheduleEvent {
  /**
   * @template T
   * @param {ManualSchedule} manualSchedule
   * @param {T} item
   */
  constructor(manualSchedule, item) {
    super(manualSchedule, item);
  };
};


module.exports = Object.freeze({
  ManualSchedule,
  ManualScheduler,
  ManualScheduleEventSimple,
  symbolManualSchedulerEvent
});
