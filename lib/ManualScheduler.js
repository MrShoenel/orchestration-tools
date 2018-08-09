const { Schedule, ScheduleEvent } = require('./Schedule')
, { Scheduler } = require('./Scheduler')
, symbolManualSchedulerEvent = Symbol('manualSchedulerEvent')
, Rx = require('rxjs')
, Observable = Rx.Observable
, Subscription = Rx.Subscription
, fromEvent = Rx.fromEvent
, { filter } = require('rxjs/operators')
, { EventEmitter } = require('events');


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
    });

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
   * @template T Must be of type ScheduleEvent or more derived.
   * @param {T|Schedule} schedule
   * @returns {Observable.<T|ScheduleEvent>} An Observable for the designated schedule.
   */
  getObservableForSchedule(schedule) {
    return this.observable.pipe(filter(evt => evt.schedule === schedule));
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
    /** @type {Observable.<T>} */
    this._observable = fromEvent(this._emitter, 'trigger');
  };

  /**
   * @returns {Observable.<T>}
   */
  get observable() {
    return this._observable;
  };

  /**
   * The main method to trigger an event on this schedule, that will be observed
   * by the scheduler.
   * 
   * @param {T} item 
   * @returns {this}
   */
  trigger(item) {
    if (!this.isEnabled) {
      throw new Error('This ManualSchedule is not enabled.');
    }
    this._emitter.emit('trigger', item);
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
