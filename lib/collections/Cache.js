const { Dictionary, DictionaryMapBased, symbolDictionaryGet } = require('./Dictionary')
, { EqualityComparer } = require('./EqualityComparer')
, { Resolve } = require('../tools/Resolve')
, { CollectionEvent } = require('./Collection')
, { Observable, fromEvent } = require('rxjs')
, symbolCacheEvict = Symbol('cacheEvict')
, JSBI = require('jsbi');


/**
 * This enumeration holds supported eviction policies by some of collections.
 * 
 * @readonly
 * @enum {Number}
 */
const EvictionPolicy = {
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
	LIFO: 7,
	/**
	 * The underlying collection evicts the items inserted in a random order.
	 */
	Random: 8
};


/**
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class CacheItem {
	/**
	 * @param {Cache<any, T>|CacheMapBased<any, T>|CacheWithLoad<any, T>} cache The cache this item belongs to.
	 * @param {TKey} key
	 * @param {T} item
	 * @param {Number} order An integer used to order this item, assigned by the cache.
	 * @param {Number} expireAfterMsecs An integer, in milliseconds, to expire this
	 * item after. Only used if > 0. This item then sets a timeout and upon elapse,
	 * evicts itself from the cache.
	 */
	constructor(cache, key, item, order, expireAfterMsecs) {
		/** @protected */
		this._cache = cache;
		/** @protected */
		this._key = key;
		/** @protected */
		this._item = item;
		// initialize with order, so that newer items w/o last access have larger values.
		/**
		 * @type {JSBI.BigInt}
		 * @protected
		 */
		this._timeStamp = JSBI.BigInt(order);
		/** @protected */
		this._order = order;
		/** @protected */
		this._accessCount = 0;

		/**
		 * @type {NodeJS.Timeout}
		 * @protected
		 */
		this._expireTimeout = null;
		if (expireAfterMsecs > 0) {
			this._expireTimeout = setTimeout(() => {
				this._cache.delete(key);
			}, expireAfterMsecs);
		}
	};

	/**
	 * Clears the internal eviction timeout.
	 * 
	 * @returns {this}
	 */
	clearTimeout() {
		clearTimeout(this._expireTimeout);
		this._expireTimeout = null;
		return this;
	};

	/**
	 * @type {String|Symbol}
	 */
	get key() {
		return this._key;
	};
	
	/**
	 * @type {T}
	 */
	get item() {
		return this._item;
	};

	/**
	 * @type {JSBI.BigInt}
	 */
	get timeStamp() {
		return this._timeStamp;
	};

	/**
	 * @returns {void}
	 */
	updateAccessTime() {
		const hrTime = process.hrtime()
		, secsAsNano = JSBI.multiply(JSBI.BigInt(hrTime[0]), JSBI.BigInt(1e9))
		, withNs = JSBI.add(secsAsNano, JSBI.BigInt(hrTime[1]));

		this._timeStamp = withNs;
	};

	/**
	 * @type {Number}
	 */
	get order() {
		return this._order;
	};

	/**
	 * @type {Number}
	 */
	get accessCount() {
		return this._accessCount;
	};

	/**
	 * @returns {this}
	 */
	increaseAccessCount() {
		this._accessCount++;
		return this;
	};
};



let __counter = 0;

/**
 * @deprecated Use @see {CacheMapBased} instead. This class will be
 * removed from Version v3.0.
 * A Cache is similar to a @see {DictionaryMapBased}, and also allows to manually and automatically
 * evict items stored in it. A Cache's capacity is constrained.
 * 
 * @template TKey
 * @template TVal
 * @extends {Dictionary<TKey, TVal>}
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Cache extends Dictionary {
	/**
	 * Used to assign a running number to new cache items.
	 * @private
	 * @type {Number}
	 */
	static get __counter() {
		return __counter++;
	};


	/**
	 * Creates a new, empty Cache<T>, using the specified @see {EvictionPolicy} and
	 * an initial capacity.
	 * 
	 * @param {EvictionPolicy|Number} [evictPolicy] Optional. Specify the eviction policy that is
	 * applied, if the cache has no more space left.
	 * @param {Number} [capacity] Optional. Specify the initial capacity of this cache. The capacity
	 * can be increased and decreased later.
	 * @param {EqualityComparer<TVal>} [eqComparer] Optional. Defaults To EqualityComparer<TVal>.default.
	 */
	constructor(evictPolicy = EvictionPolicy.None, capacity = Number.MAX_SAFE_INTEGER, eqComparer = EqualityComparer.default) {
		super(eqComparer);
		
		/**
		 * @type {EvictionPolicy|Number}
		 * @protected
		 */
		this._evictPolicy = EvictionPolicy.None;
		this.evictionPolicy = evictPolicy;

		/**
		 * @type {Number}
		 * @protected
		 */
		this._capacity = capacity;
		this.capacity = capacity;

		/**
		 * @type {Object<String|Symbol, CacheItem<T>>}
		 * @protected
		 */
		this._dict = {};
	};
	
	/**
	 * @param {EvictionPolicy|Number} policy An @see {EvictionPolicy}
	 * @throws {Error} If the given policy is not one of @see {EvictionPolicy}.
	 * @protected
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
			case EvictionPolicy.Random:
			case EvictionPolicy.Undetermined:
				break;
			default:
				throw new Error(`The eviction policy '${policy}' is not supported.`);
		}
	};

	/**
	 * Get the current @see {EvictionPolicy}.
	 * 
	 * @type {EvictionPolicy|Number}
	 */
	get evictionPolicy() {
		return this._evictPolicy;
	};

	/**
	 * Set the current @see {EvictionPolicy}.
	 * 
	 * @param {EvictionPolicy|Number} policy The new policy to use for evicting items.
	 * @type {void}
	 */
	set evictionPolicy(policy) {
		this._validateEvictionPolicy(policy);
		this._evictPolicy = policy;
	};

	/**
	 * @param {Number} capacity The capacity to check. Must be a positive integer.
	 * @throws {Error} If the given capacity is not an integer or less than zero.
	 * @protected
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
	 * Returns the current capacity of this cache.
	 * 
	 * @type {Number}
	 */
	get capacity() {
		return this._capacity;
	};

	/**
	 * Returns true, if the cache's capacity is all used up.
	 * 
	 * @type {Boolean}
	 */
	get isFull() {
		return this.size === this.capacity;
	};

	/**
	 * @param {Number} capacity The new capacity of this cache. Must be a positive
	 * integer (0 is allowed). Note that setting a capacity that undercuts the amount
	 * of items currently held in the cache, will lead to the eviction of enough
	 * items to meet the new capacity constraint.
	 * @type {void}
	 */
	set capacity(capacity) {
		this._validateCapacity(capacity);

		let toEvict = this.size - capacity;
		if (toEvict > 0 && this.evictionPolicy === EvictionPolicy.None) {
			throw new Error('Cannot decrease capacity and automatically evict items with policy set to None.');
		}
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
	 * @returns {Array<T>} The evicted items in an array.
	 */
	evictMany(count) {
		let howMany = Math.min(count, this.size);
		/** @type {Array<T>} */
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
	 * @returns {Array<Object<String|Symbol, T>>}
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
	 * @protected
	 * @returns {IterableIterator<CacheItem<T>>}
	 */
	*_evictNext() {
		/** @type {Array<CacheItem<T>>} */
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
			case EvictionPolicy.Random:
				// Randomly select items to evict:
				wrappers.unshift(
					...Array.from(super.values()).sort(() => {
						return Math.random() < .5 ? 1 : -1;
					})
				);
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
	 * @override
	 * @inheritdoc
	 * @param {Number} [expireAfterMsecs] Optional. if given a positive integer, then it
	 * will be used as the amount of milliseconds this entry will expire and remove itself
	 * from the cache.
	 * @throws {Error} If this cache is full and no automatic eviction policy was set.
	 * @type {void}
	 */
	set(key, val, expireAfterMsecs = void 0) {
		const isFull = this.size === this.capacity;
		if (isFull) {
			if (this.evictionPolicy === EvictionPolicy.None) {
				throw new Error(`The Cache is full and no automatic eviction policy is set.`);
			}

			this.evict(); // Remove one item according to an automatic policy.
		}

		if (!Resolve.isNumber(expireAfterMsecs) || !Number.isSafeInteger(expireAfterMsecs) || expireAfterMsecs < 0) {
			expireAfterMsecs = -1;
		}

		const wrap = new CacheItem(this, key, val, Cache.__counter, expireAfterMsecs);

		return super.set(key, wrap);
	};

	/**
	 * @override
	 * @inheritdoc
	 */
	get(key) {
		/** @type {CacheItem<T>} */
		const wrap = super.get(key);
		wrap.updateAccessTime();
		wrap.increaseAccessCount();
		return wrap.item;
	};

	/**
	 * @override
	 * @inheritdoc
	 */
	remove(key) {
		/** @type {CacheItem<T>} */
		const wrap = super.remove(key);
		wrap.clearTimeout();
		return wrap.item;
	};

	/**
	 * @override
	 * @inheritdoc
	 */
	*values() {
		for (const val of super.values()) {
			yield val.item;
		}
	};

	/**
	 * @override
	 * @inheritdoc
	 * @protected
	 */
	*_entries(reverse = false) {
		for (const entry of super._entries(reverse)) {
			const key = Object.keys(entry).concat(Object.getOwnPropertySymbols(entry))[0];
			entry[key] = entry[key].item; // unwrap
			yield entry;
		}
	};
};



let __counterCb = 0;

/**
 * @template TKey
 * @template TVal
 * @extends {DictionaryMapBased<TKey, TVal>}
 * @author Sebastian Hönel <development@hoenel.net>
 */
class CacheMapBased extends DictionaryMapBased {
	/**
	 * Used to assign a running number to new cache items.
	 * @private
	 * @type {Number}
	 */
	static get __counter() {
		return __counterCb++;
	};


	/**
	 * Creates a new, empty CacheMapBased<TKey, TVal>, using the specified @see {EvictionPolicy} and
	 * an initial capacity.
	 * 
	 * @param {EvictionPolicy|Number} [evictPolicy] Optional. Specify the eviction policy that is
	 * applied, if the cache has no more space left.
	 * @param {Number} [capacity] Optional. Specify the initial capacity of this cache. The capacity
	 * can be increased and decreased later.
	 * @param {EqualityComparer<TVal>} [eqComparer] Optional. Defaults To EqualityComparer<TVal>.default.
	 */
	constructor(evictPolicy = EvictionPolicy.None, capacity = Number.MAX_SAFE_INTEGER, eqComparer = EqualityComparer.default) {
		super(eqComparer);
		
		/**
		 * @type {EvictionPolicy|Number}
		 * @protected
		 */
		this._evictPolicy = EvictionPolicy.None;
		this.evictionPolicy = evictPolicy;

		/**
		 * @type {Number}
		 * @protected
		 */
		this._capacity = capacity;
		this.capacity = capacity;

		/**
		 * @type {Map<TKey, CacheItem<TVal>>}
		 * @protected
		 */
		this._map = new Map();

		/** @type {Observable<CollectionEvent<Array<TVal>>>} */
		this.observableEvict = Object.freeze(fromEvent(this, symbolCacheEvict));
	};
	
	/**
	 * @param {EvictionPolicy|Number} policy An @see {EvictionPolicy}
	 * @throws {Error} If the given policy is not one of @see {EvictionPolicy}.
	 * @protected
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
			case EvictionPolicy.Random:
			case EvictionPolicy.Undetermined:
				break;
			default:
				throw new Error(`The eviction policy '${policy}' is not supported.`);
		}
	};

	/**
	 * @type {EvictionPolicy|Number}
	 */
	get evictionPolicy() {
		return this._evictPolicy;
	};

	/**
	 * @param {EvictionPolicy|Number} policy The new policy to use for evicting items.
	 */
	set evictionPolicy(policy) {
		this._validateEvictionPolicy(policy);
		this._evictPolicy = policy;
	};

	/**
	 * @param {Number} capacity The capacity to check. Must be a positive integer.
	 * @throws {Error} If the given capacity is not an integer or less than zero.
	 * @protected
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
	 * Returns the current capacity of this cache.
	 * 
	 * @type {Number}
	 */
	get capacity() {
		return this._capacity;
	};

	/**
	 * Returns true, if the cache's capacity is all used up.
	 * 
	 * @type {Boolean}
	 */
	get isFull() {
		return this.size === this.capacity;
	};

	/**
	 * @param {Number} capacity The new capacity of this cache. Must be a positive
	 * integer (0 is allowed). Note that setting a capacity that undercuts the amount
	 * of items currently held in the cache, will lead to the eviction of enough
	 * items to meet the new capacity constraint.
	 * @type {void}
	 */
	set capacity(capacity) {
		this._validateCapacity(capacity);

		let toEvict = this.size - capacity;
		if (toEvict > 0 && this.evictionPolicy === EvictionPolicy.None) {
			throw new Error('Cannot decrease capacity and automatically evict items with policy set to None.');
		}
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
	 * @returns {Array<T>} The evicted items in an array.
	 */
	evictMany(count) {
		let howMany = Math.min(count, this.size);
		/** @type {Array<T>} */
		const items = [];

		for (const item of this._evictNext()) {
			items.push(this.delete(item.key));
			if (--howMany === 0) {
				break;
			}
		}

		this.emit(symbolCacheEvict, new CollectionEvent(items.slice(0)));

		return items;
	};

	/**
	 * Allows to peek at the next n items that will be evicted next, without
	 * removing them. Returns the items as key/value pair.
	 * 
	 * @param {Number} amount
	 * @returns {Array<[TKey, TVal]>}
	 */
	peekEvict(amount) {
		if (!Resolve.isTypeOf(amount, Number) || !Number.isInteger(amount) || amount < 1) {
			throw new Error('You must peek an mount larger than 0.');
		}

		amount = Math.min(amount, this.size);
		const iter = this._evictNext();
		return Array.from(Array(amount), iter.next, iter).map(o => {
			return [o.value.key, o.value.item];
		});
	};

	/**
	 * Returns items in the order they will be evicted, according to the policy.
	 * 
	 * @protected
	 * @returns {IterableIterator<CacheItem<TVal>>}
	 */
	*_evictNext() {
		/** @type {Array<CacheItem<TVal>>} */
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
			case EvictionPolicy.Random:
				// Randomly select items to evict:
				wrappers.unshift(
					...Array.from(super.values()).sort(() => {
						return Math.random() < .5 ? 1 : -1;
					})
				);
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
	 * @override
	 * @inheritdoc
	 * @param {Number} [expireAfterMsecs] Optional. if given a positive integer, then it
	 * will be used as the amount of milliseconds this entry will expire and remove itself
	 * from the cache.
	 * @throws {Error} If this cache is full and no automatic eviction policy was set.
	 */
	set(key, val, expireAfterMsecs = void 0) {
		const isFull = this.size === this.capacity;
		if (isFull) {
			if (this.evictionPolicy === EvictionPolicy.None) {
				throw new Error(`The Cache is full and no automatic eviction policy is set.`);
			}

			this.evict(); // Remove one item according to an automatic policy.
		}

		if (!Resolve.isNumber(expireAfterMsecs) || !Number.isSafeInteger(expireAfterMsecs) || expireAfterMsecs < 0) {
			expireAfterMsecs = -1;
		}

		const wrap = new CacheItem(this, key, val, CacheMapBased.__counter, expireAfterMsecs);

		return super.set(key, wrap);
	};

	/**
	 * @override
	 * @inheritdoc
	 */
	get(key) {
		const wrap = this._map.get(key);
		wrap.updateAccessTime();
		wrap.increaseAccessCount();

		const value = this.__unwrapValue(wrap);
		this.emit(symbolDictionaryGet, new CollectionEvent([key, value]));
		return value;
	};

	/**
	 * @override
	 * @inheritdoc
	 */
	*values() {
		for (const val of super.values()) {
			yield this.__unwrapValue(val);
		}
	};

	/**
	 * @override
	 * @inheritdoc
	 */
	*entries() {
		for (const entry of super.entries()) {
			yield [entry[0], this.__unwrapValue(entry[1])];
		}
	};

	/**
	 * @private
	 * @override
	 * @inheritdoc
	 * @param {CacheItem<TVal>} value
	 * @returns {TVal} The wrapped value
	 */
	__unwrapValue(value) {
		return value.item;
	};
};



/**
 * @template T
 * @extends {CacheItem<T>}
 * @author Sebastian Hönel <development@hoenel.net>
 */
class CacheItemWithLoad extends CacheItem {
	/**
	 * @inheritdoc
	 * @param {T} item
	 * @param {Number} load 
	 */
	constructor(cache, key, item, order, expireAfterMsecs, load) {
		super(cache, key, item, order, expireAfterMsecs);

		/** @protected */
		this._load = load;
	};

	/**
	 * @type {Number}
	 */
	get load() {
		return this._load;
	};
};


/**
 * A CacheWithLoad introduces a second concept to constrain the capacity
 * of it. This second concept of load is useful for when the size of the
 * items to cache is not known, and when the sheer amount of items does
 * not allow to estimate the load. The CacheWithLoad evicts items when
 * either its capacity is exhausted or the maximum load is exceeded.
 * 
 * @template TKey
 * @template TVal
 * @extends {CacheMapBased<TKey, TVal>}
 * @author Sebastian Hönel <development@hoenel.net>
 */
class CacheWithLoad extends CacheMapBased {
	/**
	 * @inheritdoc
	 * @param {EvictionPolicy|Number} evictPolicy
	 * @param {Number} capacity
	 * @param {Number} maxLoad The maximum load, expressed as a positive number.
	 * @param {EqualityComparer<TVal>} eqComparer
	 */
	constructor(evictPolicy = EvictionPolicy.None, capacity = Number.MAX_SAFE_INTEGER, maxLoad = Number.MAX_VALUE, eqComparer = EqualityComparer.default) {
		super(evictPolicy, capacity, eqComparer);

		/** @protected */
		this._maxLoad = maxLoad;
		this.maxLoad = maxLoad;

		/**
		 * @type {Object<String|Symbol, CacheItemWithLoad<T>>}
		 * @protected
		 */
		this._dict = {};
	};

	/**
	 * @protected
	 * @param {Number} load
	 */
	_validateLoad(load) {
		if (!Resolve.isTypeOf(load, Number) || !Number.isFinite(load)) {
			throw new Error(`The value given for load is not a number.`);
		}
		if (load <= 0) {
			throw new Error(`The value given for load must be greater than zero.`);
		}
	};

	/**
	 * Returns the current load.
	 * 
	 * @type {Number}
	 */
	get load() {
		return Array.from(
			// To avoid unwrapping:
			DictionaryMapBased.prototype.values.call(this)
		).map(ci => ci.load).reduce((a, b) => a + b, 0);
	};

	/**
	 * Returns the current free load (maximum load - current load).
	 * 
	 * @type {Number}
	 */
	get loadFree() {
		return this.maxLoad - this.load;
	};

	/**
	 * Set the maximum load.
	 * 
	 * @param {Number} maxLoad
	 * @type {void}
	 */
	set maxLoad(maxLoad) {
		this._validateLoad(maxLoad);

		if (maxLoad < this.load && this.evictionPolicy === EvictionPolicy.None) {
			throw new Error('Cannot decrease the maximum load and automatically evict items with policy set to None.');
		}

		while (this.load > maxLoad) {
			this.evict();
		}

		this._maxLoad = maxLoad;
	};

	/**
	 * Returns the maximum load.
	 * 
	 * @type {Number}
	 */
	get maxLoad() {
		return this._maxLoad;
	};

	/**
	 * @override
	 * @inheritdoc
	 * @param {TKey} key
	 * @param {TVal} val
	 * @param {Number} load
	 * @param {Number} [expireAfterMsecs] defaults to undefined. Only used if given
	 * as a positive integer.
	 * @returns {this}
	 */
	set(key, val, load, expireAfterMsecs = void 0) {
		this._validateLoad(load);

		if (load > this.maxLoad) {
			throw new Error(`The specified load exceeds this cache's maximum load.`);
		}

		const isFull = this.size === this.capacity;
		if (isFull) {
			if (this.evictionPolicy === EvictionPolicy.None) {
				throw new Error(`The Cache is full and no automatic eviction policy is set.`);
			}

			this.evict(); // Remove one item according to an automatic policy.
		}

		if (load + this.load > this.maxLoad) {
			if (this.evictionPolicy === EvictionPolicy.None) {
				throw new Error(`The Cache's load is too high and no automatic eviction policy is set.`);
			}

			while (load + this.load > this.maxLoad) {
				this.evict();
			}
		}

		if (!Resolve.isNumber(expireAfterMsecs) || !Number.isSafeInteger(expireAfterMsecs) || expireAfterMsecs < 0) {
			expireAfterMsecs = -1;
		}

		const wrap = new CacheItemWithLoad(
			this, key, val, CacheMapBased.__counter, expireAfterMsecs, load);

		return DictionaryMapBased.prototype.set.call(this, key, wrap);
	};
};


module.exports = Object.freeze({
	EvictionPolicy,
	Cache,
	CacheMapBased,
	CacheItem,
	CacheWithLoad,
	CacheItemWithLoad
});
