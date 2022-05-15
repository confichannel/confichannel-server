import { ChannelType } from './ChannelType';

export type ChannelBase = {
	id: string;
	channelType: ChannelType;
	creationTimestamp: number;
	updateTimestamp: number;
	name?: string;
};
