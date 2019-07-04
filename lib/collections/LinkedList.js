const { Collection } = require('./Collection')
, { EqualityComparer } = require('./EqualityComparer');


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
    
    /** @type {LinkedListNode.<T>} */
    this._firstNode = null;
    /** @type {LinkedListNode.<T>} */
    this._lastNode = null;

    this._size = 0;
  };

  /**
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
   * 
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
    
    this._size++;
    return newNode;
  }

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

    for (const value of this.nodes()) {
      if (node === value) {
        return true;
      }
    }
    return false;
  };
  
  /**
   * @inheritDoc
   * @returns {this}
   */
  clear() {
    this._firstNode = null;
    this._lastNode = null;
    this._size = 0;
    return this;
  };

  /**
   * @param {T} item
   * @returns {LinkedListNode.<T>} The node that has been created.
   */
  addFirst(item) {
    if (this.isEmpty) {
      this._size++;
      return this._firstNode = this._lastNode = new LinkedListNode(item, this);
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
      return this._lastNode = this._firstNode = new LinkedListNode(item, this);
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

    if (node.prev instanceof LinkedListNode) {
      node.prev.next = node.next instanceof LinkedListNode ? node.next : null;
      checkHeadTail(node.prev);
    }
    if (node.next instanceof LinkedListNode) {
      node.next.prev = node.prev instanceof LinkedListNode ? node.prev : null;
      checkHeadTail(node.next);
    }

    node.next = node.prev = null;

    this._size--;
    return node;
  }

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
  LinkedListNode
});
