import { ChannelInviteBase } from './ChannelInviteBase';

export type ExportableChannelInvite = ChannelInviteBase & {
	passcode: string;
};
