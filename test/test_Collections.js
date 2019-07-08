const { assert, expect } = require('chai')
, { EqualityComparer, DefaultEqualityComparer } = require('../lib/collections/EqualityComparer')
, { Collection } = require('../lib/collections/Collection')
, { Queue, ConstrainedQueue } = require('../lib/collections/Queue')
, { Stack } = require('../lib/collections/Stack')
, { LinkedList, LinkedListNode } = require('../lib/collections/LinkedList')
, { Dictionary, DictionaryMapBased } = require('../lib/collections/Dictionary')
, { Cache, CacheMapBased, CacheWithLoad, EvictionPolicy } = require('../lib/collections/Cache')
, { Comparer, DefaultComparer } = require('../lib/collections/Comparer')
, JSBI = require('jsbi')
, { timeout } = require('../tools/Defer');


class NoEq extends EqualityComparer {
	equals(x, y) {
		return false;
	};
};


describe(EqualityComparer.name, function() {
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




describe(Comparer.name, function() {
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



describe(Collection.name, function() {
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



describe(Queue.name, function() {
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



describe(Stack.name, function() {
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



describe(LinkedList.name, function() {
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
		assert.isFalse(l.has(43, new NoEq()));

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



describe(Dictionary.name, function() {
  it('should throw if given invalid parameters', done => {
		const d = new Dictionary();

		assert.throws(() => {
			d.get('42');
		});
		assert.throws(() => {
			d.remove('42');
		});
		assert.throws(() => {
			d.set(true, null);
		});
		assert.throws(() => {
			d.set('__proto__', 42);
		});
		assert.doesNotThrow(() => {
			assert.isTrue(d.size === 0);
			d.set('__proto--', 42);
			assert.isTrue(d.size === 1);
			d.remove('__proto--');
			assert.isTrue(d.size === 0);
		});


		assert.doesNotThrow(() => {
			d.set('true', null);
			const s = Symbol('true');
			d.set(s, null);

			assert.isTrue(d.hasKey('true'));
			assert.isTrue(d.hasKey(s));
			assert.isTrue(d.has(null));
			assert.isTrue(d.get(s) === null);
		});

    done();
	});
	
	it('should not increase the size if a key is overwritten', done => {
		const d = new Dictionary();

		d.set('k', 42);
		assert.isTrue(d.size === 1);
		d.set('k', 43);
		assert.isTrue(d.size === 1);
		assert.isTrue(d.get('k') === 43);
		d.clear();
		assert.isTrue(d.size === 0 && d.isEmpty);

		done();
	});

	it('should support generators for entries and reverse entries as well', done => {
		const d = new Dictionary();

		d.set('k0', 42);
		d.set('k1', 43);

		const c1 = Array.from(d.entries());
		assert.deepStrictEqual(c1, [{ k0: 42 }, { k1: 43 }]);
		const c2 = Array.from(d.entriesReversed());
		assert.deepStrictEqual(c2, [{ k1: 43 }, { k0: 42 }]);

		const s1 = Symbol('s1');
		d.set(s1, 'symb');
		const c3 = Array.from(d.keys());
		assert.deepStrictEqual(c3, ['k0', 'k1', s1]);

		assert.isTrue(d.hasKey(s1));
		assert.isTrue(d.hasKeyEq(s1));
		d.remove(s1);
		assert.isTrue(d.size === 2);
		assert.isFalse(d.hasKey(s1));
		assert.isFalse(d.hasKeyEq(s1));

		done();
	});

	it('should support has/has not/hasKey, even with custom EQ', done => {
		const d = new Dictionary();

		assert.isFalse(d.has('k0'));
		assert.isFalse(d.hasKey('k0'));
		assert.isFalse(d.hasKeyEq('k0'));
		d.set('k0', 42);
		assert.isTrue(d.has(42));
		assert.isFalse(d.has(42, new NoEq()));

		assert.isTrue(d.hasKeyEq('k0'));
		assert.isFalse(d.hasKeyEq('k0', new NoEq()));

		done();
	});
});



describe(Cache.name, function() {
	it('should throw if given invalid parameters', done => {
		assert.throws(() => {
			new Cache(42);
		});
		assert.throws(() => {
			new Cache(EvictionPolicy.None, 0.5);
		});
		assert.throws(() => {
			new Cache(EvictionPolicy.None, -1);
		});
		assert.doesNotThrow(() => {
			new Cache(EvictionPolicy.None, 0);
			new Cache(EvictionPolicy.None, 1);
			new Cache(EvictionPolicy.None, 12341345);
		});

		const c = new Cache(EvictionPolicy.None);
		assert.throws(() => {
			Array.from(c._evictNext());
		});
		assert.throws(() => {
			c.peekEvict(0);
		});
		assert.throws(() => {
			c.peekEvict(1.2);
		});
		assert.throws(() => {
			c.peekEvict(true);
		});

		done();
	});

	it('should evict items according to algo LFU/MFU', done => {
		const c = new Cache(EvictionPolicy.LFU, 2); // access counts
		
		c.set('k0', 42);
		c.set('k1', 43);

		// Now access k1 once
		c.get('k1');
		let evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');
		c.evictionPolicy = EvictionPolicy.MFU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		// .. and now k0 twice:
		c.get('k0');
		c.get('k0');
		assert.isTrue(c._dict['k1'].accessCount === 1 && c._dict['k0'].accessCount === 2);
		c.evictionPolicy = EvictionPolicy.LFU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');
		c.evictionPolicy = EvictionPolicy.MFU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');

		evict = c.evictMany(10);
		assert.isTrue(evict[0] === 42 && evict[1] === 43);

		assert.throws(() => {
			c.evict();
		});

		done();
	});

	// This may fail if BigInt is not available; rewriting it using
	// async and some waiting would however definitely work.
	it('should evict items according to algo LRU/MRU', done => {
		const c = new Cache(EvictionPolicy.LRU, 2); // timestamps

		c.set('k0', 42);
		c.set('k1', 43);

		// The last item inserted has a larger timestamp
		assert.isTrue(JSBI.subtract(c._dict['k0'].timeStamp, c._dict['k1'].timeStamp) < 0);

		// k1 is more recent right now, so k0 is evicted first in LRU
		let evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');
		// Now touch k0:
		c.get('k0');
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		// Now change policy:
		c.evictionPolicy = EvictionPolicy.MRU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');
		// .. touch k0:
		c.get('k1');
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		done();
	});

	it('should evict items according to algo FIFO/LIFO', done => {
		const c = new Cache(EvictionPolicy.FIFO, 2); // Queue, Stack

		c.set('k0', 42);
		c.set('k1', 43);

		// k0 went in first, so it's the first to be evicted
		let evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');

		// TEST: Switch to MRU
		c.evictionPolicy = EvictionPolicy.MRU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		// Switch to LIFO:
		c.evictionPolicy = EvictionPolicy.LIFO;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		done();
	});

	it('should allow self-expiration of k/v pairs using a timeout', async() => {
		const c = new Cache(EvictionPolicy.FIFO, 3);

		c.set('k0', 42);
		c.set('k1', 43, 25); // expire this one after 50 msecs
		c.set('k2', 43);

		let evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1' && evict[2].key === 'k2');

		await timeout(50);evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k2');
	});

	it('should properly evict in all situations', done => {
		const c = new Cache(EvictionPolicy.FIFO, 3);

		c.set('k0', 42); // With FIFO, this will be deleted first
		c.set('k1', 43);
		c.set('k2', 44);
		c.set('k3', 45);

		let evict = Array.from(c._evictNext()).map(w => w.item);
		assert.deepStrictEqual(evict, [43, 44, 45]);

		// Assert that no automatic eviction happens if forbidden:
		const k4 = Symbol('46');
		c.evictionPolicy = EvictionPolicy.None;
		assert.throws(() => {
			c.set(k4, 46);
		});
		c.evictionPolicy = EvictionPolicy.FIFO;
		assert.doesNotThrow(() => {
			c.set(k4, 46);
		});

		const peek = c.peekEvict(2); // With FIFO, this affects k2, k3
		assert.deepStrictEqual(peek, [{ 'k2': 44 }, { 'k3': 45 }]);

		// Now we change the capacity, so that automatic truncation happens:
		c.evictionPolicy = EvictionPolicy.MRU;
		c.capacity = Number.MAX_SAFE_INTEGER;
		assert.isTrue(c.size === 3);

		// Make sure it throws without proper policy:
		const polBefore = c.evictionPolicy;
		c.evictionPolicy = EvictionPolicy.None;
		assert.throws(() => {
			c.capacity = c.size - 1;
		});
		c.evictionPolicy = polBefore;

		// Now do the truncation
		c.capacity = 1; // truncation of k4 and k3 with MRU
		assert.isTrue(c.size === 1);
		assert.isTrue(c.get('k2') === 44);

		evict = Array.from(c._evictNext());
		// switch to undetermined:
		c.evictionPolicy = EvictionPolicy.Undetermined;
		assert.deepStrictEqual(evict, Array.from(c._evictNext()));

		c.capacity = 0;
		assert.isTrue(c.isEmpty);
		assert.isTrue(c.isFull); // Paradox, but no space is left, so it's true

		// We have to test random eviction, too, but we're only making sure
		// that all evicted elements were in fact inserted earlier.
		// We are checking that the elements are not returned in the
		// same order they were inserted (that might happen, but the
		// probability for that is very low with 10 elements (~1/10!))
		c.evictionPolicy = EvictionPolicy.Random;
		c.capacity = 10;
		c.set('k0', 42);
		c.set('k1', 43);
		c.set('k2', 44);
		c.set('k3', 45);
		c.set('k4', 46);
		c.set('k5', 47);
		c.set('k6', 48);
		c.set('k7', 49);
		c.set('k8', 50);
		c.set('k9', 51);

		evict = Array.from(c.evictMany(c.size));
		assert.isTrue(evict.length === 10);
		assert.equal(
			evict.reduce((a, b) => a + b, 0),
			42 + 43 + 44 + 45 + 46 + 47 + 48 + 49 + 50 + 51
		);

		assert.notDeepEqual(evict, [42, 43, 44, 45, 46, 47, 48, 49, 50, 51]);

		done();
	});

	it('should be possible to access all values and entries', done => {
		const c = new Cache();
		c.capacity = 3;

		c.set('k0', 42);
		c.set('k1', 43);
		c.set('k2', 44);

		assert.isTrue(c.has(43));
		assert.isFalse(c.has(45));
		assert.isTrue(c.has(44, EqualityComparer.default));

		assert.equal(
			Array.from(c.values()).reduce((a, b) => a + b, 0),
			42 + 43 + 44
		);

		const ent = Array.from(c.entries());
		const entR = Array.from(c.entriesReversed()).reverse();
		assert.deepEqual(ent, entR);

		done();
	});
});




describe(CacheMapBased.name, function() {
	it('should throw if given invalid parameters', done => {
		assert.throws(() => {
			new CacheMapBased(42);
		});
		assert.throws(() => {
			new CacheMapBased(EvictionPolicy.None, 0.5);
		});
		assert.throws(() => {
			new CacheMapBased(EvictionPolicy.None, -1);
		});
		assert.doesNotThrow(() => {
			new CacheMapBased(EvictionPolicy.None, 0);
			new CacheMapBased(EvictionPolicy.None, 1);
			new CacheMapBased(EvictionPolicy.None, 12341345);
		});

		const c = new CacheMapBased(EvictionPolicy.None);
		assert.throws(() => {
			Array.from(c._evictNext());
		});
		assert.throws(() => {
			c.peekEvict(0);
		});
		assert.throws(() => {
			c.peekEvict(1.2);
		});
		assert.throws(() => {
			c.peekEvict(true);
		});

		done();
	});

	it('should evict items according to algo LFU/MFU', done => {
		const c = new CacheMapBased(EvictionPolicy.LFU, 2); // access counts
		
		c.set('k0', 42);
		c.set('k1', 43);

		// Now access k1 once
		c.get('k1');
		let evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');
		c.evictionPolicy = EvictionPolicy.MFU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		// .. and now k0 twice:
		c.get('k0');
		c.get('k0');
		assert.isTrue(c._map.get('k1').accessCount === 1 && c._map.get('k0').accessCount === 2);
		c.evictionPolicy = EvictionPolicy.LFU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');
		c.evictionPolicy = EvictionPolicy.MFU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');

		evict = c.evictMany(10);
		assert.isTrue(evict[0] === 42 && evict[1] === 43);

		assert.throws(() => {
			c.evict();
		});

		done();
	});

	// This may fail if BigInt is not available; rewriting it using
	// async and some waiting would however definitely work.
	it('should evict items according to algo LRU/MRU', done => {
		const c = new CacheMapBased(EvictionPolicy.LRU, 2); // timestamps

		c.set('k0', 42);
		c.set('k1', 43);

		// The last item inserted has a larger timestamp
		assert.isTrue(JSBI.subtract(c._map.get('k0').timeStamp, c._map.get('k1').timeStamp) < 0);

		// k1 is more recent right now, so k0 is evicted first in LRU
		let evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');
		// Now touch k0:
		c.get('k0');
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		// Now change policy:
		c.evictionPolicy = EvictionPolicy.MRU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');
		// .. touch k0:
		c.get('k1');
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		done();
	});

	it('should evict items according to algo FIFO/LIFO', done => {
		const c = new CacheMapBased(EvictionPolicy.FIFO, 2); // Queue, Stack

		c.set('k0', 42);
		c.set('k1', 43);

		// k0 went in first, so it's the first to be evicted
		let evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1');

		// TEST: Switch to MRU
		c.evictionPolicy = EvictionPolicy.MRU;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		// Switch to LIFO:
		c.evictionPolicy = EvictionPolicy.LIFO;
		evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k1' && evict[1].key === 'k0');

		done();
	});

	it('should allow self-expiration of k/v pairs using a timeout', async() => {
		const c = new CacheMapBased(EvictionPolicy.FIFO, 3);

		c.set('k0', 42);
		c.set('k1', 43, 25); // expire this one after 50 msecs
		c.set('k2', 43);

		let evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k1' && evict[2].key === 'k2');

		await timeout(50);evict = Array.from(c._evictNext());
		assert.isTrue(evict[0].key === 'k0' && evict[1].key === 'k2');
	});

	it('should properly evict in all situations', done => {
		const c = new CacheMapBased(EvictionPolicy.FIFO, 3);

		c.set('k0', 42); // With FIFO, this will be deleted first
		c.set('k1', 43);
		c.set('k2', 44);
		c.set('k3', 45);

		let evict = Array.from(c._evictNext()).map(w => w.item);
		assert.deepStrictEqual(evict, [43, 44, 45]);

		// Assert that no automatic eviction happens if forbidden:
		const k4 = Symbol('46');
		c.evictionPolicy = EvictionPolicy.None;
		assert.throws(() => {
			c.set(k4, 46);
		});
		c.evictionPolicy = EvictionPolicy.FIFO;
		assert.doesNotThrow(() => {
			c.set(k4, 46);
		});

		const peek = c.peekEvict(2); // With FIFO, this affects k2, k3
		assert.deepStrictEqual(peek, [['k2', 44], ['k3', 45]]);

		// Now we change the capacity, so that automatic truncation happens:
		c.evictionPolicy = EvictionPolicy.MRU;
		c.capacity = Number.MAX_SAFE_INTEGER;
		assert.isTrue(c.size === 3);

		// Make sure it throws without proper policy:
		const polBefore = c.evictionPolicy;
		c.evictionPolicy = EvictionPolicy.None;
		assert.throws(() => {
			c.capacity = c.size - 1;
		});
		c.evictionPolicy = polBefore;

		// Now do the truncation
		c.capacity = 1; // truncation of k4 and k3 with MRU
		assert.isTrue(c.size === 1);
		assert.isTrue(c.get('k2') === 44);

		evict = Array.from(c._evictNext());
		// switch to undetermined:
		c.evictionPolicy = EvictionPolicy.Undetermined;
		assert.deepStrictEqual(evict, Array.from(c._evictNext()));

		c.capacity = 0;
		assert.isTrue(c.isEmpty);
		assert.isTrue(c.isFull); // Paradox, but no space is left, so it's true

		// We have to test random eviction, too, but we're only making sure
		// that all evicted elements were in fact inserted earlier.
		// We are checking that the elements are not returned in the
		// same order they were inserted (that might happen, but the
		// probability for that is very low with 10 elements (~1/10!))
		c.evictionPolicy = EvictionPolicy.Random;
		c.capacity = 10;
		c.set('k0', 42);
		c.set('k1', 43);
		c.set('k2', 44);
		c.set('k3', 45);
		c.set('k4', 46);
		c.set('k5', 47);
		c.set('k6', 48);
		c.set('k7', 49);
		c.set('k8', 50);
		c.set('k9', 51);

		evict = Array.from(c.evictMany(c.size));
		assert.isTrue(evict.length === 10);
		assert.equal(
			evict.reduce((a, b) => a + b, 0),
			42 + 43 + 44 + 45 + 46 + 47 + 48 + 49 + 50 + 51
		);

		assert.notDeepEqual(evict, [42, 43, 44, 45, 46, 47, 48, 49, 50, 51]);

		done();
	});

	it('should be possible to access all values and entries', done => {
		const c = new CacheMapBased();
		c.capacity = 3;

		c.set('k0', 42);
		c.set('k1', 43);
		c.set('k2', 44);

		assert.isTrue(c.hasValue(43));
		assert.isFalse(c.hasValue(45));
		assert.isTrue(c.hasValue(44, EqualityComparer.default));

		assert.equal(
			Array.from(c.values()).reduce((a, b) => a + b, 0),
			42 + 43 + 44
		);

		const ent = Array.from(c.entries());
		const entR = Array.from(c.entriesReversed()).reverse();
		assert.deepEqual(ent, entR);

		done();
	});
});



describe(DictionaryMapBased.name, function() {
	it('should throw if given invalid parameters', done => {
		const d = new DictionaryMapBased();
		assert.throws(() => {
			d.get('foo');
		});
		assert.doesNotThrow(() => {
			d.set('foo', 42);
			assert.isTrue(d.get('foo') === 42);
			d.has('foo');
			d.delete('foo');
		});
		assert.throws(() => {
			d.delete('bar');
		});
		assert.doesNotThrow(() => {
			d.set('bar');
			d.delete('bar');
		});
		assert.throws(() => {
			d.forEach(null);
		});
		assert.doesNotThrow(() => {
			d.forEach(() => {});
			d.forEach(function(){});
			d.forEach(async() => {});
			d.forEach(async function() {});
		});

		done();
	});

	it('should forward calls to the underlying map', done => {
		const d = new DictionaryMapBased();

		assert.isTrue(d.isEmpty && d.size === 0);
		d.set('k0', 0);
		assert.isTrue(!d.isEmpty && d.size === 1);
		d.set('k0', 1);
		assert.isTrue(!d.isEmpty && d.size === 1);
		d.set('k1', 42);
		assert.isTrue(!d.isEmpty && d.size === 2);

		assert.isTrue(d.has('k0') && d.has('k1'));
		assert.isFalse(d.has('k17'));

		assert.deepStrictEqual(Array.from(d.entries()), [
			['k0', 1],
			['k1', 42]
		]);
		assert.deepStrictEqual(Array.from(d.entriesReversed()), [
			['k1', 42],
			['k0', 1]
		]);
		assert.deepStrictEqual(Array.from(d.keys()), ['k0', 'k1']);
		assert.deepStrictEqual(Array.from(d.values()), [1, 42]);

		d.clear();
		assert.isTrue(d.isEmpty && d.size === 0);

		done();
	});

	it('should support custom equality comparers', done => {
		const d = new DictionaryMapBased();

		d.set('bar', 42);
		assert.isTrue(d.hasValue(42)); // uses ===
		assert.isFalse(d.hasValue('42'));
		assert.isFalse(d.hasValue(43));

		assert.isFalse(d.hasValue(42, new NoEq()));

		done();
	});

	it('should emulate and extend forEach() properly', done => {
		const d = new DictionaryMapBased();

		d.set('k0', 42);
		d.set('k1', 43);

		d.forEach((val, key, idx) => {
			if (idx === 0) {
				assert.isTrue(val === 42 && key === 'k0');
			} else if (idx === 1) {
				assert.isTrue(val === 43 && key === 'k1');
			}
			assert.isTrue(this !== 888); // does not work on arrow funcs
		}, 888);

		d.forEach(function() {
			assert.equal(this, 888);
		}, 888);

		d.forEach((v, k, idx, dict) => {
			assert.isTrue(dict === d);
		});

		done();
	});
});


describe(CacheWithLoad.name, function() {
	it('should throw if given invalid values', done => {
		const c = new CacheWithLoad();

		assert.throws(() => {
			new CacheWithLoad(EvictionPolicy.Random, 10, -1);
		});
		assert.throws(() => {
			new CacheWithLoad(EvictionPolicy.Random, 10, "foo");
		});
		assert.throws(() => {
			new CacheWithLoad(EvictionPolicy.Random, 10, Number.POSITIVE_INFINITY);
		});

		done();
	});

	it('should evict based on the load as well', done => {
		const c = new CacheWithLoad(EvictionPolicy.FIFO, 999, 5);

		c.set('k0', 42, 1.5);
		c.set('k1', 43, 2.5);

		c.set('k2', 44, 2); // will evict k0
		assert.closeTo(c.load, 4.5, 1e-9);

		c.set('k3', 45, 4.99); // will evict all others
		assert.closeTo(c.load, 4.99, 1e-9);
		assert.isTrue(c.size === 1);

		const polBefore = c.evictionPolicy;
		assert.throws(() => {
			c.evictionPolicy = EvictionPolicy.None;
			c.maxLoad = c.load - 1;
		});
		c.evictionPolicy = polBefore;

		let evict = c.evictMany(10); // up to 10, we have 1
		assert.isTrue(evict.length === 1 && evict[0] === 45);

		c.set('kx', 55, 4); // 5 is the limit currently
		c.maxLoad = 3.9;
		assert.isTrue(c.isEmpty && c.size === 0);
		assert.closeTo(c.maxLoad, 3.9, 1e-9);

		assert.throws(() => {
			c.set('kx', 55, 4);
		});

		c.capacity = 1;
		c.evictionPolicy = EvictionPolicy.None;
		c.set('ky0', 56, 2);
		assert.throws(() => {
			c.set('ky1', 57, 1);
		});

		c.evictionPolicy = EvictionPolicy.Undetermined;
		assert.doesNotThrow(() => {
			c.set('ky1', 57, 1);
		});
		
		done();
	});

	it('should report the current load adequately', async() => {
		const c = new CacheWithLoad(EvictionPolicy.None, 9999, 5);

		assert.isTrue(c.load === 0 && c.loadFree === 5 && c.maxLoad === 5);

		c.set('k0', 42, 1.5);
		c.set('k1', 43, 2.5, 25); // expire after 25msecs

		assert.throws(() => {
			c.set('k2', 44, 1.1); // too much load and no auto-evict
		});

		assert.closeTo(c.load, 4, 1e-9);
		assert.doesNotThrow(() => {
			c.set('k2', 44, 1);
		});

		assert.closeTo(c.load, 5, 1e-9);

		await timeout(50);

		assert.closeTo(c.load, 2.5, 1e-9);
	});
});