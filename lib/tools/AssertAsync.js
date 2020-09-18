const { assert } = require('chai');

/**
 * @param {() => Promise.<any>} promiseFn 
 */
const assertThrowsAsync = async promiseFn => {
	let threw = false;
	try {
		await promiseFn();
	} catch (e) {
		threw = true;
	} finally {
		assert.isTrue(threw);
	}
};

module.exports = Object.freeze({
	assertThrowsAsync
});