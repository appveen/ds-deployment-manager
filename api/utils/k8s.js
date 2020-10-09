const kubeutil = require('@appveen/odp-utils').kubeutil;
const logger = global.logger;
let release = process.env.RELEASE;

let dockerRegistryType = process.env.DOCKER_REGISTRY_TYPE ? process.env.DOCKER_REGISTRY_TYPE : '';
if (dockerRegistryType.length > 0) dockerRegistryType = dockerRegistryType.toUpperCase();

let dockerReg = process.env.DOCKER_REGISTRY_SERVER ? process.env.DOCKER_REGISTRY_SERVER : '';
if (dockerReg.length > 0 && !dockerReg.endsWith('/') && dockerRegistryType != 'ECR') dockerReg += '/';

var e = {};

e.deploymentCreate = (_schema) => {
	logger.info('Creating deployment ' + _schema.image.toLowerCase());
	let envVars = [];

	let dockerTag = `${dockerReg}${_schema.image.toLowerCase()}:${_schema.version}`;
	// Check if Docker registry type is ECR, change image into a docker tag of the repository
	if (dockerRegistryType == 'ECR') dockerTag = `${dockerReg}:${_schema.image.toLowerCase()}.${_schema.version}`;

	Object.keys(_schema.envVars).forEach(function (key) {
		envVars.push({ name: key, value: _schema.envVars[key] });
	});

	if (typeof _schema.options.terminationGracePeriodSeconds === 'string') {
		_schema.options.terminationGracePeriodSeconds = parseInt(_schema.options.terminationGracePeriodSeconds, 10);
	}
	logger.debug('terminationGracePeriodSeconds', _schema.options.terminationGracePeriodSeconds, _schema.options);
	let options = {
		livenessProbe: _schema.options.livenessProbe,
		readinessProbe: _schema.options.readinessProbe,
		terminationGracePeriodSeconds: _schema.options.terminationGracePeriodSeconds
	};
	// logger.info('ENV_VARS', envVars);
	// (_namespace, _name, _image, _port, _envVars)
	return kubeutil.deployment.createDeployment(
		_schema.namespace.toLowerCase().replace(/ /g, ''),
		_schema.name.toLowerCase(),
		dockerTag,
		_schema.port,
		envVars,
		options,
		release,
		_schema.volumeMounts)
		.then(_ => {
			logger.info('Creating deployment returned ' + _.statusCode);
			if (_.statusCode != 200 && _.statusCode != 202 && _.statusCode != 404) {
				let errorMsg = _ && _.body && _.body.message ? _.body.message : 'K8s API returned ' + _.statusCode;
				logger.error(errorMsg);
				return new Error(errorMsg);
			} return _;
		})
		.catch(_ => {
			logger.error('Error creating deployment');
			logger.debug(JSON.stringify(_));
			logger.error(_.message);
		});
};

e.deploymentUpdate = (_schema) => {
	let dockerTag = `${dockerReg}${_schema.image.toLowerCase()}:${_schema.version}`;
	// Check if Docker registry type is ECR, change image into a docker tag of the repository
	if (dockerRegistryType == 'ECR') dockerTag = `${dockerReg}:${_schema.image.toLowerCase()}.${_schema.version}`;

	let envVars = [];
	Object.keys(_schema.envVars).forEach(function (key) {
		envVars.push({ name: key, value: _schema.envVars[key] });
	});

	let options = {
		'livenessProbe': _schema.options.livenessProbe,
		'readinessProbe': _schema.options.readinessProbe,
		terminationGracePeriodSeconds: _schema.options.terminationGracePeriodSeconds
	};
	// (_namespace, _name, _image, _port, _envVars)
	let ns = _schema.namespace.toLowerCase().replace(/ /g, '');
	let deployName = _schema.name.toLowerCase();
	logger.debug({
		ns: ns,
		name: deployName,
		image: dockerTag,
		port: _schema.port,
		// envVars,
		options: JSON.stringify(options)
	});
	return kubeutil.deployment.updateDeployment(
		ns,
		deployName,
		dockerTag,
		_schema.port,
		envVars,
		options,
		_schema.volumeMounts)
		.then(_ => {
			if (_.statusCode != 200 && _.statusCode != 202 && _.statusCode != 404) {
				let errorMsg = _ && _.body && _.body.message ? _.body.message : 'K8s API returned ' + _.statusCode;
				logger.error(errorMsg);
				return new Error(errorMsg);
			} else {
				try {
					if (_.body.spec.replicas == 0) {
						return kubeutil.deployment.scaleDeployment(ns, deployName, 1)
							.then((_d) => {
								logger.debug('Scale deployment returned :: ' + JSON.stringify(_d));
								return _;
							});
					}
				} catch (err) {
					// do nothing
				}
				return _;
			}
		})
		.catch(_ => {
			logger.error('Error updating deployment');
			logger.debug(JSON.stringify(_));
			logger.error(_.message);
		});
};

e.deploymentDelete = (_schema) => {
	// (_namespace, _name)
	return kubeutil.deployment.deleteDeployment(
		_schema.namespace.toLowerCase().replace(/ /g, ''),
		_schema.name.toLowerCase())
		.then(_ => {
			if (_.statusCode != 200 && _.statusCode != 202 && _.statusCode != 404) {
				let errorMsg = _ && _.body && _.body.message ? _.body.message : 'K8s API returned ' + _.statusCode;
				logger.error(errorMsg);
				return new Error(errorMsg);
			} return _;
		})
		.catch(_ => {
			logger.error('Error deleting deployment');
			logger.debug(JSON.stringify(_));
			logger.error(_.message);
		});
};

e.serviceStart = (_schema) => {
	// (_namespace, _name, _port)
	logger.info('release is ', release);
	logger.info('Creating service ' + _schema.namespace.toLowerCase().replace(/ /g, '') + ' ' + _schema.name.toLowerCase() + ' ' + _schema.port);
	return kubeutil.service.createService(
		_schema.namespace.toLowerCase().replace(/ /g, ''),
		_schema.name.toLowerCase(),
		_schema.port,
		release)
		.then(_ => {
			logger.info('Create service return ' + _.statusCode);
			if (_.statusCode != 200 && _.statusCode != 202 && _.statusCode != 404) {
				let errorMsg = _ && _.body && _.body.message ? _.body.message : 'K8s API returned ' + _.statusCode;
				logger.error(errorMsg);
				return new Error(errorMsg);
			} return _;
		})
		.catch(_ => {
			logger.error('Error starting service');
			logger.debug(JSON.stringify(_));
			logger.error(_.message);
		});
};

e.serviceDelete = (_schema) => {
	// (_namespace, _name)
	logger.debug(_schema);
	return kubeutil.service.deleteService(
		_schema.namespace.toLowerCase().replace(/ /g, ''),
		_schema.name.toLowerCase())
		.then(_ => {
			if (_.statusCode != 200 && _.statusCode != 202 && _.statusCode != 404) {
				let errorMsg = _ && _.body && _.body.message ? _.body.message : 'K8s API returned ' + _.statusCode;
				logger.error(errorMsg);
				return new Error(errorMsg);
			} return _;
		})
		.catch(_ => {
			logger.error('Error deleting service');
			logger.debug(JSON.stringify(_));
			logger.error(_.message);
		});
};


module.exports = e;