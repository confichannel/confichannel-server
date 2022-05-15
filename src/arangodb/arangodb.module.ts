import { DynamicModule, Module, Provider } from '@nestjs/common';
import { Database } from 'arangojs';

const arangoDb: Database = new Database({
	url: process.env.ARANGO_URL,
	databaseName: process.env.ARANGODB_DATABASE_NAME,
	auth: {
		username: process.env.ARANGODB_USER,
		password: process.env.ARANGODB_PASS,
	},
});

/**
 * The ArangodbModule can be used by other modules and it will make the Database
 * available to the modules that use it.
 */
@Module({})
export class ArangodbModule {
	static forRoot(): DynamicModule {
		const providers: Provider[] = [
			{
				provide: Database,
				useValue: arangoDb,
			},
		];
		return {
			global: true,
			module: ArangodbModule,
			providers,
			exports: providers,
		};
	}
}
