'use strict';

const crypto = require('crypto');
const _ = require('lodash');
const Promise = require('bluebird');
const XError = require('@xtrctio/xerror');
const Redis = require('@xtrctio/redis');
const stringify = require('json-stable-stringify');
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
    USAGE_PREFIX: 'usage',
    DELIMITER: '---',
    LAST_EXPORT_KEY: 'last-_export',
  },
  COLUMN_NAMES: {
    USAGE: 'usage',
  },
  TIME_BUCKETS: {
    MIN5: 'min5',
    HOUR: 'hour',
    DAY: 'day',
    MONTH: 'month',
  },
  MAX_RETURNED_USAGE_BUCKETS: 100,
  HASH_ENCODING: 'hex',
  HASH_TYPE: 'sha256',
  BUCKET_RESOLUTION_MIN: 5,
  MAX_CONCURRENCY: 10,
  MAX_IMPORT_BATCH: 500,
  MAX_IMPORT_DAYS: 40,
  DEFAULT_EXPORT_INTERVAL_MS: 5 * 60 * 1000,
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
    this.interval = null;
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
        throw new XError(`timeBucket must be one of: ${CONSTANTS.TIME_BUCKET_VALUES.join(', ')}`);
    }
  }

  /**
   * Gets bucket name for hash field based on project and time
   * @param {string} category
   * @param {string} timeBucket
   * @param {DateTime} utcTime
   * @returns {string}
   */
  static getBucketName(category, timeBucket, utcTime = DateTime.utc()) {
    if (!_.isString(category)) {
      throw new XError('category must be a string');
    }

    if (!(utcTime instanceof DateTime) || utcTime.offset !== 0 || !utcTime.isOffsetFixed) {
      throw new XError('utcTime must be instance of DateTime set to utc');
    }

    return `${timeBucket}${CONSTANTS.KEYS.DELIMITER}${category}${CONSTANTS.KEYS.DELIMITER}${UsageTracker.getBucketTime(timeBucket, utcTime)
      .toISO()}`;
  }

  /**
   * Converts bucketName back into it's parts
   * @param {string} bucketName
   * @returns {{timeBucket: string, category: string, utcTime: DateTime}}
   */
  static parseBucketName(bucketName) {
    if (!_.isString(bucketName)) {
      throw new XError('bucketName must be a string');
    }

    const parts = bucketName.split(CONSTANTS.KEYS.DELIMITER);

    if (parts.length !== 3) {
      throw new XError(`Unexpected bucketName while parsing: ${bucketName}`);
    }

    return {
      timeBucket: parts[0],
      category: parts[1],
      utcTime: DateTime.fromISO(parts[2]).toUTC(),
    };
  }

  /**
   * Get key for project
   * @param {string} projectId
   * @returns {string}
   */
  static getUsageKey(projectId) {
    if (!_.isString(projectId)) {
      throw new XError('projectId must be a string');
    }

    return `${CONSTANTS.KEYS.USAGE_PREFIX}${CONSTANTS.KEYS.DELIMITER}${projectId}`;
  }

  /**
   * Converts usageKey back into projectId
   * @param {string} usageKey
   * @returns {{projectId: string}}
   */
  static parseUsageKey(usageKey) {
    if (!_.isString(usageKey)) {
      throw new XError('usageKey must be a string');
    }

    const parts = usageKey.split(CONSTANTS.KEYS.DELIMITER);

    if (parts.length !== 2) {
      throw new XError(`Unexpected usageKey while parsing: ${usageKey}`);
    }

    return {
      projectId: parts[1],
    };
  }

  /**
   * Record traffic by a project to an API category and limit to max
   * @param {string} projectId
   * @param {string} category
   * @param {Limits|object} limits
   * @param {DateTime} utcTime
   * @returns {Promise<null|object>} null if not limited, object of limits hit otherwise
   */
  async trackAndLimit(projectId, category, limits, utcTime = DateTime.utc()) {
    if (!_.isString(projectId)) {
      throw new XError('projectId must be a string');
    }

    if (!_.isString(category)) {
      throw new XError('category must be a string');
    }

    if (!(limits instanceof Limits)) {
      limits = new Limits(limits);
    }

    if (!(utcTime instanceof DateTime) || utcTime.offset !== 0 || !utcTime.isOffsetFixed) {
      throw new XError('utcTime must be instance of DateTime set to utc');
    }

    let transaction = this.services.redis.multi();

    CONSTANTS.TIME_BUCKET_VALUES.forEach((timeBucket) => {
      transaction = transaction
        .hincrby(UsageTracker.getUsageKey(projectId), UsageTracker.getBucketName(category, timeBucket, utcTime), 1);
    });

    const usage = Redis.processMultiResults(await transaction.exec()).reduce((_usage, countValue, i) => {
      _usage[CONSTANTS.TIME_BUCKET_VALUES[i]] = countValue ? parseInt(countValue, 10) : 0;
      return _usage;
    }, {});

    const limitResult = _.reduce(limits, (result, limitValue, limitKey) => {
      if (usage[limitKey] > limitValue) {
        result.limited = true;
        result.limitsHit.push(limitKey);
      }

      return result;
    }, {
      limited: false,
      limitsHit: [],
    });

    if (!limitResult.limited) {
      return null;
    }

    let resetTransaction = this.services.redis.multi();

    CONSTANTS.TIME_BUCKET_VALUES.forEach((timeBucket) => {
      resetTransaction = resetTransaction
        .hincrby(UsageTracker.getUsageKey(projectId), UsageTracker.getBucketName(category, timeBucket, utcTime), -1);
    });

    // Just to check for errors
    Redis.processMultiResults(await resetTransaction.exec());

    return _.pick(limits, limitResult.limitsHit);
  }

  /**
   * Decrement all usage by one
   * @param {string} projectId
   * @param {string} category
   * @param {DateTime} utcTime
   * @returns {Promise<void>}
   */
  async undo(projectId, category, utcTime = DateTime.utc()) {
    let resetTransaction = this.services.redis.multi();

    CONSTANTS.TIME_BUCKET_VALUES.forEach((timeBucket) => {
      resetTransaction = resetTransaction
        .hincrby(UsageTracker.getUsageKey(projectId), UsageTracker.getBucketName(category, timeBucket, utcTime), -1);
    });

    // Just to check for errors
    Redis.processMultiResults(await resetTransaction.exec());
  }

  /**
   * Check if previous usage is within limits without changing usage
   * @param {string} projectId
   * @param {string} category
   * @param {Limits|object} limits
   * @param {DateTime} utcTime
   * @returns {Promise<null|object>} null if not limited, object of limits hit otherwise
   */
  async checkLimits(projectId, category, limits, utcTime = DateTime.utc()) {
    if (!_.isString(projectId)) {
      throw new XError('projectId must be a string');
    }

    if (!_.isString(category)) {
      throw new XError('category must be a string');
    }

    if (!(limits instanceof Limits)) {
      limits = new Limits(limits);
    }

    if (!(utcTime instanceof DateTime) || utcTime.offset !== 0 || !utcTime.isOffsetFixed) {
      throw new XError('utcTime must be instance of DateTime set to utc');
    }

    let transaction = this.services.redis.multi();

    CONSTANTS.TIME_BUCKET_VALUES.forEach((timeBucket) => {
      transaction = transaction.hget(UsageTracker.getUsageKey(projectId), UsageTracker.getBucketName(category, timeBucket, utcTime));
    });

    const usage = Redis.processMultiResults(await transaction.exec()).reduce((_usage, countValue, i) => {
      _usage[CONSTANTS.TIME_BUCKET_VALUES[i]] = countValue ? parseInt(countValue, 10) : 0;
      return _usage;
    }, {});

    const limitResult = _.reduce(limits, (result, limitValue, limitKey) => {
      if (usage[limitKey] >= limitValue) {
        result.limited = true;
        result.limitsHit.push(limitKey);
      }

      return result;
    }, {
      limited: false,
      limitsHit: [],
    });

    if (!limitResult.limited) {
      return null;
    }

    return _.pick(limits, limitResult.limitsHit);
  }

  /**
   * Get usage at specific time
   * @param {string} projectId
   * @param {string} category
   * @param {DateTime} utcTime
   * @returns {Promise<object>}
   */
  async getUsageAtTime(projectId, category, utcTime = DateTime.utc()) {
    if (!_.isString(projectId)) {
      throw new XError('projectId must be a string');
    }

    if (!_.isString(category)) {
      throw new XError('category must be a string');
    }

    if (!(utcTime instanceof DateTime) || utcTime.offset !== 0 || !utcTime.isOffsetFixed) {
      throw new XError('utcTime must be instance of DateTime set to utc');
    }

    let transaction = this.services.redis.multi();

    CONSTANTS.TIME_BUCKET_VALUES.forEach((timeBucket) => {
      transaction = transaction
        .hget(UsageTracker.getUsageKey(projectId), UsageTracker.getBucketName(category, timeBucket, utcTime));
    });

    return Redis.processMultiResults(await transaction.exec()).reduce((_usage, countValue, i) => {
      _usage[CONSTANTS.TIME_BUCKET_VALUES[i]] = countValue ? parseInt(countValue, 10) : 0;
      return _usage;
    }, {});
  }

  /**
   * Export all data points back until startTime (if provided), calling save function for each
   * @param {Function} saveDataPoint
   * @param {DateTime} [startTime=null] override for testing
   * @returns {Promise<void>}
   * @private
   */
  async _export(saveDataPoint, startTime = null) {
    if (!_.isFunction(saveDataPoint)) {
      throw new XError('saveDataPoint must be a function');
    }

    if (startTime && (!(startTime instanceof DateTime) || startTime.offset !== 0 || !startTime.isOffsetFixed)) {
      throw new XError('if provided, startTime must be instance of DateTime set to utc');
    }

    if (!startTime) {
      const previousExportTime = await this.services.redis.get(CONSTANTS.KEYS.LAST_EXPORT_KEY);
      startTime = previousExportTime ? DateTime.fromISO(previousExportTime) : null;
      startTime = startTime && startTime.minus({ days: 1 });
    }

    if (startTime) {
      startTime = startTime.toUTC();
    }

    let maxExportTime;

    const usageKeys = await this.services.redis.keys(`${CONSTANTS.KEYS.USAGE_PREFIX}${CONSTANTS.KEYS.DELIMITER}*`);

    await Promise.map(usageKeys, async (usageKey) => {
      const { projectId } = UsageTracker.parseUsageKey(usageKey);
      const bucketNames = await this.services.redis.hkeys(UsageTracker.getUsageKey(projectId));

      const relevantBucketNames = !startTime ? bucketNames : bucketNames.filter((bucketName) => {
        const { utcTime, timeBucket } = UsageTracker.parseBucketName(bucketName);

        const bucketTime = UsageTracker.getBucketTime(timeBucket, startTime);

        maxExportTime = (maxExportTime && (maxExportTime > bucketTime)) ? maxExportTime : bucketTime;
        return utcTime >= bucketTime;
      });

      await Promise.map(relevantBucketNames, async (bucketName) => {
        let value = await this.services.redis.hget(usageKey, bucketName);
        value = value ? parseInt(value, 10) : 0;
        await saveDataPoint(Object.assign(UsageTracker.parseBucketName(bucketName), {
          value,
          projectId,
        }));
      }, { concurrency: CONSTANTS.MAX_CONCURRENCY });
    }, { concurrency: CONSTANTS.MAX_CONCURRENCY });

    if (maxExportTime) {
      await this.services.redis.set(CONSTANTS.KEYS.LAST_EXPORT_KEY, maxExportTime.toUTC().toISO());
    }
  }

  /**
   * Export dataPoints to Firestore. Should be called periodically to minimize data loss in the event that Redis goes down
   * @param {DateTime} [startTime=null] override for testing
   * @returns {Promise<void>}
   */
  async export(startTime = null) {
    await this._export(async (dataPoint) => {
      const hash = crypto.createHash(CONSTANTS.HASH_TYPE);

      // It's not important what the ID is, just that it remains the same for a datapoint
      const stringifiedId = stringify(_.omit(dataPoint, 'value'));
      const id = `a${hash.update(stringifiedId).digest(CONSTANTS.HASH_ENCODING)}`;

      const data = _.omit(dataPoint, 'utcTime');

      await this.services.db
        .collection(CONSTANTS.COLUMN_NAMES.USAGE)
        .doc(id)
        .set(Object.assign(data, { utcTime: Firestore.Timestamp.fromDate(dataPoint.utcTime.toJSDate()) }));
    }, startTime);
  }

  /**
   * Import usage from Firestore
   * @param {DateTime|null} [startTime=null] override for testing
   * @returns {Promise<void>}
   */
  async import(startTime = null) {
    if (await this.services.redis.get(CONSTANTS.KEYS.LAST_EXPORT_KEY)) {
      log.warn('Data already in redis, aborting import');
      return;
    }

    if (!startTime) {
      startTime = DateTime.utc().minus({ days: CONSTANTS.MAX_IMPORT_DAYS });
    }

    const scroll = async (startAfter = null) => {
      let query = this.services.db
        .collection(CONSTANTS.COLUMN_NAMES.USAGE)
        .where('utcTime', '>', Firestore.Timestamp.fromDate(startTime.toJSDate()));

      if (startAfter) {
        query = query.startAfter(startAfter);
      }

      const querySnapshot = await query
        .limit(CONSTANTS.MAX_IMPORT_BATCH)
        .get();

      if (querySnapshot.size === 0) {
        return;
      }

      let transaction = this.services.redis.multi();

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const utcTime = DateTime.fromISO(data.utcTime.toDate().toISOString()).toUTC();

        transaction = transaction
          .hincrby(UsageTracker
            .getUsageKey(data.projectId), UsageTracker.getBucketName(data.category, data.timeBucket, utcTime), data.value);

        startAfter = docSnapshot;
      });

      // Just to check for errors
      Redis.processMultiResults(await transaction.exec());

      await scroll(startAfter);
    };

    await scroll();
  }

  /**
   * Remove old usage from Redis
   * @param {DateTime} [startTime=(now minus days)] override for testing
   * @returns {Promise<void>}
   */
  async clean(startTime = DateTime.utc().minus({ days: CONSTANTS.MAX_IMPORT_DAYS })) {
    if (startTime && (!(startTime instanceof DateTime) || startTime.offset !== 0 || !startTime.isOffsetFixed)) {
      throw new XError('if provided, startTime must be instance of DateTime set to utc');
    }

    if (!startTime) {
      const previousExportTime = await this.services.redis.get(CONSTANTS.KEYS.LAST_EXPORT_KEY);
      startTime = previousExportTime ? DateTime.fromISO(previousExportTime) : null;
    }

    if (startTime) {
      startTime = startTime.toUTC();
    }

    const usageKeys = await this.services.redis.keys(`${CONSTANTS.KEYS.USAGE_PREFIX}${CONSTANTS.KEYS.DELIMITER}*`);

    await Promise.map(usageKeys, async (usageKey) => {
      const { projectId } = UsageTracker.parseUsageKey(usageKey);
      const bucketNames = await this.services.redis.hkeys(UsageTracker.getUsageKey(projectId));

      const relevantBucketNames = bucketNames.filter((bucketName) => {
        const { utcTime, timeBucket } = UsageTracker.parseBucketName(bucketName);
        return utcTime <= UsageTracker.getBucketTime(timeBucket, startTime);
      });

      await Promise.map(relevantBucketNames, async (bucketName) => {
        await this.services.redis.hdel(usageKey, bucketName);
      }, { concurrency: CONSTANTS.MAX_CONCURRENCY });
    }, { concurrency: CONSTANTS.MAX_CONCURRENCY });
  }

  /**
   * Get usage for project and category at the bucket resolution, from start to end
   * @param {string} projectId
   * @param {string} category
   * @param {string} timeBucket
   * @param {string} startTime ISO8601 timestamp
   * @param {string} [endTime=now] ISO8601 timestamp
   * @returns {Promise<Array>}
   */
  async getUsage(projectId, category, timeBucket, startTime, endTime = DateTime.utc().toISO()) {
    if (!_.isString(projectId)) {
      throw new XError('projectId must be a string');
    }

    if (!_.isString(category)) {
      throw new XError('category must be a string');
    }

    if (!CONSTANTS.TIME_BUCKET_VALUES.includes(timeBucket)) {
      throw new XError(`timeBucket must be one of: ${CONSTANTS.TIME_BUCKET_VALUES.join(', ')}`);
    }

    startTime = DateTime.fromISO(startTime);
    endTime = DateTime.fromISO(endTime);

    if (startTime < endTime.minus({ [timeBucket]: CONSTANTS.MAX_RETURNED_USAGE_BUCKETS })) {
      throw new XError(`endTime - startTime cannot yield more than ${CONSTANTS.MAX_RETURNED_USAGE_BUCKETS} buckets`);
    }

    if (startTime >= endTime) {
      throw new XError('startTime must be before endTime');
    }

    let query = this.services.db
      .collection(CONSTANTS.COLUMN_NAMES.USAGE)
      .where('projectId', '==', projectId);

    query = query.where('category', '==', category);
    query = query.where('timeBucket', '==', timeBucket);
    query = query.where('utcTime', '>', Firestore.Timestamp.fromDate(startTime.toJSDate()));
    query = query.where('utcTime', '<=', Firestore.Timestamp.fromDate(endTime.toJSDate()));

    const querySnapshot = await query.get();

    const usage = [];

    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const utcTime = DateTime.fromISO(data.utcTime.toDate().toISOString()).toUTC();

      usage.push({
        projectId: data.projectId,
        category: data.category,
        utcTime: utcTime.toISO(),
        value: data.value,
        timeBucket: data.timeBucket,
      });
    });

    return usage;
  }

  /**
   * Attempt import if necessary and then start automatic export
   * @param {number} [intervalMs=CONSTANTS.DEFAULT_EXPORT_INTERVAL_MS]
   * @returns {void}
   */
  async start(intervalMs = CONSTANTS.DEFAULT_EXPORT_INTERVAL_MS) {
    const self = this;
    if (this.interval) {
      throw new Error('already started');
    }

    await this.import();
    this.interval = setInterval(() => self.export(), intervalMs);
  }

  /**
   * Stop automatic export to Firebase
   * @returns {void}
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

UsageTracker.CONSTANTS = CONSTANTS;
module.exports = UsageTracker;
