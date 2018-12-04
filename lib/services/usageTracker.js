'use strict';

const crypto = require('crypto');
const _ = require('lodash');
const XError = require('@xtrctio/xerror');
const Firestore = require('@google-cloud/firestore');
const { DateTime } = require('luxon');

const { Limits } = require('../models');

const log = require('../../logger');

const validateServices = (services) => {
  if (!_.isObject(services)) {
    throw new Error('services must be an object');
  }

  if (!_.isObject(services.db)) {
    throw new Error('services.db must be an object');
  }

  if (!_.isObject(services.redis)) {
    throw new Error('services.redis must be an object');
  }
};

const CONSTANTS = {
  KEYS: {
    USAGE_PREFIX: 'project-api-usage',
    DELIMITER: '---',
  },
  TIME_BUCKETS: {
    MIN5: 'min5',
    HOUR: 'hour',
    DAY: 'day',
    MONTH: 'month',
  },
  BUCKET_RESOLUTION_MIN: 5,
};

CONSTANTS.TIME_BUCKET_VALUES = Object.values(CONSTANTS.TIME_BUCKETS);

/**
 * @class
 */
class UsageTracker {
  /**
   * @param {object} services
   * @param {object} services.db
   * @param {object} services.redis
   */
  constructor(services) {
    validateServices(services);

    this.services = services;
  }

  /**
   * Consistently rounds down to the nearest 5 minute increment and returns the new DateTime
   * @param {string} timeBucket
   * @param {DateTime} utcTime
   * @returns {DateTime}
   */
  static getBucketTime(timeBucket, utcTime = DateTime.utc()) {
    switch (timeBucket) {
      case CONSTANTS.TIME_BUCKETS.MIN5: {
        utcTime = utcTime.startOf('minute');
        const minAdjustment = utcTime.minute % CONSTANTS.BUCKET_RESOLUTION_MIN;
        return utcTime.set({ minute: utcTime.minute - minAdjustment });
      }
      case CONSTANTS.TIME_BUCKETS.HOUR:
      case CONSTANTS.TIME_BUCKETS.DAY:
      case CONSTANTS.TIME_BUCKETS.MONTH: {
        return utcTime.startOf(timeBucket);
      }
      default:
        throw new XError(`timeBucket must be one of: ${Object.values(CONSTANTS.TIME_BUCKETS).join(', ')}`);
    }
  }

  /**
   * Gets bucket name for hash field based on project and time
   * @param {string} apiCategory
   * @param {string} timeBucket
   * @param {DateTime} utcTime
   * @returns {string}
   */
  static getBucketName(apiCategory, timeBucket, utcTime = DateTime.utc()) {
    if (!_.isString(apiCategory)) {
      throw new XError('apiCategory must be a string');
    }

    if (!(utcTime instanceof DateTime) || utcTime.offset !== 0) {
      throw new XError('utcTime must be instance of DateTime set to utc');
    }

    return `${apiCategory}${CONSTANTS.KEYS.DELIMITER}${timeBucket}${CONSTANTS.KEYS.DELIMITER}${UsageTracker.getBucketTime(timeBucket, utcTime)
      .toISO()}`;
  }

  /**
   * Get key for project
   * @param {string} projectId
   * @returns {string}
   */
  static getUsageKey(projectId) {
    return `${CONSTANTS.KEYS.USAGE_PREFIX}${CONSTANTS.KEYS.DELIMITER}${projectId}`;
  }

  /**
   * Record traffic by a project to an API category and limit to max
   * @param {string} projectId
   * @param {string} apiCategory
   * @param {Limits|object} limits
   * @param {DateTime} utcTime
   * @returns {Promise<null|object>} null if not limited, object of limits hit otherwise
   */
  async trackAndLimit(projectId, apiCategory, limits, utcTime = DateTime.utc()) {
    if (!_.isString(projectId)) {
      throw new XError('projectId must be a string');
    }

    if (!_.isString(apiCategory)) {
      throw new XError('apiCategory must be a string');
    }

    if (!(limits instanceof Limits)) {
      limits = new Limits(limits);
    }

    let transaction = this.services.redis.multi();

    CONSTANTS.TIME_BUCKET_VALUES.forEach((timeBucket) => {
      transaction = transaction
        .hincby(UsageTracker.getUsageKey(apiCategory), UsageTracker.getBucketName(apiCategory, timeBucket, utcTime), 1);
    });

    const usage = UsageTracker._processMultiResults(await transaction.exec()).reduce((_usage, countValue, i) => {
      _usage[CONSTANTS.TIME_BUCKET_VALUES[i]] = countValue;
      return _usage;
    }, {});

    const limitResult = _.reduce(limits, (result, limitValue, limitKey) => {
      if (usage[limitKey] >= limitValue) {
        result.limited = true;
        result.limitsHit.push(limitKey);
      }

      return result;
    }, { limited: false, limitsHit: [] });

    if (!limitResult.limited) {
      return null;
    }

    let resetTransaction = this.services.redis.multi();

    limitResult.limitsHit.forEach((timeBucket) => {
      resetTransaction = resetTransaction
        .hincby(UsageTracker.getUsageKey(apiCategory), UsageTracker.getBucketName(apiCategory, timeBucket, utcTime), -1);
    });

    // Just to check for errors
    UsageTracker._processMultiResults(await transaction.exec());

    return _.pick(limits, limitResult.limitsHit);
  }

  async export() {}

  async import() {}

  async clean() {}


  /**
   * Process arrayed results from redis multi
   * @param {any[][]} results
   * @returns {*}
   * @private
   */
  static _processMultiResults(results) {
    const ERR_INDEX = 0;
    const RESULT_INDEX = 1;

    if (!_.isArray(results) || !_.every(results, _.isArray)) {
      throw new Error('results must be an array of arrays');
    }

    return results.map((result) => {
      if (result[ERR_INDEX]) {
        throw new Error(`error during multi: ${result[ERR_INDEX]}`);
      }

      return result[RESULT_INDEX];
    });
  }
}

UsageTracker.CONSTANTS = CONSTANTS;
module.exports = UsageTracker;
