const ical = require('ical.js')
, Rx = require('rxjs')
, Observable = Rx.Observable // we do this for annotations
, Event = ical.Event
, EventEmitter = require('events').EventEmitter
, symbolCalendarEvent = Symbol('calendarEvent');



/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class CalendarEventSimple {
  /**
   * @param {Event} event
   * @param {boolean} isBeginOfEvent should be true if this event
   * marks the start/beginning of the event
   * @param {boolean} isEndOfEvent should be true if this event
   * marks the end of the event
   */
  constructor(event, isBeginOfEvent = true, isEndOfEvent = false) {
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
class CalendarScheduler extends EventEmitter {
  /**
   * 
   * @param {number} scheduleIntervalSecs an interval, in seconds, to check
   * all calendars and schedule their events (regardless of Calendar's update-
   * interval). Since a calendar is usually not required to be accurate to the
   * millisecond, the lowests allowed value is five (5) seconds. The recommen-
   * ded value is 20 seconds and there is no upper limit.
   */
  constructor(scheduleIntervalSecs = 20) {
    super();

    if (isNaN(scheduleIntervalSecs) || scheduleIntervalSecs < 5) {
      throw new Error('scheduleIntervalSecs must not be less than 5 seconds.');
    }

    /** @type {Array.<Calendar>} */
    this.calendars = [];
    /**
     * For each Calendar, this object will have another object, which holds
     * the Calendar's scheduled events.
     * @type {Object.<Object.<NodeJS.Timeout>>}
     */
    this._scheduledEvents = {};

    /** @type {Object.<number>} */
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
      await calendar.refresh();
      this._scheduleCalendar(calendar);
    } finally {
      this._scheduledCalendarUpdates[calId] = setTimeout(() => {
        this._updateCalendar(calendar);
        this._scheduledCalendarUpdates[calId] = null;
        delete this._scheduledCalendarUpdates[calId];
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


    const lookAheadMs = this.scheduleIntervalSecs * 2 * 1e3,
      now = new Date(
        (+new Date) + (60 * 1e3 * new Date().getTimezoneOffset()));

    for (const evt of calendar.events) {
      const eId = evt.uid,
        sd = evt.startDate, ed = evt.endDate,
        dateStart = new Date(
          sd.year, sd.month - 1, sd.day, sd.hour, sd.minute, sd.second),
        dateEnd = new Date(
          ed.year, ed.month - 1, ed.day, ed.hour, ed.minute, ed.second);
        
      const startDiff = (+dateStart - +now);
      if (startDiff > 0 && startDiff <= lookAheadMs) {
        // Schedule the start of this event
        scheduleEvt(
          `${eId}.start`, new CalendarEventSimple(evt, true, false), startDiff);

        // Also check if the end of the event is within the lookahead:
        const endDiff = (+dateEnd - +now);
        if (endDiff > startDiff && endDiff <= lookAheadMs) {
          // Schedule the end of this event
          scheduleEvt(
            `${eId}.end`, new CalendarEventSimple(evt, false, true), endDiff);
        }
      }
    }
  };

  /**
   * @param {Calendar} calendar 
   */
  removeCalendar(calendar) {
    this._unscheduleCalendar(calendar);

    if (!this.hasCalendar(calendar)) {
      throw new Error(`The calendar with ID/name "${calendar.nameOrId}" cannot be found.`);
    }

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
    return this;
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
    if (waitForUpdate) {
      await this._updateCalendar(calendar);
      this._scheduleCalendar(calendar);
    }
    return this;
  };

  /**
   * Returns an Rx.Observable that will emit events whenever they
   * are reported to its subscribers.
   * 
   * @returns {Observable.<CalendarEventSimple>}
   */
  get observable() {
    return Rx.Observable.fromEvent(this, symbolCalendarEvent);
  };
};


/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Calendar {
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
   */
  constructor(nameOrId, icsProvider, icsIntervalMsecs = 10000) {
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
    /** @type {Array.<Event>} */
    this.events = [];
  };

  async refresh() {
    let providerResult = this.icsProvider();

    if (providerResult instanceof Promise) {
      providerResult = await providerResult;
    }

    if (typeof providerResult !== 'string') {
      throw new Error(`The icsProvider did not return valid iCal-data.`);
    }
    
    const jCalData = ical.parse(providerResult);
    const comp = new ical.Component(jCalData);

    this.events = comp
      .getAllSubcomponents('vevent').map(v => new Event(v));
    
    return this;
  };
};


module.exports = Object.freeze({
  Calendar,
  CalendarEventSimple,
  CalendarScheduler,
  symbolCalendarEvent
});