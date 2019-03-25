'use strict';

const { expect } = require('chai');
const { DateTime } = require('luxon');
const sinon = require('sinon');

const { UsageTracker } = require('../../lib/services');

describe('usageTracker unit tests', () => {
  it('puts time into 5 minute buckets', () => {
    let time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, 1, time).toISO()).to.eql('2018-01-01T01:10:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 11, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, 1, time).toISO()).to.eql('2018-01-01T01:10:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 15, 0);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, 1, time).toISO()).to.eql('2018-01-01T01:15:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 59, 58);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, 1, time).toISO()).to.eql('2018-01-01T01:55:00.000Z');
  });

  it('puts time into hour buckets', () => {
    let time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.HOUR, 1, time).toISO()).to.eql('2018-01-01T01:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 11, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.HOUR, 1, time).toISO()).to.eql('2018-01-01T01:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 15, 0);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.HOUR, 1, time).toISO()).to.eql('2018-01-01T01:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 59, 58);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.HOUR, 1, time).toISO()).to.eql('2018-01-01T01:00:00.000Z');
  });

  it('puts time into day buckets', () => {
    let time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.DAY, 1, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 11, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.DAY, 1, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 15, 0);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.DAY, 1, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 59, 58);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.DAY, 1, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');
  });

  it('puts time into month buckets', () => {
    let time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MONTH, 1, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 11, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MONTH, 1, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 29, 1, 15, 0);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MONTH, 1, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 15, 1, 59, 58);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MONTH, 1, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');
  });

  it('gets hash field for category and time', () => {
    const time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketName('search', UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, 1, time))
      .to.eql('min5---search---2018-01-01T01:10:00.000Z');
  });

  it('gets hash field for category and time with reset day for month', () => {
    const time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketName('search', UsageTracker.CONSTANTS.TIME_BUCKETS.MONTH, 1, time))
      .to.eql('month||1---search---2018-01-01T00:00:00.000Z');
  });

  it('parses bucketName (hash field)', () => {
    const utcTime = DateTime.utc(2018, 1, 1, 1, 10, 0);
    const parsed = UsageTracker.parseBucketName('min5---search---2018-01-01T01:10:00.000Z');

    expect(parsed.category).to.eql('search');
    expect(parsed.timeBucket).to.eql('min5');
    expect(parsed.utcTime.toISO()).to.eql(utcTime.toISO());
  });

  it('parses bucketName with reset day in month', () => {
    const utcTime = DateTime.utc(2018, 1, 1, 1, 10, 0);
    const parsed = UsageTracker.parseBucketName('month||23---search---2018-01-01T01:10:00.000Z');

    expect(parsed.category).to.eql('search');
    expect(parsed.timeBucket).to.eql('month');
    expect(parsed.resetDay).to.eql(23);
    expect(parsed.utcTime.toISO()).to.eql(utcTime.toISO());
  });

  it('get usage limited to specific number of buckets', async () => {
    const where = {
      get: sinon.stub().resolves([]),
    };

    where.where = sinon.stub().returns(where);

    const usageTracker = new UsageTracker({
      redis: {},
      db: {
        collection: where,
      },
    });
    const startTime = DateTime.utc(2017, 1, 1, 1, 14, 30);
    const endTime = DateTime.utc(2018, 1, 1, 1, 14, 30);
    const result = await usageTracker.getUsage('some-project', 'category', 'min5', startTime.toISO(), endTime.toISO())
      .then(() => 'should reject')
      .catch((err) => err);
    expect(result.message).to.eql('endTime - startTime cannot yield more than 100 buckets');
  });

  it('get usage limits startTime before endTime', async () => {
    const where = {
      get: sinon.stub().resolves([]),
    };

    where.where = sinon.stub().returns(where);

    const usageTracker = new UsageTracker({
      redis: {},
      db: { collection: where },
    });

    const startTime = DateTime.utc(2018, 1, 1, 1, 14, 30);
    const endTime = DateTime.utc(2017, 1, 1, 1, 14, 30);
    const result = await usageTracker.getUsage('some-project', 'category', 'min5', startTime.toISO(), endTime.toISO())
      .then(() => 'should reject')
      .catch((err) => err);
    expect(result.message).to.eql('startTime must be before endTime');
  });

  it('get month based on reset data', () => {
    expect(UsageTracker.getMonthFromResetDay(14, DateTime.fromISO('2018-01-01T00:00:00.000Z').toUTC()).toISO())
      .to.eql('2017-12-01T00:00:00.000Z');
    expect(UsageTracker.getMonthFromResetDay(14, DateTime.fromISO('2018-01-14T00:00:00.000Z').toUTC()).toISO())
      .to.eql('2018-01-01T00:00:00.000Z');
    expect(UsageTracker.getMonthFromResetDay(14, DateTime.fromISO('2018-01-15T00:00:00.000Z').toUTC()).toISO())
      .to.eql('2018-01-01T00:00:00.000Z');
  });

  it('get time range', () => {
    const expectedRange = {
      '2018-01-01T00:00:00.000Z': {
        value: 0,
      },
      '2018-01-02T00:00:00.000Z': {
        value: 0,
      },
      '2018-01-03T00:00:00.000Z': {
        value: 0,
      },
      '2018-01-04T00:00:00.000Z': {
        value: 0,
      },
      '2018-01-05T00:00:00.000Z': {
        value: 0,
      },
    };

    const start = DateTime.fromISO('2018-01-01T00:00:00.000Z').toUTC();
    const end = DateTime.fromISO('2018-01-05T00:00:00.000Z').toUTC();

    expect(UsageTracker._getBucketRangeObject('day', start, end)).to.eql(expectedRange);
  });

  it('get time range min5', () => {
    const expectedRange = {
      '2018-01-01T00:00:00.000Z': {
        value: 0,
      },
      '2018-01-01T00:05:00.000Z': {
        value: 0,
      },
      '2018-01-01T00:10:00.000Z': {
        value: 0,
      },
    };

    const start = DateTime.fromISO('2018-01-01T00:00:00.000Z').toUTC();
    const end = DateTime.fromISO('2018-01-01T00:10:00.000Z').toUTC();

    expect(UsageTracker._getBucketRangeObject('min5', start, end)).to.eql(expectedRange);
  });

  it('get time range min5 with rounding', () => {
    const expectedRange = {
      '2018-01-01T00:00:00.000Z': {
        value: 0,
      },
      '2018-01-01T00:05:00.000Z': {
        value: 0,
      },
      '2018-01-01T00:10:00.000Z': {
        value: 0,
      },
    };

    const start = DateTime.fromISO('2018-01-01T00:01:00.000Z').toUTC();
    const end = DateTime.fromISO('2018-01-01T00:09:00.000Z').toUTC();

    expect(UsageTracker._getBucketRangeObject('min5', start, end)).to.eql(expectedRange);
  });
});
