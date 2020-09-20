const { Collection, CollectionEvent } = require('./Collection')
, { EqualityComparer } = require('./EqualityComparer')
, { Resolve } = require('../tools/Resolve')
, { defer } = require('../tools/Defer')
, { Observable, fromEvent} = require('rxjs')
, symbolQueueEnqueue = Symbol('queueEnqueue')
, symbolQueueDequeue = Symbol('queueDequeue')
, symbolQueueTakeOut = Symbol('queueTakeOut');


/**
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Queue extends Collection {
	/**
	 * Creates a new, empty Queue<T>.
	 * 
	 * @param {EqualityComparer<T>} [eqComparer] Optional. Defaults To EqualityComparer<T>.default.
	 */
	constructor(eqComparer = EqualityComparer.default) {
		super(eqComparer);
		
		/** @type {Observable<T>} */
		this.observableEnqueue = Object.freeze(fromEvent(this, symbolQueueEnqueue));
		/** @type {Observable<T>} */
		this.observableDequeue = Object.freeze(fromEvent(this, symbolQueueDequeue));
	};

	/**
	 * @param {T} item The item to add at the end of the Queue.
	 * @returns {this}
	 */
	enqueue(item) {
		this._items.push(item);
		this.emit(symbolQueueEnqueue, new CollectionEvent(item));
		return this;
	};

	/**
	 * @returns {T} The first item (at the beginning) of the Queue.
	 */
	dequeue() {
		if (this.isEmpty) {
			throw new Error('The Queue is empty.');
		}
		
		const item = this._items.shift();
		this.emit(symbolQueueDequeue, new CollectionEvent(item));
		return item;
	};

	/**
	 * @param {Number} index The index of the item to peek.
	 * @returns {T} The item at the index.
	 * @throws {Error} If the given index is out of range
	 */
	peekIndex(index) {
		if (index < 0 || index > (this.size - 1)) {
			throw new Error(`The given index is out of range`);
		}

		return this._items[index];
	};
	
	/**
	 * @param {Number} index The index of the element to remove. The index
	 * must be in the range [0, this.size - 1]. The first element to take out
	 * has index 0 (the last element inserted has the largest index, size - 1).
	 * @returns {T} The dequeued item
	 * @throws {Error} If the given index is out of range
	 */
	takeOutIndex(index) {
		if (index === 0) {
			return this.dequeue();
		}

		if (index < 0 || index > (this.size - 1)) {
			throw new Error(`The given index is out of range`);
		}

		const item = this._items.splice(index, 1)[0];
		this.emit(symbolQueueTakeOut, new CollectionEvent(item));
		return item;
	};

	/**
	 * @param {T} item The item to take ot, must be an item currently on this queue
	 * @param {EqualityComparer<T>} [eqComparer] Optional. Defaults to this queue's
	 * equality comparer. Used to find the index of the given item.
	 * @returns {T} The dequeued item.
	 * @throws {Error} If the item cannot be found in the queue.
	 */
	takeOutItem(item, eqComparer = null) {
		/** @type {EqualityComparer<T>} */
		eqComparer = eqComparer instanceof EqualityComparer ? eqComparer : this.equalityComparer;
		const idx = this._items.findIndex((val, idx) => {
			return eqComparer.equals(val, item);
		});
		return this.takeOutIndex(idx);
	};

	/**
	 * @returns {T} The first item without removing it.
	 */
	peek() {
		if (this.isEmpty) {
			throw new Error('The Queue is empty.');
		}

		return this._items[0];
	};

	/**
	 * @returns {T} The last item without removing it.
	 */
	peekLast() {
		if (this.isEmpty) {
			throw new Error('The Queue is empty.');
		}

		return this._items[this.size - 1];
	};
};


/**
 * @readonly
 * @enum {Number}
 */
const ConstrainedQueueCapacityPolicy = {
	/**
	 * Dequeue items to make space and accomodate new items.
	 */
	Dequeue: 1,

	/**
	 * Ignore attempts to enqueue more items once the full capacity
	 * is reached. New items are not enqueued and silently discarded.
	 */
	IgnoreEnqueue: 2,

	/**
	 * Reject attempts to enqueue more items once the full capacity
	 * is reached. An error is thrown in this case.
	 */
	RejectEnqueue: 4
};


/**
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class ConstrainedQueue extends Queue {
	/**
	 * Creates a new, empty ConstrainedQueue<T>.
	 * 
	 * @param {Number} [maxSize] Optional. Defaults to Number.MAX_SAFE_INTEGER. Use this parameter to
	 * limit the maximum amount of elements this Queue can hold. When the limit is reached and items
	 * are being further enqueued, the ConstrainedQueue will dequeue and discard items to make space.
	 * This parameter must be a positive integer larger than zero.
	 * @param {EqualityComparer<T>} [eqComparer] Optional. Defaults To EqualityComparer<T>.default.
	 */
	constructor(maxSize = Number.MAX_SAFE_INTEGER, eqComparer = EqualityComparer.default) {
		super(eqComparer);

		this._maxSize = 1;
		this.maxSize = maxSize;
	};

	/**
	 * @type {Number}
	 */
	get maxSize() {
		return this._maxSize;
	};

	/**
	 * Sets the maximum size of this ConstrainedQueue. If currently there are more items, the queue
	 * will be truncated (i.e. the excess items will be discarded). The excess items will be taken
	 * from the head of the queue (dequeued).
	 * 
	 * @param {Number} value The new value for maxSize. Must be an integer equal to or larger than 1.
	 * @throws {Error} If parameter value is not a number or less than one (1).
	 * @type {void}
	 */
	set maxSize(value) {
		if (!Resolve.isTypeOf(value, Number) || !Number.isInteger(value)) {
			throw new Error(`The value given for maxSize is not a number.`);
		}
		
		if (value < 1) {
			throw new Error(`The value given is less than 1: ${value}`);
		}

		this._maxSize = value;
		this._truncate();
	};

	/**
	 * @protected
	 * @returns {this}
	 */
	_truncate() {
		let excess = this.size - this.maxSize;
		while (excess > 0) {
			// Triggers/emits symbol for dequeueing items.
			this.dequeue();
			excess--;
		}
		
		return this;
	};

	/**
	 * @override
	 * @inheritdoc
	 * @param {T} item
	 * @returns {this}
	 */
	enqueue(item) {
		super.enqueue(item);
		return this._truncate();
	};
};




/**
 * @template T, TQueue
 * @author Sebastian Hönel <development@hoenel.net>
 */
class ItemAndDeferred {
	/**
	 * @param {T} item 
	 * @param {Deferred<TQueue>} deferred
	 */
	constructor(item, deferred) {
		this.item = item;
		this.deferred = deferred;
	};
};


/**
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class ProducerConsumerQueue extends ConstrainedQueue {
	
	/**
	 * Creates a new, empty ProducerConsumerQueue<T>.
	 * 
	 * @param {Number} [maxSize] Optional. Defaults to Number.MAX_SAFE_INTEGER. Use this parameter to
	 * limit the maximum amount of elements this Queue can hold. When the limit is reached and items
	 * are being further enqueued, the ProducerConsumerQueue will defer further calls and only resolve
	 * them, once space is available and the item has been enqueued. Likewise, an item is dequeued
	 * immediately if the queue is non-empty. Otherwise, the call is deferred and resolved once an item
	 * becomes available. Adjusting the capacity of this queue will only affect items in it, but not
	 * deferred calls to enqueue().
	 * @param {EqualityComparer<T>} [eqComparer] Optional. Defaults To EqualityComparer<T>.default.
	 */
	constructor(maxSize = Number.MAX_SAFE_INTEGER, eqComparer = EqualityComparer.default) {
		super(maxSize, eqComparer);

		/**
		 * @type {Queue<ItemAndDeferred<T, this>>}
		 * @protected
		 */
		this._deferredEnqueues = new Queue(eqComparer);
		/**
		 * @type {Queue<Deferred<T>>}
		 * @protected
		 */
		this._deferredDequeues = new Queue(eqComparer);
	};

	/**
	 * @protected
	 */
	_itemAvailable() {
		while (this.size > 0 && this._deferredDequeues.size > 0) {
			const deferred = this._deferredDequeues.dequeue();
			deferred.resolve(super.dequeue());
		}
	};

	/**
	 * @protected
	 */
	_spaceAvailable() {
		while (this.size < this.maxSize && this._deferredEnqueues.size > 0) {
			const itemAndDef = this._deferredEnqueues.dequeue();
			super.enqueue(itemAndDef.item);
			itemAndDef.deferred.resolve(this);
		}
	};
	
	/**
	 * @override
	 * @inheritdoc
	 * @param {T} item The item to be enqueued.
	 * @returns {Promise<this>} The promise is resolved once the item got enqueued.
	 */
	enqueue(item) {
		if (this.size < this.maxSize) {
			// There is space in the queue, so we can just enqueue the item.
			super.enqueue(item);
			setTimeout(this._itemAvailable.bind(this), 0);
			return Promise.resolve(this);
		} else {
			// We have to defer the request and wait for space in the queue.
			/** @type {Deferred<this>} */
			const deferred = defer();
			this._deferredEnqueues.enqueue(new ItemAndDeferred(item, deferred));
			return deferred.promise;
		}
	};

	/**
	 * @override
	 * @inheritdoc
	 * @returns {Promise<T>} The promise is resolved once an item is available.
	 */
	dequeue() {
		if (this.isEmpty) {
			// We have to wait for an item to be produced.
			/** @type {Deferred<T>} */
			const deferred = defer();
			this._deferredDequeues.enqueue(deferred);
			return deferred.promise;
		} else {
			// Dequeue the first available item.
			setTimeout(this._spaceAvailable.bind(this), 0);
			return Promise.resolve(super.dequeue());
		}
	};
};


module.exports = Object.freeze({
	Queue,
	ConstrainedQueue,
	ConstrainedQueueCapacityPolicy,
	ProducerConsumerQueue,
	symbolQueueEnqueue,
	symbolQueueDequeue,
	symbolQueueTakeOut
});
