import { EcdhJsonWebKey } from './EcdhJsonWebKey';

export type DeviceToEdgeParams = {
	deviceId: string;
	channelId: string;
	permissions: string[];
	tempPublicKey?: EcdhJsonWebKey;
};
