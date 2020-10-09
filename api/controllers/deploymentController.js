'use strict';
const depMan = require('./deploymentManager.js');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const kubeutil = require('@appveen/odp-utils').kubeutil;
let exec = require('child_process').exec;
// const docker = require('../utils/docker.js');
const k8s = require('../utils/k8s.js');
var path = require('path');
const logger = global.logger;
let customControllers = {};
let envConfig = require('../../config/config');

customControllers.createDeployment = (_req, _res) => {
	logger.debug('Inside :: deploymentController.createDeployment()');
	var json = _req.body.deployment;
	var config = JSON.parse(json);
	if (envConfig.isK8sEnv() && config.image) config.image = `${envConfig.odpNS}-${config.image}`;

	var rootFolder = process.cwd() + '/generatedDeployments';
	logger.debug(`root folder :: ${rootFolder}`);
	var imageFolder = rootFolder + '/' + config.image;
	logger.debug(`image folder :: ${imageFolder}`);

	if (!fs.existsSync(rootFolder)) {
		logger.info(rootFolder + ' does not exist');
		fs.mkdirSync(rootFolder);
	}
	if (!fs.existsSync(imageFolder)) {
		logger.info(imageFolder + ' does not exist');
		fs.mkdirSync(imageFolder);
	}

	logger.debug('Uploading :: ' + _req.files.file.name);
	logger.debug(`Output file location - ${imageFolder}/${_req.files.file.name}`);
	var sampleFile = _req.files.file;
	return sampleFile.mv(imageFolder + '/' + _req.files.file.name)
		.then(() => {
			logger.info(`File upload - ${imageFolder}/${_req.files.file.name} - success`);
			var zip = new AdmZip(imageFolder + '/' + _req.files.file.name);
			zip.extractAllToAsync(imageFolder + '/', true, function (err) {
				if (err) {
					logger.error(`Unable to extract file ${imageFolder}/${_req.files.file.name}`);
					logger.error(err);
					_res.status(500).json({
						message: 'Failed to extract file.'
					});
				} else {
					logger.debug(` Extracted file - ${imageFolder}/${_req.files.file.name}`);
					config.path = imageFolder;
					_res.status(202).json({
						message: 'Deployment Queued'
					});
					return depMan.deployService(config, false)
						.then(() => {
							logger.debug('Deployment Success');
							fs.removeSync(imageFolder);
						})
						.catch((err) => {
							logger.error('Deployment Failed!');
							logger.error(err);
							// _res.status(500).json({
							// 	message: 'Deployment Failure'
							// });
						});
				}
			});
		})
		.catch((err) => {
			logger.error(err);
			_res.status(500).json({
				message: 'Deployment Failure'
			});
		});
};

customControllers.createImage = (_req, _res) => {
	var json = _req.body.deployment;
	var config = JSON.parse(json);
	if (envConfig.isK8sEnv() && config.image) config.image = `${envConfig.odpNS}-${config.image}`;
	var dir1 = process.cwd() + '/generatedImages';
	var dir2 = dir1 + '/' + config.image;
	if (!fs.existsSync(dir1)) {
		logger.info(dir1 + ' does not exist');
		fs.mkdirSync(dir1);
	}
	if (!fs.existsSync(dir2)) {
		logger.info(dir2 + ' does not exist');
		fs.mkdirSync(dir2);
	}

	logger.info('Uploading: ' + _req.files.file.name);
	var sampleFile = _req.files.file;
	logger.info('file is +++++++++++', sampleFile);
	sampleFile.mv(dir2 + '/' + _req.files.file.name)
		.then(() => {
			logger.info('Upload Success');
			var zip = new AdmZip(dir2 + '/' + _req.files.file.name);
			zip.extractAllToAsync(dir2 + '/', true, function (err) {
				if (err) {
					logger.info('extraction Failure');
					_res.status(500).json({
						message: 'Deployment Failure'
					});
				} else {
					logger.info('File Unzipped!');
					config.path = dir2;
					let location = path.resolve(process.cwd(), config.path).replace(/\\/g, '/');
					let builder = exec('docker build -t ' + config.image.toLowerCase() + ':' + config.version + ' .', {
						cwd: location
					});
					return new Promise((resolve, reject) => {
						builder.stdout.on('data', (data) => {
							logger.info('exec output ' + data);
						});
						builder.on('close', () => {
							logger.info('Docker image created for ' + config.image + ':' + config.version);
							resolve();
							let downloader = exec('docker save ' + config.image + ':' + config.version + '| bzip2 >' + config.image + '_' + config.version + '.tar.bz2');
							return new Promise((resolve, reject) => {
								downloader.stdout.on('data', (data) => {
									logger.debug('exec output ' + data);
								});
								downloader.on('close', () => {
									logger.info('bz2 file created. Clean Up Starting');
									resolve();
									let command = 'docker rmi ' + config.image + ':' + config.version + ';rm -rf ' + location;
									let cleaner = exec(command);
									return new Promise((resolve, reject) => {
										cleaner.stdout.on('data', (data) => {
											logger.debug('exec output ' + data);

										});
										cleaner.on('close', () => {
											logger.info('Cleanup Success. Downloading File');
											resolve();
											_res.status(200).download(config.image + '_' + config.version + '.tar.bz2');
										});
										cleaner.on('error', (err) => {
											logger.info('Err' + err);
											reject(err);
										});
									});
								});
								downloader.on('error', (err) => {
									logger.info('Err' + err);
									reject(err);
								});
							});
						});
						builder.on('error', (err) => {
							logger.info('Err' + err);
							reject(err);
						});
					})
						//******************************************************** */
						.catch(() => {
							logger.error('Image Creation Failure ');
							_res.status(500).json({
								message: 'Image Creation Failure'
							});
						});
				}
			});
		})
		.catch(() => {
			logger.error('Image Creation Failure ');
			_res.status(500).json({
				message: 'Image Creation Failure'
			});
		});
};

customControllers.deleteDeployment = (_req, _res) => {
	var json = _req.body.deployment;
	var config = JSON.parse(json);
	if (envConfig.isK8sEnv() && config.image) config.image = `${envConfig.odpNS}-${config.image}`;
	logger.info('Destroying Deployment...');
	depMan.destroyDeploymentCall(config, false)
		.then((data) => {
			logger.debug('Destroy Deployment Data - ', data);
			_res.status(200).json({
				'message': data
			});
		}).catch(err => {
			logger.error(err);
			_res.status(500).json({
				'message': err
			});
		});
};

customControllers.updateDeployment = (_req, _res) => {
	logger.debug('Inside :: deploymentController.updateDeployment()');
	var json = _req.body.deployment;
	var config = JSON.parse(json);
	if (envConfig.isK8sEnv() && config.image) config.image = `${envConfig.odpNS}-${config.image}`;
	var rootFolder = process.cwd().replace(/\\/g, '/') + '/generatedDeployments';
	logger.debug(`root folder :: ${rootFolder}`);
	var imageFolder = rootFolder + '/' + config.image;
	logger.debug(`image folder :: ${imageFolder}`);
	if (!fs.existsSync(rootFolder)) {
		logger.info(rootFolder + ' does not exist');
		fs.mkdirSync(rootFolder);
	}
	if (!fs.existsSync(imageFolder)) {
		logger.info(imageFolder + ' does not exist');
		fs.mkdirSync(imageFolder);
	}

	logger.debug('Uploading :: ' + _req.files.file.name);
	logger.debug(`Output file location - ${imageFolder}/${_req.files.file.name}`);
	logger.info('Uploading: ' + _req.files.file.name);
	var sampleFile = _req.files.file;
	return sampleFile.mv(imageFolder + '/' + _req.files.file.name)
		.then(() => {
			logger.info('Upload Success');
			var zip = new AdmZip(imageFolder + '/' + _req.files.file.name);
			zip.extractAllTo(imageFolder + '/', true);
			logger.info('File Unzipped!');
		})
		.then(() => {
			config.path = imageFolder;
			_res.status(202).json({
				message: 'Deployment Queued'
			});
			return depMan.deployService(config, true);
		})
		.then(() => {
			logger.debug('Deployment success');
			fs.removeSync(imageFolder);
		})
		.catch((err) => {
			logger.error('Deploment failed!');
			logger.error(err);
			if(!_res.headersSent){
				_res.status(500).json({
					message: 'Deployment Failure'
				});
			}
		});
};

customControllers.apiChange = (_req, _res) => {
	var json = _req.body.deployment;
	var config = JSON.parse(json);
	if (envConfig.isK8sEnv() && config.image) config.image = `${envConfig.odpNS}-${config.image}`;
	var oldJson = _req.body.oldDeployment;
	var oldConfig = JSON.parse(oldJson);
	oldConfig.namespace = config.namespace;
	if (envConfig.isK8sEnv() && config.image) oldConfig.image = `${envConfig.odpNS}-${config.image}`;
	var dir1 = process.cwd().replace(/\\/g, '/') + '/generatedDeployments';
	var dir2 = dir1 + '/' + config.image;
	if (!fs.existsSync(dir1)) {
		logger.info(dir1 + ' does not exist');
		fs.mkdirSync(dir1);
	}
	if (!fs.existsSync(dir2)) {
		logger.info(dir2 + ' does not exist');
		fs.mkdirSync(dir2);
	}
	logger.info('Uploading: ' + _req.files.file.name);
	var sampleFile = _req.files.file;
	sampleFile.mv(dir2 + '/' + _req.files.file.name)
		.then(() => {
			logger.info('Upload Success');
			var zip = new AdmZip(dir2 + '/' + _req.files.file.name);
			zip.extractAllTo(dir2 + '/', true);
			logger.info('File Unzipped!');
		})
		.then(() => {
			config.path = dir2;
			depMan.deployService(config, false, oldConfig)
				.then(() => {
					_res.status(200).json({
						message: 'Deployment Success'
					});
				})
				.catch(() => {
					_res.status(500).json({
						message: 'Deployment Failure'
					});
				});
		}).catch(() => {
			_res.status(500).json({
				message: 'Deployment Failure'
			});
		});
};

customControllers.repairDeployment = (_req, _res) => {
	var json = _req.body.deployment;
	var config = JSON.parse(json);
	if (envConfig.isK8sEnv() && config.image) config.image = `${envConfig.odpNS}-${config.image}`;
	var dir1 = process.cwd().replace(/\\/g, '/') + '/generatedDeployments';
	var dir2 = dir1 + '/' + config.image;
	_res.status(202).json({
		message: 'Repair Process Started.....'
	});
	depMan.destroyDeploymentCall(config, true)
		.then(_d => {
			logger.info('Deployment deleted');
			logger.debug(_d);
			config.path = dir2 + '/' + config.image;
			return depMan.deployService(config, false);
		})
		.catch(err => {
			logger.error(err);
			if (!_res.headersSent) {
				_res.status(500).json({
					message: err
				});
			}
		});
};

customControllers.kubeDeployCreate = (_req, _res) => {
	var json = _req.body.deployment;
	var schema = JSON.parse(json);
	k8s.deploymentCreate(schema).then((data) => {
		_res.status(200).json({
			'message': data
		});
	}).catch(err => {
		logger.error(err);
		_res.status(500).json({
			'message': err
		});
	});
};

customControllers.kubeDeployDelete = (_req, _res) => {
	var json = _req.body.deployment;
	var schema = JSON.parse(json);
	k8s.deploymentDelete(schema).then((data) => {
		_res.status(200).json({
			'message': data
		});
	}).catch(err => {
		logger.error(err);
		_res.status(500).json({
			'message': err
		});
	});
};

customControllers.kubeSvcCreate = (_req, _res) => {
	var json = _req.body.deployment;
	var schema = JSON.parse(json);
	k8s.serviceStart(schema).then((data) => {
		_res.status(200).json({
			'message': data
		});
	}).catch(err => {
		logger.error(err);
		_res.status(500).json({
			'message': err
		});
	});
};

customControllers.kubeSvcDelete = (_req, _res) => {
	var json = _req.body.deployment;
	var schema = JSON.parse(json);
	k8s.serviceDelete(schema).then((data) => {
		_res.status(200).json({
			'message': data
		});
	}).catch(err => {
		logger.error(err);
		_res.status(500).json({
			'message': err
		});
	});
};

customControllers.scaleDeployment = (_req, _res) => {
	var app = _req.body.namespace;
	var api = _req.body.name;
	var instances = _req.body.instances;
	kubeutil.deployment.scaleDeployment(app.toLowerCase().replace(/ /g, ''), api.toLowerCase(), 0)
		.then(_d => {
			logger.debug(_d);
			kubeutil.deployment.scaleDeployment(app.toLowerCase().replace(/ /g, ''), api.toLowerCase(), instances)
				.then(_d => {
					_res.status(_d.statusCode);
				}).catch(err => {
					logger.error(err);
				});
		}).catch(err => {
			logger.error(err);
		});
};

customControllers.health = function (req, res) {
	res.end();
};

module.exports = {
	createDeployment: customControllers.createDeployment,
	deleteDeployment: customControllers.deleteDeployment,
	updateDeployment: customControllers.updateDeployment,
	apiChange: customControllers.apiChange,
	repairDeployment: customControllers.repairDeployment,
	kubeDeployCreate: customControllers.kubeDeployCreate,
	kubeDeployDelete: customControllers.kubeDeployDelete,
	kubeSvcCreate: customControllers.kubeSvcCreate,
	kubeSvcDelete: customControllers.kubeSvcDelete,
	scaleDeployment: customControllers.scaleDeployment,
	health: customControllers.health,
	createImage: customControllers.createImage
};