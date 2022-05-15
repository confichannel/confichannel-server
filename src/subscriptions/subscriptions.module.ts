import { Module } from '@nestjs/common';
import { ArangodbModule } from '../arangodb/arangodb.module';
import { MetricsModule } from '../metrics/metrics.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
	imports: [ArangodbModule.forRoot(), MetricsModule],
	controllers: [SubscriptionsController],
	providers: [SubscriptionsService],
	exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
