let config = require('../../config/config');

var clientId = process.env.HOSTNAME || 'DM';

var client = require('@appveen/data.stack-utils').streaming.init(
	process.env.STREAMING_CHANNEL || 'datastack-cluster',
	clientId,
	config.streamingConfig
);

module.exports = {
	client: client
};