const { assert, expect } = require('chai')
, { EqualityComparer, DefaultEqualityComparer } = require('../lib/collections/EqualityComparer')
, { Collection } = require('../lib/collections/Collection')
, { Queue, ConstrainedQueue } = require('../lib/collections/Queue')
, { Stack } = require('../lib/collections/Stack');


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
    
    let idx = 0;
    for (const item of c.entries()) {
      if (idx === 0) {
        idx++;
        assert.strictEqual(item, 42);
      } else {
        assert.strictEqual(item, 43);
      }
    }
    
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
      s.pop();
    });
    
    s.push(41).push(42);

    assert.strictEqual(s.size, 2);
    assert.strictEqual(s.peek(), 42);

    assert.strictEqual(s.pop(), 42);
    assert.strictEqual(s.size, 1);
    assert.strictEqual(s.peek(), 41);

    done();
  });
});
