'use strict';

/* eslint-disable import/no-dynamic-require */

const admin = require('firebase-admin');
const firebaseTools = require('firebase-tools');

const homedir = require('os').homedir();
const path = require('path');
const fs = require('fs').promises;

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
    token: (await fs.readFile(path.join(homedir, 'service-accounts/firebase-token'), 'utf8')).trim(),
  })
  .then(() => ({ path: _path }));

module.exports = {
  db: admin.firestore(),
  auth: admin.auth(),
  deletePath,
};
