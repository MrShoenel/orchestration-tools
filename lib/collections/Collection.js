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
		
		/**
		 * @type {EqualityComparer.<T>}
		 * @protected
		 */
		this._eqComparer = null;
		this.equalityComparer = eqComparer;

		/**
		 * @type {Array.<T>}
		 * @protected
		 */
		this._items = [];
		
		/** @type {Observable.<CollectionEvent.<T>>} */
		this.observableClear = Object.freeze(fromEvent(this, symbolCollectionClear));
	};

	/**
	 * @protected
	 * @param {EqualityComparer.<T>} eqComparer The comparer
	 * @returns {EqualityComparer.<T>} The same comparer that was given
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
	 * @returns {EqualityComparer.<T>} The current EqualityComparer.
	 */
	get equalityComparer() {
		return this._eqComparer;
	};

	/**
	 * @param {EqualityComparer.<T>} value An EqualityComparer to use.
	 */
	set equalityComparer(value) {
		this._eqComparer = this._validateEqualityComparer(value);
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
	 * @returns {Array.<T>} All of the collection's items as array.
	 */
	get asArray() {
		return Array.from(this.entries());
	};
	
	/**
	 * Maps a callback to each of the items and returns an array.
	 * 
	 * @param {consumerProducer3ArgHandler.<T, Number, Array.<T>, any>} callback that gets the
	 * value, the index, and the array of values
	 * @returns {Array.<any>} The mapped items as array
	 */
	map(callback, thisArg = void 0) {
		return this.asArray.map(callback.bind(thisArg));
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
	symbolCollectionClear
});
