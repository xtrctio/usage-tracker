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
        * [.trackAndLimit(projectId, category, limits, utcTime)](#UsageTracker+trackAndLimit) ⇒ <code>Promise.&lt;(null\|object)&gt;</code>
        * [.getUsageAtTime(projectId, category, utcTime)](#UsageTracker+getUsageAtTime) ⇒ <code>Promise.&lt;object&gt;</code>
        * [.export(startTime)](#UsageTracker+export) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.import([startTime])](#UsageTracker+import) ⇒ <code>Promise.&lt;void&gt;</code>
        * [.clean([startTime])](#UsageTracker+clean) ⇒ <code>Promise.&lt;void&gt;</code>
    * _static_
        * [.getBucketTime(timeBucket, utcTime)](#UsageTracker.getBucketTime) ⇒ <code>DateTime</code>
        * [.getBucketName(category, timeBucket, utcTime)](#UsageTracker.getBucketName) ⇒ <code>string</code>
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

### usageTracker.trackAndLimit(projectId, category, limits, utcTime) ⇒ <code>Promise.&lt;(null\|object)&gt;</code>
Record traffic by a project to an API category and limit to max

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  
**Returns**: <code>Promise.&lt;(null\|object)&gt;</code> - null if not limited, object of limits hit otherwise  

| Param | Type |
| --- | --- |
| projectId | <code>string</code> | 
| category | <code>string</code> | 
| limits | [<code>Limits</code>](#Limits) \| <code>object</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker+getUsageAtTime"></a>

### usageTracker.getUsageAtTime(projectId, category, utcTime) ⇒ <code>Promise.&lt;object&gt;</code>
Get usage at specific time

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| projectId | <code>string</code> | 
| category | <code>string</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker+export"></a>

### usageTracker.export(startTime) ⇒ <code>Promise.&lt;void&gt;</code>
Export dataPoints to Firestore

**Kind**: instance method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type | Default |
| --- | --- | --- |
| startTime | <code>DateTime</code> | <code></code> | 

<a name="UsageTracker+import"></a>

### usageTracker.import([startTime]) ⇒ <code>Promise.&lt;void&gt;</code>
Import usage from Firestore

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

<a name="UsageTracker.getBucketTime"></a>

### UsageTracker.getBucketTime(timeBucket, utcTime) ⇒ <code>DateTime</code>
Consistently rounds down to the nearest 5 minute increment and returns the new DateTime

**Kind**: static method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| timeBucket | <code>string</code> | 
| utcTime | <code>DateTime</code> | 

<a name="UsageTracker.getBucketName"></a>

### UsageTracker.getBucketName(category, timeBucket, utcTime) ⇒ <code>string</code>
Gets bucket name for hash field based on project and time

**Kind**: static method of [<code>UsageTracker</code>](#UsageTracker)  

| Param | Type |
| --- | --- |
| category | <code>string</code> | 
| timeBucket | <code>string</code> | 
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

