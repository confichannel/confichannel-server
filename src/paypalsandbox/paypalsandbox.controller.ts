import { Body, Controller, Logger, Post } from '@nestjs/common';

const paypalSandboxWebhookPath = (process.env as any)
	.PAYPAL_SANDBOX_WEBHOOK_PATH;
if (
	typeof paypalSandboxWebhookPath !== 'string' ||
	!paypalSandboxWebhookPath.length
) {
	throw new Error('Invalid PayPal webhook path');
}

@Controller(paypalSandboxWebhookPath)
export class PaypalsandboxController {
	/**
	 * For Sandbox PayPal webhooks, all payloads are logged.
	 * @param {any} payload
	 */
	@Post()
	async handlePayPalSandboxWebhookEvent(@Body() payload: any) {
		Logger.log(JSON.stringify(payload, null, 2));
	}
}
