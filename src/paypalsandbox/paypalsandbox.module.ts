import { Module } from '@nestjs/common';
import { PaypalsandboxController } from './paypalsandbox.controller';

@Module({
	controllers: [PaypalsandboxController],
})
export class PaypalsandboxModule {}
