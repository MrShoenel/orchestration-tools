const { assert } = require('chai');

/**
 * @param {() => Promise.<any>} promiseFn 
 */
const assertThrowsAsync = async promiseFn => {
  let f = () => {};
  try {
    await promiseFn();
  } catch (e) {
    f = () => { throw e; };
  } finally {
    assert.throws(f)
  }
};

module.exports = Object.freeze({
  assertThrowsAsync
});