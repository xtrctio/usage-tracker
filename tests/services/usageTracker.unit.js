'use strict';

const { expect } = require('chai');
const { DateTime } = require('luxon');

const { UsageTracker } = require('../../lib/services');

describe('usageTracker unit tests', () => {
  it('puts time into 5 minute buckets', () => {
    let time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, time).toISO()).to.eql('2018-01-01T01:10:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 11, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, time).toISO()).to.eql('2018-01-01T01:10:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 15, 0);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, time).toISO()).to.eql('2018-01-01T01:15:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 59, 58);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, time).toISO()).to.eql('2018-01-01T01:55:00.000Z');
  });

  it('puts time into hour buckets', () => {
    let time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.HOUR, time).toISO()).to.eql('2018-01-01T01:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 11, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.HOUR, time).toISO()).to.eql('2018-01-01T01:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 15, 0);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.HOUR, time).toISO()).to.eql('2018-01-01T01:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 59, 58);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.HOUR, time).toISO()).to.eql('2018-01-01T01:00:00.000Z');
  });

  it('puts time into day buckets', () => {
    let time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.DAY, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 11, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.DAY, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 15, 0);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.DAY, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 59, 58);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.DAY, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');
  });

  it('puts time into month buckets', () => {
    let time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MONTH, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 1, 1, 11, 30);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MONTH, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 29, 1, 15, 0);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MONTH, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');

    time = DateTime.utc(2018, 1, 15, 1, 59, 58);
    expect(UsageTracker.getBucketTime(UsageTracker.CONSTANTS.TIME_BUCKETS.MONTH, time).toISO()).to.eql('2018-01-01T00:00:00.000Z');
  });

  it('gets hash field for category and time', () => {
    const time = DateTime.utc(2018, 1, 1, 1, 14, 30);
    expect(UsageTracker.getBucketName('search', UsageTracker.CONSTANTS.TIME_BUCKETS.MIN5, time))
      .to.eql('search---min5---2018-01-01T01:10:00.000Z');
  });
});
