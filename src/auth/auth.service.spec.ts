import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { EncryptedJwtAuthGuard } from './jwt-auth.guard';

describe('AuthService', () => {
	let service: AuthService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AuthService],
		}).compile();

		service = module.get<AuthService>(AuthService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('EncryptedJwtAuthGuard', () => {
		it('should be memoized', () => {
			const GuardDef1 = EncryptedJwtAuthGuard();
			const GuardDef2 = EncryptedJwtAuthGuard();
			expect(GuardDef1).toStrictEqual(GuardDef2);
		});
	});
});
