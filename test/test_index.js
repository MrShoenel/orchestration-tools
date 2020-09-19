const { assert, expect } = require('chai');


describe('index.js imports/exports', function() {
	it('should import and export all types and functions', done => {
		require('../index');
		done();
	});
});
