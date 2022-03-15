'use strict';
const dataStackUtils = require('@appveen/data.stack-utils');
let logger = global.logger;
if (process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) {
	dataStackUtils.kubeutil.check()
		.then(
			() => logger.info('Connection to Kubernetes API server successful!'),
			_e => {
				logger.error('ERROR :: Unable to connect to Kubernetes API server');
				logger.error(_e);
			});
}
function isK8sEnv() {
	return process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT;
}

const odpNS = process.env.DATA_STACK_NAMESPACE;
logger.info(`DATA_STACK_NAMESPACE :: ${process.env.DATA_STACK_NAMESPACE}`);
if (isK8sEnv() && !odpNS) throw new Error('DATA_STACK_NAMESPACE not found. Please check your configMap');

function get(_service) {
	if (isK8sEnv()) {
		if (_service == 'ne') return `http://ne.${odpNS}`;
		if (_service == 'sm') return `http://sm.${odpNS}`;
		if (_service == 'pm') return `http://pm.${odpNS}`;
		if (_service == 'user') return `http://user.${odpNS}`;
		if (_service == 'gw') return `http://gw.${odpNS}`;
	} else {
		if (_service == 'ne') return 'http://localhost:10010';
		if (_service == 'sm') return 'http://localhost:10003';
		if (_service == 'pm') return 'http://localhost:10011';
		if (_service == 'user') return 'http://localhost:10004';
		if (_service == 'gw') return 'http://localhost:9080';
	}
}

function isCosmosDB() {
	let val = process.env.COSMOS_DB;
	if (typeof val === 'boolean') return val;
	else if (typeof val === 'string') {
		return process.env.COSMOS_DB.toLowerCase() === 'true';
	} else {
		return false;
	}
}


module.exports = {
	baseUrlSM: get('sm') + '/sm',
	baseUrlNE: get('ne') + '/ne',
	baseUrlUSR: get('user') + '/rbac',
	mongoUrl: process.env.MONGO_AUTHOR_URL || 'mongodb://localhost',
	mongoAuthorDb: process.env.MONGO_AUTHOR_DBNAME || 'dataStackConfig',
	validationApi: get('user') + '/rbac/validate',
	isK8sEnv: isK8sEnv,
	isCosmosDB: isCosmosDB,
	logQueueName: 'systemService',
	odpNS: odpNS,
	streamingConfig: {
		url: process.env.STREAMING_HOST || 'nats://127.0.0.1:4222',
		user: process.env.STREAMING_USER || '',
		pass: process.env.STREAMING_PASS || '',
		// maxReconnectAttempts: process.env.STREAMING_RECONN_ATTEMPTS || 500,
		// reconnectTimeWait: process.env.STREAMING_RECONN_TIMEWAIT_MILLI || 500
		maxReconnectAttempts: process.env.STREAMING_RECONN_ATTEMPTS || 500,
		connectTimeout: 2000,
		stanMaxPingOut: process.env.STREAMING_RECONN_TIMEWAIT_MILLI || 500
	},
	mongoOptions: {
		numberOfRetries: process.env.MONGO_RECONN_TRIES,
		retryMiliSeconds: process.env.MONGO_RECONN_TIME_MILLI
	}
};