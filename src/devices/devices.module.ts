import { Module } from '@nestjs/common';
import { ArangodbModule } from '../arangodb/arangodb.module';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { MetricsModule } from '../metrics/metrics.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
	imports: [ArangodbModule.forRoot(), MetricsModule, SettingsModule],
	providers: [DevicesService],
	exports: [DevicesService],
	controllers: [DevicesController],
})
export class DevicesModule {}
