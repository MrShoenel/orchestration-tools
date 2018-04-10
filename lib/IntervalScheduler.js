const { Scheduler } = require('./Scheduler')
, Rx = require('rxjs')
, { Schedule } = require('./Schedule')
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
   * @param {boolean} triggerInitially if true, will trigger this interval
   * right away, instead of waiting for the timeout to elapse once.
   * @param {boolean} enabled if true, this Interval is enabled. Otherwise,
   * its events are ignored until it get enabled.
   */
  constructor(msecs, itemProducer, waitforFinishProduction = true, triggerInitially = false, enabled = true) {
    super(!!enabled);

    if (isNaN(msecs) || msecs < 1) {
      throw new Error(`Interval smaller than 1 ms are forbidden.`);
    }
    if (typeof itemProducer !== 'function') {
      throw new Error('The itemProducer must be a function.');
    }

    this.msecs = msecs;
    this.itemProducer = itemProducer;
    this.waitforFinishProduction = !!waitforFinishProduction;
    this.triggerInitially = !!triggerInitially;
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
    /** @type {Object.<Interval>} */
    this._intervalIds = {};
    this._intervalId = 0;
    /** @type {Object.<number>} */
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
   * @param {boolean} triggerOnce 
   */
  async _scheduleInterval(id, interval, triggerOnce = false) {
    /** @param {boolean} wait */
    const triggerInterval = async wait => {
      if (!interval.isEnabled) {
        return;
      }

      let item = interval.itemProducer();
      if (wait && item instanceof Promise) {
        item = await item;
      }

      this.emit(symbolIntervalEvent, item);
    };

    const triggerOncePromise = triggerOnce ?
      triggerInterval(interval.waitforFinishProduction) : Promise.resolve();
    if (interval.waitforFinishProduction) {
      await triggerOncePromise;
    }

    this._timeouts[id] = setTimeout(async () => {
      this._timeouts[id] = null;
      delete this._timeouts[id];

      let triggerPromise = triggerInterval(interval.waitforFinishProduction);
      if (interval.waitforFinishProduction) {
        await triggerPromise;
      }

      if (this.hasInterval(interval)) {
        // May have been removed in the meantime
        this._scheduleInterval(id, interval, false);
      }
    }, interval.msecs);
  };

  _getIntervalId(interval) {
    this._isInterval(interval) && this.hasInterval(interval);

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
};


module.exports = Object.freeze({
  Interval,
  IntervalScheduler,
  symbolIntervalEvent
});
