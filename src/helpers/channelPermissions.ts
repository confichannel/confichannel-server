// Permission for a device to completely delete a channel.
export const WriteDeleteChannelPermission = 'write:DeleteChannel';

// Permission for a device to delete themselves from a channel.
export const WriteDeleteOwnDevicePermission =
	'write:DeleteOwnDeviceFromChannel';

// Permission for a device to push a message to a channel.
export const WritePushPermission = 'write:Push';

// Permission for a device to create an invite for a channel.
export const WriteInvitePermission = 'write:Invite';

// Permission for a device to delete an invite for a channel.
export const WriteDeleteInvitePermission = 'write:DeleteInvite';

// Permission for a device to pop public keys associated with a channel.
export const PopPublicKeyPermission = 'pop:PublicKeys';

// Permission for a device to get the invite list for a channel.
export const ReadInviteListPermission = 'read:InviteList';

// Permission for a device to pull the message data of a channel.
export const ReadPullPermission = 'read:Pull';
