'use strict';
const pm2Lib = require('../utils/pm2Lib.js');
const docker = require('../utils/docker.js');
const k8s = require('../utils/k8s.js');
const fs = require('fs-extra');
// const deployUtil = require('../deploy/deploymentUtil');
const logger = global.logger;
const destroyDeploymentRetry = 5;
var e = {};

e.deployService = (_schema, _isUpdate, _oldData) => {
	return new Promise((resolve, reject) => {
		var startPromise = new Promise.resolve();
		startPromise.then(() => {
			if (process.env.ODPENV == 'K8s') {
				logger.info('Kubernetes environment detected');
				return docker.build(_schema)
					.then(() => logger.info('Docker image created for ' + _schema.image + ':' + _schema.version))
					.then(() => {
						if (_oldData) {
							logger.info('Deleting running deployment');
							return k8s.deploymentDelete(_oldData)
								.then(_r => {
									logger.debug('Response after deleting ' + JSON.stringify(_r));
									return k8s.serviceDelete(_oldData);
								})
								.then(_r => {
									logger.debug('Response after deleting ' + JSON.stringify(_r));
									return k8s.deploymentCreate(_schema);
								})
								.then(_r => {
									logger.debug('Response after creating ' + JSON.stringify(_r));
									return k8s.serviceStart(_schema);
								})
								.then(_r => {
									logger.debug('Response after starting service ' + JSON.stringify(_r));
									return docker.removeImage(_schema.image, _schema.version - 2);
								})
								.then(() => {
									logger.info('Removing old docker image for ' + _schema.image);
								})
								.catch(err => {
									logger.error(err);
								});
						} else if (_isUpdate) {
							logger.info('Updating running deployment');
							return k8s.deploymentUpdate(_schema)
								.then(_r => {
									logger.debug('Updating Deployment returned: ' + _r.statusCode);
									if (_r.statusCode == 404) {
										logger.info('Deployment instance does not exist. Creating a new one.');
										return k8s.deploymentCreate(_schema)
											.then(() => k8s.serviceStart(_schema));
									}
								})
								.then(() => logger.info('Deployment update in-progress for ' + _schema.image))
								.then(() => docker.removeImage(_schema.image, _schema.version - 2))
								.then(() => logger.info('Removing old docker image for ' + _schema.image))
								.catch(_e => logger.error(_e));
						} else {
							logger.info('Creating deployment');
							return k8s.deploymentCreate(_schema)
								.then(() => logger.info('Deployment created for ' + _schema.image))
								.then(() => k8s.serviceStart(_schema))
								.then(() => logger.info('Service created for ' + _schema.image))
								.catch(_e => logger.error(_e));
						}
					});
			} else {
				logger.info('Local environment detected.');
				return pm2Process(_schema.image);
			}
		})
			.then((status) => {
				logger.info('Environment is:' + process.env.ODPENV);

				if (process.env.ODPENV == 'K8s') {
					resolve();
				} else {
					if (status === 'online')
						resolve();
					else {
						throw new Error('Status is ' + status ? status : 'error');
					}
				}
			})
			.catch(e => reject(e));
	});
};
e.destroyDeploymentCall = (config, isRepair) => {
	return destroyDeployment(0, config, isRepair);
};

function destroyDeployment(count, config, isRepair) {
	return new Promise((resolve, reject) => {
		logger.info('Destroy Attempt ' + count);
		// logger.debug(config);
		logger.debug(config.image);
		var doc = config;
		var id = config.image;
		var startPromise = new Promise.resolve();
		startPromise.then(() => {
			if (process.env.ODPENV == 'K8s') {
				logger.info('Environment is Kube8');
				return k8s.deploymentDelete(doc)
					.then(() => logger.info('Deployment deleted for ' + id))
					.then(() => k8s.serviceDelete(doc))
					.then(() => logger.info('Service deleted for ' + id))
					.catch(_e => logger.error(_e));
			} else {
				resolve();
			}
		}).then(() => {
			if (!isRepair)
				destroyDeploymentsFolder(id);
		}).then(() => resolve())
			.catch(err => {
				logger.error(err);
				if (count >= destroyDeploymentRetry)
					throw err;
				else {
					logger.info('Retrying Destruction!!!');
					return destroyDeployment(count + 1, doc);
				}
			})
			.catch(e => {
				logger.error(e);
				reject();
			});
	});
}


function destroyDeploymentsFolder(_id) {
	logger.info('Deployments Folders Deleted');
	return fs.removeSync(process.cwd() + '/generatedDeployments/' + _id);
}

function pm2Process(_id) {
	return Promise.resolve()
		.then(() => pm2Lib.init(_id));
}

module.exports = e;