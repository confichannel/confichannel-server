export interface Subscription {
	id: string;
	deviceId: string;
	creationTimestamp: number;
	updateTimestamp: number;
	validUntil?: number;
}
