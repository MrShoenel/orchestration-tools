const { Collection, CollectionEvent } = require('./Collection')
, { EqualityComparer } = require('./EqualityComparer')
, { Resolve } = require('../../tools/Resolve')
, { Observable, fromEvent} = require('rxjs')
, symbolQueueEnqueue = Symbol('queueEnqueue')
, symbolQueueDequeue = Symbol('queueDequeue');


/**
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Queue extends Collection {
  /**
   * Creates a new, empty Queue.<T>.
   * 
   * @param {EqualityComparer.<T>} [eqComparer] Optional. Defaults To EqualityComparer.<T>.default.
   */
  constructor(eqComparer = EqualityComparer.default) {
		super(eqComparer);
		
		/** @type {Observable.<T>} */
		this.observableEnqueue = Object.freeze(fromEvent(this, symbolQueueEnqueue));
		/** @type {Observable.<T>} */
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
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class ConstrainedQueue extends Queue {
  /**
   * Creates a new, empty ConstrainedQueue.<T>.
   * 
   * @param {number} [maxSize] Optional. Defaults to Number.MAX_SAFE_INTEGER. Use this parameter to
   * limit the maximum amount of elements this Queue can hold. When the limit is reached and items
   * are being further enqueued, the ConstrainedQueue will dequeue and discard items to make space.
   * This parameter must be a positive integer larger than zero.
   * @param {EqualityComparer.<T>} [eqComparer] Optional. Defaults To EqualityComparer.<T>.default.
   */
  constructor(maxSize = Number.MAX_SAFE_INTEGER, eqComparer = EqualityComparer.default) {
    super(eqComparer);

    this._maxSize = 1;
    this.maxSize = maxSize;
  };

  /**
   * @returns {number}
   */
  get maxSize() {
    return this._maxSize;
  };

  /**
   * Sets the maximum size of this ConstrainedQueue. If currently there are more items, the queue
   * will be truncated (i.e. the excess items will be discarded). The excess items will be taken
   * from the head of the queue (dequeued).
   * 
   * @param {number} value The new value for maxSize. Must be an integer equal to or larger than 1.
   * @throws {Error} If parameter value is not a number or less than one (1).
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
   * @returns {this}
   */
  _truncate() {
    const excess = this.size - this.maxSize;
    if (excess > 0) {
      this._items.splice(0, excess);
    }
    
    return this;
  };

  /**
   * @param {T} item
   * @returns {this}
   */
  enqueue(item) {
    super.enqueue(item);
    return this._truncate();
  };
};


module.exports = Object.freeze({
  Queue,
	ConstrainedQueue,
	symbolQueueEnqueue,
	symbolQueueDequeue
});
