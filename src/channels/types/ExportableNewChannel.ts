import { ChannelBase } from './ChannelBase';
import { EncryptionMode } from './EncryptionMode';

export type ExportableNewChannel = ChannelBase & {
	passcodeBase64: string;
	encryptionMode?: EncryptionMode;
};
