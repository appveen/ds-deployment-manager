'use strict';
const fs = require('fs');
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

function isDockerEnv() {
	return fs.existsSync('/.dockerenv');
}

function getHostOSBasedLocation() {
	if (process.env.PLATFORM == 'NIX') return 'localhost';
	return 'host.docker.internal';
}

function get(_service) {
	if (isK8sEnv()) {
		if (_service == 'ne') return 'http://ne.capiot';
		if (_service == 'sm') return 'http://sm.capiot';
		if (_service == 'pm') return 'http://pm.capiot';
		if (_service == 'user') return 'http://user.capiot';
		if (_service == 'gw') return 'http://gw.capiot';
		if (_service == 'wf') return 'http://wf.capiot';
		if (_service == 'sec') return 'http://sec.capiot';
	} else if (fs.existsSync('/.dockerenv')) {
		if (_service == 'ne') return 'http://' + getHostOSBasedLocation() + ':10010';
		if (_service == 'sm') return 'http://' + getHostOSBasedLocation() + ':10003';
		if (_service == 'pm') return 'http://' + getHostOSBasedLocation() + ':10011';
		if (_service == 'user') return 'http://' + getHostOSBasedLocation() + ':10004';
		if (_service == 'gw') return 'http://' + getHostOSBasedLocation() + ':9080';
		if (_service == 'wf') return 'http://' + getHostOSBasedLocation() + ':10006';
		if (_service == 'sec') return 'http://' + getHostOSBasedLocation() + ':10007';
	} else {
		if (_service == 'ne') return 'http://localhost:10010';
		if (_service == 'sm') return 'http://localhost:10003';
		if (_service == 'pm') return 'http://localhost:10011';
		if (_service == 'user') return 'http://localhost:10004';
		if (_service == 'gw') return 'http://localhost:9080';
		if (_service == 'wf') return 'http://localhost:10006';
		if (_service == 'sec') return 'http://localhost:10007';
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
	baseUrlWF: get('wf') + '/workflow',
	baseUrlSEC: get('sec') + '/sec',
	mongoUrl: process.env.MONGO_AUTHOR_URL || 'mongodb://localhost',
	mongoAuthorDb: process.env.MONGO_AUTHOR_DBNAME || 'odpConfig',
	validationApi: get('user') + '/rbac/validate',
	isK8sEnv: isK8sEnv,
	isDockerEnv: isDockerEnv,
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