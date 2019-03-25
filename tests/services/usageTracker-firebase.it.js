'use strict';

/* eslint-disable func-names */

require('dotenv').config();

const { expect } = require('chai');
const { DateTime } = require('luxon');
const Promise = require('bluebird');

const Redis = require('@xtrctio/redis');
const firebase = require('../firebase');

const testConfig = require('../config');
const { UsageTracker } = require('../../lib/services');


describe('usageTracker integration tests', function () {
  this.timeout(20000);

  const redis = new Redis(testConfig.redis);

  let originalMaxBatch = null;

  before(async () => {
    await firebase.deleteCollection(UsageTracker.CONSTANTS.COLUMN_NAMES.USAGE);

    await redis.flushdb();

    originalMaxBatch = UsageTracker.CONSTANTS.MAX_IMPORT_BATCH;
  });

  beforeEach(async () => {
    await firebase.deleteCollection(UsageTracker.CONSTANTS.COLUMN_NAMES.USAGE);
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

    expect(await usageTracker._getLastExportTime()).to.not.eql(null);

    // Wipe redis
    await redis.flushdb();

    // Import from Firestore (override the date)
    await usageTracker.import(utcTime.minus({ months: 2 }));

    const project1PostImportCount = await redis.hlen(UsageTracker.getUsageKey('project1'));
    const project2PostImportCount = await redis.hlen(UsageTracker.getUsageKey('project2'));

    expect(project1PostImportCount).to.eql(104);
    expect(project2PostImportCount).to.eql(63);
  });

  it('do not import if last export is set', async () => {
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

    expect(await usageTracker._getLastExportTime()).to.not.eql(null);

    // Wipe redis
    await redis.flushdb();
    await usageTracker._setLastExportTime(utcTime);

    // Import from Firestore (override the date)
    await usageTracker.import(utcTime.minus({ months: 2 }));

    const project1PostImportCount = await redis.hlen(UsageTracker.getUsageKey('project1'));
    const project2PostImportCount = await redis.hlen(UsageTracker.getUsageKey('project2'));

    expect(project1PostImportCount).to.eql(0);
    expect(project2PostImportCount).to.eql(0);
  });

  it('get usage from firebase by the day', async () => {
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
        utcTime: '2018-01-01T00:00:00.000Z',
        timeBucket: 'day',
        value: 0,
      },
      {
        utcTime: '2018-01-02T00:00:00.000Z',
        timeBucket: 'day',
        value: 24,
      },
      {
        utcTime: '2018-01-03T00:00:00.000Z',
        timeBucket: 'day',
        value: 3,
      },
      {
        utcTime: '2018-01-04T00:00:00.000Z',
        timeBucket: 'day',
        value: 0,
      },
      {
        utcTime: '2018-01-05T00:00:00.000Z',
        timeBucket: 'day',
        value: 0,
      },
      {
        utcTime: '2018-01-06T00:00:00.000Z',
        timeBucket: 'day',
        value: 0,
      },
    ];

    expect(usage).to.eql(expectedUsage);
  });

  it('get usage from firebase by min3', async () => {
    const services = {
      db: firebase.db,
      redis,
    };

    const usageTracker = new UsageTracker(services);

    const utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);

    // Create usage in redis
    await Promise.map(Array.from(Array(50).keys()), async (n) => {
      await usageTracker.trackAndLimit('project1', 'search', 1, {}, utcTime.plus({ minute: n }));
    }, { concurrency: 10 });

    await Promise.map(Array.from(Array(30).keys()), async (n) => {
      await usageTracker.trackAndLimit('project2', 'search', 1, {}, utcTime.plus({ hours: n }));
    }, { concurrency: 10 });

    await usageTracker.export();

    const usage = await usageTracker.getUsage('project1', 'search', 'min5', utcTime.toISO(), utcTime.plus({ minutes: 30 }).toISO());

    const expectedUsage = [
      {
        utcTime: '2018-01-01T01:10:00.000Z',
        timeBucket: 'min5',
        value: 0,
      },
      {
        utcTime: '2018-01-01T01:15:00.000Z',
        timeBucket: 'min5',
        value: 5,
      },
      {
        utcTime: '2018-01-01T01:20:00.000Z',
        timeBucket: 'min5',
        value: 5,
      },
      {
        utcTime: '2018-01-01T01:25:00.000Z',
        timeBucket: 'min5',
        value: 5,
      },
      {
        utcTime: '2018-01-01T01:30:00.000Z',
        timeBucket: 'min5',
        value: 5,
      },
      {
        utcTime: '2018-01-01T01:35:00.000Z',
        timeBucket: 'min5',
        value: 5,
      },
      {
        utcTime: '2018-01-01T01:40:00.000Z',
        timeBucket: 'min5',
        value: 5,
      },
      {
        utcTime: '2018-01-01T01:45:00.000Z',
        timeBucket: 'min5',
        value: 5,
      },
    ];

    expect(usage).to.eql(expectedUsage);
  });
});
