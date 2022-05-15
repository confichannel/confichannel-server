import { ChannelType } from './ChannelType';
import { EncryptionMode } from './EncryptionMode';

export type NewChannelParams = {
	deviceId: string;
	encryptionMode: EncryptionMode;
	channelType: ChannelType;
	encryptedValue?: string;
	encryptedValueIv?: string;
	encryptedValueSalt?: string;
};
