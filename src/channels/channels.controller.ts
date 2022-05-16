import { validate as validateUuid } from 'uuid';
import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	ForbiddenException,
	Get,
	Header,
	HttpCode,
	InternalServerErrorException,
	NotFoundException,
	Param,
	Post,
	Req,
	UseGuards,
} from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { EncryptedJwtAuthGuard } from '../auth/jwt-auth.guard';
import { DevicesService } from '../devices/devices.service';
import {
	PopPublicKeyPermission,
	ReadInviteListPermission,
	ReadPullPermission,
	WriteDeleteChannelPermission,
	WriteDeleteInvitePermission,
	WriteDeleteOwnDevicePermission,
	WriteInvitePermission,
	WritePushPermission,
} from '../helpers/channelPermissions';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { MetricsService } from '../metrics/metrics.service';
import { isValidEchdPublicKey } from '../helpers/isValidEchdPublicKey';
import { ChannelCreatePayload } from './types/CreateChannelPayload';
import { ExportableNewChannel } from './types/ExportableNewChannel';
import { PulledChannel } from './types/PulledChannel';
import { ChannelMessageUpdatePayload } from './types/ChannelMessageUpdatePayload';
import { InviteCreatePayload } from './types/InviteCreatePayload';
import { InviteConsumePayload } from './types/InviteConsumePayload';
import { generateHmac } from '../helpers/generateHmac';
import { AuthedRequest } from '../types/AuthedRequest';
import {
	ERROR_MESSAGE_CHANNEL_ALREADY_EXISTS,
	MAX_CHANNELS_NO_SUBSCRIPTION,
	MAX_CHANNELS_WITH_SUBSCRIPTION,
} from '../config';
import { Subscription } from '../types/Subscription';
import { EncryptionMode } from './types/EncryptionMode';
import { ChannelEncryptedMessage } from './types/ChannelEncryptedMessage';

const PROPS_ALLOWED_IN_CHANNEL_CREATE_PAYLOAD = new Set([
	'message',
	'encryptionMode',
	'channelType',
]);

const PROPS_ALLOWED_IN_CHANNEL_UPDATE_PAYLOAD = new Set([
	'message',
	'encryptionMode',
	'senderPublicKey',
]);

const PROPS_ALLOWED_IN_CHANNEL_MESSAGE_PAYLOAD = new Set([
	'cipher',
	'iv',
	'salt',
]);

/**
 * The channels controller responds to requests to do with the management of
 * channels. Channels themselves faciliate the transfer of encrypted data
 * between devices.
 *
 * The controller is responsible for ensuring that requests are valid requests
 * and managing the business logic. It passes on validated data to the channels
 * service. It constructs and returns responses for the frontend.
 */
@Controller('channels')
export class ChannelsController {
	constructor(
		private readonly channelsService: ChannelsService,
		private readonly devicesService: DevicesService,
		private readonly subscriptionsService: SubscriptionsService,
		private readonly metricsService: MetricsService
	) {}

	/**
	 * postChannel responds to requests to create a new channel.
	 * @param {ChannelCreatePayload} channelCreatePayload
	 * @param {AuthedRequest} request
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Post()
	@HttpCode(201)
	async postChannel(
		@Body() channelCreatePayload: ChannelCreatePayload,
		@Req() request: AuthedRequest
	): Promise<ExportableNewChannel> {
		const { deviceId } = request;

		// Validate the basic channel creation payload data.
		this._validateChannelPayloadPropNames(
			channelCreatePayload,
			PROPS_ALLOWED_IN_CHANNEL_CREATE_PAYLOAD
		);

		const [channelCount, subscription] = await Promise.all([
			this.channelsService.getCountOfChannelsForDevice(deviceId),
			this.subscriptionsService.getActiveSubsciptionForDevice(deviceId),
		]);

		if (typeof channelCreatePayload.channelType !== 'string') {
			this.metricsService.recordEvent('channel:creationError', {
				errorType: 'Channel type not provided',
			});
			throw new BadRequestException();
		}

		// Check the user is allowed to create the channel given the number of
		// channels they already have and their subscription status.
		if (!subscription && channelCount >= MAX_CHANNELS_NO_SUBSCRIPTION) {
			this.metricsService.recordEvent('channel:creationError', {
				errorType: 'max number of channels reached',
				maxChannelCount: MAX_CHANNELS_NO_SUBSCRIPTION,
				channelCount,
				hasSubscription: false,
			});
			throw new BadRequestException(
				`Channel limit (${MAX_CHANNELS_NO_SUBSCRIPTION}) exceeded`
			);
		} else if (subscription && channelCount >= MAX_CHANNELS_WITH_SUBSCRIPTION) {
			this.metricsService.recordEvent('channel:creationError', {
				errorType: 'max number of channels reached',
				maxChannelCount: MAX_CHANNELS_WITH_SUBSCRIPTION,
				channelCount,
				hasSubscription: true,
			});
			throw new BadRequestException(
				`Channel limit (${MAX_CHANNELS_WITH_SUBSCRIPTION}) exceeded`
			);
		}

		switch (channelCreatePayload.channelType) {
			case 'bidirectional':
				return await this._createBidirectionalChannel(
					channelCreatePayload as ChannelCreatePayload & {
						channelType: 'bidirectional';
					},
					subscription,
					deviceId
				);
			case 'unidirectional':
				return await this._createUnidirectionalChannel(
					channelCreatePayload as ChannelCreatePayload & {
						channelType: 'unidirectional';
					},
					subscription,
					deviceId
				);
			default: {
				this.metricsService.recordEvent('channel:creationError', {
					errorType: 'Invalid channel type',
				});
				throw new BadRequestException();
			}
		}
	}

	/**
	 * pullChannel responds to requests to pull the content of a channel. This
	 * returns the encrypted message content of the channel, if there is some
	 * to fetch at this point in time.
	 *
	 * Note: it is a GET request with a side-effect: the encrypted message is
	 * deleted as it is retrieved. Until another pushChannel request is made,
	 * subsequent calls to pullChannel will return no message.
	 *
	 * @param {string} channelId
	 * @param {AuthedRequest} request
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Get(':channelId')
	@Header('Cache-Control', 'none')
	async pullChannel(
		@Param('channelId') channelId: string,
		@Req() request: AuthedRequest
	): Promise<PulledChannel> {
		const { deviceId } = request;
		if (!validateUuid(channelId)) {
			throw new BadRequestException();
		}
		const passcode = request.get('x-confi-passcode');
		await this._validateChannelPasscode(
			channelId,
			passcode,
			'channel:pullError'
		);
		await this._validatePermissions(
			deviceId,
			channelId,
			[ReadPullPermission],
			'channel:pullError'
		);
		const result = await this.channelsService.pull(channelId);
		this.metricsService.recordEvent('channel:pulled');
		return result;
	}

	/**
	 * deleteChannel removes the channel. If the user has permissions to delete
	 * the channel completely (i.e. they were probably the creator of the
	 * channel), the channel will be completely deleted. Otherwise, if the user
	 * has permission only to removed the channel from their own device, then
	 * this is the type of deletion that will be performed.
	 * @param {string} channelId
	 * @param {AuthedRequest} request
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Delete(':channelId')
	async deleteChannel(
		@Param('channelId') channelId: string,
		@Req() request: AuthedRequest
	) {
		const { deviceId } = request;
		if (!validateUuid(channelId)) {
			throw new BadRequestException();
		}
		const passcode = request.get('x-confi-passcode');
		const channelExists = await this.channelsService.getChannelExists(
			channelId
		);
		if (!channelExists) {
			// Channel doesn't exist, technically a successful response.
			return undefined;
		}
		await this._validateChannelPasscode(
			channelId,
			passcode,
			'channel:deleteError'
		);
		// If the device can delete the whole channel
		if (
			await this._hasPermissions(deviceId, channelId, [
				WriteDeleteChannelPermission,
			])
		) {
			// ... then do that.
			await this.channelsService.deleteChannel(channelId);
			this.metricsService.recordEvent('channel:deleted');
			return undefined;
		} else if (
			// If the device can only delete the channel for itself...
			await this._hasPermissions(deviceId, channelId, [
				WriteDeleteOwnDevicePermission,
			])
		) {
			// ... then do that instead.
			await this.channelsService.deleteDeviceFromChannel(channelId, deviceId);
			this.metricsService.recordEvent('channel:device-removed');
			return undefined;
		} else {
			this.metricsService.recordEvent('channel:deleteError', {
				errorType: 'Lacks permission to remove the channel',
			});
			throw new ForbiddenException();
		}
	}

	/**
	 * pushChannel updates the encrypted message in the channel.
	 * @param {string} channelId
	 * @param {AuthedRequest} request
	 * @param {ChannelCreatePayload} channelValuePayload
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Post(':channelId')
	async pushChannel(
		@Param('channelId') channelId: string,
		@Req() request: AuthedRequest,
		@Body() channelValuePayload: ChannelMessageUpdatePayload
	) {
		const { deviceId } = request;
		if (!validateUuid(channelId)) {
			throw new BadRequestException();
		}

		this._validateChannelPayloadPropNames(
			channelValuePayload,
			PROPS_ALLOWED_IN_CHANNEL_UPDATE_PAYLOAD
		);

		// Check that the correct passcode for the channel was used.
		const passcode = request.get('x-confi-passcode');
		await this._validateChannelPasscode(
			channelId,
			passcode,
			'channel:pushError'
		);

		// Check that the device making the request has permission to push
		// to the channel.
		await this._validatePermissions(
			deviceId,
			channelId,
			[WritePushPermission],
			'channel:pushError'
		);

		const [channelType, subscription] = await Promise.all([
			this.channelsService.getChannelType(channelId),
			this.subscriptionsService.getActiveSubsciptionForDevice(deviceId),
		]);
		let result: { updateTimestamp: number } = undefined;
		if (channelValuePayload.message && channelValuePayload.message.cipher) {
			switch (channelType) {
				case 'bidirectional':
					this._validateEncryptedValueForBidirectionalChannel(
						subscription,
						channelValuePayload.encryptionMode,
						channelValuePayload.message,
						'channel:pushError'
					);
					break;
				case 'unidirectional':
					this._validateEncryptedValueForUnidirectionalChannel(
						subscription,
						channelValuePayload.encryptionMode,
						channelValuePayload.message,
						channelValuePayload.senderPublicKey,
						'channel:pushError'
					);
					break;
				default:
					throw new InternalServerErrorException();
			}
			result = await this.channelsService.push(channelId, channelValuePayload);
		} else {
			// If no encrypted value was provided, then set the channel message to
			// be empty.
			if (channelValuePayload.encryptionMode !== 'none') {
				throw new BadRequestException();
			}
			result = await this.channelsService.push(channelId, {
				encryptionMode: channelValuePayload.encryptionMode,
				message: {
					cipher: null,
					iv: null,
					salt: null,
				},
				senderPublicKey: undefined,
			});
		}
		this.metricsService.recordEvent('channel:pushed', {
			hasSubscription: !!subscription,
			encryptionMode: channelValuePayload.encryptionMode,
			hasValue: !!channelValuePayload.message?.cipher,
		});
		return result;
	}

	/**
	 * popTempPublicKeys pops and returns any public keys which are temporarily
	 * stored after the recipient of an invite has accepted that invite. In other
	 * words, the person who sent the invite in the first place uses the
	 * popTempPublicKeys to retrieve the public keys of anyone who accepted their
	 * invite. Once this happens, both the invite sender and invite receiver
	 * have one anothers' public keys (the recipient got it as part of the
	 * process consuming the invite, and the sender gets recipient's public key
	 * by checking this popTempPublicKeys endpoint).
	 * @param {string} channelId
	 * @param {AuthedRequest} request
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Post(':channelId/tempPublicKeys')
	async popTempPublicKeys(
		@Param('channelId') channelId: string,
		@Req() request: AuthedRequest
	) {
		const { deviceId } = request;
		if (!validateUuid(channelId)) {
			throw new BadRequestException();
		}
		const passcode = request.get('x-confi-passcode');
		await this._validateChannelPasscode(
			channelId,
			passcode,
			'channel:popTempPublicKeysError'
		);
		await this._validatePermissions(
			deviceId,
			channelId,
			[PopPublicKeyPermission],
			'channel:popTempPublicKeysError'
		);
		const publicKeys = await this.channelsService.popChannelPublicKeys(
			channelId
		);
		return { publicKeys };
	}

	/**
	 * getOutstandingInviteFlag is used to indicate if a channel has an
	 * outstanding invite.
	 * @param {string} channelId
	 * @param {AuthedRequest} request
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Get(':channelId/outstandingInviteFlag')
	async getOutstandingInviteFlag(
		@Param('channelId') channelId: string,
		@Req() request: AuthedRequest
	) {
		const { deviceId } = request;
		if (!validateUuid(channelId)) {
			throw new BadRequestException();
		}

		// Check that the passcode used to access the channel is correct.
		const passcode = request.get('x-confi-passcode');
		await this._validateChannelPasscode(
			channelId,
			passcode,
			'channel:getOutstandingInviteError'
		);

		// Check that the device has permission to read the list of channel
		// invites.
		await this._validatePermissions(
			deviceId,
			channelId,
			[ReadInviteListPermission],
			'channel:getOutstandingInviteError'
		);

		// Return flag indiciate if the channel has an outstanding invite.
		const hasOutstandingInvite =
			await this.channelsService.channelHasOutstandingInvite(channelId);
		return { hasOutstandingInvite };
	}

	/**
	 * pushChannelInvite creates a new invite to the channel.
	 * @param {string} channelId
	 * @param {AuthedRequest} request
	 * @param {InviteCreatePayload} inviteBody
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Post(':channelId/invites')
	async pushChannelInvite(
		@Param('channelId') channelId: string,
		@Req() request: AuthedRequest,
		@Body() inviteBody: InviteCreatePayload
	) {
		const { deviceId } = request;
		if (!validateUuid(channelId)) {
			throw new BadRequestException();
		}

		// Check that the password to access the channel is correct.
		const passcode = request.get('x-confi-passcode');
		await this._validateChannelPasscode(
			channelId,
			passcode,
			'channel:invite:creationError'
		);

		// Check that the device has access to create invites for the channel.
		await this._validatePermissions(
			deviceId,
			channelId,
			[WriteInvitePermission],
			'channel:invite:creationError'
		);

		// Validate that invite includes the correct data.
		const { encryptedEncryptKey } = inviteBody;

		// Validate the encrypted channel key which is used to encrypt and decrypt
		// channel messages. The channel encrypt key itself is not visible to the
		// server in its unencrypted form nor the invite key which is used to
		// encrypt it (the invite key is sent with the invite in the URL fragment,
		// which is generally not sent to the server as part of the request).
		await this._validateEncryptedEncryptKey(
			encryptedEncryptKey,
			'channel:inviteCreateError'
		);

		// Validate the public key of the origin device of the invite.
		if (!inviteBody.originPublicKey) {
			this.metricsService.recordEvent('channel:inviteCreationError', {
				errorType: 'origin public key missing from invite body',
			});
			throw new BadRequestException();
		}
		if (!isValidEchdPublicKey(inviteBody.originPublicKey)) {
			this.metricsService.recordEvent('channel:inviteCreationError', {
				errorType: 'origin public key is invalid public key',
			});
			throw new BadRequestException();
		}

		const invitesCount = await this.channelsService.getCountOfInvitesForChannel(
			channelId
		);
		// TODO: communicate this limit to a user somewhere.
		if (invitesCount > 100) {
			this.metricsService.recordEvent('channel:inviteCreationError', {
				errorType: 'too many invites for channel',
				invitesCount,
			});
			throw new BadRequestException();
		}

		const [channelType, devicesCount] = await Promise.all([
			this.channelsService.getChannelType(channelId),
			this.channelsService.getCountOfDevicesForChannel(channelId),
		]);
		if (channelType === 'bidirectional') {
			// Check that bidirectional channels are only shared with one other
			// device.
			if (devicesCount > 1) {
				this.metricsService.recordEvent('channel:inviteCreationError', {
					errorType: 'channel already shared with at least one other device',
					devicesCount,
				});
				throw new BadRequestException();
			}
		} else {
			// here, the channelType must be 'unidirectional'
			// TODO communicate this limit to the user somewhere. Just here so there's
			// no run-away resource usage.
			if (devicesCount > 100) {
				this.metricsService.recordEvent('channel:inviteCreationError', {
					errorType: 'channel already shared with at least 100 other devices',
					devicesCount,
				});
				throw new BadRequestException();
			}
		}

		// Create and return the channel invite.
		const result = await this.channelsService.createChannelInvite(
			channelId,
			passcode,
			channelType,
			encryptedEncryptKey,
			inviteBody.originPublicKey
		);
		this.metricsService.recordEvent('channel:invite:created', {
			channelType,
			devicesCount,
		});
		return result;
	}

	/**
	 * getInvites retrieves the invites for a channel.
	 * @param {string} channelId
	 * @param {AuthedRequest} request
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Get(':channelId/invites')
	async getInvites(
		@Param('channelId') channelId: string,
		@Req() request: AuthedRequest
	) {
		const { deviceId } = request;
		if (!validateUuid(channelId)) {
			throw new BadRequestException();
		}

		// Check that the password to access the channel is correct.
		const passcode = request.get('x-confi-passcode');
		await this._validateChannelPasscode(
			channelId,
			passcode,
			'channel:invitesListError'
		);

		// Check that the device has permission to write invites
		await this._validatePermissions(
			deviceId,
			channelId,
			[WriteInvitePermission],
			'channel:invitesListError'
		);

		// Get and return the invites for the channel.
		const invites = await this.channelsService.getInvites(channelId);
		return invites;
	}

	/**
	 * deleteChannelInvite deletes an invite to a channel.
	 * @param {string} inviteId
	 * @param {string} channelId
	 * @param {AuthedRequest} request
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Delete(':channelId/invites/:inviteId')
	async deleteChannelInvite(
		@Param('inviteId') inviteId: string,
		@Param('channelId') channelId: string,
		@Req() request: AuthedRequest
	) {
		if (!validateUuid(inviteId) || !validateUuid(channelId)) {
			throw new BadRequestException();
		}
		const { deviceId } = request;

		// Check that the password to access the channel is correct.
		const passcode = request.get('x-confi-passcode');
		await this._validateChannelPasscode(
			channelId,
			passcode,
			'channel:deleteInviteError'
		);

		// Check that the invite exists.
		const inviteExists = await this.channelsService.channelInviteExists(
			inviteId
		);
		if (!inviteExists) {
			// The invite may have already been deleted, probably no error here.
			return undefined;
		}

		// Check that the invite is actually linked to the channel its claimed to
		// be linked to.
		const realChannelId = await this.channelsService.getInviteChannelId(
			inviteId
		);
		if (realChannelId !== channelId) {
			throw new BadRequestException();
		}

		// Check that the device has permisison to delete invites for this channel
		await this._validatePermissions(
			deviceId,
			realChannelId,
			[WriteDeleteInvitePermission],
			'channel:deleteInviteError'
		);

		// Delete the channel.
		await this.channelsService.deleteChannelInvite(inviteId);
	}

	/**
	 * checkChannelInvite checks that an invite really exists.
	 *
	 * Unlike many other
	 * requests here, this one does not check the channel passcode. This is
	 * deliberate: when a device makes this request - it has not yet accepted
	 * the invite and therefore has no passcode nor permissions to the channel.
	 * All it is allowed to do is check if the invite still exists and get the
	 * type of channel attached to the invite.
	 *
	 * @param {string} inviteId
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Get('invites/:inviteId')
	async checkChannelInvite(@Param('inviteId') inviteId: string) {
		if (!validateUuid(inviteId)) {
			throw new BadRequestException();
		}
		const inviteExists = await this.channelsService.channelInviteExists(
			inviteId
		);
		if (!inviteExists) {
			throw new NotFoundException();
		}
		const channelId = await this.channelsService.getInviteChannelId(inviteId);
		const channelType = await this.channelsService.getChannelType(channelId);
		this.metricsService.recordEvent('channel:invite:validated', {
			channelType,
		});
		return { channelType };
	}

	/**
	 * consumeInvite consumes an invite for a channel.
	 *
	 * For bidirectional channels this means the invite will be deleted,
	 * preventing subsequent use of the invite.
	 *
	 * For unidirectional channels, the invite will remain active. Multiple
	 * devices are able to accept unidirectional channel invites.
	 *
	 * @param {string} inviteId
	 * @param {AuthedRequest} request
	 * @param {InviteConsumePayload} inviteConsumeBody
	 */
	@UseGuards(EncryptedJwtAuthGuard())
	@Post('invites/:inviteId')
	async consumeInvite(
		@Param('inviteId') inviteId: string,
		@Req() request: AuthedRequest,
		@Body() inviteConsumeBody: InviteConsumePayload
	) {
		if (!validateUuid(inviteId)) {
			throw new BadRequestException();
		}
		const { deviceId } = request;

		// Confirm the invite exists
		const inviteExists = await this.channelsService.channelInviteExists(
			inviteId
		);
		if (!inviteExists) {
			throw new NotFoundException();
		}

		// Get invite and channel details
		const channelId = await this.channelsService.getInviteChannelId(inviteId);
		const channelInfo = await this.channelsService.getChannelInfo(channelId);
		const { channelType } = channelInfo;
		if (
			channelType === 'bidirectional' &&
			!inviteConsumeBody.receiverPublicKey
		) {
			// Check that devices consuming bidirectional invites include a public
			// key.
			this.metricsService.recordEvent('channel:inviteConsumeError', {
				errorType: 'The receiver public key is required',
			});
			throw new BadRequestException();
		} else if (
			channelType === 'unidirectional' &&
			inviteConsumeBody.receiverPublicKey
		) {
			// Check that devices consuming unidirectional invites do not include
			// a public key (these channel types send public keys along with messages
			// being sent).
			this.metricsService.recordEvent('channel:inviteConsumeError', {
				errorType:
					'The receiver public key should not be provided when consuming invite to unidirectional channel',
			});
			throw new BadRequestException();
		}
		const invitePasscode = request.get('x-confi-passcode');
		switch (channelType) {
			case 'bidirectional': {
				// Consume a bidirectional invite (deletes it)
				const channelInvite =
					await this.channelsService.getChannelInviteAndRemove(inviteId);

				// Check the invite passcode is valid.
				if (
					!this._getInvitePasscodeIsValid(
						invitePasscode,
						channelInvite.passcodeHashSalt,
						channelInvite.passcodeHash
					)
				) {
					// Re-add the invite to the DB - validation failed, therefore it is
					// not going to be consumed.
					await this.channelsService.saveChannelInvite(channelInvite);
					this.metricsService.recordEvent('channel:inviteConsumeError', {
						errorType: 'Invite passcode is invalid',
						channelType,
					});
					throw new BadRequestException();
				}
				// Check that consuming the invite doesn't result in more than 2
				// devices having access to the channel.
				const devicesCount =
					await this.channelsService.getCountOfDevicesForChannel(channelId);
				if (devicesCount > 1) {
					this.metricsService.recordEvent('channel:inviteConsumeError', {
						errorType: 'The channel already has at least 1 other devices in it',
						devicesCount,
					});
					throw new BadRequestException();
				}
				// Save the edge connecting the device to the channel with associated
				// permissions.
				const permissions = [
					WriteDeleteOwnDevicePermission,
					WritePushPermission,
					ReadPullPermission,
				];
				const edge = {
					deviceId,
					channelId,
					permissions,
					tempPublicKey: inviteConsumeBody.receiverPublicKey,
				};
				try {
					await this.devicesService.createDeviceToChannelEdge(edge);
				} catch (err) {
					if (err.message !== ERROR_MESSAGE_CHANNEL_ALREADY_EXISTS) {
						throw err;
					}
				}
				this.metricsService.recordEvent('channel:invite:consumed-existing');
				return {
					channelType,
					channelId: channelInfo.id,
					channelName: channelInfo.name,
					channelPasscode: channelInvite.channelPasscode,
					updateTimestamp: channelInfo.updateTimestamp,
					creationTimestamp: channelInfo.creationTimestamp,
					encryptedEncryptKey: channelInvite.encryptedEncryptKey,
					originPublicKey: channelInvite.originPublicKey,
				};
			}
			case 'unidirectional': {
				// Consume a unidirectional invite (it is not deleted and remains
				// active until deleted by a device)
				const channelInvite = await this.channelsService.getChannelInvite(
					inviteId
				);

				// Check the invite passcode is valid.
				if (
					!this._getInvitePasscodeIsValid(
						invitePasscode,
						channelInvite.passcodeHashSalt,
						channelInvite.passcodeHash
					)
				) {
					this.metricsService.recordEvent('channel:inviteConsumeError', {
						errorType: 'Invite passcode is invalid',
						channelType,
					});
					throw new BadRequestException();
				}

				// Save device permissions for the channel.
				const permissions = [
					WriteDeleteOwnDevicePermission,
					WritePushPermission,
				];
				const edge = {
					deviceId,
					channelId,
					permissions,
				};
				try {
					await this.devicesService.createDeviceToChannelEdge(edge);
					// Increment the number of times this invite has been accepted.
					await this.channelsService.incrementInviteAcceptsCount(channelInvite);
				} catch (err) {
					if (err.message !== ERROR_MESSAGE_CHANNEL_ALREADY_EXISTS) {
						throw err;
					}
				}
				this.metricsService.recordEvent('channel:invite:consumed-existing');
				return {
					channelType,
					channelId: channelInfo.id,
					channelName: channelInfo.name,
					channelPasscode: channelInvite.channelPasscode,
					updateTimestamp: channelInfo.updateTimestamp,
					creationTimestamp: channelInfo.creationTimestamp,
					encryptedEncryptKey: channelInvite.encryptedEncryptKey,
					originPublicKey: channelInvite.originPublicKey,
				};
			}
			default: {
				this.metricsService.recordEvent('channel:inviteConsumeError', {
					errorType: 'channelType unrecognised',
					channelType,
				});
				throw new InternalServerErrorException();
			}
		}
	}

	// Returns boolean indicating if invite passcode is valid or not.
	private _getInvitePasscodeIsValid(
		invitePasscode: string,
		invitePasscodeSalt: string,
		invitePasscodeHash: string
	) {
		const hashResult = generateHmac(invitePasscode, invitePasscodeSalt);
		return hashResult.hash === invitePasscodeHash;
	}

	// Throws an error if the channel passcode is invalid.
	private async _validateChannelPasscode(
		channelId: string,
		challengePasscode: string,
		metricErrorEvent: string
	) {
		// TODO make sure to hash everything (or at least hash every request)
		if (!challengePasscode || typeof challengePasscode !== 'string') {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'Invalid channel passcode type',
				passcodeType: typeof challengePasscode,
			});
			throw new BadRequestException();
		}
		if (challengePasscode.length !== 44) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'Invalid channel passcode length',
				passcodeLength: challengePasscode.length,
			});
			throw new BadRequestException();
		}
		const passcodeInfo = await this.channelsService.getPasscodeHashInfo(
			channelId
		);
		const { passcodeHash, passcodeHashSalt } = passcodeInfo;
		const challengeHashResult = generateHmac(
			challengePasscode,
			passcodeHashSalt
		);
		if (challengeHashResult.hash !== passcodeHash) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'Channel passcode hash does not match stored hash',
			});
			throw new ForbiddenException();
		}
	}

	// Throws an error if the encrypted channel encryption key is invalid.
	private async _validateEncryptedEncryptKey(
		encryptedEncryptKey: string,
		metricErrorEvent: string
	) {
		if (!encryptedEncryptKey || typeof encryptedEncryptKey !== 'string') {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'Invalid encrypted passcode type',
				encryptedPasscodeType: typeof encryptedEncryptKey,
			});
			throw new BadRequestException();
		}
		const parts = encryptedEncryptKey.split('.');
		if (parts.length !== 3) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'Invalid encrypted passcode parts length',
				partsLength: parts.length,
			});
			throw new BadRequestException();
		}
		const [iv, salt, encryptedValue] = parts;
		// Check base64 salt length
		if (salt.length !== 24) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'Invalid salt length',
				saltLength: salt.length,
			});
			throw new BadRequestException();
		}
		// Check base64 iv length
		if (iv.length !== 16) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'Invalid iv length',
				ivLength: iv.length,
			});
			throw new BadRequestException();
		}
		// Check base64 encrypted value length
		if (encryptedValue.length !== 56) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'Invalid encrypted value length',
				encryptedValueLength: encryptedValue.length,
			});
			throw new BadRequestException();
		}
	}

	// Throws an error does not have the asserted permissions for the given
	// channel.
	private async _validatePermissions(
		deviceId: string,
		channelId: string,
		expectedPermissions: string[],
		metricErrorEvent: string
	) {
		const deviceToChannel = await this.devicesService.getDeviceToChannelEdge({
			deviceId,
			channelId,
		});
		if (!deviceToChannel) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'deviceToChannel not found',
			});
			throw new ForbiddenException();
		}
		const actualPermissions = new Set(deviceToChannel.permissions);
		for (const permission of expectedPermissions) {
			if (!actualPermissions.has(permission)) {
				this.metricsService.recordEvent(metricErrorEvent, {
					errorType: 'permission not found',
				});
				throw new ForbiddenException();
			}
		}
	}

	// Returns true if the device has the asserted permissions, false otherwise.
	private async _hasPermissions(
		deviceId: string,
		channelId: string,
		testPermissions: string[]
	) {
		const deviceToChannel = await this.devicesService.getDeviceToChannelEdge({
			deviceId,
			channelId,
		});
		if (!deviceToChannel) {
			return false;
		}
		const actualPermissions = new Set(deviceToChannel.permissions);
		for (const permission of testPermissions) {
			if (!actualPermissions.has(permission)) {
				return false;
			}
		}
		return true;
	}

	private _validateEncryptedValueLength(
		subscription: Subscription | null,
		encryptedValueCipherLength: number,
		metricErrorEvent: string
	) {
		// Check the length of the encrypted value based on the subscription
		// which the user has.
		if (subscription) {
			if (encryptedValueCipherLength > 4000024) {
				this.metricsService.recordEvent(metricErrorEvent, {
					errorType: 'length of encrypted message above 4000024',
					hasSubscription: true,
					encryptedValueLength: encryptedValueCipherLength,
				});
				throw new BadRequestException('The size of the message is too large.');
			}
		} else {
			if (encryptedValueCipherLength > 40024) {
				this.metricsService.recordEvent(metricErrorEvent, {
					errorType: 'length of encrypted message above 40024',
					hasSubscription: false,
					encryptedValueLength: encryptedValueCipherLength,
				});
				throw new BadRequestException(
					'Max size of message reached. Upgrade to send larger values.'
				);
			}
		}
	}

	private _validatePasswordOrSharedKeyEncryptedValue(
		subscription: Subscription | null,
		value: ChannelEncryptedMessage,
		metricErrorEvent: string
	) {
		if (typeof value.salt !== 'string') {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'type of salt was not string',
				saltType: typeof value.salt,
			});
			throw new BadRequestException();
		}
		if (value.salt.length !== 24) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType:
					'salt was required but was not provided or was of invalid length',
				saltLength: value.salt.length,
			});
			throw new BadRequestException();
		}
		if (typeof value.iv !== 'string') {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'type of iv was not string',
				ivType: typeof value.iv,
			});
			throw new BadRequestException();
		}
		if (value.iv.length !== 16) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'iv length was not 16',
				ivLength: value.iv.length,
			});
			throw new BadRequestException();
		}
		if (typeof value.cipher !== 'string') {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'type of encrypted value was not string',
				encryptedValueType: typeof value.cipher,
			});
			throw new BadRequestException();
		}
		this._validateEncryptedValueLength(
			subscription,
			value.cipher.length,
			metricErrorEvent
		);
	}

	private _validatePublicPrivateEncryptedValue(
		subscription: Subscription | null,
		value: ChannelEncryptedMessage,
		metricErrorEvent: string
	) {
		if (value.salt) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'salt was set for public-private encrypted value',
				ivType: typeof value.iv,
			});
			throw new BadRequestException();
		}
		// Check the type and length of the iv
		if (typeof value.iv !== 'string') {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'type of iv was not string',
				ivType: typeof value.iv,
			});
			throw new BadRequestException();
		}
		if (value.iv.length !== 16) {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'iv length was not 16',
				ivLength: value.iv.length,
			});
			throw new BadRequestException();
		}
		if (typeof value.cipher !== 'string') {
			this.metricsService.recordEvent(metricErrorEvent, {
				errorType: 'type of encrypted value was not string',
				encryptedValueType: typeof value.cipher,
			});
			throw new BadRequestException();
		}
		this._validateEncryptedValueLength(
			subscription,
			value.cipher.length,
			metricErrorEvent
		);
	}

	private _validateEncryptedValueForUnidirectionalChannel(
		subscription: Subscription | null,
		encryptionMode: EncryptionMode,
		value: ChannelEncryptedMessage,
		senderPublicKey: JsonWebKey,
		metricErrorEvent: string
	) {
		switch (encryptionMode) {
			case 'end-to-end-password':
				this._validatePasswordOrSharedKeyEncryptedValue(
					subscription,
					value,
					metricErrorEvent
				);
				break;
			case 'end-to-end-private-public':
				this._validatePublicPrivateEncryptedValue(
					subscription,
					value,
					metricErrorEvent
				);
				break;
			default:
				throw new BadRequestException();
		}
		if (encryptionMode === 'end-to-end-private-public') {
			if (!senderPublicKey) {
				this.metricsService.recordEvent(metricErrorEvent, {
					errorType:
						'unidirectional message was sent without sender public key',
				});
				throw new BadRequestException();
			}
			if (!isValidEchdPublicKey(senderPublicKey)) {
				this.metricsService.recordEvent(metricErrorEvent, {
					errorType: 'unidirectional message sent with invalid public key',
				});
				throw new BadRequestException();
			}
		}
	}

	// Throws an error if the encrypted value does not fit the format/length
	// boundries for encrypted values.
	private _validateEncryptedValueForBidirectionalChannel(
		subscription: Subscription | null,
		encryptionMode: EncryptionMode,
		value: ChannelEncryptedMessage,
		metricErrorEvent: string
	) {
		switch (encryptionMode) {
			case 'end-to-end-password':
			case 'end-to-end-shared':
				this._validatePasswordOrSharedKeyEncryptedValue(
					subscription,
					value,
					metricErrorEvent
				);
				break;
			case 'end-to-end-private-public':
				this._validatePublicPrivateEncryptedValue(
					subscription,
					value,
					metricErrorEvent
				);
				break;
			default:
				throw new BadRequestException();
		}
	}

	private async _createUnidirectionalChannel(
		channelCreatePayload: ChannelCreatePayload & {
			channelType: 'unidirectional';
		},
		subscription: Subscription | null,
		deviceId: string
	) {
		if (channelCreatePayload.message) {
			throw new BadRequestException();
		}
		if (channelCreatePayload.encryptionMode !== 'none') {
			throw new BadRequestException();
		}
		const result = await this.channelsService.createChannel({
			channelType: channelCreatePayload.channelType,
			deviceId,
			encryptionMode: 'none',
		});
		this.metricsService.recordEvent(`channel:created`, {
			hasSubscription: !!subscription,
			channelType: channelCreatePayload.channelType,
			withValue: false,
		});
		return result;
	}

	private async _createBidirectionalChannel(
		channelCreatePayload: ChannelCreatePayload & {
			channelType: 'bidirectional';
		},
		subscription: Subscription | null,
		deviceId: string
	) {
		if (channelCreatePayload.message && channelCreatePayload.message.cipher) {
			if (
				!(
					channelCreatePayload.encryptionMode === 'end-to-end-password' ||
					channelCreatePayload.encryptionMode === 'end-to-end-shared'
				)
			) {
				throw new BadRequestException();
			}
			this._validateEncryptedValueForBidirectionalChannel(
				subscription,
				channelCreatePayload.encryptionMode,
				channelCreatePayload.message,
				'channel:creationError'
			);
			const result = await this.channelsService.createChannel({
				deviceId,
				channelType: channelCreatePayload.channelType,
				encryptionMode: channelCreatePayload.encryptionMode,
				encryptedValue: channelCreatePayload.message.cipher,
				encryptedValueIv: channelCreatePayload.message.iv,
				encryptedValueSalt: channelCreatePayload.message.salt,
			});
			this.metricsService.recordEvent(`channel:created`, {
				hasSubscription: !!subscription,
				channelType: channelCreatePayload.channelType,
				withValue: true,
			});
			return result;
		} else {
			if (channelCreatePayload.encryptionMode !== 'none') {
				throw new BadRequestException();
			}
			const result = await this.channelsService.createChannel({
				deviceId,
				channelType: channelCreatePayload.channelType,
				encryptionMode: channelCreatePayload.encryptionMode,
			});
			this.metricsService.recordEvent(`channel:created`, {
				hasSubscription: !!subscription,
				channelType: channelCreatePayload.channelType,
				withValue: false,
			});
			return result;
		}
	}

	private _validateMessageValuePayloadProps(payload: ChannelEncryptedMessage) {
		if (typeof payload !== 'object') {
			throw new BadRequestException();
		}
		const props = Object.keys(payload);
		for (const prop of props) {
			if (!PROPS_ALLOWED_IN_CHANNEL_MESSAGE_PAYLOAD.has(prop)) {
				throw new BadRequestException();
			}
		}
	}

	private _validateChannelPayloadPropNames(
		payload: ChannelCreatePayload | ChannelMessageUpdatePayload,
		propNamesAllowed: Set<string>
	) {
		if (typeof payload !== 'object') {
			throw new BadRequestException();
		}
		const props = Object.keys(payload);
		for (const prop of props) {
			if (!propNamesAllowed.has(prop)) {
				throw new BadRequestException();
			}
			if (prop === 'value') {
				this._validateMessageValuePayloadProps(payload.message);
			}
		}
	}
}
