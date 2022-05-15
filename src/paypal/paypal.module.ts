import { Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaypalController } from './paypal.controller';
import { PaypalService } from './paypal.service';

@Module({
	imports: [MetricsModule, SubscriptionsModule],
	controllers: [PaypalController],
	providers: [PaypalService],
})
export class PaypalModule {}
