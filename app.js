'use strict';
const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');
const swaggerTools = require('swagger-tools');
const express = require('express');
const bodyParser = require('body-parser');
if (process.env.LOG_LEVEL == 'DB_DEBUG') { process.env.LOG_LEVEL = 'debug'; }
const utils = require('@appveen/utils');
const log4js = utils.logger.getLogger;
const loggerName = process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT && process.env.ODPENV == 'K8s' ? `[${process.env.DATA_STACK_NAMESPACE}][${process.env.HOSTNAME}]` : '[deploymentManager]';
const logger = log4js.getLogger(loggerName);
const bluebird = require('bluebird');
const fileUpload = require('express-fileupload');
let timeOut = process.env.API_REQUEST_TIMEOUT || 120;
global.Promise = bluebird;
global.serverStartTime = new Date();
global.logger = logger;
const conf = require('./config/config.js');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());
app.use(bodyParser());
var logMiddleware = utils.logMiddleware.getLogMiddleware(logger);
app.use(logMiddleware);

let odputils = require('@appveen/odp-utils');
let queueMgmt = require('./api/utils/queueMgmt');

let masking = [
	{ url: '/dm/updateDeployment', path: ['deployment'] },
	{ url: '/dm/deployment', path: ['deployment'] }
];
let logToQueue = odputils.logToQueue('dep', queueMgmt.client, conf.logQueueName, 'deploymentManager.logs', masking);
app.use(logToQueue);

if (conf.isK8sEnv()) {
	logger.info('*** K8s environment detected ***');
	logger.info('Image version: ' + process.env.IMAGE_TAG);
} else if (fs.existsSync('/.dockerenv')) {
	logger.info('*** Docker environment detected ***');
} else {
	logger.info('*** Local environment detected ***');
}

// swaggerRouter configuration
var options = {
	swaggerUi: path.join(__dirname, '/swagger.json'),
	controllers: path.join(__dirname, './api/controllers'),
	useStubs: process.env.NODE_ENV === 'development' // Conditionally turn on stubs (mock mode)
};

// The Swagger document (require it, build it programmatically, fetch it from a URL, ...)
var spec = fs.readFileSync(path.join(__dirname, 'api/swagger/swagger.yaml'), 'utf8');
var swaggerDoc = jsyaml.safeLoad(spec);

swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {

	// Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
	app.use(middleware.swaggerMetadata());

	// Validate Swagger requests
	app.use(middleware.swaggerValidator());

	// Route validated requests to appropriate controller
	app.use(middleware.swaggerRouter(options));

	// Serve the Swagger documents and Swagger UI
	// app.use(middleware.swaggerUi());

	// Start the server
	var port = process.env.PORT || 10709;
	var server = app.listen(port, (err) => {
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
});

// Running cron job
require('./api/utils/cron/imageCleanCron')();
