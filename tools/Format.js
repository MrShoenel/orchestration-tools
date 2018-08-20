const { inspect} = require('util');



/**
 * Formats any value to a useful string that reflects the given value's contents.
 * 
 * Formats like this if val is:
 * - undefined: '<undefined>'
 * - null: '<null>'
 * - typeof string: val (identity)
 * - val.toString() if val's prototype !== null || val's prototype.ctor !== Object
 * - inspect(val), otherwise
 * 
 * @author Sebastian Hönel <development@hoenel.net>
 * @param {any} val
 * @returns {string}
 */
const formatValue = val => {
  if (val === void 0) {
    return '<undefined>';
  } else if (val === null) {
    return '<null>';
  }

  if (typeof val === 'string') {
    return val;
  } else if (Array.isArray(val)) {
    return `[ ${val.map(v => formatValue(v)).join(', ') } ]`;
  } else {
    // We do not want to call toString() on bare Objects where prototype === null
    // or where the Prototype is Object because it will result in [object Object].
    try {
      const proto = Object.getPrototypeOf(val);

      const skipToString = proto === null ||
        ('constructor' in proto && proto.constructor === Object);

      if (!skipToString) {
        return val.toString();
      }
    } catch (e) { } // Object.getPrototypeOf threw
  }

  return inspect(val);
};



/**
 * Formats an Error like this if err is (all returned values are prefixed by 'Error: '):
 * - not an Error: return 'Error: formatValue(err)'
 * - an Error: [err.constructor.name] optionally followed by ': ' if the error has a
 *   message or a stack; If it has a stack, the stack's print is prefixed by 'Stack: '
 * 
 * @author Sebastian Hönel <development@hoenel.net>
 * @param {Error|any} err An instance of Error or any other thrown value.
 * @returns {string}
 */
const formatError = err => {
  if (err instanceof Error) {
    const msg = formatValue(err.message)
    , stack = formatValue(err.stack);

    return `${err.constructor.name}: ${msg}${stack.length > 0 ? ' Stack: ' : ''}${stack}`;
  }

  return `Error: ${formatValue(err)}`;
};


module.exports = Object.freeze({
  formatValue,
  formatError
});