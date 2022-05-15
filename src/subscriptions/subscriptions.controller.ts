import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthedRequest } from '../types/AuthedRequest';
import { EncryptedJwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetricsService } from '../metrics/metrics.service';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
	constructor(
		private readonly subscriptionsService: SubscriptionsService,
		private readonly metricsService: MetricsService
	) {}

	/**
	 * Creates a subscription.
	 * @param {AuthedRequest} request
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Post()
	async postSubscription(
		@Req() request: AuthedRequest
	): Promise<{ id: string }> {
		const { deviceId } = request;
		const newSubscription = await this.subscriptionsService.createSubscription({
			deviceId,
		});
		this.metricsService.recordEvent('subscription:created');
		return {
			id: newSubscription.id,
		};
	}

	/**
	 * Returns the currently active subscription for the device associated
	 * with the request.
	 * Devices with subscriptions can send more data and create more channels.
	 * @param {AuthedRequest} request
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Get('/active')
	async getSubscription(@Req() request: AuthedRequest): Promise<{
		activeSubscriptionId?: string;
		timeRemaining?: number;
	}> {
		const { deviceId } = request;
		const activeSubscription =
			await this.subscriptionsService.getActiveSubsciptionForDevice(deviceId);
		if (activeSubscription) {
			const response: {
				activeSubscriptionId?: string;
				timeRemaining?: number;
			} = {
				activeSubscriptionId: activeSubscription.id,
			};
			const now = Math.round(Date.now() / 1000);
			if (activeSubscription.validUntil) {
				// If validUntil is set, calculate the timeRemaining based on that.
				response.timeRemaining = activeSubscription.validUntil - now;
			} else {
				// TODO: check if this is ever used.
				response.timeRemaining =
					now - activeSubscription.creationTimestamp + 180;
			}
			return response;
		} else {
			return {};
		}
	}
}
