
'use strict';

const _ = require('lodash');


const deploymentController = require('./deploymentController.js');

// var exports = {};

// exports.createDeployment = deploymentController.createDeployment;
// exports.deleteDeployment = deploymentController.deleteDeployment;
// exports.updateDeployment = deploymentController.updateDeployment;
// exports.apiChange = deploymentController.apiChange;
// exports.repairDeployment = deploymentController.repairDeployment;
// exports.kubeDeployCreate = deploymentController.kubeDeployCreate;
// exports.kubeDeployDelete = deploymentController.kubeDeployDelete;
// exports.kubeSvcCreate = deploymentController.kubeSvcCreate;
// exports.kubeSvcDelete = deploymentController.kubeSvcDelete;
// exports.scaleDeployment = deploymentController.scaleDeployment;
// exports.health = deploymentController.health;
// exports.createImage = deploymentController.createImage;
// module.exports = exports;


const router = require('express').Router();


router.post('/deployment', mapSwaggerParams, deploymentController.createDeployment);
router.delete('/deployment', mapSwaggerParams, deploymentController.deleteDeployment);
router.post('/updateDeployment', mapSwaggerParams, deploymentController.updateDeployment);
router.post('/repairDeployment', mapSwaggerParams, deploymentController.repairDeployment);
router.post('/apiChange', mapSwaggerParams, deploymentController.apiChange);
router.post('/kubedeploy', mapSwaggerParams, deploymentController.kubeDeployCreate);
router.delete('/kubedeploy', mapSwaggerParams, deploymentController.kubeDeployDelete);
router.post('/kubesvc', mapSwaggerParams, deploymentController.kubeSvcCreate);
router.delete('/kubesvc', mapSwaggerParams, deploymentController.kubeSvcDelete);
router.post('/scaleDeployment', mapSwaggerParams, deploymentController.scaleDeployment);
router.get('/health', mapSwaggerParams, deploymentController.health);
router.post('/generateImage', mapSwaggerParams, deploymentController.createImage);


module.exports = router;


function mapSwaggerParams(req, res, next) {
	const temp = {};
	_.merge(temp, req.params, req.query);
	const params = {};
	// Object.assign(params, req.params, req.query);
	Object.keys(temp).forEach(key => {
		params[key] = { value: temp[key] };
	});
	// logger.debug(req.params, req.query, params);
	req.swagger = {
		params
	};
	next();
}