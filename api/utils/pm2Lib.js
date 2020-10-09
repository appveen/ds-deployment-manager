let exec = require('child_process').exec;
let fs = require('fs');
const logger = global.logger;
var e = {};
var path = require('path');
e.init = (projectName) => {
	let filePath = path.resolve(process.cwd(), 'generatedDeployments', projectName);
	filePath = filePath.replace(/\\/g, '/');
	logger.info('Doing npm install......');
	let npm = null;
	logger.info('FilePath:' + filePath);
	
	if (fs.existsSync('Test/node_modules')) {
		logger.info('Sample node_modules folder found. Using that and skipping \'npm install\'.');
		npm = exec('cp -R Test/node_modules ' + filePath + '/', (err, stdout, stdErr) => {
			if (err) {
				return Promise.reject(new Error(stdErr));
			}
			else {
				logger.info('Node Modules Copied');
				return Promise.resolve(stdout);
			}
		});
	} else {
		npm = exec('npm install', {
			cwd: filePath
		});
		return new Promise((resolve, reject) => {
			npm.stdout.on('data', (data) => {
				logger.info('exec output ' + data);
				resolve(data);
			});
			npm.on('close', (data) => {
				logger.info('close ' + data);
			});
			npm.on('error', (err) => {
				logger.info('Err' + err);
				reject(err);
			});
		});
	}
};

var ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

e.generateRandomID = function (len) {
	var rtn = '';
	for (var i = 0; i < len; i++) {
		rtn += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
	}
	return rtn;
};

module.exports = e;