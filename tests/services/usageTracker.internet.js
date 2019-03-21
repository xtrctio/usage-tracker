'use strict';

/* eslint-disable func-names */

require('dotenv').config();

const { expect } = require('chai');
const { DateTime } = require('luxon');
const Promise = require('bluebird');

const Redis = require('ioredis');
const firebase = require('../firebase');

const testConfig = require('../config');
const { UsageTracker } = require('../../lib/services');

const log = require('../../logger');

const DELAY = 2;

describe('usageTracker integration tests', function () {
  this.timeout(20000);

  const redis = new Redis(testConfig.redis);

  let originalMaxBatch = null;

  before(async () => {
    log.error(`WARNING: THIS WILL DELETE ALL TOKEN CONTENT IN TESTING. ${DELAY} seconds to CTRL-C`);
    await Promise.delay(DELAY * 1000);
    await firebase.deletePath(UsageTracker.CONSTANTS.COLUMN_NAMES.USAGE);

    await redis.flushdb();

    originalMaxBatch = UsageTracker.CONSTANTS.MAX_IMPORT_BATCH;
  });

  beforeEach(async () => {
    await firebase.deletePath(UsageTracker.CONSTANTS.COLUMN_NAMES.USAGE);
    await redis.flushdb();
  });

  after(async () => {
    await redis.disconnect();
    UsageTracker.CONSTANTS.MAX_IMPORT_BATCH = originalMaxBatch;
  });

  it('export usage to Firestore, wipe redis, then import', async () => {
    const services = {
      db: firebase.db,
      redis,
    };

    const usageTracker = new UsageTracker(services);

    // Make it smaller to force scrolling
    UsageTracker.CONSTANTS.MAX_IMPORT_BATCH = 20;

    const utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);

    // Create usage in redis
    await Promise.map(Array.from(Array(50).keys()), async (n) => {
      await usageTracker.trackAndLimit('project1', 'search', 1, {}, utcTime.plus({ hours: n }));
    }, { concurrency: 10 });

    await Promise.map(Array.from(Array(30).keys()), async (n) => {
      await usageTracker.trackAndLimit('project2', 'search', 1, {}, utcTime.plus({ hours: n }));
    }, { concurrency: 10 });

    const project1PreImportCount = await redis.hlen(UsageTracker.getUsageKey('project1'));
    const project2PreImportCount = await redis.hlen(UsageTracker.getUsageKey('project2'));
    await usageTracker.export();

    expect(project1PreImportCount).to.eql(104);
    expect(project2PreImportCount).to.eql(63);

    const querySnapshot = await services.db
      .collection(UsageTracker.CONSTANTS.COLUMN_NAMES.USAGE)
      .get();

    expect(querySnapshot.size).to.eql(167);
    expect(querySnapshot.size).to.eql(project1PreImportCount + project2PreImportCount);

    // Wipe redis
    await redis.flushdb();

    // Import from Firestore (override the date)
    await usageTracker.import(utcTime.minus({ months: 2 }));

    const project1PostImportCount = await redis.hlen(UsageTracker.getUsageKey('project1'));
    const project2PostImportCount = await redis.hlen(UsageTracker.getUsageKey('project2'));

    expect(project1PostImportCount).to.eql(104);
    expect(project2PostImportCount).to.eql(63);
  });

  it('get usage from firebase', async () => {
    const services = {
      db: firebase.db,
      redis,
    };

    const usageTracker = new UsageTracker(services);

    const utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);

    // Create usage in redis
    await Promise.map(Array.from(Array(50).keys()), async (n) => {
      await usageTracker.trackAndLimit('project1', 'search', 1, {}, utcTime.plus({ hours: n }));
    }, { concurrency: 10 });

    await Promise.map(Array.from(Array(30).keys()), async (n) => {
      await usageTracker.trackAndLimit('project2', 'search', 1, {}, utcTime.plus({ hours: n }));
    }, { concurrency: 10 });

    await usageTracker.export();

    const usage = await usageTracker.getUsage('project1', 'search', 'day', utcTime.toISO(), utcTime.plus({ days: 5 }).toISO());

    const expectedUsage = [
      {
        projectId: 'project1',
        category: 'search',
        utcTime: '2018-01-02T00:00:00.000Z',
        value: 24,
        timeBucket: 'day',
      },
      {
        projectId: 'project1',
        category: 'search',
        utcTime: '2018-01-03T00:00:00.000Z',
        value: 3,
        timeBucket: 'day',
      },
    ];

    expect(usage).to.eql(expectedUsage);
  });
});
