const { assert, expect } = require('chai')
, { timeout, defer, deferMocha } = require('../tools/Defer')
, { assertThrowsAsync } = require('../tools/AssertAsync')
, { deepCloneObject, mergeObjects } = require('../tools/Objects');


describe('Tools', () => {
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
});