const { inspect } = require('util')
, jsNumberRegex = /^(?<sign>\-)?((?<int>(0|([1-9]\d*?)))|(?<float>(0|([1-9]\d*?))?\.\d+?))(?<sci>e(\-|\d)?\d+)?$/i;


/**
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Resolve {
	/**
	 * Check whether or not a value is of a specific type, that can be given
	 * as an example, an actual Type/Class or the name of a class.
	 * 
	 * @param {any} value the value to check
	 * @param {any|String} exampleOrTypeOrClassName an examplary other value you'd
	 * expect, a type (e.g. RegExp) or class or the name of a class or c'tor-function.
	 * @returns {Boolean}
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
			, ctor = !!proto && proto.hasOwnProperty('constructor') ? proto.constructor : null;

			if (typeof exampleOrTypeOrClassName === 'string') {
				if (ctor.name === exampleOrTypeOrClassName) {
					return true;
				}
			} else if (Resolve.isFunction(exampleOrTypeOrClassName)) {
				if (ctor === exampleOrTypeOrClassName) {
					return true;
				}
			} else {
				const exProto = Object.getPrototypeOf(exampleOrTypeOrClassName)
				, exCtor = !!exProto && exProto.hasOwnProperty('constructor') ? exProto.constructor : null;

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
	 * @returns {Boolean} true, iff the given number or NaN is of type Number
	 */
	static isNumber(value) {
		return Object.prototype.toString.call(value) === '[object Number]';
	};

	/**
	 * Gets a regular expression that can be used to match valid integers,
	 * floats and floats in scientific notation.
	 * 
	 * @type {RegExp}
	 */
	static get numberRegex() {
		return jsNumberRegex;
	};

	/**
	 * Attempts conversion of a number in a string to a native number.
	 * 
	 * @param {String} value A number (as int, float or scientific notation) to
	 * be parsed to a native Number object. Also supports the literal 'NaN'.
	 * @throws {Error} if the value cannot be parsed as a number.
	 * @returns {Number} the value parsed as Number.
	 */
	static asNumber(value) {
		value = `${value}`.trim();
		if (value === 'NaN') {
			return NaN;
		}

		const match = value.match(Resolve.numberRegex);
		if (match === null) {
			throw new Error(`Cannot cast value '${value}' as number. It must be in the format ${Resolve.numberRegex.toString()}.`);
		}

		// let's check the sign and whether it's an int/float/sci:
		const groups = match.groups
		, all = `${groups.int || ''}${groups.float || ''}${groups.sci || ''}`
		, isNeg = groups.sign === '-' ? -1 : 1
		, isFloatOrSci = typeof groups.float === 'string' || typeof groups.sci === 'string'
		, parsed = isFloatOrSci ? parseFloat(all) : parseInt(all, 10);

		return isNeg * parsed;
	};

	/**
	 * Attempts conversion of a value to number, iff it is a valid number. Otherwise
	 * returns the value as is. Uses @see {asNumber}.
	 * 
	 * @template T Basically any value.
	 * @param {T|String|Number} value A value that is checked for whether it is a
	 * valid number or not. If the value is already a Number, it is returned as is.
	 * If it is a String, it is attempted to parse. Should that fail, the value is
	 * returned as is. If the value is not a Number and not a String, it is also
	 * returned as is.
	 * @returns {T|String|Number}
	 */
	static tryAsNumber(value) {
		const t = typeof value;

		if (t === 'number') {
			return value;
		} else if (t === 'string') {
			try {
				return Resolve.asNumber(value);
			} catch (e) {
				return value;
			}
		}

		return value;
	};

	/**
	 * @param {any|Function|AsyncFunction} value
	 * @returns {Boolean} true, iff the given value is an (async) function
	 */
	static isFunction(value) {
		return typeof value === 'function';
	};

	/**
	 * @param {any|Promise} value
	 * @returns {Boolean} true, iff the value is an instance of Promise
	 */
	static isPromise(value) {
		return Resolve.isTypeOf(value, Promise);
	};

	/**
	 * @param {Symbol} value 
	 * @returns {Boolean}
	 */
	static isSymbol(value) {
		return typeof value === 'symbol';
	};

	/**
	 * @info {https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures}
	 * @param {any} value 
	 * @returns {Boolean} true, iff the value is primitive
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

		return await Resolve.toValue(...[...arguments].slice(1));
	};

	/**
	 * Resolve a literal value, a function or Promise to a value. If enabled, deeply
	 * resolves functions or Promises. Attempts to resolve (to a) value until it matches
	 * the expected example, type/class or class name.
	 * 
	 * @see {Resolve.isTypeOf}
	 * @template T
	 * @param {any|T|producerHandler<T>|Promise<T>} value a literal value or an (async) function
	 * or Promise that may produce a value of the expected type or exemplary value.
	 * @param {any|string|T} [exampleOrTypeOrClassName] Optional. If not given, will only
	 * resolve functions and promises to a value that is not a function and not a Promise.
	 * Otherwise, pass in an examplary other value you'd expect, a type (e.g. RegExp) or
	 * class or the name of a class or c'tor-function.
	 * @param {Boolean} [resolveFuncs] Optional. Defaults to true. If true, then functions
	 * will be called and their return value will be checked against the expected type or
	 * exemplary value. Note that this parameter applies recursively, until a function's
	 * returned value no longer is a function.
	 * @param {Boolean} [resolvePromises] Optional. Defaults to true. If true, then Promises
	 * will be awaited and their resolved value will be checked against the expected type or
	 * exemplary value. Note that this parameter applies recursively, until a Promise's
	 * resolved value no longer is a Promise.
	 * @throws {Error} if the value cannot be resolved to the expected type or exemplary
	 * value.
	 * @returns {T} the resolved-to value
	 */
	static async toValue(value, exampleOrTypeOrClassName, resolveFuncs = true, resolvePromises = true) {
		const hasExample = arguments.length > 1
		, checkType = val => {
			return Resolve.isTypeOf(val, exampleOrTypeOrClassName) ||
				(!hasExample && !Resolve.isFunction(val) && !Resolve.isPromise(val));
		} , orgVal = value;

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

		throw new Error(`The value '${inspect(orgVal)}' cannot be resolved to
			'${exampleOrTypeOrClassName}' using resolveFuncs=${resolveFuncs}
			and resolvePromises=${resolvePromises}.`);
	};

	/**
	 * @see {Resolve.toValue}
	 * @template T
	 * Convenience method for resolving functions and/or Promises to values. Calls
	 * toValue() without an example which leads to resolving the given function or
	 * Promise until it yields a value that is not a function and not a Promise.
	 * @param {producerHandler<T|Promise<T>>|Promise<T>} asyncFuncOrPromise An (async)
	 * function or a Promise.
	 * @returns {T} The result of deeply resolving the given function or Promise.
	 */
	static async asyncFuncOrPromise(asyncFuncOrPromise) {
		if (!Resolve.isFunction(asyncFuncOrPromise) && !Resolve.isPromise(asyncFuncOrPromise)) {
			throw new Error(`The value given for func is neither an (async) function nor a Promise. The value given was: ${inspect(asyncFuncOrPromise)}`);
		}
		return await Resolve.toValue(asyncFuncOrPromise);
	};
};


module.exports = Object.freeze({
	Resolve
});