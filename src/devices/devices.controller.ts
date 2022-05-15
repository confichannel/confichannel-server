import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { generateDeviceJwtToken } from '../helpers/generateJwtToken';
import { MetricsService } from '../metrics/metrics.service';
import { EncryptedJwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from '../settings/settings.service';

@Controller('devices')
export class DevicesController {
	constructor(
		private readonly devicesService: DevicesService,
		private readonly metricsService: MetricsService,
		private readonly settingsService: SettingsService
	) {}

	/**
	 * Posts a new device and returns a newly generated token for the device.
	 */
	@Post()
	async post(): Promise<{ deviceToken: string }> {
		const newDevice = await this.devicesService.createDevice();
		const jwt = await generateDeviceJwtToken(
			{ sub: newDevice.id },
			this.settingsService.deviceJwtExpirationTime
		);
		this.metricsService.recordEvent('device:created');
		return {
			deviceToken: jwt,
		};
	}

	/**
	 * Returns OK if the device token is successfully verified or throws an
	 * error otherwise.
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Get('status')
	async getStatus() {
		// If there's something wrong with the token, following code won't be
		// returned, instead an error will be thrown.
		return { status: 'OK' };
	}
}
