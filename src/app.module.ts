import { Module, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { APP_FILTER, BaseExceptionFilter } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChannelsModule } from './channels/channels.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { ArangodbModule } from './arangodb/arangodb.module';
import { PaypalModule } from './paypal/paypal.module';
import { SettingsModule } from './settings/settings.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { MetricsModule } from './metrics/metrics.module';
import { PaypalsandboxModule } from './paypalsandbox/paypalsandbox.module';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost) {
		super.catch(exception, host);
		Logger.error(exception);
	}
}

const providers =
	process.env.NODE_ENV === 'production' && !process.env.LOG_ALL_EXCEPTIONS
		? [AppService]
		: [
				AppService,
				{
					provide: APP_FILTER,
					useClass: AllExceptionsFilter,
				},
		  ];

@Module({
	imports: [
		ChannelsModule,
		// Means for any 60 seconds, any given IP address can request an endpoint
		// a maximum of ten times.
		ThrottlerModule.forRoot({
			ttl: 60,
			limit: 10,
		}),
		AuthModule,
		DevicesModule,
		ArangodbModule.forRoot(),
		PaypalModule,
		SettingsModule,
		SubscriptionsModule,
		MetricsModule,
		PaypalsandboxModule,
	],
	controllers: [AppController],
	providers,
})
export class AppModule {}
