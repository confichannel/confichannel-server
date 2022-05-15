import { EcdhJsonWebKey } from '../../types/EcdhJsonWebKey';

export interface ChannelInviteDbDoc {
	_key: string;
	id: string;
	channelId: string;
	creationTimestamp: number;
	channelPasscode: string;
	encryptedEncryptKey: string;
	passcodeHash: string;
	passcodeHashSalt: string;
	originPublicKey: EcdhJsonWebKey;
	expires: number;
	inviteAcceptsCount?: number;
}
