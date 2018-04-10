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


module.exports = Object.freeze({
  Schedule
});
