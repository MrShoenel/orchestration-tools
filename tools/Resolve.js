/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Resolve {
  /**
   * Check whether or not a value is of a specific type, that can be given
   * as an example, an actual Type/Class or the name of a class.
   * 
   * @param {any} value the value to check
   * @param {any|string} exampleOrTypeOrClassName an examplary other value you'd
   * expect, a type (e.g. RegExp) or class or the name of a class or c'tor-function.
   * @returns {boolean}
   */
  static isTypeOf(value, exampleOrTypeOrClassName) {
    if (typeof exampleOrTypeOrClassName === 'string' && typeof value === 'string') {
      // Check if the given example was a string and the value as well:
      return true;
    } else { // The example is not a string
      try {
        if (value instanceof exampleOrTypeOrClassName) { // let's make a quick check first
          return true;
        }
      } catch (e) { }
    }


    try {
      const proto = Object.getPrototypeOf(value)
      , ctor = proto.hasOwnProperty('constructor') ? proto.constructor : null;

      if (typeof exampleOrTypeOrClassName === 'string') {
        if (ctor.name === exampleOrTypeOrClassName) {
          return true;
        }
      } else if (Resolve.isFunction(exampleOrTypeOrClassName)) {
        if (value instanceof exampleOrTypeOrClassName) {
          return true;
        } else if (ctor === exampleOrTypeOrClassName) {
          return true;
        }
      } else {
        const exProto = Object.getPrototypeOf(exampleOrTypeOrClassName)
        , exCtor = exProto.hasOwnProperty('constructor') ? exProto.constructor : null;

        if (proto === exProto || ctor === exCtor) {
          return true;
        }
      }
    } catch (e) { }


    if (Resolve.isPrimitive(value) && Resolve.isPrimitive(exampleOrTypeOrClassName)
      && value === exampleOrTypeOrClassName) {
      return true;
    }

    return false;
  };

  /**
   * @param {any|Number} value 
   * @returns {boolean} true, iff the given number or NaN is of type Number
   */
  static isNumber(value) {
    return Object.prototype.toString.call(value) === '[object Number]';
  };

  /**
   * @param {any|Function|AsyncFunction} value
   * @returns {boolean} true, iff the given value is an (async) function
   */
  static isFunction(value) {
    return typeof value === 'function';
  };

  /**
   * @param {any|Promise} value
   * @returns {boolean} true, iff the value is an instance of Promise
   */
  static isPromise(value) {
    return Resolve.isTypeOf(value, Promise);
  };

  /**
   * @param {Symbol} value 
   * @returns {boolean}
   */
  static isSymbol(value) {
    return typeof value === 'symbol';
  };

  /**
   * @see {https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures}
   * @param {any} value 
   * @returns {boolean} true, iff the value is primitive
   */
  static isPrimitive(value) {
    return value === true || value === false || value === void 0 || value === null
      || typeof value === 'string' || Resolve.isNumber(value) || Resolve.isSymbol(value);
  };

  /**
   * Similar to @see {toValue}, this method returns the default value for the given
   * value, should it be undefined. Other than that, this method returns the same as
   * @see {toValue}.
   * 
   * @see {toValue}
   * @template T
   * @returns {T} the resolved-to value or its default, should it be undefined.
   */
  static async optionalToValue(defaultValue, value, exampleOrTypeOrClassName, resolveFuncs = true, resolvePromises = true) {
    if (value === void 0) {
      return defaultValue;
    }

    return await Resolve.toValue(value, exampleOrTypeOrClassName, resolveFuncs, resolvePromises);
  };

  /**
   * Resolve a literal value, a function or Promise to a value. If enabled, deeply
   * resolves functions or Promises. Attempts to resolve (to a) value until it matches
   * the expected example, type/class or class name.
   * 
   * @see {Resolve.isTypeOf}
   * @template T
   * @param {any|T|(() => T)|Promise.<T>} value a literal value or an (async) function
   * or Promise that may produce a value of the expected type or exemplary value.
   * @param {any|string|T} exampleOrTypeOrClassName an examplary other value you'd
   * expect, a type (e.g. RegExp) or class or the name of a class or c'tor-function.
   * @param {boolean} [resolveFuncs] Optional. Defaults to true. If true, then functions
   * will be called and their return value will be checked against the expected type or
   * exemplary value. Note that this parameter applies recursively, until a function's
   * returned value no longer is a function.
   * @param {boolean} [resolvePromises] Optional. Defaults to true. If true, then Promises
   * will be awaited and their resolved value will be checked against the expected type or
   * exemplary value. Note that this parameter applies recursively, until a Promise's
   * resolved value no longer is a Promise.
   * @throws {Error} if the value cannot be resolved to the expected type or exemplary
   * value.
   * @returns {T} the resolved-to value
   */
  static async toValue(value, exampleOrTypeOrClassName, resolveFuncs = true, resolvePromises = true) {
    const checkType = val => Resolve.isTypeOf(val, exampleOrTypeOrClassName)
    , orgVal = value;

    if (checkType(value)) {
      return value;
    }

    do {
      let isFunc = false, isProm = false;

      if ((resolveFuncs && (isFunc = Resolve.isFunction(value)))
        || (resolvePromises && (isProm = Resolve.isPromise(value)))) {
        value = isFunc ? value() : await value;
        if (checkType(value)) {
          return value;
        } else {
          continue;
        }
      } else {
        break;
      }
    } while (true);

    throw new Error(`The value '${JSON.stringify(orgVal)}' cannot be resolved to
      '${exampleOrTypeOrClassName}' using resolveFuncs=${resolveFuncs}
      and resolvePromises=${resolvePromises}.`);
  };
};


module.exports = Object.freeze({
  Resolve
});