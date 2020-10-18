require('../docs');

const { assert, expect } = require('chai')
, { assertThrowsAsync } = require('../lib/tools/AssertAsync')
, { Resolve } = require('../lib/tools/Resolve');


class TestClass {};

const testObj = {
	a: 0,
	b: null,
	c: false,
	d: void 0,
	e: '',
	f: () => {},
	g: function() {},
	p: new Promise((res, rej) => res(() => 42)),
	t: async() => new TestClass(),
	v: () => Math.random() >= .5,
	u: () => 42
};


describe('Resolve', () => {
	it('should identify types correctly', done => {
		assert.isTrue(Resolve.isTypeOf(true, Boolean));
		assert.isTrue(Resolve.isTypeOf(0, Number));
		assert.isTrue(Resolve.isTypeOf(NaN, Number));
		assert.isTrue(Resolve.isTypeOf("a", String));
		assert.isTrue(Resolve.isTypeOf(["a"], []));
		assert.isTrue(Resolve.isTypeOf(new Boolean(false), Boolean));

		// Because those two DO NOT HAVE the same Prototype:
		assert.isFalse(Resolve.isTypeOf(Object.create(null), {}));
		// ... the same goes for the following case:
		assert.isFalse(Resolve.isTypeOf({}, Object.create(null)));

		done();
	});

	it('should resolve functions and promises without example', async() => {
		let result = await Resolve.toValue(async() => 42);
		assert.strictEqual(result, 42);

		result = await Resolve.optionalToValue(null, () => 43);
		assert.strictEqual(result, 43);

		result = await Resolve.asyncFuncOrPromise(async() => {
			return async() => {
				return new Promise((resolve, reject) => {
					resolve(44);
				});
			};
		});
		assert.strictEqual(result, 44);

		result = await Resolve.asyncFuncOrPromise(new Promise((res, _) => { res(45); }));
		assert.strictEqual(result, 45);

		await assertThrowsAsync(async() => {
			await Resolve.asyncFuncOrPromise(new Boolean());
		});

		result = await Resolve.asyncFuncOrPromise(() => 46);
		assert.strictEqual(result, 46);
	});

	it('should resolve functions and towards functions correctly', async() => {
		const boolVal = await Resolve.toValue(testObj.v, Boolean);
		assert.isTrue(boolVal === true || boolVal === false);

		const fVal = await Resolve.toValue(testObj.u, Function);
		assert.isTrue(Resolve.isFunction(fVal));
		assert.strictEqual(fVal(), 42);

		const _42 = await Resolve.toValue(testObj.u, Number);
		assert.strictEqual(_42, 42);
	});

	it('should resolve literal values correctly', async() => {
		assert.strictEqual(
			await Resolve.toValue(testObj.a, 42), 0);
		assert.strictEqual(
			await Resolve.toValue(testObj.b, null), null);
		assert.strictEqual(
			await Resolve.toValue(testObj.c, true), false);
		assert.strictEqual(
			await Resolve.toValue(testObj.d, void 0), void 0);
		assert.strictEqual(
			await Resolve.toValue(testObj.e, 'hello'), '');

		const arr = await Resolve.toValue(() => [1,2], Array);
		assert.isTrue(Object.prototype.toString.call(arr) === '[object Array]');
		assert.strictEqual(arr.length, 2);
	});

	it('should resolve functions correctly', async() => {
		assert.strictEqual(
			await Resolve.toValue(testObj.f /*, void 0*/), void 0);
		assert.strictEqual(
			await Resolve.toValue(testObj.g, void 0), void 0);
		assert.strictEqual(
			await Resolve.toValue(testObj.p, Number), 42);
		assert.isTrue(
			await Resolve.toValue(() => new Date, Date) instanceof Date);

		// Notice how we exec the result of the resolving this time:
		// .. and also how we resolve to a function instead of a 42:
		assert.strictEqual(
			(await Resolve.toValue(testObj.p, Function))(), 42);
	});

	it('should resolve promises/async function correctly', async() => {
		assert.isTrue(
			await Resolve.toValue(testObj.t, TestClass) instanceof TestClass);
		assert.isTrue(
			await Resolve.toValue(testObj.t, TestClass.name) instanceof TestClass);
	});

	it('should resolve optional values as well', async() => {
		assert.strictEqual(await Resolve.optionalToValue(42, void 0), 42);

		assert.strictEqual(await Resolve.optionalToValue(42, async() => 42, Number), 42);
	});

	it('should throw if cannot resolve to expected type', async() => {
		await assertThrowsAsync(async () => {
			await Resolve.toValue(() => 5, true);
		});
		await assertThrowsAsync(async () => {
			await Resolve.toValue(async() => '5', 5);
		});
	});

	it('should parse numbers in strings correctly', done => {
		assert.doesNotThrow(() => {
			assert.isTrue(isNaN(Resolve.asNumber(' NaN ')));

			assert.strictEqual(Resolve.asNumber('0'), 0);
			assert.strictEqual(Resolve.asNumber('123454'), 123454);
			assert.strictEqual(Resolve.asNumber('-123'), -123);
			assert.strictEqual(Resolve.asNumber('-9e9999999'), -Infinity);

			assert.strictEqual(Resolve.asNumber('9007199254740991'), Number.MAX_SAFE_INTEGER);
			assert.strictEqual(Resolve.asNumber('-9007199254740991'), Number.MIN_SAFE_INTEGER);

			assert.strictEqual(Resolve.asNumber('9007199254740992'), 9007199254740992n);
			assert.strictEqual(Resolve.asNumber('-9007199254740992'), -9007199254740992n);

			assert.strictEqual(Resolve.asNumber('-.1'), -.1);
			assert.strictEqual(Resolve.asNumber('123.234'), 123.234);
			assert.strictEqual(Resolve.asNumber('-123.234'), -123.234);

			assert.strictEqual(Resolve.asNumber('-.7e2'), -.7e2);
			assert.strictEqual(Resolve.asNumber('23e3'), 23e3);
			assert.strictEqual(Resolve.asNumber('23E3'), 23e3);
			assert.strictEqual(Resolve.asNumber('1e2000'), Infinity);
		});

		['0123', '-123.23.4', '1.e2', '2e2.2', 'bla', '-'].forEach(v => assert.throws(() => Resolve.asNumber(v)));


		assert.strictEqual(Resolve.tryAsNumber('bla'), 'bla');
		assert.strictEqual(Resolve.tryAsNumber(true), true);
		assert.strictEqual(Resolve.tryAsNumber(false), false);
		assert.strictEqual(Resolve.tryAsNumber(null), null);
		assert.deepStrictEqual(Resolve.tryAsNumber([1,2,3]), [1,2,3]);
		assert.deepStrictEqual(Resolve.tryAsNumber({a:true, b:42}), {a:true, b:42});
		
		assert.strictEqual(Resolve.tryAsNumber(42), 42);
		assert.strictEqual(Resolve.tryAsNumber('42'), 42);
		assert.strictEqual(Resolve.tryAsNumber('999999999999999999999999'), 999999999999999999999999n);
		assert.strictEqual(Resolve.tryAsNumber(.2e-2), .2e-2);
		assert.strictEqual(Resolve.tryAsNumber('2.2e7'), 2.2e7);

		done();
	});
});