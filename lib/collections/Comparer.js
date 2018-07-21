const { EqualityComparer } = require('./EqualityComparer');


/**
 * @template T
 */
class Comparer {
  /**
   * @param {EqualityComparer.<T>} [eqComparer] Optional. Defaults to
   * EqualityComparer.default. An EqualityComparer to use for comparing
   * two items. The method compareTo() returns 0 if the equality comparer
   * considers the two compared items to be equal.
   */
  constructor(eqComparer = EqualityComparer.default) {
    /** @type {EqualityComparer.<T>} */
    this._eqComparer = null;
    this.equalityComparer = eqComparer;
  };

  /**
   * @returns {EqualityComparer.<T>} The current EqualityComparer.
   */
  get equalityComparer() {
    return this._eqComparer;
  };

  /**
   * @param {EqualityComparer.<T>} value An EqualityComparer to use.
   * @throws {Error} If the given value is not of type EqualityComparer.
   */
  set equalityComparer(value) {
    if (!(value instanceof EqualityComparer)) {
      throw new Error(`The value provided is not of type ${EqualityComparer.name}: ${util.inspect(value)}`);
    }
    this._eqComparer = value;
  };

  /**
   * Compare two items and return a value that indicates which of them
   * is considered to be less or smaller. A negative value means that
   * x is smaller than y; 0 means they are equally large and a positive
   * value means that y is larger than x.
   * 
   * @param {T} x
   * @param {T} y
   * @returns {-1|0|1} Returns either -1, 0 or 1.
   */
  compare(x, y) {
    throw new Error('Abstract method.');
  };
};


/**
 * @template T
 */
class DefaultComparer extends Comparer {
  /**
   * Uses the instance of the EqualityComparer to determine whether two
   * items are considered to be equal.
   * @inheritDoc
   * 
   * @param {T} x
   * @param {T} y
   * @returns {-1|0|1} Returns either -1, 0 or 1.
   */
  compare(x, y) {
    return this.equalityComparer.equals(x, y) ? 0 : (x < y ? -1 : 1);
  };
};



module.exports = Object.freeze({
  Comparer,
  DefaultComparer
});
