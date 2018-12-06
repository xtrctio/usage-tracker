'use strict';

const { utils } = require('@xtrctio/common');

module.exports = {
  redis: {
    host: utils.getProcessEnv('REDIS_HOST'),
    port: utils.getProcessEnv('REDIS_PORT'),
  },
};
