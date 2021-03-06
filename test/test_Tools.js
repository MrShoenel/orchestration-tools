const { assert, expect } = require('chai')
, { assertThrowsAsync } = require('../lib/tools/AssertAsync')
, { timeout, deferMocha, DeferredClass } = require('../lib/tools/Defer')
, { deepCloneObject, mergeObjects } = require('../lib/tools/Objects')
, { throwError, wrapError } = require('../lib/tools/Error')
, { formatError, formatValue } = require('../lib/tools/Format')
, { getRandomNumber } = require('../lib/tools/Random');


describe('Tools', () => {
	it('should behave consistently if called with invalid parameters', done => {
		assert.throws(() => {
			mergeObjects();
		}, /No objects were given/i);

		const testObj = { foo: 1 };
		const result = mergeObjects(testObj);
		expect(result).to.deep.equal(testObj);
		assert.strictEqual(result, testObj);

		done();
	});

	it('should deep-clone objects with literal values accordingly', done => {
		const org = {
			a: 5.6, b: true, c: null, d: 'string', e: [
				{ x: 2 },
				{ x: 3 }
			]
		};

		expect(org).to.deep.equal({
			a: 5.6, b: true, c: null, d: 'string', e: [
				{ x: 2 },
				{ x: 3 }
			]
		});

		done();
	});

	it('should merge two or more shallow objects', done => {
		const result = mergeObjects({ a: 2 }, { b: 3 }, { a: 7, foo: true });

		expect(result).to.deep.equal({ a: 7, b: 3, foo: true});

		done();
	});

	it('should merge objects and prevent prototype pollution', done => {
		assert.isFalse('polluted' in global);
		assert.isFalse('polluted' in global.__proto__);

		// Even the explicit '__proto__'-property is ignored by Object.keys()!
		assert.deepStrictEqual(Object.keys({ __proto__: 41, foo: 40 }), ['foo']);
		const result = mergeObjects({ '__proto__': { polluted: 42 } }, { xx: 43 });

		expect(result).to.deep.equal({ xx: 43 });

		assert.isFalse('polluted' in global);
		assert.isFalse('polluted' in global.__proto__);

		done();
	});

	it('should handle the case of Objects without prototype', done => {
		const bla = Object.create(null);
		const result = mergeObjects({}, { bla });

		assert.strictEqual(result.bla, bla);
		
		done();
	});

	it('should also merge custom classes', done => {
		class Xx123 {
			get [Symbol.toStringTag]() {
				return this.constructor.name;
			};
		};

		const xx123 = new Xx123();
		const result = mergeObjects({}, { foo: true }, { xx123 });
		
		expect(result).to.deep.equal({ foo: true, xx123 });
		assert.strictEqual(result.xx123, xx123);

		class Invalid {
			get [Symbol.toStringTag]() {
				return '123'; // This would be an invalid class name and therefore be skipped
			}
		}

		const result2 = mergeObjects({}, { inv: new Invalid() });
		expect(result2).to.deep.equal({});

		done();
	});

	it('should deep-merge two or more objects, retaining all properties', done => {
		const o_a = {
			a: 5,
			b: {
				x: true,
				y: null
			}
		};
		const o_b = {
			c: [1, 2, 3],
			b: {
				myProp: 42
			}
		};
		const o_c = {
			d: 21,
			b: {
				myProp: 43
			}
		};

		const result = mergeObjects(o_a, o_b, o_c);

		expect(result).to.deep.equal({
			a: 5,
			b: {
				x: true,
				y: null,
				myProp: 43
			},
			c: [1, 2, 3],
			d: 21
		});

		done();
	});

	it('should copy references when objects are class-instances', done => {
		class X {
			constructor() { this.b = 1 };
		};

		const obj = {
			a: {
				b: 1
			},
			b: new X()
		};

		const result = mergeObjects({}, obj);

		assert.isTrue(result.b instanceof X);
		assert.isFalse(result.a instanceof X);

		assert.strictEqual(result.a.b, 1);
		assert.strictEqual(result.b.b, 1);

		assert.isTrue(obj.b === result.b);

		done();
	});

	it('should preserve all kinds of functions', done => {
		const obj = {
			a: () => {},
			b: function() {},
			c: function foo(){},
			d: async() => {},
			e: async function() {},
			f: async function bar(){}
		};

		const result = mergeObjects({}, obj);

		for (const prop in result) {
			assert.strictEqual(result[prop], obj[prop]);
		}

		done();
	});

	it('should merge types not explicitly defined by reference', done => {
		const obj = {
			d: new Date()
		};

		const result = mergeObjects({}, obj);

		assert.strictEqual(obj.d, result.d);
		expect(result).to.deep.equal(obj);

		done();
	});

	it('should create new Arrays instead of copying the reference', done => {
		const o1 = { arr: [42, 43, null, true] }
		, result = mergeObjects({}, o1);

		assert.isFalse(result.arr === o1.arr);
		assert.deepEqual(result.arr, o1.arr);

		done();
	});

	it('should deep-clone objects using JSON-stringify/parse', done => {
		const o1 = {
			a: {
				f: 1
			},
			b: null,
			c: [1,2]
		}, o2 = {
			x: 5,
			f: () => {}
		};

		const r1 = deepCloneObject(o1), r2 = deepCloneObject(o2);

		expect(r1).to.deep.equal(o1);
		assert.isTrue(o1 !== r1);

		expect(r2).to.deep.equal({ x: 5 });
		assert.isTrue(o2 !== r2);

		done();
	});

	it('should allow deferring promises for mocha', async() => {
		const mochaArr = deferMocha(), done = mochaArr[1];

		await timeout(10);
		timeout(10).then(_ => {
			done();
		});

		return mochaArr[0]; // return the promise
	});

	it('should allow creating rejectable promises for mocha', async() => {
		const mochaArr = deferMocha(), done = mochaArr[1];

		let e = null;
		mochaArr[0].catch(x => e = x);

		done('my Error');
		await timeout(10); // just in case..

		assert.strictEqual(e, 'my Error');
	});

	it('should be possible to check the state of a DeferredClass<T>', async() => {
		/** @type {DeferredClass<Number>} */
		const d = new DeferredClass();

		let wasRejected = false;
		d.promise.catch(() => wasRejected = true);

		assert.isFalse(d.isRejected);
		assert.isFalse(d.isResolved);

		d.reject('error');
		await timeout(5);
		assert.isTrue(wasRejected);
		assert.isTrue(d.isRejected);
		assert.isFalse(d.isResolved);

		await assertThrowsAsync(async() => {
			d.reject('bla');
		});
		await assertThrowsAsync(async() => {
			d.resolve(1337);
		});


		/** @type {DeferredClass<Number>} */
		const d1 = new DeferredClass();

		let wasResolved = false;
		d1.promise.then(() => wasResolved = true);

		assert.isFalse(d1.isRejected);
		assert.isFalse(d1.isResolved);

		d1.resolve(42);
		await timeout(5);
		assert.isTrue(wasResolved);
		assert.isTrue(d1.isResolved);
		assert.isFalse(d1.isRejected);

		await assertThrowsAsync(async() => {
			d1.resolve(43);
		});
		await assertThrowsAsync(async() => {
			d1.reject('err');
		});
	});

	it('should format any kind of value properly', done => {
		let r = formatValue();
		assert.strictEqual(r, '<undefined>');
		r = formatValue(null);
		assert.strictEqual(r, '<null>');
		r = formatValue('asd');
		assert.strictEqual(r, 'asd');

		let v = Object.create(null); // no prototype..
		v.asd = { foo: true };
		r = formatValue(v);
		// Newer version of nodejs' util.inspect will include
		// the [Object: null prototype] at the beginning
		assert.isTrue(r.endsWith('{ asd: { foo: true } }'));
		assert.isTrue(r.startsWith('{') || r.startsWith('[Object: null prototype] {'));

		r = formatValue({ foo: true });
		assert.strictEqual(r, "{ foo: true }");

		class A {
			toString() {
				return 'A=42';
			};
		};
		r = formatValue(new A);
		assert.strictEqual(r, 'A=42');

		r = formatValue([1, [2, true, new A()]]);
		assert.strictEqual(r, '[ 1, [ 2, true, A=42 ] ]');

		done();
	});

	it('should format any kind of error properly as well', done => {
		let r = formatError();
		assert.strictEqual(r, 'Error: <undefined>');

		let threw = false;
		try {
			throwError({ foo: true });
		} catch (e) {
			threw = true;
			assert.isTrue(e instanceof Error);
			/** @type {Error} */
			const err = e;
			assert.strictEqual(err.message, '{ foo: true }');
			
			r = formatError(e);
			assert.isTrue(r.startsWith('Error: { foo: true } Stack: '));
			e.stack = '';
			r = formatError(e);
			assert.strictEqual(r, 'Error: { foo: true }');
		} finally {
			assert.isTrue(threw);
		}

		const e = new Error('any');
		assert.strictEqual(wrapError(e), e);

		done();
	});

	it('should generate a few good random numbers', done => {
		const s = new Set()
		, testSize = 100;

		for (let i = 0; i < testSize; i++) {
			s.add(getRandomNumber());
		}
		
		assert.strictEqual(s.size, testSize);
		done();
	});
});