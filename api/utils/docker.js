let exec = require('child_process').exec;
const logger = global.logger;
var e = {};
var path = require('path');

function parseBoolean(val) {
	if (typeof val === 'boolean') return val;
	else if (typeof val === 'string') {
		return val.toLowerCase() === 'true';
	} else {
		return false;
	}
}

let containerAuthRequired = false;

let dockerRegistryType = process.env.DOCKER_REGISTRY_TYPE ? process.env.DOCKER_REGISTRY_TYPE : '';
if (dockerRegistryType.length > 0) dockerRegistryType = dockerRegistryType.toUpperCase();

let dockerReg = process.env.DOCKER_REGISTRY_SERVER ? process.env.DOCKER_REGISTRY_SERVER : '';
if (dockerReg.length > 0 && !dockerReg.endsWith('/') && dockerRegistryType != 'ECR' ) dockerReg += '/';

let CONTAINER_ENGINE = process.env.DOCKER_CONTAINER_ENGINE ? process.env.DOCKER_CONTAINER_ENGINE : 'docker';
logger.info(`CONTAINER_ENGINE :: ${CONTAINER_ENGINE}`);

let CONTAINER_ENGINE_TLS_VERIFY = parseBoolean(process.env.DOCKER_CONTAINER_ENGINE_TLS_VERIFY);
logger.info(`CONTAINER_ENGINE_TLS_VERIFY :: ${CONTAINER_ENGINE_TLS_VERIFY}`);

let CONTAINER_FORMAT = process.env.DOCKER_CONTAINER_FORMAT ? process.env.DOCKER_CONTAINER_FORMAT : 'v2s2';
logger.info(`CONTAINER_FORMAT :: ${CONTAINER_FORMAT}`);


function execCommand(cmd, errMsg) {
	logger.debug(`Executing command: ${cmd}`);
	let command = exec(cmd);
	return new Promise((resolve, reject) => {
		command.stdout.on('data', (data) => {
			logger.debug('data ' + data);
		});
		command.on('close', (data) => {
			logger.debug('close ' + data);
			if (data == '0') return resolve(data);
			logger.error('Command execution failed');
			logger.error(data);
			reject(new Error('Command execution failed :' + data));
		});
		command.on('error', (err) => {
			logger.error(err);
			reject(new Error(errMsg));
		});
	});
}

function doDockerLogin(){
	let dockerLoginCmd = null;
	if (process.env.DOCKER_USER && process.env.DOCKER_PASSWORD && process.env.DOCKER_REGISTRY_SERVER) {
		logger.debug('Generic container registry with username and password. Attempting to login');
		dockerLoginCmd = `${CONTAINER_ENGINE} login -u ${process.env.DOCKER_USER} -p ${process.env.DOCKER_PASSWORD} ${process.env.DOCKER_REGISTRY_SERVER}`;
	} else if (dockerRegistryType == 'GCR') {
		logger.debug('Container registry type detected as GCR. Logging into GCR');
		dockerLoginCmd = `cat /app/gcr/keyfile.json | ${CONTAINER_ENGINE} login -u _json_key --password-stdin ${process.env.DOCKER_REGISTRY_SERVER}`;
	} else if (dockerRegistryType == 'ECR') {
		logger.debug('Container registry type detected as ECR. Logging into GCR');
		dockerLoginCmd = `aws ecr get-login --no-include-email --region ${process.env.AWS_DEFAULT_REGION} | sed 's/docker/${CONTAINER_ENGINE}/' | sh `;
	}
	if (dockerLoginCmd != null) {
		logger.debug(dockerLoginCmd);
		if (CONTAINER_ENGINE === 'podman') {
			containerAuthRequired = true;
			dockerLoginCmd += ` --tls-verify=${CONTAINER_ENGINE_TLS_VERIFY} --authfile=/app/generatedDeployments/auth.js`;
		}
		return execCommand(dockerLoginCmd, 'Container login failed.');
	}
	return Promise.resolve();
}

e.build = (_schema) => {
	logger.debug('In Docker Build');
	logger.debug(__dirname);
	let location = path.resolve(process.cwd(), _schema.path);
	logger.debug('CWD :: ' + process.cwd());
	logger.debug('Location :: ' + location);
	let dockerTag = `${dockerReg}${_schema.image.toLowerCase()}:${_schema.version}`;
	// Check if Docker registry type is ECR, change image into a docker tag of the repository
	if(dockerRegistryType == 'ECR') dockerTag = `${dockerReg}:${_schema.image.toLowerCase()}.${_schema.version}`;
	logger.info(`Image tag :: ${dockerTag}`);
	return doDockerLogin()
		.then(() => {
			let command = `cd ${location}; ${CONTAINER_ENGINE} build -t ${dockerTag} .`;
			if (CONTAINER_ENGINE === 'podman') command += ` --format=${CONTAINER_FORMAT} --tls-verify=${CONTAINER_ENGINE_TLS_VERIFY}`;
			if (containerAuthRequired) command += ' --authfile=/app/generatedDeployments/auth.js';
			logger.debug('Command - ', command);
			return execCommand(command, `Error budiling ${CONTAINER_ENGINE} image :: ${dockerTag}`);
		})
		.then((_r) => {
			if (dockerReg.length == 0 && CONTAINER_ENGINE == 'podman') {
				let errMsg = `${CONTAINER_ENGINE} requires a container registry`;
				logger.error(errMsg);
				return Promise.reject(errMsg);
			}
			if (dockerReg.length > 0) {
				logger.debug('Push image!');
				let command = `${CONTAINER_ENGINE} push ${dockerTag}`;
				if (CONTAINER_ENGINE === 'podman') command += ` --tls-verify=${CONTAINER_ENGINE_TLS_VERIFY}`;
				logger.debug('Command - ', command);
				return execCommand(command, `Error pushing image to ${CONTAINER_ENGINE} registry :: ${dockerTag}`);
			}
			return Promise.resolve(_r);
		});
};

e.removeImage = (_imageName, _version) => {
	if(CONTAINER_ENGINE === 'podman') return Promise.resolve();
	let dockerTag = `${_imageName.toLowerCase()}:${_version}`;
	logger.debug(`Local tag : ${dockerTag}`);
  
	let remoteDockerTag = `${dockerReg}${_imageName.toLowerCase()}:${_version}`;
	if(dockerRegistryType == 'ECR') remoteDockerTag = `${dockerReg}:${_imageName.toLowerCase()}.${_version}`;
	logger.debug(`Remote tag : ${remoteDockerTag}`);
	
	logger.info(`Removing image :: ${dockerTag}`);
	let command = `${CONTAINER_ENGINE} rmi ${dockerTag}`;
	if (dockerReg.length > 0) command += `; ${CONTAINER_ENGINE} rmi ${remoteDockerTag}`;
	logger.debug(`Cleanup command :: ${command}`);
	return exec(command, (_err, _stdout, _stderr) => {
		if (_err) {
			logger.warn(`ERROR executing :: ${command}`);
			logger.warn(_stderr);
			if (_stderr.indexOf('No such image') == -1) {
				logger.error(_err);
				return;
			}
		}
		logger.info(`SUCCESS :: ${command}`);
		logger.debug(_stdout);
	});
};

module.exports = e;