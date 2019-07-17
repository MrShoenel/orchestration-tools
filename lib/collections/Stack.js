const { Collection, CollectionEvent } = require('./Collection')
, { EqualityComparer } = require('./EqualityComparer')
, { Observable, fromEvent } = require('rxjs')
, symbolStackPush = Symbol('stackPush')
, symbolStackPop = Symbol('stackPop');


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
  };

  /**
   * Push an item to the top of the Stack.
   * 
   * @param {T} item 
   */
  push(item) {
		this._items.push(item);
		this.emit(symbolStackPush, new CollectionEvent(item));
    return this;
  };

  /**
   * @throws {Error} If the Stack is empty.
   * @returns {T} The item at the top of the Stack.
   */
  pop() {
    if (this.isEmpty) {
      throw new Error('The Stack is empty.');
		}
		
		const item = this._items.splice(this.size - 1, 1)[0];
		this.emit(symbolStackPop, new CollectionEvent(item));
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


module.exports = Object.freeze({
	Stack,
	symbolStackPop,
	symbolStackPush
});
