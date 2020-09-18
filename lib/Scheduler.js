const EventEmitter = require('events').EventEmitter
, absMethod = 'Abstract method'
, { Observable, fromEvent } = require('rxjs')
, { filter } = require('rxjs/operators')
, { Schedule, ScheduleEvent, PreliminaryScheduleEvent } = require('./Schedule');


/**
 * Generic scheduler class that can emit events of type T. The purpose
 * of this scheduler is to notify when an event occurs or something should
 * be executed. It shall be used as base-class to other schedulers. It is
 * not to be used for executing jobs, use an appropriate queue for that.
 * Although providing Observables, Schedulers never error or complete.
 * 
 * @author Sebastian Hönel <development@hoenel.net>
 * @template T
 */
class Scheduler extends EventEmitter {
	/**
	 * @param {Symbol} schedulerSymbol The symbol that is used for emitting
	 * events from this Scheduler.
	 */
	constructor(schedulerSymbol) {
		super();
		this._symbol = schedulerSymbol;
		this._observable = fromEvent(this, schedulerSymbol);
	};

	/**
	 * Returns the same Observable<T> to every subscriber. Note that this Observable
	 * never errors or drains. You will need to observe a particular Schedule to get
	 * its errors or completion.
	 * 
	 * @template T Must be of type ScheduleEvent or more derived.
	 * @returns {Observable.<T|ScheduleEvent>} That never errors or completes.
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
		return this.observable.pipe(filter(evt => evt.schedule === schedule));
	};

	/**
	 * Add a Schedule to this scheduler. This is an abstract method.
	 * 
	 * @param {Schedule} schedule
	 * @returns {this}
	 */
	addSchedule(schedule) {
		throw new Error(absMethod);
	};

	/**
	 * Remove a Schedule from this scheduler. This is an abstract method.
	 * 
	 * @param {Schedule} schedule
	 * @returns {this}
	 */
	removeSchedule(schedule) {
		throw new Error(absMethod);
	};

	/**
	 * Removes all Schedules from this scheduler. This is an abstract methdod.
	 * 
	 * @returns {Array.<Schedule>} All Schedules as array.
	 */
	removeAllSchedules() {
		throw new Error(absMethod);
	};

	/**
	 * Returns a value indicating whether this Scheduler has the given
	 * Schedule. This is an abstract method.
	 * 
	 * @param {Schedule} schedule
	 * @returns {this}
	 */
	hasSchedule(schedule) {
		throw new Error(absMethod);
	};

	/**
	 * A generator that supposedly yields all schedules' preliminary events.
	 * 
	 * @template T Must be of type PreliminaryScheduleEvent or more derived.
	 * @param {Date} [after] Optional. Defaults to undefined.
	 * @param {Date} [before] Optiona. Defaults to undefined.
	 * @returns {IterableIterator.<PreliminaryScheduleEvent.<T|Schedule, any>>}
	 */
	*preliminaryEvents(after, before) {
	};
};

module.exports = Object.freeze({
	Scheduler
});
