import { Request } from 'express';

export type AuthedRequest = Request & {
	deviceId: string;
};
