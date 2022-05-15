import { Test, TestingModule } from '@nestjs/testing';
import { PaypalsandboxController } from './paypalsandbox.controller';

describe('PaypalsandboxController', () => {
	let controller: PaypalsandboxController;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [PaypalsandboxController],
		}).compile();

		controller = module.get<PaypalsandboxController>(PaypalsandboxController);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});
});
