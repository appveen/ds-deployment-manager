const router = require('express').Router();

const controller = require('./deploymentController');

router.post('/deployment', controller.createDeployment);
router.delete('/deployment', controller.deleteDeployment);
router.post('/updateDeployment', controller.updateDeployment);
router.post('/repairDeployment', controller.repairDeployment);
router.post('/apiChange', controller.apiChange);
router.post('/kubedeploy', controller.kubeDeployCreate);
router.delete('/kubedeploy', controller.kubeDeployDelete);
router.post('/kubesvc', controller.kubeSvcCreate);
router.delete('/kubesvc', controller.kubeSvcDelete);
router.post('/scaleDeployment', controller.scaleDeployment);
router.get('/health', controller.health);
router.post('/generateImage', controller.createImage);



module.exports = router;