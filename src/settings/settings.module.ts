import { Module } from '@nestjs/common';
import { ArangodbModule } from '../arangodb/arangodb.module';
import { SettingsService } from './settings.service';

@Module({
	imports: [ArangodbModule.forRoot()],
	providers: [SettingsService],
	exports: [SettingsService],
})
export class SettingsModule {}
