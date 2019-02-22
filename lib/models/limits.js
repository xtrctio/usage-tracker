'use strict';

const AJV = require('ajv');

const ajv = new AJV({
  allErrors: true,
  jsonPointers: true,
});
require('ajv-errors')(ajv, { singleError: true });

const { stringifyAjvErrors } = require('@xtrctio/common').utils;

const CONSTANTS = {};

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    min5: {
      type: 'integer',
      minimum: 0,
    },
    hour: {
      type: 'integer',
      minimum: 0,
    },
    day: {
      type: 'integer',
      minimum: 0,
    },
    month: {
      type: 'integer',
      minimum: 0,
    },
  },
};

const validate = ajv.compile(schema);

CONSTANTS.SCHEMA = schema;

/**
 * @class
 * @property {number} min5
 * @property {number} hour
 * @property {number} day
 * @property {number} month
 */
class Limits {
  /**
   * @param {object} params
   * @returns {Limits}
   */
  constructor(params) {
    const valid = validate(params);

    if (!valid) {
      throw new Error(stringifyAjvErrors(validate.errors));
    }

    Object.assign(this, params);

    return this;
  }
}

Limits.CONSTANTS = CONSTANTS;
module.exports = Limits;
