'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rule = require('../../../lib/rules/use-arangodb-query-with-aql');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const RuleTester = require('eslint').RuleTester;

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2016 } });
ruleTester.run('use-arangodb-query-with-aql', rule, {
	valid: ['this.db.query(aql`FOR doc IN docs RETURN doc`);'],
	invalid: [
		{
			code: 'this.db.query(`FOR doc IN docs RETURN doc`);',
			errors: [{ messageId: 'arangoDbQueryMustUseAql' }],
		},
	],
});
