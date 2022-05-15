import { Test, TestingModule } from '@nestjs/testing';
import { Database } from 'arangojs';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
	let service: SubscriptionsService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [SubscriptionsService],
		})
			.useMocker((token) => {
				if (token === Database) {
					return {
						collection: jest.fn(() => {
							return {
								exists: jest.fn(async () => true),
								ensureIndex: jest.fn(async () => undefined),
							};
						}),
					};
				}
			})
			.compile();

		service = module.get<SubscriptionsService>(SubscriptionsService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
