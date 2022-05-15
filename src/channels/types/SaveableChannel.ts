import { ChannelBase } from './ChannelBase';
import { EncryptionMode } from './EncryptionMode';

export type SaveableChannel = ChannelBase & {
	_key: string;
	passcodeHashSalt: string;
	passcodeHash: string;
	encryptionMode: EncryptionMode | null;
	e2eEncryptedValue?: string | null;
	e2eEncryptedValueIv?: string | null;
	e2eEncryptedValueSalt?: string | null;
	senderPublicKey?: JsonWebKey | null;
};
