module.exports = {
	rules: {
		'use-arangodb-query-with-aql': require('./lib/rules/use-arangodb-query-with-aql'),
	},
	configs: {
		all: {
			rules: {
				'confichannel/use-arangodb-query-with-aql': 'error'
			},
		},
	},
};
