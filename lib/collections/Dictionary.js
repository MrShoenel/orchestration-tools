const { Collection } = require('./Collection')
, { EqualityComparer } = require('./EqualityComparer')
, util = require('util');


/**
 * @deprecated Use DictionaryMapBased instead. This Dictionary will be removed from version v3.0. Also, DictionaryMapBased will receive an alias of Dictionary.
 * @template T
 * @template TEq An extra template for the EqualityComparer, is it may be used for keys
 * and/or values simultaneously.
 */
class Dictionary extends Collection {


  /**
   * Creates a new, empty Dictionary.<T>.
	 * 
	 * @param {EqualityComparer.<TEq>} [eqComparer] Optional. Defaults To EqualityComparer.<TEq>.default.
   */
  constructor(eqComparer = EqualityComparer.default) {
		super(eqComparer);

		/** @type {Object.<String|Symbol, T>} */
		this._dict = Object.create(null);

		/** @type {Number} */
		this._size = 0;
	};

	/**
	 * Asserts that a key is suitable for use in an object.
	 * 
	 * @param {String|Symbol} key The key to validate
	 * @throws {Error} If the key is not a string and not a symbol.
	 */
	_validateKey(key) {
		const type = typeof key;

		if (type !== 'string' && type !== 'symbol') {
			throw new Error(`The given key is not a string and not a Symbol: '${util.inspect(key)}'`);
		}
		if (key === '__proto__') {
			throw new Error(`You must not use a key with the name ${key}`);
		}
	};

	/**
	 * @param {String|Symbol} key
	 * @returns {T} The value of the removed item
	 */
	delete(key) {
		if (!this.hasKey(key)) {
			throw new Error(`The key ${key.toString()} is not present.`);
		}

		const item = this._dict[key];
		delete this._dict[key];
		this._size--;
		return item;
	};

	/**
	 * @deprecated Use ::delete(key) instead. This will be removed in v3.0.
	 * @param {String|Symbol} key The item's key.
	 * @returns {T} The removed item.
	 * @throws {Error} If the given key is not present.
	 */
	remove(key) {
		return this.remove(key);
	};

	/**
	 * Sets the item with the given key. If the key exists previously, its
	 * value is overwritten.
	 * 
	 * @param {String|Symbol} key 
	 * @param {T} val 
	 */
	set(key, val) {
		const hadKey = this.hasKey(key);
		this._dict[key] = val;
		if (!hadKey) {
			this._size++;
		}
		return this;
	};

	/**
	 * @param {String|Symbol} key The item's key.
	 * @returns {T} The item
	 * @throws {Error} If the key is not present.
	 */
	get(key) {
		if (this.hasKey(key)) {
			return this._dict[key];
		}
		throw new Error(`The key '${key.toString()}' is not present.`);
	};

	/**
	 * @param {String|Symbol} key The item's key.
   * @param {EqualityComparer.<TEq>} [eqComparer] an optional EqualityComparer to use. If not provided, will use the Collection's EqualityComparer.
	 * @returns {Boolean} True, if the given key is present.
	 */
	hasKeyEq(key, eqComparer = null) {
		this._validateKey(key);
		eqComparer = eqComparer instanceof EqualityComparer ? eqComparer : this._eqComparer;
		const allKeys = Array.from(this.keys())
		, idx = allKeys.findIndex(value => eqComparer.equals(value, key));
		return idx >= 0;
	};

	/**
	 * Does not support an @see {EqualityComparer.<TEq>} and can therefore facilitate faster O(1) lookups.
	 * 
	 * @param {String|Symbol} key The item's key.
	 * @returns {Boolean} True, if the given key is present.
	 */
	hasKey(key) {
		this._validateKey(key);
		return key in this._dict;
	};

	/**
	 * @param {T} item The item to check for
	 * @param {EqualityComparer.<TEq>} eqComparer An optional EqualityComparer to use. If not provided,
	 * will use the Collection's EqualityComparer.
	 */
	has(item, eqComparer = null) {
    eqComparer = eqComparer instanceof EqualityComparer ? eqComparer : this._eqComparer;
		for (const value of this.values()) {
			if (eqComparer.equals(value, item)) {
				return true;
			}
		}
		return false;
	};

	/**
	 * @returns {Number}
	 */
	get size() {
		return this._size;
	};

	/**
	 * Removes all items from this dictionary.
	 * 
	 * @returns {this}
	 */
	clear() {
		this._dict = Object.create(null);
		this._size = 0;
		return this;
	};

	/**
	 * @returns {IterableIterator.<String|Symbol>}
	 */
	*keys() {
		for (const key of Object.keys(this._dict)) {
			yield key;
		}
		for (const key of Object.getOwnPropertySymbols(this._dict)) {
			yield key;
		}
	};

	/**
	 * @returns {IterableIterator.<T>}
	 */
	*values() {
		for (const key of this.keys()) {
			yield this._dict[key];
		}
	};

	/**
	 * @param {boolean} reverse True, if the entries should be returned in reverse order.
	 * @returns {IterableIterator.<Object.<String|Symbol, T>>}
	 */
	*_entries(reverse = false) {
		let keys = Array.from(this.keys());
		if (reverse) {
			keys = keys.reverse();
		}
		
		for (const key of keys) {
			const obj = {};
			obj[key] = this._dict[key];
			yield obj;
		}
	};

	/**
	 * Returns all entries of this dictionary. Note that the order is deterministic and
	 * that therefore returning the entries in reverse order may also be of use.
	 * @see {https://2ality.com/2015/10/property-traversal-order-es6.html#traversing-the-own-keys-of-an-object}
	 * 
	 * @returns {IterableIterator.<Object.<String|Symbol, T>>}
	 */
	*entries() {
		for (const entry of this._entries()) {
			yield entry;
		}
	};

	/**
	 * @returns {IterableIterator.<Object.<String|Symbol, T>>}
	 */
	*entriesReversed() {
		for (const entry of this._entries(true)) {
			yield entry;
		}
	};
};


module.exports = Object.freeze({
	Dictionary
});
