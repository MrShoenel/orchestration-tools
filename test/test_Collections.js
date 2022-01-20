const { assert } = require('chai')
, { EqualityComparer, DefaultEqualityComparer } = require('../lib/collections/EqualityComparer')
, { Collection } = require('../lib/collections/Collection')
, { Queue, ConstrainedQueue, ProducerConsumerQueue,
		ConstrainedQueueCapacityPolicy, ProducerConsumerQueueCapacityPolicy
	} = require('../lib/collections/Queue')
, { Stack, ConstrainedStack } = require('../lib/collections/Stack')
, { LinkedList, LinkedListNode, LinkedListEvent } = require('../lib/collections/LinkedList')
, { Dictionary, DictionaryMapBased } = require('../lib/collections/Dictionary')
, { Cache, CacheMapBased, CacheWithLoad, EvictionPolicy } = require('../lib/collections/Cache')
, { Comparer, DefaultComparer } = require('../lib/collections/Comparer')
, JSBI = require('jsbi')
, { timeout } = require('../lib/tools/Defer')
, { assertThrowsAsync } = require('../lib/tools/AssertAsync');


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
		
		let numEnq = 0, numDeq = 0;
		q.observableEnqueue.subscribe(evt => {
			numEnq++;
		});
		q.observableDequeue.subscribe(evt => {
			numDeq++;
		});

		assert.throws(() => {
			q.peek();
		});
		assert.throws(() => {
			q.peekLast();
		});
		assert.throws(() => {
			q.peekIndex(-1);
		});
		assert.throws(() => {
			q.peekIndex(0);
		});
		assert.throws(() => {
			q.peekIndex(1);
		});
		
		assert.equal(numEnq, 0);
		assert.equal(numDeq, 0);

		q.enqueue(42).enqueue(43);
		assert.equal(numEnq, 2);

		assert.strictEqual(q.peek(), 42);
		assert.strictEqual(q.size, 2);

		assert.strictEqual(q.dequeue(), 42);
		assert.equal(numDeq, 1);
		assert.strictEqual(q.size, 1);
		assert.strictEqual(q.dequeue(), 43);
		assert.equal(numDeq, 2);
		assert.strictEqual(q.size, 0);
		assert.isTrue(q.isEmpty);

		assert.throws(() => {
			q.dequeue();
		});

		done();
	});
	
	it('should work correctly with indexes as well', done => {
		const q = new Queue();

		q.enqueue(42).enqueue(43).enqueue(44);

		assert.equal(q.peekIndex(0), 42);
		assert.equal(q.peekIndex(1), 43);
		assert.equal(q.peekIndex(2), 44);

		assert.equal(q.size, 3);
		
		assert.throws(() => {
			q.takeOutItem(43, new NoEq());
		});
		assert.equal(q.takeOutItem(43), 43);
		assert.equal(q.size, 2);
		assert.equal(q.peekIndex(0), 42);
		assert.equal(q.peekIndex(1), 44);

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

		assert.throws(() => {
			q1.capacityPolicy = 1337;
		}, `The policy '1337' is not supported.`);

		/** @type {ConstrainedQueue.<Number>} */
		const q = new ConstrainedQueue(2);

		q.enqueue(42).enqueue(43);

		assert.strictEqual(q.peek(), 42);
		assert.strictEqual(q.peekLast(), 43);
		assert.strictEqual(q.size, 2);
	
		const observed = [];
		q.observableDequeue.subscribe(next => {
			observed.push(next.item);
		});
		q.enqueue(44);
		assert.strictEqual(observed.length, 1);
		assert.strictEqual(observed[0], 42);

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

	it('should deal with different policies when full', done => {
		const q = new ConstrainedQueue(2);
		q.enqueue(42).enqueue(43);

		assert.isTrue(q.isFull);

		q.capacityPolicy = ConstrainedQueueCapacityPolicy.Dequeue;
		assert.doesNotThrow(() => {
			q.enqueue(44);
		});
		assert.deepStrictEqual(q._items, [43, 44]);
		assert.strictEqual(q.size, 2);

		q.capacityPolicy = ConstrainedQueueCapacityPolicy.IgnoreEnqueue;
		q.enqueue(50);
		assert.deepStrictEqual(q._items, [43, 44]);
		assert.strictEqual(q.size, 2);

		q.capacityPolicy = ConstrainedQueueCapacityPolicy.RejectEnqueue;
		assert.throws(() => {
			q.enqueue(1337);
		}, 'Cannot enqueue more items, Queue is full.');

		done();
	});
});



describe(ProducerConsumerQueue.name, function() {
	it('should defer enqueueing new items if no space available', async() => {
		/** @type {ProducerConsumerQueue.<Number>} */
		const q = new ProducerConsumerQueue(2);

		assert.doesNotThrow(() => {
			q.capacityPolicy = ConstrainedQueueCapacityPolicy.Dequeue;
			q.capacityPolicy = ConstrainedQueueCapacityPolicy.IgnoreEnqueue;
			q.capacityPolicy = ConstrainedQueueCapacityPolicy.RejectEnqueue;
			q.capacityPolicy = ProducerConsumerQueueCapacityPolicy.DeferEnqueue;
		});

		await q.enqueue(42);
		await q.enqueue(43);

		const p = q.enqueue(44);

		assert.deepStrictEqual(q._items, [42, 43]);
		assert.strictEqual(q._deferredEnqueues.size, 1);

		assert.strictEqual(await q.dequeue(), 42);
		
		await timeout(5);
		// now the enqueue should have gone through
		assert.strictEqual(await p, q);
		assert.deepStrictEqual(q._items, [43, 44]);
		assert.strictEqual(q._deferredEnqueues.size, 0);
	});

	it('should defer dequeueing if no items are available', async() => {
		/** @type {ProducerConsumerQueue.<Number>} */
		const q = new ProducerConsumerQueue();

		/** @type {String[]} */
		const vals = [];

		assert.strictEqual(q.numDeferredEnqueues, 0);

		const req1 = q.dequeue().then(v => vals.push(v))
		, req2 = q.dequeue().then(v => vals.push(v))
		, req3 = q.dequeue().then(v => vals.push(v));

		assert.strictEqual(q.numDeferredDequeues, 3);

		assert.throws(() => {
			q.maxDeferredEnqueuesCapacityPolicy = 1337;
		}, `The policy '1337' is not supported.`);

		await timeout(10);
		// Still no request is fulfilled
		assert.isTrue(vals.length === 0);

		await q.enqueue('42');
		await req1;
		assert.deepStrictEqual(vals, ['42']);

		const p = q.enqueue('43');
		// hasn't yet been dequeued..
		assert.strictEqual(q.size, 1);
		await p;
		await req2;

		await q.enqueue('44');
		await req3;
		
		assert.deepStrictEqual(vals, ['42', '43', '44']);
	});

	it('should handle enqueueing after full according to policy', async() => {
		/** @type {ProducerConsumerQueue.<Number>} */
		const q = new ProducerConsumerQueue(1, EqualityComparer.default, ProducerConsumerQueueCapacityPolicy.Defer, 1);

		await q.enqueue(42); // Now it's full.
		const p = q.enqueue(43); // Now it's full and one enqueue (maximum) is waiting.
		await timeout(5);

		q.maxDeferredEnqueuesCapacityPolicy = ConstrainedQueueCapacityPolicy.RejectEnqueue;

		await assertThrowsAsync(async() => {
			await q.enqueue(44);
		});

		q.maxDeferredEnqueuesCapacityPolicy = ConstrainedQueueCapacityPolicy.IgnoreEnqueue;

		await q.enqueue(45); // does not throw and is ignored by the queue
		assert.strictEqual(q._deferredEnqueues._items[0].item, 43);
		assert.strictEqual(q._deferredEnqueues.size, 1);

		q.maxDeferredEnqueuesCapacityPolicy = ConstrainedQueueCapacityPolicy.Dequeue;

		let pWasRejected = false;
		p.catch(() => {
			pWasRejected = true;
		});
		const p1 = q.enqueue(46); // this will reject 'p' (43) and replace it with this call
		await timeout(5);
		
		assert.isTrue(pWasRejected);
		assert.strictEqual(q._deferredEnqueues._items[0].item, 46);
		assert.strictEqual(q._deferredEnqueues.size, 1);


		const q1 = new ProducerConsumerQueue(1);
		await q1.enqueue(42); // Now it's full..

		q1.capacityPolicy = ConstrainedQueueCapacityPolicy.IgnoreEnqueue;
		await q1.enqueue(43); // ignored
		assert.deepStrictEqual(q1._items, [42]);

		q1.capacityPolicy = ConstrainedQueueCapacityPolicy.RejectEnqueue;
		await assertThrowsAsync(async() => {
			q1.enqueue(44);
		});
		assert.deepStrictEqual(q1._items, [42]);

		q1.capacityPolicy = ConstrainedQueueCapacityPolicy.Dequeue;
		await q1.enqueue(45);
		assert.deepStrictEqual(q1._items, [45]);
	});

	it('should reject pending enqueues if the maximum backlog size is reduced', async() => {
		const q = new ProducerConsumerQueue(1, EqualityComparer.default, ProducerConsumerQueueCapacityPolicy.DeferEnqueue, 2, ConstrainedQueueCapacityPolicy.RejectEnqueue);

		await q.enqueue(42);
		let p1Rej = false, p2Rej = false, p3Rej
		const p1 = q.enqueue(43).catch(() => p1Rej = true)
		, p2 = q.enqueue(44).catch(() => p2Rej = true)
		, p3 = q.enqueue(45).catch(() => p3Rej = true);
		
		await timeout(5);
		// p3 already failed:
		assert.isTrue(p3Rej);
		assert.isFalse(p1Rej || p2Rej);

		assert.strictEqual(q._deferredEnqueues.size, 2);
		assert.deepStrictEqual(q._deferredEnqueues._items.map(it => it.item), [43, 44]);

		// now let's increase the capacity:
		q.maxDeferredEnqueues = 3;
		const p4 = q.enqueue(45);
		await timeout(5);
		assert.strictEqual(q._deferredEnqueues.size, 3);
		assert.deepStrictEqual(q._deferredEnqueues._items.map(it => it.item), [43, 44, 45]);

		// now let's cut the capacity:
		q.maxDeferredEnqueues = 1;
		await timeout(5);
		assert.isTrue(p1Rej && p2Rej);
		assert.strictEqual(q._deferredEnqueues.size, 1);
		assert.deepStrictEqual(q._deferredEnqueues._items.map(it => it.item), [45]);
	});
});



describe(Stack.name, function() {
	it('should put items on top and remove them there as well', done => {
		const s = new Stack();
		
	let hasPopped = false, numPushed = 0;
	s.observablePop.subscribe(evt => {
		hasPopped = true;
	});
	s.observablePush.subscribe(evt => {
		numPushed++;
	});

		assert.throws(() => {
			s.peek();
		});
		assert.throws(() => {
			s.peekBottom();
		});
		assert.throws(() => {
			s.pop();
	});
	assert.throws(() => {
		s.popBottom();
	});

	assert.equal(numPushed, 0);

	s.push(41).push(42);
	assert.equal(numPushed, 2);
	assert.isFalse(hasPopped);

		assert.strictEqual(s.size, 2);
		assert.strictEqual(s.peek(), 42);
		assert.strictEqual(s.peekBottom(), 41);

		assert.strictEqual(s.pop(), 42);
		assert.isTrue(hasPopped);
		assert.strictEqual(s.size, 1);
		assert.strictEqual(s.peek(), 41);

		done();
	});

	it('should properly pop from the bottom', done => {
		const s = new Stack();

		s.push(1).push(2).push(3);
		assert.strictEqual(s.size, 3);
		assert.strictEqual(s.peekBottom(), 1);
		assert.strictEqual(s.peek(), 3);

		assert.strictEqual(s.popBottom(), 1);
		assert.strictEqual(s.size, 2);
		assert.strictEqual(s.peekBottom(), 2);
		assert.strictEqual(s.peek(), 3);

		done();
	});
});



describe(ConstrainedStack.name, function() {
	it('should pop from the bottom if full', done => {
		/** @type {ConstrainedStack.<Number>} */
		const cs = new ConstrainedStack(2);

		assert.throws(() => {
			cs.maxSize = 0;
		}, /less than/i);
		assert.throws(() => {
			cs.maxSize = 'foo';
		}, /not a number/i);

		const observed = [];
		cs.observablePopBottom.subscribe(next => {
			observed.push(next.item);
		});

		cs.push(42).push(43);
		assert.strictEqual(cs.size, 2);
		assert.strictEqual(observed.length, 0);

		cs.push(44);
		assert.strictEqual(cs.size, 2);
		assert.strictEqual(observed.length, 1);
		assert.strictEqual(cs.peekBottom(), 43);
		assert.strictEqual(cs.peek(), 44);

		done();
	});

	it('should truncate properly from the bottom', done => {
		const cs = new ConstrainedStack(3);

		cs.push(1).push(2).push(3).push(4).push(5);

		assert.strictEqual(cs.size, 3);
		assert.deepEqual(cs._items, [3,4,5]);

		assert.strictEqual(cs.popBottom(), 3);
		assert.strictEqual(cs.pop(), 5);
		assert.deepEqual(cs._items, [4]);

		cs.push(6).push(7);
		assert.strictEqual(cs.size, 3);
		assert.deepEqual(cs._items, [4,6,7]);

		cs.push(8);
		assert.strictEqual(cs.size, 3);
		assert.deepEqual(cs._items, [6,7,8]);

		done();
	});

	it('should allow using the large default max-size', done => {
		const cs = new ConstrainedStack();
		assert.strictEqual(cs.maxSize, Number.MAX_SAFE_INTEGER);
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

		assert.isTrue(l.isEmpty && l._lookupSet.size === 0);
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
	
	it('should emit the right events', done => {
		/** @type {LinkedList.<Number>} */
		const l = new LinkedList();

		/** @type {Array.<LinkedListEvent.<Number>>} */
		const added = [];
		/** @type {Array.<LinkedListEvent.<Number>>} */
		const removed = [];
		l.observableNodeAdd.subscribe(evt => {
			added.push(evt);
		});
		l.observableNodeRemove.subscribe(evt => {
			removed.push(evt);
		});

		let node = l.addFirst(42);
		assert.isTrue(added.length === 1);
		let e = added[0];
		assert.isTrue(e.item.item === 42 && e.added && !e.removed && e.firstNode && e.lastNode);

		node = l.addAfter(node, 43);
		assert.isTrue(added.length === 2);
		e = added[1];
		assert.isTrue(e.item.item === 43 && e.added && !e.removed && !e.firstNode && e.lastNode);

		l.addLast(44);
		assert.isTrue(added.length === 3);

		l.remove(node);
		assert.isTrue(removed.length === 1);
		e = removed[0];
		assert.isTrue(e.item.item === 43 && !e.added && e.removed && !e.firstNode && !e.lastNode);
		
		l.removeLast();
		assert.isTrue(removed.length === 2);
		e = removed[1];
		assert.isTrue(e.item.item === 44 && !e.added && e.removed && !e.firstNode && e.lastNode);
		l.removeFirst();
		assert.isTrue(removed.length === 3);
		e = removed[2];
		assert.isTrue(e.item.item === 42 && !e.added && e.removed && e.firstNode && e.lastNode);

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
		assert.isTrue(JSBI.toNumber(JSBI.subtract(c._dict['k0'].timeStamp, c._dict['k1'].timeStamp)) < 0);

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
		/** @type {CacheMapBased.<String, Number>} */
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

		const obsEvicted = [];
		c.observableEvict.subscribe(evt => {
			obsEvicted.push(...evt.item);
		});
		evict = c.evictMany(10);
		assert.isTrue(evict[0] === 42 && evict[1] === 43);
		assert.deepStrictEqual(evict, obsEvicted);

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
		assert.isTrue(JSBI.toNumber(JSBI.subtract(c._map.get('k0').timeStamp, c._map.get('k1').timeStamp)) < 0);

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
	
	it('should not increase the size if a key is overwritten', done => {
		const d = new DictionaryMapBased();

		let s = [], g = [], del = [], cleared = false;
		d.observableClear.subscribe(evt => {
			cleared = true;
		});
		d.observableSet.subscribe(evt => {
			assert.isTrue(Array.isArray(evt.item) && evt.item.length === 2);
			s.push(evt.item);
		});
		d.observableGet.subscribe(evt => {
			assert.isTrue(Array.isArray(evt.item) && evt.item.length === 2);
			g.push(evt.item);
		});
		d.observableDelete.subscribe(evt => {
			assert.isTrue(Array.isArray(evt.item) && evt.item.length === 2);
			del.push(evt.item);
		});

		d.set('k', 42);
		assert.isTrue(d.size === 1);
		d.set('k', 43);
		assert.isTrue(d.size === 1);
		assert.deepStrictEqual(s, [['k', 42], ['k', 43]]);
		assert.isTrue(g.length === 0);
		assert.isTrue(d.get('k') === 43);
		assert.deepStrictEqual(g, [['k', 43]]);
		assert.isFalse(cleared);
		d.clear();
		assert.isTrue(cleared);
		assert.isTrue(d.size === 0 && d.isEmpty);

		d.set('h', 77);
		assert.isTrue(del.length === 0);
		d.delete('h');
		assert.deepStrictEqual(del, [['h', 77]]);

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

		let clearObserved = false;
		d.observableClear.subscribe(evt => {
			clearObserved = true;
		})
		d.clear();
		assert.isTrue(clearObserved);
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

	it('should be invertible', done => {
		/** @type {DictionaryMapBased.<String, Number>} */
		const d = new DictionaryMapBased();

		d.set('A', 42).set('B', 42).set('C', 43);

		let inv = d.invert();

		assert.strictEqual(inv.size, 2);
		assert.deepEqual(inv.get(42), ['A', 'B']);
		assert.deepEqual(inv.get(43), ['C']);

		inv = d.invert(EqualityComparer.default);

		assert.strictEqual(inv.size, 2);
		assert.deepEqual(inv.get(42), ['A', 'B']);
		assert.deepEqual(inv.get(43), ['C']);

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