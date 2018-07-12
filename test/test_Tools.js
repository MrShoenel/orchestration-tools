const { assert, expect } = require('chai')
, { timeout, defer, deferMocha } = require('../tools/Defer')
, { assertThrowsAsync } = require('../tools/AssertAsync')
, { deepCloneObject, mergeObjects } = require('../tools/Objects');


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
});