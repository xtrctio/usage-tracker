'use strict';

/* eslint-disable import/no-dynamic-require */

const admin = require('firebase-admin');
const firebaseTools = require('firebase-tools');

const homedir = require('os').homedir();
const path = require('path');

const serviceAccount = require(path.join(homedir, 'service-accounts/firebase-admin.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://xtrctio-testing.firebaseio.com',
});

const deletePath = async (_path) => firebaseTools.firestore
  .delete(_path, {
    project: 'xtrctio-testing',
    recursive: true,
    yes: true,
    token: '1/YOvTR1H5-Z8W0GpUF338g7YuEnRrzQPpueXuQx3oLEc',
    timestampsInSnapshots: true,
  })
  .then(() => ({ path: _path }));

const db = admin.firestore();
db.settings({ timestampsInSnapshots: true });

module.exports = {
  db,
  auth: admin.auth(),
  deletePath,
};
