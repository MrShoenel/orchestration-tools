const { Collection, CollectionEvent } = require('./Collection')
, { EqualityComparer } = require('./EqualityComparer')
, { Resolve } = require('../../tools/Resolve')
, { Observable, fromEvent } = require('rxjs')
, symbolDictionaryGet = Symbol('dictionaryGet')
, symbolDictionarySet = Symbol('dictionarySet')
, symbolDictionaryDelete = Symbol('dictionaryDelete')
, util = require('util');



/**
 * @deprecated Use DictionaryMapBased instead. This Dictionary will be removed from version v3.0. Also, DictionaryMapBased will receive an alias of Dictionary.
 * @template T
 * @template TEq An extra template for the EqualityComparer, is it may be used for keys
 * and/or values simultaneously.
 * @author Sebastian Hönel <development@hoenel.net>
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
		return this.delete(key);
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
		super.clear();
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
	 * @link {https://2ality.com/2015/10/property-traversal-order-es6.html#traversing-the-own-keys-of-an-object}
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



/**
 * @template TKey
 * @template TVal
 * @author Sebastian Hönel <development@hoenel.net>
 */
class DictionaryMapBased extends Collection {
	/**
	 * @param {EqualityComparer.<TVal>} [eqComparer]
	 */
	constructor(eqComparer = EqualityComparer.default) {
		super(eqComparer);

		/** @type {Map.<TKey, TVal>} */
		this._map = new Map();

		/** @type {Observable.<CollectionEvent.<[TKey, TVal]>>} */
		this.observableSet = Object.freeze(fromEvent(this, symbolDictionarySet));
		/** @type {Observable.<CollectionEvent.<[TKey, TVal]>>} */
		this.observableGet = Object.freeze(fromEvent(this, symbolDictionaryGet));
		/** @type {Observable.<CollectionEvent.<[TKey, TVal]>>} */
		this.observableDelete = Object.freeze(fromEvent(this, symbolDictionaryDelete));
	};

	/**
	 * Inverts this dictionary by using its values as keys, and storing
	 * for each value a list of keys that previously pointed to that
	 * value. Therefore, the values in the inverted dictionary are lists.
	 * E.g., the dictionary {A=>5, B=>5, C=>2} inverts to the dictionary
	 * {5=>[A,B], 2=>[C]}. Therefore, you also cannot invert an inverted
	 * dictionary and obtain a dictionary equivalent to the original.
	 * 
	 * @param {EqualityComparer.<TVal>} [eqComparer] Optional. Uses the
	 * default EqualityComparer if not given. You may also pass in this
	 * dictionary's comparer. It may make sense to use a separate comparer,
	 * as the values may be of different type than the keys.
	 * @returns {DictionaryMapBased.<TVal, Array.<TKey>>}
	 */
	invert(eqComparer = EqualityComparer.default) {
		/** @type {DictionaryMapBased.<TVal, Array.<TKey>>} */
		const dict = new DictionaryMapBased(eqComparer);

		for (const entry of this.entries()) {
			const key = entry[0], val = entry[1];
			if (dict.has(val)) {
				dict.get(val).push(key);
			} else {
				dict.set(val, [key]);
			}
		}

		return dict;
	};

	/**
	 * @returns {this}
	 */
	clear() {
		super.clear();
		this._map.clear();
		return this;
	};

	/**
	 * @param {TKey} key The key to check for
	 */
	has(key) {
		return this._map.has(key);
	};

	/**
	 * @returns {IterableIterator.<[TKey, TVal]>}
	 */
	*entries() {
		yield* this._map.entries();
	};

	/**
	 * @returns {IterableIterator.<TVal>}
	 */
	*values() {
		yield* this._map.values();
	};

	/**
	 * @returns {IterableIterator.<TKey>}
	 */
	*keys() {
		yield* this._map.keys();
	}

	/**
	 * @returns {IterableIterator.<[TKey, TVal]>}
	 */
	*entriesReversed() {
		const entries = Array.from(this.entries());

		for (const entry of entries.reverse()) {
			yield entry;
		}
	};

	/**
	 * 
	 * @param {TVal} value The value to check for
	 * @param {EqualityComparer.<TVal>} [eqComparer] An optional @see {EqualityComparer}. Uses the internal comparer if not given.
	 */
	hasValue(value, eqComparer = null) {
		eqComparer = eqComparer instanceof EqualityComparer ? eqComparer : this._eqComparer;
		
		for (const val of this.values()) { // Values are already unwrapped
			if (eqComparer.equals(val, value)) {
				return true;
			}
		}

		return false;
	};

	get size() {
		return this._map.size;
	};

	/**
	 * @param {TKey} key The key of the value to retrieve.
	 * @throws {Error} If the key is not found.
	 */
	get(key) {
		if (!this.has(key)) {
			throw new Error(`The key '${key}' is not present.`);
		}
		const value = this.__unwrapValue(this._map.get(key));
		this.emit(symbolDictionaryGet, new CollectionEvent([key, value]));
		return value;
	};

	/**
	 * @param {TKey} key The of the entry to delete.
	 * @returns {TVal} The deleted value
	 * @throws {Error} If the key cannot be found or cannot be deleted.
	 */
	delete(key) {
		const value = this.get(key); // throws if does not exist
		this._map.delete(key); // returns true because key exists
		this.emit(symbolDictionaryDelete, new CollectionEvent([key, value]));
		return value; // this::get() already unwraps
	};

	/**
	 * @param {consumerProducer4ArgHandler.<TVal, TKey, Number, Dictionary.<TKey, TVal>, any>} callbackFn receives the value, the key, the index, and the dictionary
	 * @param {*} [thisArg] Optional. Defaults to undefined. 
	 */
	forEach(callbackFn, thisArg = void 0) {
		if (!Resolve.isFunction(callbackFn)) {
			throw new Error(`The value given as callback function is not a function: '${util.inspect(callbackFn)}'`);
		}

		const that = this
		, withKey = callbackFn.length > 1
		, withIdx = callbackFn.length > 2
		, withDict = callbackFn.length > 3;

		let idx = 0;
		this._map.forEach((val, key, map) => {
			const args = [this.__unwrapValue(val)];
			if (withKey) { args.push(this.__unwrapKey(key)); }
			if (withIdx) { args.push(idx++); }
			if (withDict) { args.push(that); }
			callbackFn.apply(thisArg, args);
		});
		
		return this;
	};

	/**
	 * Used for unwrapping values. This is useful for collections that wrap
	 * the key in some way. The DictionaryMap's methods use this method, so
	 * that deriving subclasses only need to override this method.
	 * 
	 * @see __unwrapValue
	 * @access protected
	 * @param {TKey} key The key to unwrap
	 * @returns {TKey} In this base class, this is an identity function.
	 * Sub-classes may override it.
	 */
	__unwrapKey(key) {
		return key;
	};

	/**
	 * Used for unwrapping values. This is useful for collections that wrap
	 * the value in some way. The DictionaryMap's methods use this method,
	 * so that deriving subclasses only need to override this method.
	 * 
	 * @see __unwrapKey
	 * @access protected
	 * @param {TVal} value The value to unwrap
	 * @returns {TVal} In this base class, this is an identity function.
	 * Sub-classes may override it.
	 */
	__unwrapValue(value) {
		return value;
	};

	/**
	 * Sets (upserts) a value with the given key.
	 * 
	 * @param {TKey} key The key of the value.
	 * @param {TVal} value The value associated with the key.
	 * @returns {this}
	 */
	set(key, value) {
		this._map.set(key, value);
		this.emit(symbolDictionarySet, new CollectionEvent([key, value]));
		return this;
	};
};


module.exports = Object.freeze({
	Dictionary,
	DictionaryMapBased,
	symbolDictionaryGet,
	symbolDictionarySet,
	symbolDictionaryDelete
});
