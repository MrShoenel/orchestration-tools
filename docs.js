/**
 * @template T
 * @typedef Deferred
 * @property {Promise<T>} promise the underyling Promise
 * @property {(?val: T) => void} resolve the resolve function
 * @property {(?err: any) => void} reject the reject function
 */


/**
 * @template T
 * @callback callbackHandler
 * @param {T} value
 * @return {any}
 */


/**
 * @template T
 * @callback producerHandler
 * @return {T}
 */


/**
 * @template T1, TResult
 * @callback consumerProducer1ArgHandler
 * @param {T1} value1
 * @returns {TResult} 
 */


/**
 * @template T1, T2, TResult
 * @callback consumerProducer2ArgHandler
 * @param {T1} value1
 * @param {T2} value2
 * @returns {TResult} 
 */


/**
 * @template T1, T2, T3, TResult
 * @callback consumerProducer3ArgHandler
 * @param {T1} value1
 * @param {T2} value2
 * @param {T3} value3
 * @returns {TResult} 
 */


/**
 * @template T1, T2, T3, T4, TResult
 * @callback consumerProducer4ArgHandler
 * @param {T1} value1
 * @param {T2} value2
 * @param {T3} value3
 * @param {T4} value4
 * @returns {TResult} 
 */


/**
 * @template T1
 * @callback predicate1Arg
 * @param {T1} value1
 * @returns {boolean}
 */


/**
 * @typedef iCalTimeZone
 * @type {Object}
 * @property {Array} changes
 * @property {number} expandedUntilYear
 * @property {string} tzid
 */

/**
 * @typedef iCalTime
 * @type {Object}
 * @property {number} hour
 * @property {number} minute
 * @property {number} second
 * @property {number} day
 * @property {number} month
 * @property {number} year
 * @property {string} icaltype
 * @property {string} timezone
 * @property {boolean} isDate
 * @property {() => Date} toJSDate
 */

/**
 * @typedef iCalDuration
 * @type {Object}
 * @property {number} days
 * @property {number} hours
 * @property {number} minutes
 * @property {number} seconds
 * @property {number} weeks
 * @property {boolean} isNegative
 */

/**
 * @typedef iCalEvent
 * @type {Object}
 * @property {Array} attendees
 * @property {string|null} description
 * @property {string} uid
 * @property {string|null} summary
 * @property {string|null} location
 * @property {string|null} organizer
 * @property {string|number|null} recurrenceId
 * @property {number} sequence
 * @property {iCalDuration} duration
 * @property {iCalTime} endDate
 * @property {iCalTime} startDate
 * @property {Object.<string, Error>} exceptions
 * @property {Array} rangeExceptions
 */
