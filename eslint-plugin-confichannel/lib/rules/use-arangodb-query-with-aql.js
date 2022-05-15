'use strict';

module.exports = {
	meta: {
		messages: {
			arangoDbQueryMustUseAql: 'Arango DB queries must use aql template string',
		},
	},
	create: function (context) {
		return {
			CallExpression: function (node) {
				if (
					node &&
					node.callee &&
					node.callee.property &&
					node.callee.property.type === 'Identifier' &&
					node.callee.property.name === 'query' &&
					Array.isArray(node.arguments) &&
					node.arguments.length >= 1
				) {
					if (node.arguments[0].type !== 'TaggedTemplateExpression') {
						context.report({ node, messageId: 'arangoDbQueryMustUseAql' });
						return;
					}
					if (!node.arguments[0].tag || node.arguments[0].tag.name !== 'aql') {
						context.report({ node, messageId: 'arangoDbQueryMustUseAql' });
						return;
					}
				}
			},
		};
	},
};
