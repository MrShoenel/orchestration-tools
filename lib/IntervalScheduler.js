const { Scheduler } = require('./Scheduler')
, Rx = require('rxjs')
, Observable = Rx.Observable
, empty = Rx.empty
, { take } = require('rxjs/operators')
, { Schedule, ScheduleEvent } = require('./Schedule')
, symbolIntervalEvent = Symbol('intervalEvent');



/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Interval extends Schedule {
  /**
   * 
   * @template T
   * @param {number} msecs
   * @param {() => (T|Promise.<T>)} itemProducer a function that produces
   * an item that shall then be signaled by the scheduler. If the item is
   * not of importance, then you may just supply an empty function.
   * @param {boolean} waitforFinishProduction if true, the interval will
   * be reset only when the itemProducer finished producing its item. If
   * this is false, the interval will be reset right away if it elapses.
   * This makes sense if producing an item takes considerable amounts of time.
   * @param {number} maxNumTriggers the maximum amount of times this interval
   * shall trigger. Supply a negative value or Number.MAX_SAFE_INTEGER to not
   * limit this interval to any amount of occurrences.
   * @param {boolean} triggerInitially if true, will trigger this interval
   * right away, instead of waiting for the timeout to elapse once.
   * @param {boolean} enabled if true, this Interval is enabled. Otherwise,
   * its events are ignored until it get enabled.
   */
  constructor(msecs, itemProducer, maxNumTriggers = -1, waitforFinishProduction = true, triggerInitially = false, enabled = true) {
    super(!!enabled);

    if (isNaN(msecs) || msecs < 1) {
      throw new Error(`Interval smaller than 1 ms are forbidden.`);
    }
    if (typeof itemProducer !== 'function') {
      throw new Error('The itemProducer must be a function.');
    }
    if (Object.prototype.toString.call(maxNumTriggers) !== '[object Number]'
      || isNaN(maxNumTriggers)) {
      throw new Error(`The value "${maxNumTriggers}" is invalid for the parameter maxNumTriggers.`);
    }

    this.msecs = msecs;
    this.itemProducer = itemProducer;
    this.maxNumTriggers = maxNumTriggers < 0 || maxNumTriggers >= Number.MAX_SAFE_INTEGER ?
      Number.MAX_SAFE_INTEGER : Math.ceil(maxNumTriggers);
    this.waitforFinishProduction = !!waitforFinishProduction;
    this.triggerInitially = !!triggerInitially;
    this.numOccurred = 0;
  };

  get isFinished() {
    return this.numOccurred === this.maxNumTriggers;
  };

  /**
   * This method will ultimately set the number of occurences equal to the
   * number of how many times this Interval should have been triggered.
   * This leads to this Interval reporting that it is finished.
   * Attempting to finish an unbounded Interval will throw an Error.
   * 
   * @throws {Error} if this is an unbounded Interval
   * @returns {this} this
   */
  finish() {
    if (this.maxNumTriggers === Number.MAX_SAFE_INTEGER) {
      throw new Error('Finishing an Interval is only supported for limited Intervals.');
    }
    this.numOccurred = this.maxNumTriggers;
    return this;
  };

  /**
   * Additionally to finish(), this method also disables this Interval.
   * 
   * @returns {this} this
   */
  finalize() {
    this.isEnabled = false;
    return this.finish();
  };
};


class IntervalEventSimple extends ScheduleEvent {
  /**
   * @template T
   * @param {Interval} interval
   * @param {T} item
   */
  constructor(interval, item) {
    super(interval, item);
  };
};


/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class IntervalScheduler extends Scheduler {
  constructor() {
    super(symbolIntervalEvent);

    /** @type {Array.<Interval>} */
    this.intervals = [];
    /** @type {Object.<string, Interval>} */
    this._intervalIds = {};
    this._intervalId = 0;
    /** @type {Object.<string, number>} */
    this._timeouts = {};
  };

  /**
   * @param {Interval} interval
   * @throws {Error} if interval is not of type Interval
   * @returns {boolean}
   */
  _isInterval(interval) {
    if (!(interval instanceof Interval)) {
      throw new Error('The given interval is not an instance of Interval');
    }
    return true;
  };

  /**
   * @param {string} id 
   * @param {Interval} interval 
   * @param {boolean} [triggerOnce] Optional. Defaults to false.
   */
  async _scheduleInterval(id, interval, triggerOnce = false) {
    /** @param {boolean} wait */
    const triggerInterval = async wait => {
      if (!interval.isEnabled || interval.isFinished) {
        return;
      }

      let item = interval.itemProducer();
      if (wait && item instanceof Promise) {
        item = await item;
      }

      this.emit(symbolIntervalEvent, new IntervalEventSimple(interval, item));
      interval.numOccurred++;
    };

    const triggerOncePromise = triggerOnce ?
      triggerInterval(interval.waitforFinishProduction) : Promise.resolve();
    if (interval.waitforFinishProduction) {
      await triggerOncePromise;
    }

    this._timeouts[id] = setTimeout(async () => {
      clearTimeout(this._timeouts[id]);
      this._timeouts[id] = null;
      delete this._timeouts[id];

      // It may have been removed in the meantime:
      if (!this.hasInterval(interval)) {
        return;
      }

      if (!interval.isFinished && interval.isEnabled) {
        // .. then actually execute its trigger:
        let triggerPromise = triggerInterval(interval.waitforFinishProduction);
        if (interval.waitforFinishProduction) {
          await triggerPromise;
        }
      }
      
      // The Interval should be scheduled consecutively, but its execution
      // is conditional, because the scheduler is not notified when an
      // Interval gets dis- or enabled.
      this._scheduleInterval(id, interval, false);
    }, interval.msecs);
  };

  /**
   * @param {Interval} interval 
   * @returns {string}
   */
  _getIntervalId(interval) {
    this._isInterval(interval);
    if (!this.hasInterval(interval)) {
      throw new Error('This interval was not previously added.');
    }

    for (let key of Object.keys(this._intervalIds)) {
      if (this._intervalIds[key] === interval) {
        return key;
      }
    }

    throw new Error(`There is no ID for the interval.`);
  };

  /**
   * @param {Interval} interval
   * @returns {boolean}
   */
  hasInterval(interval) {
    return this._isInterval(interval) &&
      this.intervals.findIndex(i => i === interval) >= 0;
  };

  /**
   * @param {Interval} interval
   * @returns {this}
   */
  addInterval(interval) {
    if (this.hasInterval(interval)) {
      throw new Error('This interval has been added already.');
    }

    this.intervals.push(interval);

    const id = `i_${this._intervalId++}`;
    this._timeouts[id] = null;
    this._intervalIds[id] = interval;
    this._scheduleInterval(id, interval, interval.triggerInitially);

    return this;
  };

  /**
   * @param {Interval} interval
   */
  removeInterval(interval) {
    if (!this.hasInterval(interval)) {
      throw new Error('This interval was not previously added.');
    }

    const id = this._getIntervalId(interval);
    if (this._timeouts[id] !== null) {
      clearTimeout(this._timeouts[id]);
      this._timeouts[id] = null;
      delete this._timeouts[id];
    }
    delete this._intervalIds[id];

    this.intervals.splice(this.intervals.findIndex(i => i === interval), 1);
    return this;
  };

  /**
   * @returns {Observable.<IntervalEventSimple>}
   */
  get observable() {
    return super.observable;
  };

  /**
   * Returns an Observable for the given Interval. Note that, for
   * finished Intervals, an empty Observable is returned.
   * 
   * @param {Schedule|Interval} interval Must be an instance of Interval
   * @returns {Observable.<IntervalEventSimple>}
   */
  getObservableForSchedule(interval) {
    const intervalId = this._getIntervalId(interval);
    if (interval.isFinished) {
      return empty();
    }
    return super.getObservableForSchedule(interval)
      .pipe(take(interval.maxNumTriggers - interval. numOccurred));
  };
};


module.exports = Object.freeze({
  Interval,
  IntervalScheduler,
  IntervalEventSimple,
  symbolIntervalEvent
});
