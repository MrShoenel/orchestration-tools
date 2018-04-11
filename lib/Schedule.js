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
   * @returns {boolean}
   */
  get isEnabled() {
    return this.enabled;
  };

  /**
   * @property {boolean} value
   */
  set isEnabled(value) {
    this.enabled = !!value;
  };
};


class ScheduleEvent {
  /**
   * @template T A type that derives from Schedule
   * @template TItem A type that is used as items that appear on a schedule
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
  Schedule,
  ScheduleEvent
});
