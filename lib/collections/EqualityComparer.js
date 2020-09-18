/**
 * A base-class for equality comparers.
 * 
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class EqualityComparer {
	/**
	 * @template TDefault
	 * @returns {DefaultEqualityComparer.<TDefault>} An instance of the
	 * DefaultEqualityComparer that uses the identity-operator.
	 */
	static get default() {
		return new DefaultEqualityComparer();
	};

	/**
	 * @param {T} x
	 * @param {T} y
	 * @throws {Error} This is an abstract method.
	 * @returns {boolean} True, iff the two items x and y are considered
	 * to be equal.
	 */
	equals(x, y) {
		throw new Error('Abstract method');
	};
};


/**
 * The DefaultEqualityComparer uses the identity-operator to compare equality.
 * 
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class DefaultEqualityComparer extends EqualityComparer {
	/**
	 * Checks equality using the identity-operator (===).
	 * 
	 * @param {T} x 
	 * @param {T} y 
	 * @returns {boolean} True, iff the two items are identical.
	 */
	equals(x, y) {
		return x === y;
	};
};


module.exports = Object.freeze({
	EqualityComparer,
	DefaultEqualityComparer
});
