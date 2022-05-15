import { ChannelEncryptedMessage } from './ChannelEncryptedMessage';
import { ChannelType } from './ChannelType';
import { EncryptionMode } from './EncryptionMode';

export class ChannelCreatePayload {
	channelType: ChannelType;
	encryptionMode: EncryptionMode;
	message?: ChannelEncryptedMessage;
}
