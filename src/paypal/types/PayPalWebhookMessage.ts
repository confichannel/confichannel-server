import { PayPalSale } from './PayPalSale';
import { PayPalSubscription } from './PayPalSubscription';

export interface PayPalWebhookMessage {
	id: string;
	create_time: string;
	event_type: string;
	event_version: string;
	resource_type: string;
	resource_version: string;
	summary: string;
	resource: PayPalSubscription | PayPalSale;
	links: {
		href: string;
		rel: string;
		method: string;
	}[];
}
