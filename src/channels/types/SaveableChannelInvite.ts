import { EcdhJsonWebKey } from '../../types/EcdhJsonWebKey';
import { ChannelInviteBase } from './ChannelInviteBase';

export type SaveableChannelInvite = ChannelInviteBase & {
	_key: string;
	channelPasscode: string;
	encryptedEncryptKey: string;
	passcodeHash: string;
	passcodeHashSalt: string;
	originPublicKey: EcdhJsonWebKey;
	inviteAcceptsCount?: number;
};
