import { Body, Controller, Logger, Post } from '@nestjs/common';
import { validate as validateUuid } from 'uuid';
import { keyifyStringForArangoDb } from '../helpers/keyifyStringForArangoDb';
import { MetricsService } from '../metrics/metrics.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaypalService } from './paypal.service';
import { PayPalSubscription } from './types/PayPalSubscription';
import { PayPalWebhookMessage } from './types/PayPalWebhookMessage';

const paypalWebhookPath = (process.env as any).PAYPAL_WEBHOOK_PATH;
if (typeof paypalWebhookPath !== 'string' || !paypalWebhookPath.length) {
	throw new Error('Invalid PayPal webhook path');
}

const knownPlanIds = new Set(
	(process.env.PAYPAL_PLAN_IDS || '')
		.split(',')
		.map((i) => i.trim())
		.filter((i) => !!i)
);

@Controller(paypalWebhookPath)
export class PaypalController {
	private readonly logger = new Logger(PaypalController.name);
	constructor(
		private readonly metricsService: MetricsService,
		private readonly paypalService: PaypalService,
		private readonly subscriptionsService: SubscriptionsService
	) {}

	/**
	 * Handles PayPal webhook messages
	 * @param {PayPalWebhookMessage} payload
	 */
	@Post()
	async handlePayPalWebhookEvent(@Body() payload: PayPalWebhookMessage) {
		try {
			if (
				payload &&
				typeof payload.event_type === 'string' &&
				// TODO: findout if this length check is still needed; maybe substring
				// would be better here.
				payload.event_type.length < 100
			) {
				const paypalEvent = keyifyStringForArangoDb(payload.event_type);
				this.metricsService.recordEvent(`paypal:${paypalEvent}/received`);
			}
			// Check if the message is a valid subscription activated message.
			if (
				payload &&
				typeof payload === 'object' &&
				payload.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED' &&
				payload.resource_type === 'subscription' &&
				typeof payload.resource === 'object'
			) {
				const subscriptionResource = payload.resource as PayPalSubscription;
				if (
					typeof subscriptionResource.custom_id === 'string' &&
					validateUuid(subscriptionResource.custom_id) &&
					typeof subscriptionResource.id === 'string' &&
					subscriptionResource.id.length <= 256 &&
					typeof subscriptionResource.plan_id === 'string' &&
					subscriptionResource.plan_id.length <= 256 &&
					typeof subscriptionResource.status === 'string' &&
					subscriptionResource.status.length <= 256 &&
					typeof subscriptionResource.billing_info === 'object' &&
					typeof subscriptionResource.billing_info.next_billing_time ===
						'string' &&
					subscriptionResource.billing_info.next_billing_time.length < 30 &&
					!isNaN(
						Date.parse(subscriptionResource.billing_info.next_billing_time)
					) &&
					knownPlanIds.has(subscriptionResource.plan_id)
				) {
					const {
						custom_id: confiSubscriptionId,
						plan_id: paypalPlanId,
						billing_info: billingInfo,
						status,
					} = subscriptionResource;
					const paypalSubscriptionResourceId = keyifyStringForArangoDb(
						subscriptionResource.id
					);
					if (!paypalSubscriptionResourceId) {
						throw new Error('Invalid PayPal subscription document key');
					}
					const validUntil =
						(Date.parse(billingInfo.next_billing_time) + 3600000) / 1000;

					// Save the subscription details
					await this.paypalService.createOrUpdateSubscription({
						confiSubscriptionId,
						paypalSubscriptionResourceId,
						paypalPlanId,
						validUntil,
						status,
					});

					// Link the subscription to PayPal subscription
					await this.subscriptionsService.linkSubscriptionToPaypalSubscription({
						confiSubscriptionId,
						paypalSubscriptionResourceId,
						validUntil,
					});
					return;
				}
				this.logger.warn({
					message: 'Invalid BILLING.SUBSCRIPTION.ACTIVATED event encountered',
					payload,
				});
				return;
			}
			// Check if the event is valid subscription cancelled event.
			if (
				payload &&
				typeof payload === 'object' &&
				payload.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' &&
				payload.resource_type === 'subscription' &&
				typeof payload.resource === 'object' &&
				typeof payload.resource.custom_id === 'string' &&
				validateUuid(payload.resource.custom_id)
			) {
				const subscriptionResource = payload.resource as PayPalSubscription;
				if (
					typeof subscriptionResource.custom_id === 'string' &&
					validateUuid(subscriptionResource.custom_id) &&
					typeof subscriptionResource.id === 'string' &&
					subscriptionResource.id.length <= 256 &&
					typeof subscriptionResource.plan_id === 'string' &&
					subscriptionResource.plan_id.length <= 256 &&
					typeof subscriptionResource.status === 'string' &&
					subscriptionResource.status.length <= 256 &&
					knownPlanIds.has(subscriptionResource.plan_id)
				) {
					const { status } = subscriptionResource;
					const paypalSubscriptionResourceId = keyifyStringForArangoDb(
						subscriptionResource.id
					);
					if (!paypalSubscriptionResourceId) {
						throw new Error('Invalid PayPal subscription document key');
					}
					await this.paypalService.createOrUpdateSubscription({
						paypalSubscriptionResourceId,
						status,
					});
					return;
				}
				this.logger.warn(
					'Invalid BILLING.SUBSCRIPTION.CANCELLED event encountered'
				);
				return;
			}
			if (
				payload &&
				payload.event_type === 'PAYMENT.SALE.COMPLETED' &&
				payload.resource_type === 'sale'
			) {
				return;
			}
		} catch (err) {
			this.logger.error(err);
		}
	}
}
