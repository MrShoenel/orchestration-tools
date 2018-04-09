const ical = require('ical.js')
, Rx = require('rxjs')
, Observable = Rx.Observable // we do this for annotations
, EventEmitter = require('events').EventEmitter
, symbolCalendarEvent = Symbol('calendarEvent');



class CalendarEventSimple {
  /**
   * @param {ical.Event} event 
   */
  constructor(event) {
    this.event = event;
  };

  /**
   * @returns {string}
   */
  get id() {
    return `${this.event.uid}`;
  }

  /**
   * @returns {string}
   */
  get summary() {
    return `${this.event.summary}`;
  };

  get description() {
    return `${this.event.description}`;
  };

  get descriptionJson() {
    return JSON.parse(this.description);
  };
};


class CalendarScheduler extends EventEmitter {
  constructor() {
    super();
    /** @type {Array.<Calendar>} */
    this.calendars = [];
    /** @type {Object.<NodeJS.Timeout>} */
    this._scheduledEvents = {};
  };

  /**
   * @param {Calendar} calendar 
   */
  removeCalendar(calendar) {
    const idx = this.calendars.findIndex(c => c === calendar);
    if (idx < 0) {
      throw new Error(`The calendar with ID/name "${calendar.nameOrId}" cannot be found.`);
    }

    this.calendars.splice(idx, 1);
    this._scheduleEvents(); // Will remove events that come this calendar
    return this;
  };

  /**
   * @param {Calendar} calendar
   */
  hasCalendar(calendar) {
    return this.calendars.findIndex(c => c === calendar) >= 0;
  };

  /**
   * @param {Calendar} calendar
   * @param {boolean} waitForUpdate if true, will wait to resolve the promise
   * until the added calendar has been updated.
   * @return {Promise.<this>}
   */
  async addCalendar(calendar, waitForUpdate = true) {
    this.calendars.push(calendar);
    if (waitForUpdate) {
      await this._updateCalendar(calendar);
    }
    return this;
  };

  /**
   * @param {Calendar} calendar 
   */
  async _updateCalendar(calendar) {
    try {
      await calendar.refresh();
      this._scheduleEvents();
    } finally {
      setTimeout(() => {
        if (this.hasCalendar(calendar)) {
          this._updateCalendar(calendar);
        }
      }, calendar.refreshInterval);
    }
  };

  _scheduleEvents() {
    const that = this;
    for (const eId of Object.keys(this._scheduledEvents)) {
      clearTimeout(this._scheduledEvents[eId]);
      delete this._scheduledEvents[eId];
    }

    const now = new Date((+new Date) + (60 * 1e3 * new Date().getTimezoneOffset()));

    for (const cal of this.calendars) {
      for (const evt of cal.events) {
        const sd = evt.startDate;
        const date = new Date(
          sd.year, sd.month - 1, sd.day, sd.hour, sd.minute, sd.second);
        
        const diff = +date - +now;
        if (diff > 0) {
          // Some event in the future.
          const fqEvtId = `${cal.nameOrId}.${evt.uid}`;
          this._scheduledEvents[fqEvtId] = setTimeout(() => {
            delete this._scheduledEvents[fqEvtId];
            this.emit(symbolCalendarEvent, new CalendarEventSimple(evt));
          }, diff);
        }
      }
    }
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
    /** @type {Array.<ical.Event>} */
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
      .getAllSubcomponents('vevent').map(v => new ical.Event(v));
    
    return this;
  };
};


module.exports = Object.freeze({
  Calendar,
  CalendarEventSimple,
  CalendarScheduler,
  symbolCalendarEvent
});