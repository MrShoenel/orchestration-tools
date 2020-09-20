const symbolScheduleError = Symbol('scheduleError')
, symbolScheduleComplete = Symbol('scheduleComplete');


/**
 * A base-class for preliminary schedule events.
 * 
 * @template T, TPrelimItem
 * @author Sebastian Hönel <development@hoenel.net>
 */
class PreliminaryScheduleEvent {
	/**
	 * @param {Date} dateTime A Date object with the preliminary date and time.
	 * @param {Schedule|T} schedule A reference to the Schedule of this event.
	 * @param {TPrelimItem} [prelimItem] Optional. Defaults to undefined. An
	 * optional preliminary item, that is associated with this event. Note that
	 * this item may actually be preliminary, in a sense that the actual occurring
	 * event carries along another item. This depends on the concrete implemetation
	 * of the Scheduler and whether it is possible to provide a preliminary item.
	 */
	constructor(dateTime, schedule, prelimItem = void 0) {
		if (!(dateTime instanceof Date)) {
			throw new Error('dateTime is not a Date.');
		}
		if (!(schedule instanceof Schedule)) {
			throw new Error('schedule is not a Schedule.');
		}
		
		this.dateTime = dateTime;
		this.schedule = schedule;
		this.preliminaryItem = prelimItem;
	};
};


/**
 * A base-class for all types of schedules.
 * 
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Schedule {
	constructor(enabled = true) {
		this.enabled = !!enabled;
	};

	/**
	 * @type {Boolean}
	 */
	get isEnabled() {
		return this.enabled;
	};

	/**
	 * @param {Boolean} value
	 * @type {void}
	 */
	set isEnabled(value) {
		this.enabled = !!value;
	};

	/**
	 * Override and use this function for teardown logic as required by the
	 * specific sub-class. This method is useful e.g. clearing timeouts.
	 */
	async teardown() {
	};

	/**
	 * Returns the preliminary events for this Schedule in the interval as
	 * delimitated by after and before. The preliminary events returned de-
	 * pend on the Schedule's concrete implementation and some Schedule may
	 * not return any preliminary events. Ultimately, the Scheduler will
	 * schedule events, with no guarantee that these will coincide with the
	 * Schedule's reported preliminary events.
	 * 
	 * Note that if either after or before (or both) are omitted and the
	 * current Schedule does not support unbounded intervals, an Error must
	 * thrown by it.
	 * 
	 * @throws {Error} If the schedule does not support unbounded intervals.
	 * @param {Date} [after] Optional. Defaults to undefined. An inclusive
	 * start date and time.
	 * @param {Date} [before] Optional. Defaults to undefined. An exclusive
	 * end date and time.
	 * @returns {IterableIterator<PreliminaryScheduleEvent<Schedule, undefined>>}
	 */
	*preliminaryEvents(after = void 0, before = void 0) {
	};
};


/**
 * A base-class for all types of events as emitted by Schedules.
 * 
 * @template T, TItem A type that derives from Schedule and a type
 * that is used as items that appear on a schedule
 * @author Sebastian Hönel <development@hoenel.net>
 */
class ScheduleEvent {
	/**
	 * @param {Schedule|T} schedule The actual schedule
	 * @param {TItem} scheduleItem The happened item
	 */
	constructor(schedule, scheduleItem) {
		if (!(schedule instanceof Schedule)) {
			throw new Error(`The given schedule is not an instance of Schedule.`);
		}
		this.schedule = schedule;
		this.scheduleItem = scheduleItem;
	};
};


module.exports = Object.freeze({
	symbolScheduleError,
	symbolScheduleComplete,
	PreliminaryScheduleEvent,
	Schedule,
	ScheduleEvent
});
