import { ChannelEncryptedMessage } from './ChannelEncryptedMessage';
import { EncryptionMode } from './EncryptionMode';

export type ChannelMessageUpdatePayload = {
	encryptionMode?: EncryptionMode;
	message?: ChannelEncryptedMessage;
	senderPublicKey?: JsonWebKey;
};
