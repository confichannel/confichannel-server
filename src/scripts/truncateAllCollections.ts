import 'dotenv/config';
import { Database } from 'arangojs';

async function truncateAllCollections() {
	try {
		const arangoDb: Database = new Database({
			url: process.env.ARANGO_URL,
			databaseName: process.env.ARANGODB_DATABASE_NAME,
			auth: {
				username: process.env.ARANGODB_USER,
				password: process.env.ARANGODB_PASS,
			},
		});
		const collectionNames = [
			// 'channels',
			// 'devices',
			// 'devicesToChannels',
			// 'invites',
			// 'invoices',
			// 'metrics',
			// 'paypalSubscriptions',
			// 'settings',
			// 'subscriptions',
		];
		if (collectionNames.length) {
			await Promise.all(
				collectionNames.map((name) => arangoDb.collection(name).truncate())
			);
		}
	} catch (err) {
		console.error(err);
	}
}

truncateAllCollections();
