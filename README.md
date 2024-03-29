# usage-tracker

[![CircleCI](https://circleci.com/gh/xtrctio/usage-tracker/tree/master.svg?style=svg&circle-token=aa8abb7ebc9bc473168a22e6afbd5178507e7704)](https://circleci.com/gh/xtrctio/usage-tracker/tree/master)

Every request counts

## Example
```javascript
const { UsageTracker } = require('@xtrctio/usage-tracker').services;

const usageTracker = new UsageTracker({redis, db});

const limits = {
  min5: 10,
  month: 10000
};

const result = await usageTracker.trackAndLimit('some-project', 'search-api', limits);

if (result === null) {
  console.log('No limits hit!');
} else {
  console.log(`Hit limits for ${Object.keys(result).join(',')}`);
}

```

## Classes

<dl>
<dt><a href="#Limits">Limits</a></dt>
<dd></dd>
<dt><a href="#UsageTracker">UsageTracker</a></dt>
<dd></dd>
</dl>

<a name="Limits"></a>

## Limits
**Kind**: global class  
**Properties**

| Name | Type |
| --- | --- |
| min5 | <code>number</code> | 
| hour | <code>number</code> | 
| day | <code>number</code> | 
| month | <code>number</code> | 

<a name="new_Limits_new"></a>

### new Limits(params)

| Param | Type |
| --- | --- |
| params | <code>object</code> | 

<a name="UsageTracker"></a>

## UsageTracker
**Kind**: global class  

* [UsageTracker](#UsageTracker)
    * [new UsageTracker(services)](#new_UsageTracker_new)
    * _instance_
        * [.trackAndLimit(projectId, category, resetDay, limits, utcTime)](#UsageTracker+trackAndLimit) ⇒ <code>Promise.&lt;(null\|object)&gt;</code>
        * [.undo(projectId, category, resetDay, utcTime)](#UsageTracker+undo) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.checkLimits(projectId, category, resetDay, limits, utcTime)](#UsageTracker+checkLimits) ⇒ <code>Promise.&lt;(null\|object)&gt;</code>
        * [.getUsageAtTime(projectId, category, resetDay, utcTime)](#UsageTracker+getUsageAtTime) ⇒ <code>Promise.&lt;object&gt;</code>
        * [.export([startTime])](#UsageTracker+export) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.import([startTime])](#UsageTracker+import) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.clean([startTime])](#UsageTracker+clean) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.getUsage(projectId, category, timeBucket, startTime, [endTime])](#UsageTracker+getUsage) ⇒ <code>Promise.&lt;Array&gt;</code>
        * [.start([intervalMs])](#UsageTracker+start) ⇒ <code>void</code>
        * [.stop()](#UsageTracker+stop) ⇒ <code>void</code>
    * _static_
        * [.getMonthFromResetDay(resetDay, utcTime)](#UsageTracker.getMonthFromResetDay) ⇒ <code>DateTime</code>
        * [.getBucketTime(timeBucket, resetDay, utcTime)](#UsageTracker.getBucketTime) ⇒ <code>DateTime</code>
        * [.getBucketName(category, timeBucket, resetDay, utcTime)](#UsageTracker.getBucketName) ⇒ <code>string</code>
        * [.parseBucketName(bucketName)](#UsageTracker.parseBucketName) ⇒ <code>Object</code>
        * [.getUsageKey(projectId)](#UsageTracker.getUsageKey) ⇒ <code>string</code>
        * [.parseUsageKey(usageKey)](#UsageTracker.parseUsageKey) ⇒ <code>Object</code>

<a name="new_UsageTracker_new"></a>

### new UsageTracker(services)

| Param | Type |
| --- | --- |
| services | <code>object</code> | 
| services.db | <code>object</code> | 
| services.redis | <code>object</code> | 

<a name="UsageTracker+trackAndLimit"></a>

### usageTracker.trackAndLimit(projectId, category, resetDay, limits, utcTime) ⇒ <code>Promise.&lt;(null\|object)&gt;</code>
Record traffic by a project to an API category and limit to max

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  
**Returns**: <code>Promise.&lt;(null\|object)&gt;</code> - null if not limited, object of limits hit otherwise  

| Param | Type |
| --- | --- |
| projectId | <code>string</code> | 
| category | <code>string</code> | 
| resetDay | <code>number</code> | 
| limits | [<code>Limits</code>](#Limits) \| <code>object</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker+undo"></a>

### usageTracker.undo(projectId, category, resetDay, utcTime) ⇒ <code>Promise.&lt;void&gt;</code>
Decrement all usage by one

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| projectId | <code>string</code> | 
| category | <code>string</code> | 
| resetDay | <code>number</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker+checkLimits"></a>

### usageTracker.checkLimits(projectId, category, resetDay, limits, utcTime) ⇒ <code>Promise.&lt;(null\|object)&gt;</code>
Check if previous usage is within limits without changing usage

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  
**Returns**: <code>Promise.&lt;(null\|object)&gt;</code> - null if not limited, object of limits hit otherwise  

| Param | Type |
| --- | --- |
| projectId | <code>string</code> | 
| category | <code>string</code> | 
| resetDay | <code>number</code> | 
| limits | [<code>Limits</code>](#Limits) \| <code>object</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker+getUsageAtTime"></a>

### usageTracker.getUsageAtTime(projectId, category, resetDay, utcTime) ⇒ <code>Promise.&lt;object&gt;</code>
Get usage at specific time

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| projectId | <code>string</code> | 
| category | <code>string</code> | 
| resetDay | <code>number</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker+export"></a>

### usageTracker.export([startTime]) ⇒ <code>Promise.&lt;void&gt;</code>
Export dataPoints to firestore. Should be called periodically to minimize data loss in the event that Redis goes down

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [startTime] | <code>DateTime</code> | <code></code> | override for testing |

<a name="UsageTracker+import"></a>

### usageTracker.import([startTime]) ⇒ <code>Promise.&lt;void&gt;</code>
Import usage from firestore

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [startTime] | <code>DateTime</code> \| <code>null</code> | <code></code> | override for testing |

<a name="UsageTracker+clean"></a>

### usageTracker.clean([startTime]) ⇒ <code>Promise.&lt;void&gt;</code>
Remove old usage from Redis

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| [startTime] | <code>DateTime</code> | <code>(now minus days)</code> | override for testing |

<a name="UsageTracker+getUsage"></a>

### usageTracker.getUsage(projectId, category, timeBucket, startTime, [endTime]) ⇒ <code>Promise.&lt;Array&gt;</code>
Get usage for project and category at the bucket resolution, from start to end

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| projectId | <code>string</code> |  |  |
| category | <code>string</code> |  |  |
| timeBucket | <code>string</code> |  |  |
| startTime | <code>string</code> |  | ISO8601 timestamp |
| [endTime] | <code>string</code> | <code>&quot;now&quot;</code> | ISO8601 timestamp |

<a name="UsageTracker+start"></a>

### usageTracker.start([intervalMs]) ⇒ <code>void</code>
Attempt import if necessary and then start automatic export

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type | Default |
| --- | --- | --- |
| [intervalMs] | <code>number</code> | <code>CONSTANTS.DEFAULT_EXPORT_INTERVAL_MS</code> | 

<a name="UsageTracker+stop"></a>

### usageTracker.stop() ⇒ <code>void</code>
Stop automatic export to Firebase

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  
<a name="UsageTracker.getMonthFromResetDay"></a>

### UsageTracker.getMonthFromResetDay(resetDay, utcTime) ⇒ <code>DateTime</code>
Get current billng month based on reset date and time

**Kind**: static method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| resetDay | <code>number</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker.getBucketTime"></a>

### UsageTracker.getBucketTime(timeBucket, resetDay, utcTime) ⇒ <code>DateTime</code>
Consistently rounds down to the nearest 5 minute increment and returns the new DateTime

**Kind**: static method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| timeBucket | <code>string</code> | 
| resetDay | <code>number</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker.getBucketName"></a>

### UsageTracker.getBucketName(category, timeBucket, resetDay, utcTime) ⇒ <code>string</code>
Gets bucket name for hash field based on project and time

**Kind**: static method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| category | <code>string</code> | 
| timeBucket | <code>string</code> | 
| resetDay | <code>number</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker.parseBucketName"></a>

### UsageTracker.parseBucketName(bucketName) ⇒ <code>Object</code>
Converts bucketName back into it's parts

**Kind**: static method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| bucketName | <code>string</code> | 

<a name="UsageTracker.getUsageKey"></a>

### UsageTracker.getUsageKey(projectId) ⇒ <code>string</code>
Get key for project

**Kind**: static method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| projectId | <code>string</code> | 

<a name="UsageTracker.parseUsageKey"></a>

### UsageTracker.parseUsageKey(usageKey) ⇒ <code>Object</code>
Converts usageKey back into projectId

**Kind**: static method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| usageKey | <code>string</code> | 

