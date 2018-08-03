const { assert, expect } = require('chai')
, { EqualityComparer, DefaultEqualityComparer } = require('../lib/collections/EqualityComparer')
, { Collection } = require('../lib/collections/Collection')
, { Queue, ConstrainedQueue } = require('../lib/collections/Queue')
, { Stack } = require('../lib/collections/Stack')
, { LinkedList, LinkedListNode } = require('../lib/collections/LinkedList')
, { Comparer, DefaultComparer } = require('../lib/collections/Comparer');


describe('EqualityComparer', function() {
  it('should be an abstract base-class', done => {
    assert.throws(() => {
      (new EqualityComparer().equals(1, 1));
    });

    done();
  });
  
  it('should provide a default comparer that supports identity-operations', done => {
    const d = EqualityComparer.default;

    assert.isTrue(d.equals(42, 42));
    assert.isFalse(d.equals(42, '42'));

    done();
  });
});




describe('Comparer', function() {
  it('should be an abstract base-class', done => {
    const c = new Comparer();

    assert.isTrue(c.equalityComparer instanceof EqualityComparer);

    assert.throws(() => {
      c.compare(42, 42);
    });

    assert.throws(() => {
      c.equalityComparer = new Date;
    });

    done();
  });

  it('should provide a default comparer that supports comparing', done => {
    const c = new DefaultComparer();

    assert.strictEqual(c.compare(1, 1), 0);
    assert.strictEqual(c.compare(1, 2), -1);
    assert.strictEqual(c.compare(2, 1), 1);

    done();
  });
});



describe('Collection', function() {
  it('should throw if given invalid arguments or behave correctly using defaults', done => {
    assert.throws(() => {
      new Collection(new Date);
    });

    assert.isTrue((new Collection()).equalityComparer instanceof DefaultEqualityComparer);

    done();
  });

  it('should return right values from all properties', done => {
    const c = new Collection();

    assert.strictEqual(c.size, 0);
    assert.isTrue(c.isEmpty);
    assert.isTrue(c._items.length === 0);

    // Let's interfere with the internals..
    c._items.push(42, 43);
    assert.strictEqual(c.size, 2);
    assert.isFalse(c.isEmpty);
    assert.isTrue(c._items.length === 2);

    assert.isTrue(c.has(42));
    assert.isTrue(c.has(43));

    class FalseEqComparer extends EqualityComparer {
      constructor() {
        super();
      };

      equals(x, y) {
        return false;
      };
    };

    assert.isFalse(c.has(42, new FalseEqComparer()));
    assert.isTrue(c.has(42, EqualityComparer.default));
    
    let idx = 0;
    for (const item of c.entries()) {
      if (idx === 0) {
        assert.strictEqual(item, 42);
      } else {
        assert.strictEqual(item, 43);
      }
      idx++;
    }
    assert.strictEqual(idx, 2);

    idx = 0;
    for (const item of c.entriesReversed()) {
      if (idx === 0) {
        assert.strictEqual(item, 43);
      } else {
        assert.strictEqual(item, 42);
      }
      idx++;
    }
    assert.strictEqual(idx, 2);
    
    c.clear();

    assert.strictEqual(c.size, 0);
    assert.isTrue(c.isEmpty);
    assert.isTrue(c._items.length === 0);


    done();
  });
});



describe('Queue', function() {
  it('should enqueue at the end and dequeue at the head', done => {
    const q = new Queue();

    assert.throws(() => {
      q.peek();
    });
    assert.throws(() => {
      q.peekLast();
    });

    q.enqueue(42).enqueue(43);

    assert.strictEqual(q.peek(), 42);
    assert.strictEqual(q.size, 2);

    assert.strictEqual(q.dequeue(), 42);
    assert.strictEqual(q.size, 1);
    assert.strictEqual(q.dequeue(), 43);
    assert.strictEqual(q.size, 0);
    assert.isTrue(q.isEmpty);

    assert.throws(() => {
      q.dequeue();
    });

    done();
  });

  it('should behave correctly with constrained queues', done => {
    assert.throws(() => {
      new ConstrainedQueue('42');
    });
    assert.throws(() => {
      new ConstrainedQueue(0);
    });

    const q1 = new ConstrainedQueue();
    assert.strictEqual(q1.maxSize, Number.MAX_SAFE_INTEGER);

    const q = new ConstrainedQueue(2);

    q.enqueue(42).enqueue(43);

    assert.strictEqual(q.peek(), 42);
    assert.strictEqual(q.peekLast(), 43);
    assert.strictEqual(q.size, 2);

    q.enqueue(44);

    assert.strictEqual(q.peek(), 43);
    assert.strictEqual(q.peekLast(), 44);
    assert.strictEqual(q.size, 2);
    assert.strictEqual(q.maxSize, 2);

    // Let's interfere with the internals again..
    q._items.push(45);
    assert.strictEqual(q.peek(), 43);
    assert.strictEqual(q.peekLast(), 45);
    assert.strictEqual(q.size, 3);
    assert.strictEqual(q.maxSize, 2);

    q._truncate();
    assert.strictEqual(q.peek(), 44);
    assert.strictEqual(q.peekLast(), 45);
    assert.strictEqual(q.size, 2);
    assert.strictEqual(q.maxSize, 2);

    done();
  });
});



describe('Stack', function() {
  it('should put items on top and remove them there as well', done => {
    const s = new Stack();

    assert.throws(() => {
      s.peek();
    });
    assert.throws(() => {
      s.peekBottom();
    });
    assert.throws(() => {
      s.pop();
    });
    
    s.push(41).push(42);

    assert.strictEqual(s.size, 2);
    assert.strictEqual(s.peek(), 42);
    assert.strictEqual(s.peekBottom(), 41);

    assert.strictEqual(s.pop(), 42);
    assert.strictEqual(s.size, 1);
    assert.strictEqual(s.peek(), 41);

    done();
  });
});



describe('LinkedList', function() {
  it('should throw if given invalid parameters', done => {
    const l = new LinkedList();

    assert.throws(() => {
      l._add(new Date, 42);
    });
    assert.throws(() => {
      l._add(new LinkedListNode(42, l));
    });
    assert.throws(() => {
      l.remove(new LinkedListNode(42, l));
    });

    done();
  });

  it('should support adding and removing at certain positions', done => {
    const l = new LinkedList();

    const n42 = l.addFirst(42);
    const n41 = n42.list.addBefore(l.first, 41);

    assert.strictEqual(l.first, n41);
    assert.strictEqual(l.last, n42);
    assert.strictEqual(l.last.prev, n41);
    assert.strictEqual(l.first.next, n42);
    assert.strictEqual(n41.prev, null);
    assert.strictEqual(n42.next, null);

    const n40 = l.addFirst(40);
    assert.strictEqual(l.first, n40);
    assert.strictEqual(l.size, 3);
    assert.strictEqual(n41.prev, n40);
    assert.strictEqual(n40.prev, null);
    assert.strictEqual(n40.next, n41);

    l.clear();

    assert.isTrue(l.isEmpty);
    assert.strictEqual(l.size, 0);
    assert.throws(() => {
      l.first;
    });
    assert.throws(() => {
      l.last;
    });


    const l1 = new LinkedList();
    const x42 = l1.addLast(42);
    const x43 = l1.addLast(43);

    assert.strictEqual(l1.size, 2);
    assert.strictEqual(l1.first, x42);
    assert.strictEqual(l1.last, x43);
    assert.strictEqual(x42.prev, null);
    assert.strictEqual(x42.next, x43);
    assert.strictEqual(x43.prev, x42);
    assert.strictEqual(x43.next, null);

    const x42_detached = l1.removeFirst();
    assert.strictEqual(x42_detached, x42);
    assert.strictEqual(l1.first, x43);
    assert.strictEqual(l1.last, x43);

    assert.strictEqual(x42.prev, null);
    assert.strictEqual(x42.next, null);
    assert.strictEqual(x43.next, null);
    assert.strictEqual(x43.prev, null);

    const x43_detached = l1.removeFirst();
    assert.isTrue(l1.isEmpty);
    assert.strictEqual(l1.size, 0);
    assert.strictEqual(x43_detached, x43);
    assert.strictEqual(x43.next, null);
    assert.strictEqual(x43.prev, null);

    done();
  });

  it('should have a properly initialized LinkedListNode class', done => {
    const l = new LinkedList();
    const n = new LinkedListNode(42, l);
    
    assert.strictEqual(n.list, l);
    assert.strictEqual(n.next, null);
    assert.strictEqual(n.prev, null);

    done();
  });

  it('should override the properties of Collection correctly', done => {
    const l = new LinkedList();

    assert.isTrue(l.equalityComparer instanceof EqualityComparer);

    assert.isTrue(l.isEmpty);
    assert.strictEqual(l.size, 0);
    assert.throws(() => {
      l.first;
    });
    assert.throws(() => {
      l.last;
    });

    done();
  });

  it('should override the methods of Collection correctly', done => {
    const l = new LinkedList();

    assert.throws(() => {
      l._requireNotEmpty();
    });

    const n42 = l.addFirst(42);

    assert.isTrue(l.hasNode(n42));

    assert.doesNotThrow(() => {
      l._requireNotEmpty();
    });

    assert.strictEqual(l.size, 1);
    assert.isFalse(l.isEmpty);

    const n43 = l.addAfter(n42, 43);

    assert.strictEqual(l.size, 2);
    assert.isFalse(l.isEmpty);

    let idx = 0;
    for (const n of l.nodes()) {
      if (idx === 0) {
        assert.strictEqual(n, n42);
      } else {
        assert.strictEqual(n, n43);
      }
      idx++;
    }

    idx = 0;
    for (const n of l.nodesReversed()) {
      if (idx === 0) {
        assert.strictEqual(n, n43);
      } else {
        assert.strictEqual(n, n42);
      }
      idx++;
    }

    idx = 0;
    for (const val of l.entries()) {
      if (idx === 0) {
        assert.strictEqual(val, 42);
      } else {
        assert.strictEqual(val, 43);
      }
      idx++;
    }

    idx = 0;
    for (const val of l.entriesReversed()) {
      if (idx === 0) {
        assert.strictEqual(val, 43);
      } else {
        assert.strictEqual(val, 42);
      }
      idx++;
    }


    assert.throws(() => {
      l._requireIsNode(42);
    });
    assert.doesNotThrow(() => {
      assert.isTrue(l._requireIsNode(n42));
    });


    // now let's check the nodes..
    assert.strictEqual(l.first, n42);
    assert.strictEqual(l.last, n43);
    assert.strictEqual(n42.prev, null);
    assert.strictEqual(n42.next, n43);
    assert.strictEqual(n43.prev, n42);
    assert.strictEqual(n43.next, null);


    assert.isTrue(l.hasNode(n43));
    assert.isTrue(l.has(43));

    const n43_detached = l.removeLast();

    assert.strictEqual(n42, l.first);
    assert.strictEqual(n42, l.last);
    assert.strictEqual(l.size, 1);
    assert.isFalse(l.hasNode(n43));
    assert.isFalse(l.has(43));

    assert.strictEqual(n43, n43_detached);
    assert.strictEqual(n43.next, null);
    assert.strictEqual(n43.prev, null);
    assert.strictEqual(n42.next, null);
    assert.strictEqual(n42.prev, null);


    const n42_detached = l.removeLast();

    assert.strictEqual(n42, n42_detached);
    assert.strictEqual(n42.next, null);
    assert.strictEqual(n42.prev, null);

    assert.isTrue(l.isEmpty);
    assert.strictEqual(l.size, 0);


    done();
  });

  it('should maintain the order of nodes correctly', done => {
    const l = new LinkedList();

    const n42 = l.addLast(42);
    const n43 = l.addAfter(l.first);
    const n44 = l.addLast(n43);

    assert.strictEqual(n42.prev, null);
    assert.strictEqual(n42.next, n43);
    assert.strictEqual(n43.prev, n42);
    assert.strictEqual(n43.next, n44);
    assert.strictEqual(n44.prev, n43);
    assert.strictEqual(n44.next, null);

    const n43_detached = l.remove(n43);
    assert.strictEqual(n43_detached, n43);
    assert.strictEqual(n42.next, n44);
    assert.strictEqual(n44.prev, n42);
    assert.strictEqual(n43.next, null);
    assert.strictEqual(n43.prev, null);

    done();
  });
});
