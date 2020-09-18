const { Collection, CollectionEvent } = require('./Collection')
, { Resolve } = require('../tools/Resolve')
, { EqualityComparer } = require('./EqualityComparer')
, { Observable, fromEvent } = require('rxjs')
, symbolStackPush = Symbol('stackPush')
, symbolStackPop = Symbol('stackPop')
, symbolStackPopBottom = Symbol('stackPopBottom');


/**
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Stack extends Collection {
	/**
	 * Creates a new, empty Stack.<T>.
	 * 
	 * @param {EqualityComparer.<T>} [eqComparer] Optional. Defaults To EqualityComparer.<T>.default.
	 */
	constructor(eqComparer = EqualityComparer.default) {
		super(eqComparer);
		
		/** @type {Observable.<T>} */
		this.observablePush = Object.freeze(fromEvent(this, symbolStackPush));
		/** @type {Observable.<T>} */
		this.observablePop = Object.freeze(fromEvent(this, symbolStackPop));
		/** @type {Observable.<T>} */
		this.observablePopBottom = Object.freeze(fromEvent(this, symbolStackPopBottom));
	};

	/**
	 * Push an item to the top of the Stack.
	 * 
	 * @param {T} item 
	 * @returns {this}
	 */
	push(item) {
		this._items.push(item);
		this.emit(symbolStackPush, new CollectionEvent(item));
		return this;
	};

	/**
	 * @throws {Error} If the Stack is empty.
	 * @returns {T} The item at the top of the Stack (the item
	 * inserted last).
	 */
	pop() {
		if (this.isEmpty) {
			throw new Error('The Stack is empty.');
		}
		
		const item = this._items.pop();
		this.emit(symbolStackPop, new CollectionEvent(item));
		return item;
	};

	/**
	 * @throws {Error} If the Stack is empty.
	 * @returns {T} The item at the bottom of the Stack (the item
	 * inserted first).
	 */
	popBottom() {
		if (this.isEmpty) {
			throw new Error('The Stack is empty.');
		}

		const item = this._items.shift();
		this.emit(symbolStackPopBottom, new CollectionEvent(item));
		return item;
	};

	/**
	 * @throws {Error} If the Stack is empty.
	 * @returns {T} The item on top of the Stack without popping it.
	 */
	peek() {
		if (this.isEmpty) {
			throw new Error('The Stack is empty.');
		}

		return this._items[this.size - 1];
	};

	/**
	 * @throws {Error} If the Stack is empty.
	 * @returns {T} The item at the bottom of the Stack without popping it.
	 */
	peekBottom() {
		if (this.isEmpty) {
			throw new Error('The Stack is empty.');
		}

		return this._items[0];
	};
};


class ConstrainedStack extends Stack {
	/**
	 * Creates a new, empty Stack.<T>.
	 * 
	 * @param {Number} [maxSize] Optional. Defaults to Number.MAX_SAFE_INTEGER. Use
	 * this parameter to limit the maximum amount of elements this Stack can hold.
	 * When the limit is reached and items are being further pushed, the
	 * ConstrainedStack will pop items from the BOTTOM. I.e., when pushing a new item
	 * to the top of the Stack when it is full, will discard one item at its bottom.
	 * This parameter must be a positive integer larger than zero.
	 * @param {EqualityComparer.<T>} [eqComparer] Optional. Defaults To
	 * EqualityComparer.<T>.default.
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
	 * Sets the maximum size of this ConstrainedStack. If currently there are more
	 * items, the stack will pop items from the bottom until the number of items
	 * does not longer exceed the new maximum size. The items will be popped from
	 * the BOTTOM.
	 * 
	 * @param {number} value The new value for maxSize. Must be an integer equal
	 * to or larger than 1.
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
		let excess = this.size - this.maxSize;
		while (excess > 0) {
			// Triggers/emits symbol for poppong items from bottom.
			this.popBottom();
			excess--;
		}
		
		return this;
	};

	/**
	 * Push an item to the top of the Stack. If, after pushing this item,
	 * the Stack is larger than its specified maximum size, it will discard
	 * an item from the BOTTOM.
	 * 
	 * @param {T} item 
	 * @returns {this}
	 */
	push(item) {
		super.push(item);
		return this._truncate();
	};
};


module.exports = Object.freeze({
	Stack,
	ConstrainedStack,
	symbolStackPop,
	symbolStackPush,
	symbolStackPopBottom
});
