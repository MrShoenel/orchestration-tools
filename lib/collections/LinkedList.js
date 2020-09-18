const { Collection, CollectionEvent } = require('./Collection')
, { EqualityComparer } = require('./EqualityComparer')
, { Observable, fromEvent } = require('rxjs')
, symbolLinkedListAdd = Symbol('linkedListAdd')
, symbolLinkedListRemove = Symbol('linkedListRemove');


/**
 * @template T
 */
class LinkedListEvent extends CollectionEvent {
	/**
	 * @param {LinkedListNode.<T>} node
	 * @param {Boolean} add True, if the node was added. If false, the node was removed.
	 * @param {Boolean} first True, iff the node is the first node now
	 * @param {Boolean} last True, iff the node is the last node now
	 */
	constructor(node, add, first, last) {
		super(node);

		/** @type {LinkedListNode.<T>} */
		this.item = node;

		/** @protected */
		this._add = add;
		/** @protected */
		this._first = first;
		/** @protected */
		this._last = last;
	};

	get added() {
		return this._add;
	};

	get removed() {
		return !this._add;
	};

	get firstNode() {
		return this._first;
	};

	get lastNode() {
		return this._last;
	};
};


/**
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class LinkedListNode {
	/**
	 * @param {T} item
	 * @param {LinkedList.<T>} list
	 * @param {LinkedListNode.<T>} prev
	 * @param {LinkedListNode.<T>} next
	 */
	constructor(item, list, prev = null, next = null) {
		this.item = item;
		this.list = list;
		this.prev = prev;
		this.next = next;
	};
};



/**
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class LinkedList extends Collection {
	/**
	 * Creates a new, empty doubly-linked LinkedList.
	 * 
	 * @param {EqualityComparer.<T>} [eqComparer] Optional. Defaults To EqualityComparer.<T>.default.
	 */
	constructor(eqComparer = EqualityComparer.default) {
		super(eqComparer);
		
		/**
		 * @type {LinkedListNode.<T>}
		 * @protected
		 */
		this._firstNode = null;
		/**
		 * @type {LinkedListNode.<T>}
		 * @protected
		 */
		this._lastNode = null;
		
		/**
		 * @type {Set.<LinkedListNode.<T>>}
		 * @protected
		 */
		this._lookupSet = new Set();

		/** @protected */
		this._size = 0;
		
		/** @type {Observable.<LinkedListEvent.<T>>} */
		this.observableNodeAdd = Object.freeze(fromEvent(this, symbolLinkedListAdd));
		/** @type {Observable.<LinkedListEvent.<T>>} */
		this.observableNodeRemove = Object.freeze(fromEvent(this, symbolLinkedListRemove));
	};

	/**
	 * @protected
	 * @throws {Error} If this LinkedList is empty.
	 * @returns {boolean} true
	 */
	_requireNotEmpty() {
		if (this._firstNode === null) {
			throw new Error('The LinkedList is empty.');
		}
		return true;
	};

	/**
	 * @protected
	 * @throws {Error} If the given node is not a LinkedListNode.
	 * @param {LinkedListNode.<T>} node
	 */
	_requireIsNode(node) {
		if (!(node instanceof LinkedListNode)) {
			throw new Error('The node is not a LinkedListNode.');
		}
		return true;
	};

	/**
	 * @protected
	 * @param {LinkedListNode.<T>} node 
	 * @param {T} item 
	 * @param {boolean} after
	 * @returns {LinkedListNode.<T>} The newly added node.
	 */
	_add(node, item, after = true) {
		if (!this.hasNode(node)) {
			throw new Error('The node given is not a member of this LinkedList.');
		}

		const newNode = new LinkedListNode(
			item, this, after ? node : node.prev, after ? node.next : node);
		
		if (newNode.prev instanceof LinkedListNode) {
			newNode.prev.next = newNode;
			if (newNode.prev.prev === null) {
				this._firstNode = newNode.prev;
			}
		} else {
			this._firstNode = newNode;
		}

		if (newNode.next instanceof LinkedListNode) {
			newNode.next.prev = newNode;
			if (newNode.next.next === null) {
				this._lastNode = newNode.next;
			}
		} else {
			this._lastNode = newNode;
		}
		
		this._lookupSet.add(newNode);
		this._size++;
		
		this.emit(symbolLinkedListAdd, new LinkedListEvent(
			newNode, true, this.first === newNode, this.last === newNode));

		return newNode;
	};

	/**
	 * @inheritDoc
	 */
	get size() {
		return this._size;
	};

	/**
	 * @inheritDoc
	 * @returns {boolean}
	 */
	get isEmpty() {
		return this._size === 0;
	};

	/**
	 * @returns {LinkedListNode.<T>}
	 */
	get first() {
		this._requireNotEmpty();
		return this._firstNode;
	};

	/**
	 * @returns {LinkedListNode.<T>}
	 */
	get last() {
		this._requireNotEmpty();
		return this._lastNode;
	};

	/**
	 * @returns {IterableIterator.<LinkedListNode.<T>>}
	 */
	*nodes() {
		let node = this._firstNode;

		while (node instanceof LinkedListNode) {
			yield node;
			node = node.next;
		}
	};

	/**
	 * @returns {IterableIterator.<LinkedListNode.<T>>}
	 */
	*nodesReversed() {
		let node = this._lastNode;

		while (node instanceof LinkedListNode) {
			yield node;
			node = node.prev;
		}
	};

	/**
	 * @returns {IterableIterator.<T>}
	 */
	*entries() {
		for (const node of this.nodes()) {
			yield node.item;
		}
	};

	/**
	 * @returns {IterableIterator.<T>}
	 */
	*entriesReversed() {
		for (const node of this.nodesReversed()) {
			yield node.item;
		}
	};

	/**
	 * @inheritDoc
	 * @param {T} item
	 * @param {EqualityComparer.<T>} [eqComparer] an optional EqualityComparer to use. If not provided, will use the Collection's EqualityComparer.
	 * @returns {boolean}
	 */
	has(item, eqComparer = null) {
		eqComparer = eqComparer instanceof EqualityComparer ? eqComparer : this._eqComparer;
		for (const value of this.entries()) {
			if (eqComparer.equals(item, value)) {
				return true;
			}
		}
		return false;
	};

	/**
	 * Returns a value indicating whether or not this LinkedList has
	 * the node provided.
	 * 
	 * @param {LinkedListNode.<T>} node
	 * @returns {boolean}
	 */
	hasNode(node) {
		this._requireIsNode(node);
		return this._lookupSet.has(node);
	};
	
	/**
	 * @override
	 * @inheritDoc
	 * @returns {this}
	 */
	clear() {
		super.clear();
		this._firstNode = null;
		this._lastNode = null;
		this._size = 0;
		this._lookupSet.clear();
		return this;
	};

	/**
	 * @param {T} item
	 * @returns {LinkedListNode.<T>} The node that has been created.
	 */
	addFirst(item) {
		if (this.isEmpty) {
			this._size++;
			this._firstNode = this._lastNode = new LinkedListNode(item, this);
			this._lookupSet.add(this._firstNode);
			this.emit(symbolLinkedListAdd, new LinkedListEvent(
				this._firstNode, true, true, true));
			return this._firstNode;
		} else {
			return this._add(this.first, item, false);
		}
	};

	/**
	 * @param {T} item
	 * @returns {LinkedListNode.<T>} The node that has been created.
	 */
	addLast(item) {
		if (this.isEmpty) {
			this._size++;
			this._lastNode = this._firstNode = new LinkedListNode(item, this);
			this._lookupSet.add(this._lastNode);
			this.emit(symbolLinkedListAdd, new LinkedListEvent(
				this._lastNode, true, true, true));
			return this._lastNode;
		} else {
			return this._add(this.last, item, true);
		}
	};

	/**
	 * @param {LinkedListNode.<T>} node
	 * @param {T} item
	 * @returns {LinkedListNode.<T>} The newly created and inserted node.
	 */
	addAfter(node, item) {
		return this._add(node, item, true);
	};

	/**
	 * @param {LinkedListNode.<T>} node
	 * @param {T} item
	 */
	addBefore(node, item) {
		return this._add(node, item, false);
	};

	/**
	 * @param {LinkedListNode.<T>} node
	 * @returns {LinkedListNode} The removed node
	 */
	remove(node) {
		if (!this.hasNode(node)) {
			throw new Error('This LinkedList does not have the given node.');
		}

		/**
		 * @param {LinkedListNode.<T>} theNode 
		 */
		const checkHeadTail = theNode => {
			if (theNode.prev === null) {
				this._firstNode = theNode;
			}
			if (theNode.next === null) {
				this._lastNode = theNode;
			};
		}

		let wasFirst = true, wasLast = true;
		if (node.prev instanceof LinkedListNode) {
			node.prev.next = node.next instanceof LinkedListNode ? node.next : null;
			checkHeadTail(node.prev);
			wasFirst = false;
		}
		if (node.next instanceof LinkedListNode) {
			node.next.prev = node.prev instanceof LinkedListNode ? node.prev : null;
			checkHeadTail(node.next);
			wasLast = false;
		}

		node.next = node.prev = null;

		this._size--;
		this._lookupSet.delete(node);
		this.emit(symbolLinkedListRemove, new LinkedListEvent(
			node, false, wasFirst, wasLast));
		return node;
	};

	/**
	 * @returns {LinkedListNode.<T>} The first node after it has been removed
	 */
	removeFirst() {
		return this.remove(this.first);
	};

	/**
	 * @returns {LinkedListNode.<T>} The last node after it has been removed.
	 */
	removeLast() {
		return this.remove(this.last);
	};
};



module.exports = Object.freeze({
	LinkedList,
	LinkedListNode,
	LinkedListEvent,
	symbolLinkedListAdd,
	symbolLinkedListRemove
});
