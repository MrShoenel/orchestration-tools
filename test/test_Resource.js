require('../docs');

const { assert, expect } = require('chai')
, { Resource, ResourceSelector, ResourceSelectionStrategy } = require('../lib/ResourceSelector')
, { timeout } = require('../lib/tools/Defer')


describe(ResourceSelector.name, () => {
	it('should throw if given invalid arguments', done => {
		const rs = new ResourceSelector();

		assert.throws(() => {
			rs.select();
		}, /No resources available/i);
		assert.throws(() => {
			rs.strategy = 42;
		}, /not known/);
		assert.throws(() => {
			rs.removeResource('asd');
		}, /unknown/i);

		assert.doesNotThrow(() => {
			rs.addResource(42);
		});
		assert.throws(() => {
			rs.addResource(42);
		}, /already been added/i);

		assert.doesNotThrow(() => {
			const res = rs.select();
			assert.strictEqual(res.numUsed, 0);
			assert.strictEqual(res.lastUsed, null);
			assert.isAbove(res.created, Date.now() - 1e4);

			assert.strictEqual(res.use(), 42);

			assert.strictEqual(res.numUsed, 1);
			assert.isAbove(res.lastUsed, Date.now() - 1e3);
			assert.isAbove(res.created, Date.now() - 1e4);
		});
		rs.strategy = ResourceSelectionStrategy.None;
		assert.throws(() => {
			rs.select();
		}, /No selection strategy/i);

		assert.doesNotThrow(() => {
			rs.removeResource(42);
		});

		done();
	});

	it('should return the resource according to the strategy', async() => {
		const rs = new ResourceSelector();

		rs.addResource(42).addResource(43).addResource(44);

		rs.strategy = ResourceSelectionStrategy.RoundRobin;
		const resRR = [rs.select(), rs.select(), rs.select(), rs.select()].map(r => r.use());
		assert.deepStrictEqual(resRR, [42, 43, 44, 42]);

		rs.strategy = ResourceSelectionStrategy.Random;
		const resRandom = [...Array(1000)].map(() => rs.select().use());
		assert.isAbove(resRandom.filter(v => v === 42).length, 250);
		assert.isAbove(resRandom.filter(v => v === 43).length, 250);
		assert.isAbove(resRandom.filter(v => v === 44).length, 250);

		rs.clear();
		assert.isTrue(rs.isEmpty);
		rs.addResource(42).addResource(43);
		rs.strategy = ResourceSelectionStrategy.LU;
		// Selects 42 first, uses it; then the next LU is 43; after that it's 42 again etc..
		const resLU = [...Array(4)].map(() => rs.select().use());
		assert.deepStrictEqual([42, 43, 42, 43], resLU);

		rs.clear();
		rs.strategy = ResourceSelectionStrategy.MU;
		rs.addResource(42).addResource(43);
		const resMU = [...Array(4)].map(() => rs.select().use());
		assert.deepStrictEqual([43, 43, 43, 43], resMU);

		rs.clear();
		rs.strategy = ResourceSelectionStrategy.LRU;
		rs.addResource(42).addResource(43);
		// Note that sorting starts backwards
		assert.strictEqual(rs.select().use(), 43);
		await timeout(1);
		assert.strictEqual(rs.select().use(), 42);
		await timeout(1);
		assert.strictEqual(rs.select().use(), 43);
		await timeout(1);
		rs.strategy = ResourceSelectionStrategy.MRU;
		assert.strictEqual(rs.select().use(), 43);

		rs.clear();
		rs.strategy = ResourceSelectionStrategy.LRA;
		rs.addResource(42);
		await timeout(1);
		rs.addResource(43);
		assert.strictEqual(rs.select().use(), 42);
		await timeout(1);
		rs.addResource(44);
		assert.strictEqual(rs.select().use(), 42);
		rs.strategy = ResourceSelectionStrategy.MRA;
		assert.strictEqual(rs.select().use(), 44);
	});
});
