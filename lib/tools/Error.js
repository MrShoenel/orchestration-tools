const { formatError } = require('./Format');


/**
 * Optionally wraps an arbitrary value that shall be thrown as an Error
 * into an instance of Error by applying formatError() and constructing
 * a new Error from it.
 * If the given error is an instance of Error, then it is returned as is.
 * 
 * @param {Error|any} error The value that should be thrown and needs to
 * be wrapped.
 * @returns {Error} Always returns an instance of Error.
 */
const wrapError = error => {
	if (error instanceof Error) {
		return error;
	}

	return new Error(formatError(error).replace(/^Error:\s*/, ''));
};


/**
 * Throws an Error by conditionally wrapping the given error into an
 * actual instance of Error using wrapError().
 * 
 * @param {Error|any} error The value that should be thrown.
 * @throws {Error} The given error as is (if instance of Error) or being
 * wrapped into an Error.
 */
const throwError = error => {
	throw wrapError(error);
};


module.exports = Object.freeze({
	wrapError,
	throwError
});