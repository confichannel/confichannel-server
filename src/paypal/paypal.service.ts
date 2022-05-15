import { Inject, Injectable, Logger } from '@nestjs/common';
import { Database } from 'arangojs';
import { DocumentCollection } from 'arangojs/collection';

@Injectable()
export class PaypalService {
	private readonly logger = new Logger(PaypalService.name);
	private paypalSubscriptionsCollection: DocumentCollection;

	constructor(
		@Inject(Database)
		private db: Database
	) {
		this.paypalSubscriptionsCollection = this.db.collection(
			'paypalSubscriptions'
		);
		const paypalSubscriptionsCollection = this.paypalSubscriptionsCollection;
		async function initialiseDb() {
			const paypalSubscriptionsCollectionExists =
				await paypalSubscriptionsCollection.exists();
			if (!paypalSubscriptionsCollectionExists) {
				await paypalSubscriptionsCollection.create();
			}
		}
		initialiseDb();
	}

	async createOrUpdateSubscription(paypalSubscription: {
		paypalSubscriptionResourceId: string;
		confiSubscriptionId?: string;
		paypalPlanId?: string;
		status?: string;
		validUntil?: number;
	}) {
		const {
			confiSubscriptionId,
			paypalSubscriptionResourceId,
			paypalPlanId,
			validUntil,
			status,
		} = paypalSubscription;
		const exists = await this.paypalSubscriptionsCollection.documentExists(
			paypalSubscriptionResourceId
		);
		if (exists) {
			const current = await this.paypalSubscriptionsCollection.document(
				paypalSubscriptionResourceId
			);
			const patch: {
				confiSubscriptionId?: string;
				paypalPlanId?: string;
				validUntil?: number;
				status?: string;
			} = {};
			if (validUntil && current.validUntil !== validUntil) {
				patch.validUntil = validUntil;
			}
			if (paypalPlanId && current.paypalPlanId !== paypalPlanId) {
				patch.paypalPlanId = paypalPlanId;
			}
			if (status && current.status !== status) {
				patch.status = status;
			}
			if (
				confiSubscriptionId &&
				current.confiSubscriptionId !== confiSubscriptionId
			) {
				patch.confiSubscriptionId = confiSubscriptionId;
			}
			if (!Object.keys(patch).length) {
				this.logger.log(`Empty patch skipped for ${paypalPlanId}`);
			} else {
				await this.paypalSubscriptionsCollection.update(
					paypalSubscriptionResourceId,
					patch
				);
			}
		} else {
			await this.paypalSubscriptionsCollection.save(
				Object.assign({}, paypalSubscription, {
					_key: paypalSubscriptionResourceId,
				})
			);
		}
	}
}
