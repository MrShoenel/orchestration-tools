require('../docs');

const ical = require('ical.js')
, { Scheduler } = require('./Scheduler')
, { Schedule, ScheduleEvent } = require('./Schedule')
, { EventEmitter } = require('events')
, IcalExpander = require('ical-expander')
, Rx = require('rxjs')
, Observable = Rx.Observable // we do this for annotations
, symbolCalendarEvent = Symbol('calendarEvent');

/** @type {iCalEvent} */
const Event = ical.Event;



class MyIcalExpander extends IcalExpander {
  constructor(opts) {
    super(opts);
  };

  /**
   * @param {Date} after
   * @param {Date} before
   * @returns {Array.<{ events: Array.<Event>, occurrences: Array.<Event> }>}
   */
  betweenWithExceptions(after, before) {
    function isEventWithinRange(startTime, endTime) {
      return (!after || endTime >= after.getTime()) &&
      (!before || startTime <= before.getTime());
    }

    function getTimes(eventOrOccurrence) {
      const startTime = eventOrOccurrence.startDate.toJSDate().getTime();
      let endTime = eventOrOccurrence.endDate.toJSDate().getTime();

      // If it is an all day event, the end date is set to 00:00 of the next day
      // So we need to make it be 23:59:59 to compare correctly with the given range
      if (eventOrOccurrence.endDate.isDate && (endTime > startTime)) {
        endTime -= 1;
      }

      return { startTime, endTime };
    }

    const exceptions = [];

    this.events.forEach((event) => {
      if (event.isRecurrenceException()) exceptions.push(event);
    });

    const ret = {
      events: [],
      occurrences: []
    };

    this.events/*.filter(e => !e.isRecurrenceException())*/.forEach((event) => {
      const exdates = [];

      event.component.getAllProperties('exdate').forEach((exdateProp) => {
        const exdate = exdateProp.getFirstValue();
        exdates.push(exdate.toJSDate().getTime());
      });

      // Recurring event is handled differently
      if (event.isRecurring()) {
        const iterator = event.iterator();

        let next;
        let i = 0;

        do {
          i += 1;
          next = iterator.next();
          if (next) {
            const occurrence = event.getOccurrenceDetails(next);

            const { startTime, endTime } = getTimes(occurrence);

            const isOccurrenceExcluded = exdates.indexOf(startTime) !== -1;

            // TODO check that within same day?
            const exception = exceptions.find(ex => ex.uid === event.uid && ex.recurrenceId.toJSDate().getTime() === occurrence.startDate.toJSDate().getTime());

            // We have passed the max date, stop
            if (before && startTime > before.getTime()) break;

            // Check that we are within our range
            if (isEventWithinRange(startTime, endTime)) {
              if (exception) {
                ret.events.push(exception);
              } else if (!isOccurrenceExcluded) {
                ret.occurrences.push(occurrence);
              }
            }
          }
        }
        while (next && (!this.maxIterations || i < this.maxIterations));

        return;
      }

      // Non-recurring event:
      const { startTime, endTime } = getTimes(event);

      if (isEventWithinRange(startTime, endTime)) ret.events.push(event);
    });

    return ret;
  };
};



/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class CalendarEventSimple extends ScheduleEvent {
  /**
   * @param {Calendar} calendar the Calendar this event is coming from
   * @param {Event|iCalEvent} event
   * @param {boolean} isBeginOfEvent should be true if this event
   * marks the start/beginning of the event
   * @param {boolean} isEndOfEvent should be true if this event
   * marks the end of the event
   */
  constructor(calendar, event, isBeginOfEvent = true, isEndOfEvent = false) {
    super(calendar, event);
    this.calendar = calendar;
    this.event = event;
    this.isBeginOfEvent = isBeginOfEvent;
    this.isEndOfEvent = isEndOfEvent;
  };

  /**
   * @returns {string}
   */
  get id() {
    return `${this.event.uid}`;
  };

  /**
   * @returns {string}
   */
  get summary() {
    return `${this.event.summary}`;
  };

  /**
   * @returns {string}
   */
  get description() {
    return `${this.event.description}`;
  };

  /**
   * This property is useful, if the description contains JSON.
   * This property will throw, if description does not contain
   * JSON and it is being accessed.
   * 
   * @returns {Object}
   */
  get descriptionJson() {
    return JSON.parse(this.description);
  };
};


/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class CalendarScheduler extends Scheduler {
  /**
   * 
   * @param {number} scheduleIntervalSecs an interval, in seconds, to check
   * all calendars and schedule their events (regardless of Calendar's update-
   * interval). Since a calendar is usually not required to be accurate to the
   * millisecond, the lowests allowed value is five (5) seconds. The recommen-
   * ded value is 20 seconds and there is no upper limit.
   */
  constructor(scheduleIntervalSecs = 20) {
    super(symbolCalendarEvent);

    if (isNaN(scheduleIntervalSecs) || scheduleIntervalSecs < 5) {
      throw new Error('scheduleIntervalSecs must not be less than 5 seconds.');
    }

    /** @type {Array.<Calendar>} */
    this.calendars = [];
    /**
     * For each Calendar, this object will have another object, which holds
     * the Calendar's scheduled events.
     * @type {Object.<string, Object.<string, number>>}
     */
    this._scheduledEvents = {};

    /** @type {Object.<string, number>} */
    this._scheduledCalendarUpdates = {};

    this.scheduleIntervalSecs = scheduleIntervalSecs;
    /** @type {number} */
    this._schedulerInterval = null;
    this._initializeScheduler();
  };

  /**
   * @param {Calendar} calendar
   * @returns {boolean} true, iff the given calendar is an instance of Calendar.
   */
  _isCalendar(calendar) {
    if (!(calendar instanceof Calendar)) {
      throw new Error('The supplied calendar is not an instance of Calendar.');
    }
    return true;
  };

  _initializeScheduler() {
    if (this.calendars.length === 0) {
      // Then cancel any scheduling interval (if any)
      if (this._schedulerInterval !== null) {
        clearInterval(this._schedulerInterval);
        this._schedulerInterval = null;
      }
    } else {
      this._schedulerInterval = setInterval(() => {
        this._scheduleAllCalendars();
      }, this.scheduleIntervalSecs * 1e3);
    }
  };

  /**
   * @param {Calendar} calendar 
   */
  async _updateCalendar(calendar) {
    this._isCalendar(calendar);
    const calId = calendar.nameOrId;
    try {
      if (calendar.isEnabled) {
        await calendar.refresh();
        this._scheduleCalendar(calendar);
      } else {
        this._unscheduleCalendar(calendar);
      }
    } finally {
      if (!this.hasCalendar(calendar)) {
        return; // Could have been removed in the meantime..
      }
      this._scheduledCalendarUpdates[calId] = setTimeout(() => {
        this._scheduledCalendarUpdates[calId] = null;
        delete this._scheduledCalendarUpdates[calId];
        this._updateCalendar(calendar);
      }, calendar.refreshInterval);
    }
  };

  _scheduleAllCalendars() {
    for (const calendar of this.calendars) {
      this._scheduleCalendar(calendar);
    }
  };

  /**
   * @param {Calendar} calendar 
   */
  _unscheduleCalendar(calendar) {
    this._isCalendar(calendar);
    
    if (!this.hasCalendar(calendar)) {
      throw new Error(`The calendar with ID/name "${calendar.nameOrId}" cannot be found.`);
    }

    const calId = calendar.nameOrId,
      events = this._scheduledEvents[calId];

    for (const eId of Object.keys(events)) {
      clearTimeout(events[eId]);
      events[eId] = null;
      delete events[eId];
    }
  };

  /**
   * @param {Calendar} calendar 
   */
  _scheduleCalendar(calendar) {
    this._unscheduleCalendar(calendar);

    if (!calendar.isEnabled) {
      return;
    }

    const calId = calendar.nameOrId,
      events = this._scheduledEvents[calId];

    /**
     * @param {string} eId 
     * @param {CalendarEventSimple} calSimpleEvt 
     * @param {number} timeoutMsecs
     */
    const scheduleEvt = (eId, calSimpleEvt, timeoutMsecs) => {
      events[eId] = setTimeout(() => {
        events[eId] = null;
        delete events[eId];
        this.emit(symbolCalendarEvent, calSimpleEvt);
      }, timeoutMsecs);
    };


    const lookAheadMs = this.scheduleIntervalSecs * 2 * 1e3
    , now = new Date()
    , maxDate = new Date(+now + lookAheadMs);

    const occurrences = calendar.expander.betweenWithExceptions(now, maxDate);
    /** @type {Array.<{ evt: iCalEvent, startDate: iCalTime, endDate: iCalTime }>} */
    const arr = []
      .concat(occurrences.events.map(e => {
        return {
          evt: e,
          startDate: e.startDate,
          endDate: e.endDate
        };
      })).concat(occurrences.occurrences.map(o => {
        return {
          evt: o.item,
          startDate: o.startDate,
          endDate: o.endDate
        };
      })).filter(occ => {
        // Apply the Calendar's filter:
        return calendar.events.findIndex(e => e.uid === occ.evt.uid) >= 0;
      });

    arr.forEach(occ => {
      const eId = occ.evt.uid
      , startDiff = (+occ.startDate.toJSDate() - +now);

      if (startDiff > 0 && startDiff <= lookAheadMs) {
        // Schedule the start of this event
        scheduleEvt(
          `${eId}.start`, new CalendarEventSimple(calendar, occ.evt, true, false), startDiff);

      }

      // Also check if the end of the event is within the lookahead:
      const endDiff = (+occ.endDate.toJSDate() - +now);
      if (endDiff > startDiff && endDiff <= lookAheadMs) {
        // Schedule the end of this event
        scheduleEvt(
          `${eId}.end`, new CalendarEventSimple(calendar, occ.evt, false, true), endDiff);
      }
    });
  };

  /**
   * Calls removeCalendar() with the given Schedule.
   * 
   * @param {Calendar} schedule
   * @returns {this}
   */
  removeSchedule(schedule) {
    return this.removeCalendar(schedule);
  };

  /**
   * @param {Calendar} calendar
   * @returns {this}
   */
  removeCalendar(calendar) {
    this._unscheduleCalendar(calendar);

    const calId = calendar.nameOrId;
    if (this._scheduledCalendarUpdates.hasOwnProperty(calId)) {
      clearTimeout(this._scheduledCalendarUpdates[calId]);
      this._scheduledCalendarUpdates[calId] = null;
      delete this._scheduledCalendarUpdates[calId];
    }

    delete this._scheduledEvents[calId];

    const idx = this.calendars.findIndex(c => c === calendar);
    this.calendars.splice(idx, 1);
    this._scheduleAllCalendars(); // Will remove events that come this calendar
    this._initializeScheduler(); // This will cancel internal scheduling if no calendars
    return this;
  };

  /**
   * Calls hasCalendar() with the given Schedule.
   * 
   * @param {Calendar} schedule
   * @returns {boolean}
   */
  hasSchedule(schedule) {
    return this.hasCalendar(schedule);
  };

  /**
   * @param {Calendar} calendar
   */
  hasCalendar(calendar) {
    return this._isCalendar(calendar)
      && this._scheduledEvents.hasOwnProperty(calendar.nameOrId)
      && this.calendars.findIndex(c => c === calendar) >= 0;
  };

  /**
   * Calls addCalendar(schedule, waitForUpdate = false) so that the call
   * behaves synchronously.
   * 
   * @param {Calendar} schedule
   * @returns {this}
   */
  addSchedule(schedule) {
    this._isCalendar(schedule);
    this.addCalendar(schedule, false);
    return this;
  };

  /**
   * @param {Calendar} calendar
   * @param {boolean} waitForUpdate if true, will wait to resolve the promise
   * until the added calendar has been updated.
   * @return {Promise.<this>}
   */
  async addCalendar(calendar, waitForUpdate = true) {
    this._isCalendar(calendar);
    if (this._scheduledEvents.hasOwnProperty(calendar.nameOrId)) {
      throw new Error(`There is already a Calendar with the name/ID "${calendar.nameOrId}".`);
    }

    this._scheduledEvents[calendar.nameOrId] = {};

    this.calendars.push(calendar);
    const updatePromise = this._updateCalendar(calendar).catch(_ => {});
    if (waitForUpdate) {
      await updatePromise;
    }

    // This is necessary if there were no Calendars previously
    this._initializeScheduler();

    return this;
  };

  /**
   * Returns an Rx.Observable that will emit events whenever they
   * are reported to its subscribers.
   * 
   * @returns {Observable.<CalendarEventSimple>}
   */
  get observable() {
    return super.observable;
  };

  /**
   * Returns an Observable for the designated schedule (here: the
   * calendar).
   * 
   * @param {Schedule|Calendar} calendar Must be an instance of Calendar.
   * @returns {Observable.<CalendarEventSimple>}
   */
  getObservableForSchedule(calendar) {
    this._isCalendar(calendar);
    if (!this.hasCalendar(calendar)) {
      throw new Error(`The calendar with ID/name "${calendar.nameOrId}" cannot be found.`);
    }
    return super.getObservableForSchedule(calendar);
  };
};


/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Calendar extends Schedule {
  /**
   * @param {String} nameOrId a name or ID for this calendar (should be
   * unique across all calendars).
   * @param {() => String|Promise.<String>} icsProvider a function that
   * returns the underlying iCal data as string.
   * @param {number} icsIntervalMsecs the interval in milliseconds, to
   * refresh this calendar and reload the iCal-data from the provider.
   * It is not recommended to refresh a calendar more often than every
   * 10 seconds. Of course, this depends on where your calendar is coming
   * from. If the interval is less than 5 seconds, the constructor throws.
   * @param {boolean} enabled if true, this Interval is enabled. Otherwise,
   * its events are ignored until it get enabled.
   */
  constructor(nameOrId, icsProvider, icsIntervalMsecs = 10000, enabled = true) {
    super(!!enabled);

    if (typeof nameOrId !== 'string' || nameOrId.length === 0) {
      throw new Error(`The name or ID must be a non-empty string and it must be unique across all calendars.`);
    }
    if (typeof icsProvider !== 'function') {
      throw new Error(`The icsProvider is not a function.`);
    }
    if (isNaN(icsIntervalMsecs) || icsIntervalMsecs < 5000) {
      throw new Error(`The icsIntervalMsecs must be a reasonable large positive number.`);
    }

    this.nameOrId = nameOrId;
    this.icsProvider = icsProvider;
    this.refreshInterval = icsIntervalMsecs;

    /** @type {Array.<Event|iCalEvent>} */
    this._events = [];

    /** @type {(evts: Array.<Event|iCalEvent>) => boolean} */
    this._filter = _ => this._events;

    /** @type {MyIcalExpander} */
    this._expander = null;
  };

  /**
   * @returns {MyIcalExpander}
   */
  get expander() {
    return this._expander;
  };

  /**
   * @returns {Array.<Event|iCalEvent>}
   */
  get events() {
    return this._events.filter(this._filter);
  };

  /**
   * Apply a filter to this Calendar's events. The filter must return true
   * if an entry shall be kept; false, otherwise.
   * 
   * @param {((evt: Event|iCalEvent) => boolean)} filter 
   * @returns {this}
   */
  setFilter(filter) {
    if (!(filter instanceof Function)) {
      throw new Error(`The filter must be a function`);
    }
    this._filter = filter;
    return this;
  };

  /**
   * Removes a filter that was set by setFilter(). This Calendar then will
   * work with all its events again.
   * 
   * @returns {this}
   */
  removeFilter() {
    this._filter = _ => this._events;
    return this;
  };

  /**
   * Called by the CalendarScheduler to query this Calendar's underlying
   * ICS-provider. This method is useful if the ICS-provider e.g. points
   * to web-based calendar.
   * 
   * @returns {Promise.<this>}
   */
  async refresh() {
    let providerResult = this.icsProvider();

    if (providerResult instanceof Promise) {
      providerResult = await providerResult;
    }

    if (typeof providerResult !== 'string') {
      throw new Error(`The icsProvider did not return valid iCal-data.`);
    }

    this._expander = new MyIcalExpander({ ics: providerResult });
    this._events = this.expander.events;
    
    return this;
  };

  /**
   * Takes a predicate to filter this Calendar's events and returns a
   * new, derived Calendar. Calls to refresh() have been overridden in
   * the derived instance to await the underlying Calendar's refresh
   * and apply the filter afterwards.
   * 
   * @deprecated use setFilter() and removeFilter() instead. This method
   * will be removed in v3.x!
   * @param {(evt: Event|iCalEvent) => boolean} predicate Used to filter
   * this Calendar's events using some criteria.
   * @param {string} addName Used as a predicate to this Calendar's name
   * or ID so that we end up with a new, unique name or ID. Must not be
   * empty. The resulting name will be "calendar-name.addName".
   * @returns {Calendar}
   */
  createFiltered(predicate, addName = 'filtered') {
    if (typeof addName !== 'string' || addName.length === 0) {
      throw new Error(`The value "${addName}" given for the parameter name is not valid.`);
    }

    const that = this;
    return new class extends this.constructor {
      constructor() {
        super(`${that.nameOrId}.${addName}`, that.icsProvider, that.refreshInterval, that.isEnabled);
      };

      async refresh() {
        await super.refresh();
        this._events = this._events.filter(predicate);
        return this;
      };
    };
  };
};


module.exports = Object.freeze({
  Calendar,
  CalendarEventSimple,
  CalendarScheduler,
  symbolCalendarEvent
});