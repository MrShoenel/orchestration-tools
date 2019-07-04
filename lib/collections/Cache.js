const { Dictionary } = require('./Dictionary')
, { EqualityComparer } = require('./EqualityComparer')
, { Resolve } = require('../../tools/Resolve')
, JSBI = require('jsbi');


/**
 * This enumeration holds supported eviction policies by some of collections.
 */
const EvictionPolicy = Object.freeze({
	/**
	 * Do not evict. Requires manually freeing space in the underlying collection.
	 */
	None: 0,
	/**
	 * The underlying collection may evict elements indeterministically.
	 */
	Undetermined: 1,
	/**
	 * The underlying collection evicts the least recently used elements first.
	 */
	LRU: 2,
	/**
	 * The underlying collection evicts the most recently used elements first.
	 */
	MRU: 3,
	/**
	 * The underlying collection evicts the least frequently used elements first.
	 */
	LFU: 4,
	/**
	 * The underlying collection evicts the most frequently used elements first.
	 */
	MFU: 5,
	/**
	 * The underlying collection evicts the items inserted first (like a queue).
	 */
	FIFO: 6,
	/**
	 * The underlying collection evicts the items inserted last (like a stack).
	 */
	LIFO: 7
});


/**
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class CacheItem {
	/**
	 * @param {T} item
	 */
	constructor(key, item, order) {
		this._key = key;
		this._item = item;
		// initialize with order, so that newer items w/o last access have larger values.
		/** @type {JSBI.BigInt} */
		this._timeStamp = JSBI.BigInt(order);
		this._order = order;
		this._accessCount = 0;
	};

	/**
	 * @returns {String|Symbol}
	 */
	get key() {
		return this._key;
	};
	
	/**
	 * @returns {T}
	 */
	get item() {
		return this._item;
	};

	get timeStamp() {
		return this._timeStamp;
	};

	updateAccessTime() {
		const hrTime = process.hrtime()
		, secsAsNano = JSBI.multiply(JSBI.BigInt(hrTime[0]), JSBI.BigInt(1e9))
		, withNs = JSBI.add(secsAsNano, JSBI.BigInt(hrTime[1]));

		this._timeStamp = withNs;
	};

	get order() {
		return this._order;
	};

	get accessCount() {
		return this._accessCount;
	};

	increaseAccessCount() {
		this._accessCount++;
		return this;
	};
};



let _counter = 0;

/**
 * A Cache is similar to a @see {Dictionary}, and also allows to manually and automatically
 * evict items stored in it. A Cache has constrained capacity.
 * 
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Cache extends Dictionary {
	/**
	 * Used to assign a running number to new cache items.
	 */
	static get _counter() {
		return _counter++;
	};


  /**
   * Creates a new, empty Cache.<T>, using the specified @see {EvictionPolicy} and
	 * an initial capacity.
   * 
	 * @param {EvictionPolicy|number} [evictPolicy] Optional. Specify the eviction policy that is
	 * applied, if the cache has no more space left.
	 * @param {number} [capacity] Optional. Specify the initial capacity of this cache. The capacity
	 * can be increased and decreased later.
   * @param {EqualityComparer.<T>} [eqComparer] Optional. Defaults To EqualityComparer.<T>.default.
   */
  constructor(evictPolicy = EvictionPolicy.None, capacity = Number.MAX_SAFE_INTEGER, eqComparer = EqualityComparer.default) {
		super(eqComparer);
		
		/** @type {EvictionPolicy|number} */
		this._evictPolicy = EvictionPolicy.None;
		this.evictionPolicy = evictPolicy;

		/** @type {number} */
		this._capacity = capacity;
		this.capacity = capacity;

		/** @type {Object.<String|Symbol, CacheItem.<T>>} */
		this._dict = {};
	};
	
	/**
	 * @param {EvictionPolicy|number} policy An @see {EvictionPolicy}
	 * @throws {Error} If the given policy is not one of @see {EvictionPolicy}.
	 */
	_validateEvictionPolicy(policy) {
		switch (policy) {
			case EvictionPolicy.LRU:
			case EvictionPolicy.MRU:
			case EvictionPolicy.LFU:
			case EvictionPolicy.MFU:
			case EvictionPolicy.None:
			case EvictionPolicy.FIFO:
			case EvictionPolicy.LIFO:
			case EvictionPolicy.Undetermined:
				break;
			default:
				throw new Error(`The eviction policy '${policy}' is not supported.`);
		}
	};

	/**
	 * @returns {EvictionPolicy|number}
	 */
	get evictionPolicy() {
		return this._evictPolicy;
	};

	/**
	 * @param {EvictionPolicy|number} policy The new policy to use for evicting items.
	 */
	set evictionPolicy(policy) {
		this._validateEvictionPolicy(policy);
		this._evictPolicy = policy;
	};

	/**
	 * @param {number} capacity The capacity to check. Must be a positive integer.
	 * @throws {Error} If the given capacity is not an integer or less than zero.
	 */
	_validateCapacity(capacity) {
    if (!Resolve.isTypeOf(capacity, Number) || !Number.isInteger(capacity)) {
      throw new Error(`The value given for capacity is not a number.`);
		}
		if (capacity < 0) {
      throw new Error(`The capacity given is less than 0: ${capacity}`);
		}
	};

	/**
	 * @returns {number} The current capacity of this cache.
	 */
	get capacity() {
		return this._capacity;
	};

	/**
	 * @returns {Boolean} True, if the cache's capacity is all used up.
	 */
	get isFull() {
		return this.size === this.capacity;
	};

	/**
	 * @param {number} capacity The new capacity of this cache. Must be a positive
	 * integer (0 is allowed). Note that setting a capacity that undercuts the amount
	 * of items currently held in the cache, will lead to the eviction of enough
	 * items to meet the new capacity constraint.
	 */
	set capacity(capacity) {
		this._validateCapacity(capacity);

		let toEvict = this.size - capacity;
		while (toEvict > 0) {
			this.evict();
			toEvict--;
		}

		this._capacity = capacity;
	};

	/**
	 * @returns {T} the evicted item.
	 */
	evict() {
		if (this.isEmpty) {
			throw new Error('The cache is empty, cannot evict any more items.');
		}
		return this.evictMany(1)[0];
	};

	/**
	 * @param {Number} count
	 * @returns {Array.<T>} The evicted items in an array.
	 */
	evictMany(count) {
		let howMany = Math.min(count, this.size);
		/** @type {Array.<T>} */
		const items = [];

		for (const item of this._evictNext()) {
			items.push(this.remove(item.key));
			if (--howMany === 0) {
				break;
			}
		}

		return items;
	};

	/**
	 * Allows to peek at the next n items that will be evited next, without removing
	 * them. Returns the items with as key/value pair.
	 * 
	 * @param {Number} amount
	 * @returns {Array.<Object.<String|Symbol, T>>}
	 */
	peekEvict(amount) {
		if (!Resolve.isTypeOf(amount, Number) || !Number.isInteger(amount) || amount < 1) {
			throw new Error('You must peek an mount larger than 0.');
		}

		amount = Math.min(amount, this.size);
		const iter = this._evictNext();
		return Array.from(Array(amount), iter.next, iter).map(o => {
			const obj = {};
			obj[o.value.key] = o.value.item;
			return obj;
		});
	};

	/**
	 * Returns items in the order they will be evicted, according to the policy.
	 * 
	 * @returns {IterableIterator.<CacheItem.<T>>}
	 */
	*_evictNext() {
		/** @type {Array.<CacheItem.<T>>} */
		const wrappers = [];

		switch (this.evictionPolicy) {
			case EvictionPolicy.LRU:
			case EvictionPolicy.MRU:
				// Order items by their access date:
				const mru = this.evictionPolicy === EvictionPolicy.MRU ? -1 : 1;
					this.evictionPolicy === EvictionPolicy.MRU ? -1 : 1;
				wrappers.unshift(
					...Array.from(super.values()).sort((w1, w2) => {
						return mru * (JSBI.lessThan(w1.timeStamp, w2.timeStamp) ? -1 : 1);
					})
				);
				break;
			case EvictionPolicy.LFU:
			case EvictionPolicy.MFU:
				// Order items by access count and select least/most recently used items first.
				const mfu = this.evictionPolicy === EvictionPolicy.MFU ? -1 : 1;
				wrappers.unshift(
					...Array.from(super.values()).sort((w1, w2) => {
						return mfu * (w1.accessCount - w2.accessCount);
					})
				);
				break;
			case EvictionPolicy.FIFO:
			case EvictionPolicy.LIFO:
				// Remove the item inserted first/last.
				const lifo = this.evictionPolicy === EvictionPolicy.LIFO ? -1 : 1;
				wrappers.unshift(
					...Array.from(super.values()).sort((w1, w2) => {
						return lifo * (w1.order - w2.order);
					})
				);
				break;
			case EvictionPolicy.Undetermined:
				// No specific/deterministic order.
				yield* super.values();
				break;
			case EvictionPolicy.None:
				// Eviction not allowed, must use ::remove()
				throw new Error('Eviction not allowed.');
		}

		for (const wrap of wrappers) {
			yield wrap;
		}
	};

	/**
	 * @inheritdoc
	 * @throws {Error} If this cache is full and no automatic eviction policy was set.
	 */
	set(key, val) {
		const isFull = this.size === this.capacity;
		if (isFull) {
			if (this.evictionPolicy === EvictionPolicy.None) {
				throw new Error(`The Cache is full and no automatic eviction policy is set.`);
			}

			this.evict(); // Remove one item according to an automatic policy.
		}

		const wrap = new CacheItem(key, val, Cache._counter);

		return super.set(key, wrap);
	};

	/**
	 * @inheritdoc
	 */
	get(key) {
		/** @type {CacheItem.<T>} */
		const wrap = super.get(key);
		wrap.updateAccessTime();
		wrap.increaseAccessCount();
		return wrap.item;
	};

	/**
	 * @inheritdoc
	 */
	remove(key) {
		/** @type {CacheItem.<T>} */
		const wrap = super.remove(key);
		return wrap.item;
	};

	/**
	 * @inheritdoc
	 */
	*values() {
		for (const val of super.values()) {
			yield val.item;
		}
	};

	/**
	 * @inheritdoc
	 */
	*_entries(reverse = false) {
		for (const entry of super._entries(reverse)) {
			const key = Object.keys(entry).concat(Object.getOwnPropertySymbols(entry))[0];
			entry[key] = entry[key].item; // unwrap
			yield entry;
		}
	};
};

module.exports = Object.freeze({
	EvictionPolicy,
  Cache
});