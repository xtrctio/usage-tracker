'use strict';

/* eslint-disable func-names */
require('dotenv').config();

const { expect } = require('chai');
const { DateTime } = require('luxon');

const Redis = require('ioredis');

const testConfig = require('../config');
const { UsageTracker } = require('../../lib/services');

describe('usageTracker integration tests', () => {
  const redis = new Redis(testConfig.redis);

  beforeEach(async () => {
    await redis.flushdb();
  });

  after(async () => {
    await redis.disconnect();
  });

  it('increments usage in redis', async () => {
    const services = {
      db: {},
      redis,
    };

    const usageTracker = new UsageTracker(services);

    const utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);
    const pastUtcTime = DateTime.utc(2018, 1, 1, 1, 0, 30);

    const projectId = 'foo';
    const category = 'search';

    const limits = {}; // No limits
    let result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);

    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, pastUtcTime);
    expect(result).to.eql(null);

    let usage = await usageTracker.getUsageAtTime(projectId, category, 1, utcTime);
    expect(usage).to.eql({
      min5: 1,
      hour: 2,
      day: 2,
      month: 2,
    });

    usage = await usageTracker.getUsageAtTime(projectId, category, 1, pastUtcTime);
    expect(usage).to.eql({
      min5: 1,
      hour: 2,
      day: 2,
      month: 2,
    });

    const futureUtcTime = DateTime.utc(2018, 1, 1, 2, 0, 30);

    usage = await usageTracker.getUsageAtTime(projectId, category, 1, futureUtcTime);
    expect(usage).to.eql({
      min5: 0,
      hour: 0,
      day: 2,
      month: 2,
    });
  });

  it('increments usage for different projects', async () => {
    const services = {
      db: {},
      redis,
    };

    const usageTracker = new UsageTracker(services);

    const utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);

    const projectId1 = 'foo';
    const projectId2 = 'bar';
    const category = 'search';

    const limits = {}; // No limits
    let result = await usageTracker.trackAndLimit(projectId1, category, 1, limits, utcTime);
    expect(result).to.eql(null);

    result = await usageTracker.trackAndLimit(projectId2, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.trackAndLimit(projectId2, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.trackAndLimit(projectId2, category, 1, limits, utcTime);
    expect(result).to.eql(null);

    let usage = await usageTracker.getUsageAtTime(projectId1, category, 1, utcTime);
    expect(usage).to.eql({
      min5: 1,
      hour: 1,
      day: 1,
      month: 1,
    });

    usage = await usageTracker.getUsageAtTime(projectId2, category, 1, utcTime);
    expect(usage).to.eql({
      min5: 3,
      hour: 3,
      day: 3,
      month: 3,
    });
  });

  it('increments usage until limits', async () => {
    const services = {
      db: {},
      redis,
    };

    const usageTracker = new UsageTracker(services);

    const utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);
    const projectId = 'foo';
    const category = 'search';

    const limits = { min5: 3 };

    let result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);

    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql({ min5: 3 });
    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql({ min5: 3 });
    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql({ min5: 3 });

    const usage = await usageTracker.getUsageAtTime(projectId, category, 1, utcTime);
    expect(usage).to.eql({
      min5: 3,
      hour: 3,
      day: 3,
      month: 3,
    });
  });

  it('check usage that is below limits without changing usage', async () => {
    const services = {
      db: {},
      redis,
    };

    const usageTracker = new UsageTracker(services);

    const utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);
    const projectId = 'foo';
    const category = 'search';

    const limits = { min5: 3 };

    let result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);

    result = await usageTracker.checkLimits(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.checkLimits(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.checkLimits(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
  });

  it('increments usage is above limits without changing usage', async () => {
    const services = {
      db: {},
      redis,
    };

    const usageTracker = new UsageTracker(services);

    const utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);
    const projectId = 'foo';
    const category = 'search';

    const limits = { min5: 3 };

    let result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);

    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql({ min5: 3 });


    result = await usageTracker.checkLimits(projectId, category, 1, limits, utcTime);
    expect(result).to.eql({ min5: 3 });
    result = await usageTracker.checkLimits(projectId, category, 1, limits, utcTime);
    expect(result).to.eql({ min5: 3 });
    result = await usageTracker.checkLimits(projectId, category, 1, limits, utcTime);
    expect(result).to.eql({ min5: 3 });
  });

  it('undo one unit of usage', async () => {
    const services = {
      db: {},
      redis,
    };

    const usageTracker = new UsageTracker(services);

    const utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);
    const projectId = 'foo';
    const category = 'search';

    const limits = { min5: 3 };

    let result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
    result = await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);

    result = await usageTracker.checkLimits(projectId, category, 1, limits, utcTime);
    expect(result).to.eql({ min5: 3 });

    await usageTracker.undo(projectId, category, 1, utcTime);

    result = await usageTracker.checkLimits(projectId, category, 1, limits, utcTime);
    expect(result).to.eql(null);
  });

  it('_export data points', async () => {
    const services = {
      db: {},
      redis,
    };

    const usageTracker = new UsageTracker(services);

    let utcTime = DateTime.utc(2018, 1, 1, 1, 14, 30);

    const projectId = 'foo';
    const category = 'search';

    const limits = {};
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);

    utcTime = DateTime.utc(2018, 1, 23, 17, 14, 30);
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);

    let dataPoints = [];
    await usageTracker._export((dataPoint) => {
      dataPoints.push(dataPoint);
    });

    dataPoints.sort();
    expect(dataPoints.length).to.eql(7);

    dataPoints = dataPoints.map((dataPoint) => {
      dataPoint.utcTime = dataPoint.utcTime.toISO();
      return dataPoint;
    });

    const expectedDatapoints = [
      {
        timeBucket: 'min5',
        category: 'search',
        utcTime: '2018-01-01T01:10:00.000Z',
        projectId: 'foo',
        value: 3,
      }, {
        timeBucket: 'hour',
        category: 'search',
        utcTime: '2018-01-01T01:00:00.000Z',
        projectId: 'foo',
        value: 3,
      }, {
        timeBucket: 'day',
        category: 'search',
        utcTime: '2018-01-01T00:00:00.000Z',
        projectId: 'foo',
        value: 3,
      }, {
        timeBucket: 'month',
        category: 'search',
        utcTime: '2018-01-01T00:00:00.000Z',
        projectId: 'foo',
        value: 4,
      }, {
        timeBucket: 'min5',
        category: 'search',
        utcTime: '2018-01-23T17:10:00.000Z',
        projectId: 'foo',
        value: 1,
      }, {
        timeBucket: 'hour',
        category: 'search',
        utcTime: '2018-01-23T17:00:00.000Z',
        projectId: 'foo',
        value: 1,
      }, {
        timeBucket: 'day',
        category: 'search',
        utcTime: '2018-01-23T00:00:00.000Z',
        projectId: 'foo',
        value: 1,
      },
    ];

    expect(dataPoints).to.eql(expectedDatapoints);
  });

  it('_export data points starting from saved point', async () => {
    const services = {
      db: {},
      redis,
    };

    const usageTracker = new UsageTracker(services);

    let utcTime = DateTime.utc(2018, 1, 23, 1, 14, 30);

    const projectId = 'foo';
    const category = 'search';

    const limits = {};
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);

    // Set last date
    await redis.set(UsageTracker.CONSTANTS.KEYS.LAST_EXPORT_KEY, utcTime.toISO());

    utcTime = DateTime.utc(2018, 1, 1, 17, 14, 30);
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);

    let dataPoints = [];
    await usageTracker._export((dataPoint) => dataPoints.push(dataPoint));

    dataPoints.sort();
    expect(dataPoints.length).to.eql(4);

    dataPoints = dataPoints.map((dataPoint) => {
      dataPoint.utcTime = dataPoint.utcTime.toISO();
      return dataPoint;
    });

    const expectedDatapoints = [
      {
        timeBucket: 'min5',
        category: 'search',
        utcTime: '2018-01-23T01:10:00.000Z',
        projectId: 'foo',
        value: 3,
      }, {
        timeBucket: 'hour',
        category: 'search',
        utcTime: '2018-01-23T01:00:00.000Z',
        projectId: 'foo',
        value: 3,
      }, {
        timeBucket: 'day',
        category: 'search',
        utcTime: '2018-01-23T00:00:00.000Z',
        projectId: 'foo',
        value: 3,
      }, {
        timeBucket: 'month',
        category: 'search',
        utcTime: '2018-01-01T00:00:00.000Z',
        projectId: 'foo',
        value: 4,
      },
    ];

    expect(dataPoints).to.eql(expectedDatapoints);
  });

  it('cleans data points starting from specified time', async () => {
    const services = {
      db: {},
      redis,
    };

    const usageTracker = new UsageTracker(services);

    let utcTime = DateTime.utc(2018, 1, 23, 1, 14, 30);

    const projectId = 'foo';
    const category = 'search';

    const limits = {};
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime.plus({ months: 1 }));
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime.plus({ months: 3 }));

    // Set last date
    await redis.set(UsageTracker.CONSTANTS.KEYS.LAST_EXPORT_KEY, utcTime.toISO());

    utcTime = DateTime.utc(2018, 1, 1, 17, 14, 30);
    await usageTracker.trackAndLimit(projectId, category, 1, limits, utcTime);

    let dataPoints = [];
    await usageTracker._export((dataPoint) => dataPoints.push(dataPoint));
    dataPoints.sort();

    expect(dataPoints.length).to.eql(9);
    let expectedDataPoints = [{
      timeBucket: 'min5',
      category: 'search',
      utcTime: '2018-02-23T01:10:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'hour',
      category: 'search',
      utcTime: '2018-02-23T01:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'day',
      category: 'search',
      utcTime: '2018-02-23T00:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'month',
      category: 'search',
      utcTime: '2018-02-01T00:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'min5',
      category: 'search',
      utcTime: '2018-04-23T01:10:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'hour',
      category: 'search',
      utcTime: '2018-04-23T01:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'day',
      category: 'search',
      utcTime: '2018-04-23T00:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'month',
      category: 'search',
      utcTime: '2018-04-01T00:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'month',
      category: 'search',
      utcTime: '2018-01-01T00:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }];
    dataPoints = dataPoints.map((dataPoint) => {
      dataPoint.utcTime = dataPoint.utcTime.toISO();
      return dataPoint;
    });
    expect(dataPoints).to.eql(expectedDataPoints);

    // Wipe anything older the time provided
    await usageTracker.clean(utcTime.plus({ months: 2 }));

    dataPoints = [];
    await usageTracker._export((dataPoint) => dataPoints.push(dataPoint));
    dataPoints.sort();
    expect(dataPoints.length).to.eql(4);

    expectedDataPoints = [{
      timeBucket: 'min5',
      category: 'search',
      utcTime: '2018-04-23T01:10:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'hour',
      category: 'search',
      utcTime: '2018-04-23T01:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'day',
      category: 'search',
      utcTime: '2018-04-23T00:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }, {
      timeBucket: 'month',
      category: 'search',
      utcTime: '2018-04-01T00:00:00.000Z',
      value: 1,
      projectId: 'foo',
    }];
    dataPoints = dataPoints.map((dataPoint) => {
      dataPoint.utcTime = dataPoint.utcTime.toISO();
      return dataPoint;
    });
    expect(dataPoints).to.eql(expectedDataPoints);
  });
});
