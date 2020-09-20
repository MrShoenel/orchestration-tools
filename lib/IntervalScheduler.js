const { Scheduler } = require('./Scheduler')
, Rx = require('rxjs')
, Observable = Rx.Observable
, empty = Rx.empty
, { take } = require('rxjs/operators')
, { Schedule, ScheduleEvent, PreliminaryScheduleEvent } = require('./Schedule')
, symbolIntervalEvent = Symbol('intervalEvent');



/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Interval extends Schedule {
	/**
	 * 
	 * @template T
	 * @param {Number} msecs
	 * @param {producerHandler<T|Promise<T>>} [itemProducer] Optional. Defaults to
	 * null. A function that produces an item that shall then be signaled
	 * by the scheduler. If the item is not of importance, then you may
	 * just supply an empty function or null (will be converted to an empty
	 * function then).
	 * @param {Boolean} waitforFinishProduction if true, the interval will
	 * be reset only when the itemProducer finished producing its item. If
	 * this is false, the interval will be reset right away if it elapses.
	 * This makes sense if producing an item takes considerable amounts of time.
	 * @param {Number} maxNumTriggers the maximum amount of times this interval
	 * shall trigger. Supply a negative value or Number.MAX_SAFE_INTEGER to not
	 * limit this interval to any amount of occurrences.
	 * @param {Boolean} triggerInitially if true, will trigger this interval
	 * right away, instead of waiting for the timeout to elapse once.
	 * @param {Boolean} enabled if true, this Interval is enabled. Otherwise,
	 * its events are ignored until it get enabled.
	 */
	constructor(msecs, itemProducer = null, maxNumTriggers = -1, waitforFinishProduction = true, triggerInitially = false, enabled = true) {
		super(!!enabled);

		if (itemProducer === null) {
			itemProducer = () => {};
		}

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

	/**
	 * @type {Boolean}
	 */
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

	/**
	 * @override
	 * @inheritdoc
	 * @param {Date} after
	 * @param {Date} before
	 * @returns {IterableIterator<PreliminaryScheduleEvent<Interval, undefined>>}
	 */
	*preliminaryEvents(after, before) {
		if (!(after instanceof Date && before instanceof Date)) {
			throw new Error('after and/or before must be Date objects. Interval does not support unbounded intervals.');
		}
		
		let triggers = 0, start = +after, end = +before;

		if (start > end) {
			throw new Error('The Date for after happens after the Date for before.');
		}

		if (this.triggerInitially) {
			yield new PreliminaryScheduleEvent(after, this);
			triggers++;
		}
		start += this.msecs;

		while (triggers < this.maxNumTriggers && start <= end) {
			yield new PreliminaryScheduleEvent(new Date(start), this);
			start += this.msecs;
			triggers++;
		}
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

		/** @type {Array<Interval>} */
		this.intervals = [];
		/**
		 * @type {Object<string, Interval>}
		 * @protected
		 */
		this._intervalIds = {};
		/** @protected */
		this._intervalId = 0;
		/**
		 * @type {Object<string, number>}
		 * @protected
		 */
		this._timeouts = {};
	};

	/**
	 * @protected
	 * @param {Interval} interval
	 * @throws {Error} if interval is not of type Interval
	 * @returns {Boolean}
	 */
	_isInterval(interval) {
		if (!(interval instanceof Interval)) {
			throw new Error('The given interval is not an instance of Interval');
		}
		return true;
	};

	/**
	 * @protected
	 * @param {String} id 
	 * @param {Interval} interval 
	 * @param {Boolean} [triggerOnce] Optional. Defaults to false.
	 */
	async _scheduleInterval(id, interval, triggerOnce = false) {
		/** @param {Boolean} wait */
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
	 * @protected
	 * @param {Interval} interval 
	 * @returns {String}
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
	 * Calls hasInterval() with the given Schedule.
	 * 
	 * @param {Interval} schedule
	 * @returns {Boolean}
	 */
	hasSchedule(schedule) {
		return this.hasInterval(schedule);
	};

	/**
	 * @param {Interval} interval
	 * @returns {Boolean}
	 */
	hasInterval(interval) {
		return this._isInterval(interval) &&
			this.intervals.findIndex(i => i === interval) >= 0;
	};

	/**
	 * Calls addInterval() with the given Schedule.
	 * 
	 * @param {Interval} schedule
	 * @returns {this}
	 */
	addSchedule(schedule) {
		return this.addInterval(schedule);
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
	 * Calls removeInterval() with the given schedule.
	 * 
	 * @param {Interval} schedule
	 * @returns {this}
	 */
	removeSchedule(schedule) {
		return this.removeInterval(schedule);
	};

	/**
	 * Removes all Intervals and returns them. This will lead to the
	 * un-scheduling of all Intervals.
	 * 
	 * @override
	 * @inheritDoc
	 * @returns {Array<Interval>}
	 */
	removeAllSchedules() {
		const intervals = this.intervals.slice(0);
		intervals.forEach(i => this.removeSchedule(i));
		return intervals;
	};

	/**
	 * @param {Interval} interval
	 * @returns {this}
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
	 * @type {Observable<IntervalEventSimple>}
	 */
	get observable() {
		return super.observable;
	};

	/**
	 * Returns an Observable for the given Interval. Note that, for
	 * finished Intervals, an empty Observable is returned.
	 * 
	 * @override
	 * @inheritdoc
	 * @param {Schedule|Interval} interval Must be an instance of Interval
	 * @returns {Observable<IntervalEventSimple>}
	 */
	getObservableForSchedule(interval) {
		if (interval.isFinished) {
			return empty();
		}
		return super.getObservableForSchedule(interval)
			.pipe(take(interval.maxNumTriggers - interval. numOccurred));
	};
	
	/**
	 * @override
	 * @inheritdoc
	 * @param {Date} after
	 * @param {Date} before
	 * @returns {IterableIterator<PreliminaryScheduleEvent<Interval, undefined>>}
	 */
	*preliminaryEvents(after, before) {
		super.preliminaryEvents
		for (const interval of this.intervals) {
			for (const pre of interval.preliminaryEvents(...arguments)) {
				yield pre;
			}
		}
	};
};


module.exports = Object.freeze({
	Interval,
	IntervalScheduler,
	IntervalEventSimple,
	symbolIntervalEvent
});
