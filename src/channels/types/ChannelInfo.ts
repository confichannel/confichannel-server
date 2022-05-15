import { ChannelType } from './ChannelType';

export interface ChannelInfo {
	_key: string;
	id: string;
	name: string;
	channelType: ChannelType;
	passcodeHash: string;
	passcodeHashSalt: string;
	creationTimestamp: number;
	updateTimestamp: number;
}
