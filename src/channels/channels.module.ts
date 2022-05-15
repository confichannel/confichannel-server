import { Module } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { ArangodbModule } from '../arangodb/arangodb.module';
import { DevicesModule } from '../devices/devices.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
	imports: [
		ArangodbModule.forRoot(),
		DevicesModule,
		SubscriptionsModule,
		MetricsModule,
		SettingsModule,
	],
	providers: [ChannelsService],
	exports: [ChannelsService],
	controllers: [ChannelsController],
})
export class ChannelsModule {}
