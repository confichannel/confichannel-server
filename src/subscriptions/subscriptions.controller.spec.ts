import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../metrics/metrics.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from '../types/Subscription';

describe('SubscriptionsController', () => {
	let controller: SubscriptionsController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SubscriptionsController],
		})
			.useMocker((token) => {
				if (token === SubscriptionsService) {
					return {
						createSubscription: jest.fn(async () => {
							return {
								id: '925a4ae6-c274-4c57-980b-019f37f14757',
								deviceId: '86db9665-920e-4ea7-bf73-5d1fe817f7af',
								creationTimestamp:
									new Date('2022-01-01T00:00Z').valueOf() / 1000,
								updateTimestamp: new Date('2022-01-01T00:00Z').valueOf() / 1000,
							};
						}),
						getActiveSubsciptionForDevice: jest.fn(async () => {
							return {
								id: '925a4ae6-c274-4c57-980b-019f37f14757',
								deviceId: '86db9665-920e-4ea7-bf73-5d1fe817f7af',
								creationTimestamp:
									new Date('2022-01-01T00:00Z').valueOf() / 1000,
								updateTimestamp: new Date('2022-01-01T00:00Z').valueOf() / 1000,
							} as Subscription;
						}),
					};
				}
				if (token === MetricsService) {
					return {
						recordEvent: jest.fn(() => undefined),
					};
				}
			})
			.compile();

		controller = module.get<SubscriptionsController>(SubscriptionsController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
