import { ChannelType } from './ChannelType';

export type ChannelInviteBase = {
	/**
	 * Unique identifier ChannelInvite.
	 */
	id: string;

	/**
	 * Unique identifier of the target channel.
	 */
	channelId: string;

	/**
	 * bidirectional or unidirectional.
	 */
	channelType: ChannelType;

	/**
	 * Unix timestamp (seconds) when the ChannelInvite was created.
	 */
	creationTimestamp: number;

	/**
	 * Unix timestamp (seconds) when the ChannelInvite is due to expire.
	 */
	expires: number;
};
