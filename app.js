'use strict';
const utils = require('@appveen/utils');
const express = require('express');
const fileUpload = require('express-fileupload');
const bluebird = require('bluebird');
const dataStackUtils = require('@appveen/data.stack-utils');
const version = require('./package.json').version;

if (process.env.LOG_LEVEL == 'DB_DEBUG') { process.env.LOG_LEVEL = 'debug'; }
const log4js = utils.logger.getLogger;


const loggerName = (process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) ? `[${process.env.DATA_STACK_NAMESPACE}] [${process.env.HOSTNAME}] [DM ${version}]` : `[DM ${version}]`;
const logger = log4js.getLogger(loggerName);
const timeOut = process.env.API_REQUEST_TIMEOUT || 120;

global.Promise = bluebird;
global.serverStartTime = new Date();
global.logger = logger;

const conf = require('./config/config.js');
const queueMgmt = require('./api/utils/queueMgmt');

const app = express();
const logMiddleware = utils.logMiddleware.getLogMiddleware(logger);
const masking = [
	{ url: '/dm/updateDeployment', path: ['deployment'] },
	{ url: '/dm/deployment', path: ['deployment'] }
];
const logToQueue = dataStackUtils.logToQueue('dep', queueMgmt.client, conf.logQueueName, 'deploymentManager.logs', masking);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(logMiddleware);
app.use(logToQueue);

app.use('/dm', require('./api/controllers/deployment.controller'));

if (conf.isK8sEnv()) {
	logger.info('*** K8s environment detected ***');
	logger.info('Image version: ' + process.env.IMAGE_TAG);
} else {
	logger.info('*** Local environment detected ***');
}

const port = process.env.PORT || 10709;
const server = app.listen(port, (err) => {
	if (!err) {
		logger.info('Server started on port ' + port);
		app.use((err, req, res, next) => {
			if (err) {
				if (!res.headersSent)
					return res.status(500).json({ message: err.message });
				return;
			}
			next();
		});
	} else
		logger.error(err);
});
server.setTimeout(parseInt(timeOut) * 1000);

// Running cron job
require('./api/utils/cron/imageCleanCron')();
