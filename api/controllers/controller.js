
'use strict';

const deploymentController = require('./deploymentController.js');

var exports = {};

exports.createDeployment = deploymentController.createDeployment;
exports.deleteDeployment = deploymentController.deleteDeployment;
exports.updateDeployment = deploymentController.updateDeployment;
exports.apiChange = deploymentController.apiChange;
exports.repairDeployment = deploymentController.repairDeployment;
exports.kubeDeployCreate = deploymentController.kubeDeployCreate;
exports.kubeDeployDelete = deploymentController.kubeDeployDelete;
exports.kubeSvcCreate = deploymentController.kubeSvcCreate;
exports.kubeSvcDelete = deploymentController.kubeSvcDelete;
exports.scaleDeployment = deploymentController.scaleDeployment;
exports.health = deploymentController.health;
exports.createImage = deploymentController.createImage;
module.exports = exports;