/**
 * Deep-clones an Object using JSON.parse() and JSON.stringify(). This means
 * that complex properties, such as functions, will not be copied. Use this
 * function therefore to copy objects that contain literal values or arrays
 * and nested objects of them.
 * 
 * @param {Object} obj The Object to deep-clone
 */
const deepCloneObject = obj => JSON.parse(JSON.stringify(obj));


/**
 * Merges two or more objects and returns a new object. Recursively merges
 * nested objects. Iterates the objects in the order they were given. If a
 * key is present in the next object as well, it will overwrite the value
 * of the previous object. Atomic properties and arrays are replaced in
 * the resulting object. Passing two objects with the first being an empty
 * new object, you may use this function to clone objects as well. Object-
 * properties that are actually Class-instances will be copied (i.e. it
 * will point to the same instance in the merged object).
 * 
 * @param {...Object} objects Two or more Objects to merge.
 * @returns {Object} the result of the merge
 */
const mergeObjects = (...objects) => {
  if (objects.length === 0) {
    throw new Error('No objects were given.');
  } else if (objects.length === 1) {
    return objects[0];
  }

  const target = {};
  
  objects.reduce((prev, next) => {
    for (const key of Object.keys(next)) {
      const nextType = Object.prototype.toString.call(next[key]);

      switch (nextType) {
        case '[object Null]':
        case '[object Array]': // Maybe later implement something here and for the next cases
        case '[object Number]':
        case '[object String]':
        case '[object Boolean]':
        case '[object Function]':
        case '[object AsyncFunction]':
        case '[object Undefined]':
        case '[object RegExp]':
          prev[key] = next[key];
          break;

        case '[object Object]':
          // Check if the current value is a class instance (ctor different from Object):
          try {
            const proto = Object.getPrototypeOf(next[key]);
            if (proto.constructor !== Object) {
              prev[key] = next[key];
              break;
            }
          } catch (e) { } // just move on

          if (Object.prototype.toString.call(prev[key]) !== '[object Object]') {
            prev[key] = {};
          }
          prev[key] = mergeObjects(prev[key], next[key]);
          break;

        default:
          continue;
      }
    }
    return prev;
  }, target);

  return target;
};


module.exports = Object.freeze({
  deepCloneObject,
  mergeObjects
});