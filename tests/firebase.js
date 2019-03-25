'use strict';

/* eslint-disable import/no-dynamic-require */
const admin = require('firebase-admin');
const { credentials } = require('grpc');

admin.initializeApp({
  databaseURL: 'https://xtrctio-testing.firebaseio.com',
});

const db = new admin.firestore.Firestore({
  projectId: 'xtrctio-testing',
  servicePath: 'localhost',
  port: 8080,
  sslCreds: credentials.createInsecure(),
});

const deleteQueryBatch = async (query, batchSize) => {
  const snapshot = await query.get();

  // When there are no documents left, we are done
  if (snapshot.size === 0) {
    return null;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  return snapshot.size !== 0 ? deleteQueryBatch(query, batchSize) : null;
};

const deleteCollection = (collectionPath, batchSize = 100) => {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return deleteQueryBatch(query, batchSize);
};

module.exports = {
  db,
  deleteCollection,
  auth: admin.auth(),
};
