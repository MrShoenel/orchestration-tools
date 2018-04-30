const { randomBytes } = require('crypto');


/**
 * Uses crypto.randomBytes() to generate a 32 bit signed random number.
 * 
 * @return {Number} a 32-bit signed integer.
 */
const getRandomNumber = () => {
  const buf = randomBytes(4);
  let i = (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[0];
  return i;
};

module.exports = Object.freeze({
  getRandomNumber
});