import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { aql, Database } from 'arangojs';
import { DocumentCollection } from 'arangojs/collection';
import { Subscription } from '../types/Subscription';

@Injectable()
export class SubscriptionsService {
	private readonly logger = new Logger(SubscriptionsService.name);
	private subscriptionsCollection: DocumentCollection;

	constructor(
		@Inject(Database)
		private db: Database
	) {
		this.subscriptionsCollection = this.db.collection('subscriptions');
		const subscriptionsCollection = this.subscriptionsCollection;
		async function initialiseDb() {
			const subscriptionsCollectionExists =
				await subscriptionsCollection.exists();
			if (!subscriptionsCollectionExists) {
				await subscriptionsCollection.create();
			}
			await subscriptionsCollection.ensureIndex({
				fields: ['deviceId'],
				type: 'persistent',
				name: 'subscriptionsByDeviceIdIndex',
			});
		}
		initialiseDb();
	}

	/**
	 * Creates a new subscription for a device.
	 * @param {{deviceId: string}} params
	 */
	async createSubscription(params: {
		deviceId: string;
	}): Promise<Subscription> {
		const id = uuidv4();
		const { deviceId } = params;
		const creationTimestamp = Math.round(Date.now() / 1000);
		const updateTimestamp = creationTimestamp;
		await this.subscriptionsCollection.save(
			{ _key: id, id, deviceId, updateTimestamp, creationTimestamp },
			{
				overwriteMode: 'conflict',
			}
		);
		return {
			id,
			deviceId,
			creationTimestamp,
			updateTimestamp,
		};
	}

	/**
	 * Connects a ConfiChannel subscription to a PayPal subscription.
	 * @param {{confiSubscriptionId: string,paypalSubscriptionResourceId: string, validUntil: number}} params
	 */
	async linkSubscriptionToPaypalSubscription(params: {
		confiSubscriptionId: string;
		paypalSubscriptionResourceId: string;
		validUntil: number;
	}) {
		const { confiSubscriptionId, paypalSubscriptionResourceId, validUntil } =
			params;
		const subscriptionExists =
			await this.subscriptionsCollection.documentExists(confiSubscriptionId);
		if (!subscriptionExists) {
			Logger.warn(
				`ConfiChannel subscription with id ${confiSubscriptionId} does not exist`
			);
			return;
		}
		await this.subscriptionsCollection.update(confiSubscriptionId, {
			paypalSubscriptionResourceId,
			validUntil,
		});
	}

	/**
	 * Gets the active subscription for the given device id.
	 * @param {string} deviceId
	 */
	async getActiveSubsciptionForDevice(
		deviceId: string
	): Promise<Subscription | null> {
		const rightNow = Math.round(Date.now() / 1000);
		const aFewMinutesAgo = rightNow - 180;
		const subscriptionsResults = await this.db.query(aql`
			FOR subscription IN subscriptions
			FILTER subscription.deviceId == ${deviceId} && (
					(subscription.creationTimestamp >= ${aFewMinutesAgo}) ||
					(subscription.validUntil && subscription.validUntil >= ${rightNow})
				)
			LIMIT 1
			RETURN subscription
		`);
		const first = await subscriptionsResults.next();
		if (first) {
			return {
				id: first.id,
				deviceId: first.deviceId,
				creationTimestamp: first.creationTimestamp,
				updateTimestamp: first.updateTimestamp,
				validUntil: first.validUntil,
			} as Subscription;
		}
		return null;
	}
}
