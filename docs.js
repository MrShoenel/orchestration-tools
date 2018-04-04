/**
 * @template T
 * @typedef Deferred
 * @property {Promise.<T>} promise the underyling Promise
 * @property {(any) => any} resolve the resolve function
 * @property {(any) => any} reject the reject function
 */