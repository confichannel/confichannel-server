import { config } from 'dotenv';
config();
import helmet from 'helmet';
import * as express from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
	try {
		const app = await NestFactory.create(AppModule);
		app.setGlobalPrefix(process.env.SERVER_GLOBAL_PREFIX || '');
		app.enableCors({
			exposedHeaders: 'x-confi-token',
		});
		app.use(
			express.json({ limit: process.env.EXPRESS_JSON_LIMIT || undefined })
		);
		app.use(helmet());
		await app.listen(3000);
	} catch (err) {
		console.error(err);
	}
}
bootstrap();
