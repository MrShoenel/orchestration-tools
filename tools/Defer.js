require('../docs');


/**
 * A function that creates an awaitable timout.
 * 
 * @param {number} ms Milliseconds to wait before resolving
 * @returns {Promise.<void>} a Promise that is resolved after
 * the amount of milliseconds given.
 */
const timeout = ms => new Promise((resolve, reject) => {
  setTimeout(resolve, ms);
});


/**
 * Creates a deferred Promise and returns an object with function
 * that can be used to resolve or reject the deferred.
 * 
 * @returns {Deferred}
 */
const defer = () => {
  let _resolve = null;
  let _reject = null;

  const promise = new Promise((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  return {
    promise,
    resolve: _resolve,
    reject: _reject
  };
};


/**
 * Mocha does not support this use case (async function with done):
 * https://github.com/mochajs/mocha/issues/2407#issuecomment-237408877
 * This function creates a deferred that can be resolved/rejected using
 * a generic done-callback.
 * 
 * @returns {Array.<Promise<any>, (error?: any) => any>} an array where
 * the first element is the promise that can be returned to mocha's test
 * runner and the second element is the done-function, which, when called
 * with no arguments, resolves the promise. Otherwise, it will reject the
 * promise.
 */
const deferMocha = () => {
  const deferred = defer();

  return [deferred.promise, error => {
    if (error === void 0) {
      deferred.resolve();
    } else {
      deferred.reject(error);
    }
  }];
};

module.exports = Object.freeze({
  timeout,
  defer,
  deferMocha
});
