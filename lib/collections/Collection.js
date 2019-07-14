const { EqualityComparer } = require('./EqualityComparer')
, { EventEmitter } = require('events')
, { Observable, fromEvent } = require('rxjs')
, util = require('util')
, symbolCollectionClear = Symbol('collectionClear');



/**
 * @template T The type of the item (if passed)
 */
class CollectionEvent {
	/**
	 * @param {T} item An item associated with this event
	 */
	constructor(item = void 0) {
		this.item = item;
	};
};



/**
 * A generic class that holds any kind of item and provides basic set-
 * operations. This is a base class for other collections.
 * 
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Collection extends EventEmitter {
  /**
   * Creates a new, empty Collection.
   * 
   * @param {EqualityComparer.<T>} [eqComparer] Optional. Defaults To EqualityComparer.<T>.default.
   */
  constructor(eqComparer = EqualityComparer.default) {
		super();
		
    /** @type {EqualityComparer.<T>} */
    this._eqComparer = null;
    this.equalityComparer = eqComparer;

    /** @type {Array.<T>} */
		this._items = [];
		
		/** @type {Observable.<>} */
		this.observableClear = Object.freeze(fromEvent(this, symbolCollectionClear));
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
    return this.size === 0;
  };

  /**
   * Discards all items in this Collection.
   * 
   * @returns {this}
   */
  clear() {
		this.emit(symbolCollectionClear, new CollectionEvent());
    this._items.splice(0, this._items.length);
    return this;
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
   * @returns {IterableIterator.<T>} An IterableIterator for
   * all items in this collection in reversed order.
   */
  *entriesReversed() {
    let idx = this._items.length - 1;
    for (; idx >= 0; idx--) {
      yield this._items[idx];
    }
  };

  /**
   * @param {T} item The item to check for
   * @param {EqualityComparer.<T>} [eqComparer] an optional EqualityComparer to use. If not provided, will use the Collection's EqualityComparer.
   */
  has(item, eqComparer = null) {
    eqComparer = eqComparer instanceof EqualityComparer ? eqComparer : this._eqComparer;
    const idx = this._items.findIndex(value => eqComparer.equals(value, item));
    return idx >= 0;
  };
};


module.exports = Object.freeze({
	Collection,
	CollectionEvent,
	symbolClear: symbolCollectionClear
});
