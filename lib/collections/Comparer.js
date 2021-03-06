const { EqualityComparer } = require('./EqualityComparer');


/**
 * @template T
 */
class Comparer {
	/**
	 * @param {EqualityComparer<T>} [eqComparer] Optional. Defaults to
	 * EqualityComparer.default. An EqualityComparer to use for comparing
	 * two items. The method compareTo() returns 0 if the equality comparer
	 * considers the two compared items to be equal.
	 */
	constructor(eqComparer = EqualityComparer.default) {
		/**
		 * @type {EqualityComparer<T>}
		 * @protected
		 */
		this._eqComparer = null;
		this.equalityComparer = eqComparer;
	};

	/**
	 * Returns the current EqualityComparer.
	 * 
	 * @type {EqualityComparer<T>}
	 */
	get equalityComparer() {
		return this._eqComparer;
	};

	/**
	 * @protected
	 * @param {EqualityComparer<T>} eqComparer The comparer
	 * @returns {EqualityComparer<T>} The same comparer that was given
	 * @throws {Error} If the given value is not of type EqualityComparer.
	 */
	_validateEqualityComparer(eqComparer) {
		if (!(eqComparer instanceof EqualityComparer)) {
			throw new Error(
				`The value provided is not of type ${EqualityComparer.name}: ${util.inspect(eqComparer)}`);
		}
		return eqComparer;
	};

	/**
	 * @param {EqualityComparer<T>} value An EqualityComparer to use.
	 * @type {void}
	 */
	set equalityComparer(value) {
		this._eqComparer = this._validateEqualityComparer(value);
	};

	/**
	 * Compare two items and return a value that indicates which of them
	 * is considered to be less or smaller. A negative value means that
	 * x is smaller than y; 0 means they are equally large and a positive
	 * value means that y is larger than x.
	 * 
	 * @param {T} x
	 * @param {T} y
	 * @returns {Number} Returns either -1, 0 or 1.
	 */
	compare(x, y) {
		throw new Error('Abstract method.');
	};
};


/**
 * @template T
 * @extends {Comparer<T>}
 */
class DefaultComparer extends Comparer {
	/**
	 * Uses the instance of the EqualityComparer to determine whether two
	 * items are considered to be equal.
	 * 
	 * @override
	 * @inheritDoc
	 * @param {T} x
	 * @param {T} y
	 * @returns {Number} Returns either -1, 0 or 1.
	 */
	compare(x, y) {
		return this.equalityComparer.equals(x, y) ? 0 : (x < y ? -1 : 1);
	};
};



module.exports = Object.freeze({
	Comparer,
	DefaultComparer
});
