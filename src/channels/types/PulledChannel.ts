import { ChannelBase } from './ChannelBase';
import { EncryptionMode } from './EncryptionMode';

export type PulledChannel = ChannelBase & {
	encryptionMode: EncryptionMode;
	e2eEncryptedValue?: null | string;
	e2eEncryptedValueIv?: null | string;
	e2eEncryptedValueSalt?: null | string;
	senderPublicKey?: null | JsonWebKey;
};
