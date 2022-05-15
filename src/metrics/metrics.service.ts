import { Inject, Injectable, Logger } from '@nestjs/common';
import { Database } from 'arangojs';
import { DocumentCollection } from 'arangojs/collection';

@Injectable()
export class MetricsService {
	private metricsCollection: DocumentCollection;

	constructor(
		@Inject(Database)
		private readonly db: Database
	) {
		this.metricsCollection = this.db.collection('metrics');
		const metricsCollection = this.metricsCollection;
		async function initialiseDb() {
			const metricsCollectionExists = await metricsCollection.exists();
			if (!metricsCollectionExists) {
				await metricsCollection.create();
			}
			await metricsCollection.ensureIndex({
				fields: ['eventName', 'timestamp'],
				type: 'persistent',
				name: 'eventTimestamp',
			});
		}
		initialiseDb();
	}

	recordEvent(eventName: string, eventData: any = {}) {
		const metricsCollection = this.metricsCollection;
		async function recordEventAsync() {
			try {
				const timestamp = Math.round(Date.now() / 1000);
				const event = Object.assign(eventData, {
					eventName,
					timestamp,
				});
				await metricsCollection.save(event);
			} catch (err) {
				Logger.error(err);
			}
		}
		recordEventAsync();
	}
}
