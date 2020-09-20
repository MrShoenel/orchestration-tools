require('../../docs');


/**
 * A function that creates an awaitable timout.
 * 
 * @param {Number} ms Milliseconds to wait before resolving
 * @returns {Promise<void>} a Promise that is resolved after
 * the amount of milliseconds given.
 */
const timeout = ms => new Promise((resolve, reject) => {
	setTimeout(resolve, ms);
});


/**
 * @template T
 * 
 * Creates a deferred Promise and returns an object with functions
 * that can be used to resolve or reject the deferred.
 * 
 * @returns {Deferred<T>}
 */
const defer = () => {
	/** @type {DeferredClass<T>} */
	return new DeferredClass();
};



/**
 * @template T
 */
class DeferredClass {
	constructor() {
		/** @private */
		this._resolve = null;
		/** @private */
		this._reject = null;

		const that = this;
		/** @private */
		this._promise = new Promise((resolve, reject) => {
			that._resolve = resolve;
			that._reject = reject;
		});

		/** @private */
		this._isResolved = false;
		/** @private */
		this._isRejected = false;
	};

	/**
	 * @type {Boolean}
	 */
	get isResolved() {
		return this._isResolved;
	};

	/**
	 * @type {Boolean}
	 */
	get isRejected() {
		return this._isRejected;
	};

	/**
	 * @type {Promise<T>}
	 */
	get promise() {
		return this._promise;
	};

	/**
	 * @param {T} useValue
	 * @returns {this}
	 */
	resolve(useValue) {
		if (this.isResolved) {
			throw new Error('Already resolved');
		}
		if (this.isRejected) {
			throw new Error('Already rejected');
		}
		this._isResolved = true;
		this._resolve(useValue);
		return this;
	};

	/**
	 * @param {any} [error]
	 * @returns {this}
	 */
	reject(error) {
		if (this.isRejected) {
			throw new Error('Already rejected')
		}
		if (this.isResolved) {
			throw new Error('Already resolved');
		}
		this._isRejected = true;
		this._reject(...arguments);
		return this;
	};
};


/**
 * Mocha does not support this use case (async function with done):
 * https://github.com/mochajs/mocha/issues/2407#issuecomment-237408877
 * This function creates a deferred that can be resolved/rejected using
 * a generic done-callback.
 * 
 * @returns {[Promise<any>, callbackHandler<any>]} an array where
 * the first element is the promise that can be returned to mocha's test
 * runner and the second element is the done-function, which, when called
 * with no arguments, resolves the promise. Otherwise, it will reject the
 * promise.
 */
const deferMocha = () => {
	const deferred = defer();

	return [deferred.promise, error => {
		if (error === void 0) {
			deferred.resolve();
		} else {
			deferred.reject(error);
		}
	}];
};

module.exports = Object.freeze({
	timeout,
	defer,
	deferMocha,
	DeferredClass
});
