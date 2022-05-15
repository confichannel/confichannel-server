import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { AuthService } from './auth.service';

@Module({
	imports: [DevicesModule],
	providers: [AuthService],
})
export class AuthModule {}
