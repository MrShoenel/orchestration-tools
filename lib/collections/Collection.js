const { EqualityComparer } = require('./EqualityComparer')
, util = require('util');



/**
 * A generic class that holds any kind of item and provides basic set-
 * operations. This is a base class for other collections.
 * 
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Collection {
  /**
   * Creates a new, empty Collection.
   * 
   * @param {EqualityComparer.<T>} [eqComparer] Optional. Defaults To EqualityComparer.<T>.default.
   */
  constructor(eqComparer = EqualityComparer.default) {
    /** @type {EqualityComparer.<T>} */
    this._eqComparer = null;
    this.equalityComparer = eqComparer;

    /** @type {Array.<T>} */
    this._items = [];
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
   * @returns {number} The amount of items in this Collection.
   */
  get size() {
    return this._items.length;
  };

  /**
   * @returns {boolean} True, iff this Collection is empty.
   */
  get isEmpty() {
    return this._items.length === 0;
  };

  /**
   * Discards all items in this Collection.
   */
  clear() {
    this._items.splice(0, this._items.length);
  };

  /**
   * @returns {IterableIterator.<T>} An IterableIterator for
   * all items in this Collection.
   */
  *entries() {
    for (const item of this._items) {
      yield item;
    }
  };

  /**
   * @param {T} item The item to check for
   */
  has(item) {
    const idx = this._items.findIndex(value => this._eqComparer.equals(value, item));
    return idx >= 0;
  };
};


module.exports = Object.freeze({
  Collection
});
