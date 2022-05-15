import { randomBytes } from 'crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { aql, Database } from 'arangojs';
import { DocumentCollection } from 'arangojs/collection';

import { DevicesService } from '../devices/devices.service';
import { SettingsService } from '../settings/settings.service';
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
import { generateHmac } from '../helpers/generateHmac';
import { SaveableChannelInvite } from './types/SaveableChannelInvite';
import { EcdhJsonWebKey } from '../types/EcdhJsonWebKey';
import { NewChannelParams } from './types/NewChannelParams';
import { ExportableNewChannel } from './types/ExportableNewChannel';
import { getRandomName } from '../helpers/getRandomName';
import { ChannelBase } from './types/ChannelBase';
import { ChannelInviteBase } from './types/ChannelInviteBase';
import { ChannelPasscodeHash } from './types/ChannelPasscodeHash';
import { ChannelType } from './types/ChannelType';
import { ChannelMessageUpdatePayload } from './types/ChannelMessageUpdatePayload';
import { ExportableChannelInvite } from './types/ExportableChannelInvite';
import { PulledChannel } from './types/PulledChannel';
import { SaveableChannel } from './types/SaveableChannel';
import { ExportableInviteListItem } from './types/ExportableInviteListItem';
import { DeviceToChannelEdgeCollection } from '../types/DeviceToChannelEdgeCollection';
import { ChannelInfo } from './types/ChannelInfo';
import { ChannelInviteDbDoc } from './types/ChannelInviteDbDoc';

@Injectable()
export class ChannelsService {
	private channelsCollection: DocumentCollection;
	private invitesCollection: DocumentCollection;
	private devicesToChannelsCollection: DeviceToChannelEdgeCollection;

	constructor(
		@Inject(Database)
		private db: Database,
		@Inject(DevicesService)
		private devicesService: DevicesService,
		@Inject(SettingsService)
		private settingsService: SettingsService
	) {
		this.devicesToChannelsCollection = this.db.collection('devicesToChannels');
		const channelsCollection = this.db.collection('channels');
		this.channelsCollection = channelsCollection;
		const invitesCollection = this.db.collection('invites');
		this.invitesCollection = invitesCollection;

		// Initialise db run here to ensure that, when the channels service starts,
		// the correct collections and indices are available in the database.
		const initialiseDb = async () => {
			try {
				await channelsCollection.create();
			} catch (err) {
				if (err.response?.statusCode !== 409) {
					console.error(`Error creating channels collection`);
					console.error(err);
				}
			}
			try {
				await channelsCollection.ensureIndex({
					type: 'ttl',
					name: 'updateTimestampTtlIndex',
					fields: ['updateTimestamp'],
					expireAfter: 31557600, // 365.25 days. In seconds.
				});
			} catch (err) {
				if (err.response?.statusCode !== 409) {
					console.error(`Error creating channels ttl index`);
					console.error(err);
				}
			}
			try {
				await invitesCollection.create();
			} catch (err) {
				if (err.response?.statusCode !== 409) {
					console.error(`Error creating invites collection`);
					console.error(err);
				}
			}
			try {
				await invitesCollection.ensureIndex({
					type: 'ttl',
					name: 'expiresTtlIndex',
					fields: ['expires'],
					expireAfter: 0,
				});
			} catch (err) {
				if (err.response?.statusCode !== 409) {
					console.error(`Error creating invites ttl index`);
					console.error(err);
				}
			}
			try {
				await invitesCollection.ensureIndex({
					type: 'persistent',
					name: 'channelIdPersistentIndex',
					fields: ['channelId'],
					sparse: true,
				});
			} catch (err) {
				if (err.response?.statusCode !== 409) {
					console.error(`Error creating persistent index`);
					console.error(err);
				}
			}
		};
		initialiseDb();
	}

	/**
	 * Gets passcode hash and passcode hash salt for a given channel.
	 * @param {string} channelId
	 */
	async getPasscodeHashInfo(channelId: string) {
		const channelSearch = await this.db.query(aql`
			LET channel = DOCUMENT(${this.channelsCollection}, ${channelId})
			RETURN {
				id: channel.id,
				passcodeHash: channel.passcodeHash,
				passcodeHashSalt: channel.passcodeHashSalt,
			}
		`);
		if (!channelSearch.hasNext) {
			return null;
		}
		const channelPasscodeInfo = (await channelSearch.next()) as {
			id: string;
			passcodeHash: string;
			passcodeHashSalt: string;
		};
		if (
			!channelPasscodeInfo ||
			!channelPasscodeInfo.id ||
			!channelPasscodeInfo.passcodeHash ||
			!channelPasscodeInfo.passcodeHashSalt ||
			typeof channelPasscodeInfo.passcodeHash !== 'string' ||
			typeof channelPasscodeInfo.passcodeHashSalt !== 'string'
		) {
			return null;
		}
		return channelPasscodeInfo;
	}

	/**
	 * Gets the number of invites created for a channel.
	 */
	async getCountOfInvitesForChannel(channelId: string): Promise<number> {
		const result = await this.db.query(
			aql`
				FOR invite IN invites
					FILTER invite.channelId == ${channelId}
					RETURN invite.id
			`,
			{ count: true }
		);
		return result.count;
	}

	/**
	 * If any public keys are saved (from devices which recently accepted invites
	 * to the channel), they are deleted and returned (i.e. popped).
	 * @param {string} channelId
	 */
	async popChannelPublicKeys(channelId: string): Promise<EcdhJsonWebKey[]> {
		const result = await this.db.query(aql`
			FOR edge IN devicesToChannels
				FILTER edge._to == ${`channels/${channelId}`}
				RETURN { _key: edge._key, publicKey: edge.tempPublicKey }
		`);
		const edgesWithPublicKeys = [];
		while (result.hasNext) {
			const edge = await result.next();
			if (edge.publicKey) {
				edgesWithPublicKeys.push(edge);
			}
		}
		for (const edge of edgesWithPublicKeys) {
			await this.devicesToChannelsCollection.update(edge._key, {
				tempPublicKey: null,
			});
		}
		return edgesWithPublicKeys.map(
			(edge) => edge.publicKey
		) as EcdhJsonWebKey[];
	}

	/**
	 * Gets the number of devices which are linked to the channel.
	 * @param {string} channelId
	 */
	async getCountOfDevicesForChannel(channelId: string): Promise<number> {
		const result = await this.db.query(
			aql`
				FOR edge IN devicesToChannels
					FILTER edge._to == ${`channels/${channelId}`}
					RETURN edge._key
			`,
			{ count: true }
		);
		return result.count;
	}

	/**
	 * Gets the number of channels which are linked to the device.
	 * @param {string} deviceId
	 */
	async getCountOfChannelsForDevice(deviceId: string): Promise<number> {
		const result = await this.db.query(
			aql`
				FOR edge IN devicesToChannels
					FILTER edge._from == ${`devices/${deviceId}`}
					RETURN edge._key
			`,
			{ count: true }
		);
		return result.count;
	}

	/**
	 * Creates a new channel.
	 * @param {NewChannelParams} params
	 */
	async createChannel(params: NewChannelParams): Promise<ExportableNewChannel> {
		const {
			encryptionMode,
			encryptedValue,
			encryptedValueIv,
			encryptedValueSalt,
			channelType,
		} = params;

		// Timestamps are done in seconds.
		const creationTimestamp = Math.round(Date.now() / 1000);
		const channelBase: ChannelBase = {
			id: uuidv4(),
			name: getRandomName(),
			channelType,
			creationTimestamp,
			updateTimestamp: creationTimestamp,
		};
		const channelKey = `channels/${channelBase.id}`;
		// Very unlikely, but check that the document id doesn't already
		// exist.
		if (await this.channelsCollection.documentExists(channelBase.id)) {
			throw new Error('Channel id already exists');
		}
		// Ensure no stale invites or permission edges exist for the given channel.
		await Promise.all([
			this.db.query(aql`
				FOR invite IN invites
				FILTER invite.channelId == ${channelBase.id}
				REMOVE { _key: invite._key } IN invites
			`),
			this.db.query(aql`
				FOR edge IN devicesToChannels
				FILTER edge._to == ${channelKey}
				REMOVE { _key: edge._key } IN devicesToChannels
			`),
		]);
		const passcode = randomBytes(32).toString('base64');
		const hashResult = generateHmac(passcode);
		const saveableChannel: SaveableChannel = Object.assign({}, channelBase, {
			_key: channelBase.id,
			passcodeHashSalt: hashResult.salt,
			passcodeHash: hashResult.hash,
			encryptionMode,
		});
		saveableChannel.e2eEncryptedValue = encryptedValue;
		saveableChannel.e2eEncryptedValueIv = encryptedValueIv;
		saveableChannel.e2eEncryptedValueSalt = encryptedValueSalt;

		await this.channelsCollection.save(saveableChannel, {
			// Conflict means: if the channel id already exists in the db, then fail.
			// This is default behaviour, but explicit definition means its enforced
			// even if defaults change in the library.
			overwriteMode: 'conflict',
		});

		// Device-to-channel edge is primarily used when looking up which
		// permissions a device has to a given channel.
		await this.devicesService.createDeviceToChannelEdge({
			deviceId: params.deviceId,
			channelId: saveableChannel.id,
			permissions: [
				WriteDeleteChannelPermission,
				WriteDeleteInvitePermission,
				WriteDeleteOwnDevicePermission,
				WriteInvitePermission,
				WritePushPermission,
				ReadInviteListPermission,
				ReadPullPermission,
				PopPublicKeyPermission,
			],
		});

		// Return the newly created channel.
		const exportableChannel: ExportableNewChannel = Object.assign(
			{},
			channelBase,
			{
				passcodeBase64: passcode,
				encryptionMode,
			}
		);

		return exportableChannel;
	}

	/**
	 * Given an invite id, returns the id of the channel which is targeted by the
	 * invite.
	 * @param {string} inviteId
	 */
	async getInviteChannelId(inviteId: string): Promise<string> {
		const invitesSearch = await this.db.query(aql`
			LET invite = DOCUMENT(${this.invitesCollection}, ${inviteId})
			RETURN {
				channelId: invite.channelId
			}
		`);
		if (!invitesSearch.hasNext) {
			throw new NotFoundException('Invite not found');
		}
		const channel = await invitesSearch.next();
		if (!channel) {
			throw new NotFoundException('Invite not found');
		}
		return channel.channelId as string;
	}

	/**
	 * Returns the type of a channel.
	 * @param {string} channelId
	 */
	async getChannelType(channelId: string): Promise<ChannelType> {
		// Only return the channel values required to create the channel invite
		const channelSearch = await this.db.query(aql`
			LET channel = DOCUMENT(${this.channelsCollection}, ${channelId})
			RETURN {
				channelType: channel.channelType,
			}
		`);
		if (!channelSearch.hasNext) {
			throw new NotFoundException('Channel not found');
		}
		const channel = await channelSearch.next();
		return channel.channelType as ChannelType;
	}

	/**
	 * Returns details about the stored passcode hash for a given channel.
	 * @param {string} channelId
	 */
	async getChannelPasscodeHash(
		channelId: string
	): Promise<ChannelPasscodeHash> {
		// Only return the channel values required to create the channel invite
		const channelSearch = await this.db.query(aql`
			LET channel = DOCUMENT(${this.channelsCollection}, ${channelId})
			RETURN {
				_key: channel._key,
				id: channel.id,
				name: channel.name,
				passcodeHash: channel.passcodeHash,
				passcodeHashSalt: channel.passcodeHashSalt,
				creationTimestamp: channel.creationTimestamp,
				updateTimestamp: channel.updateTimestamp
			}
		`);
		if (!channelSearch.hasNext) {
			throw new NotFoundException('Channel not found');
		}
		const channel = await channelSearch.next();
		if (!channel) {
			throw new NotFoundException('Channel not found');
		}
		return channel as ChannelPasscodeHash;
	}

	/**
	 * Creates an invite to a channel.
	 * @param {string} channelId
	 * @param {string} channelPasscode
	 * @param {ChannelType} channelType
	 * @param {string} encryptedEncryptKey
	 * @param {EcdhJsonWebKey} originPublicKey
	 */
	async createChannelInvite(
		channelId: string,
		channelPasscode: string,
		channelType: ChannelType,
		encryptedEncryptKey: string,
		originPublicKey: EcdhJsonWebKey
	): Promise<ExportableChannelInvite> {
		const nowInSeconds = Math.round(Date.now() / 1000);
		const baseInvite: ChannelInviteBase = {
			id: uuidv4(),
			channelId,
			channelType,
			creationTimestamp: nowInSeconds,
			// TODO allow expires to be set by user
			expires:
				nowInSeconds +
				(channelType === 'bidirectional'
					? 172800 // 48 hours for bidirectional
					: 31557600), // 1 year for unidirectional
		};

		// Generate a passcode for the invite. (The invite is only able to be
		// accepted if the user can provide the passcode when consuming the invite).
		const invitePasscode = randomBytes(12).toString('base64');
		const invitePasscodeHashResult = generateHmac(invitePasscode);
		const saveableInvite: SaveableChannelInvite = Object.assign(
			{},
			baseInvite,
			{
				_key: baseInvite.id,
				channelPasscode: channelPasscode,
				encryptedEncryptKey,
				passcodeHash: invitePasscodeHashResult.hash,
				passcodeHashSalt: invitePasscodeHashResult.salt,
				originPublicKey,
				inviteAcceptsCount: 0,
			} as Partial<SaveableChannelInvite>
		) as SaveableChannelInvite;
		await this.invitesCollection.save(saveableInvite, {
			// Conflict means: if the invite id already exists in the db, then fail.
			// This is default behaviour, but explicit definition means its enforced
			// even if defaults change in the library.
			overwriteMode: 'conflict',
		});

		// Return the exportable parts of the invite.
		const exportableInvite: ExportableChannelInvite = Object.assign(
			{},
			baseInvite,
			{ passcode: invitePasscode }
		);
		return exportableInvite;
	}

	/**
	 * Returns boolean value indicating whether the invite exists or not.
	 * @param {string} inviteId
	 */
	async channelInviteExists(inviteId: string) {
		const inviteExists = await this.invitesCollection.documentExists(inviteId);
		return inviteExists;
	}

	/**
	 * Deletes an invite.
	 * Todo: de-activate invites rather than deleting them.
	 * @param {string} inviteId
	 */
	async deleteChannelInvite(inviteId: string) {
		await this.invitesCollection.remove(inviteId);
	}

	/**
	 * Return a list of all saved invites.
	 * @param {string} channelId
	 */
	async getInvites(channelId: string) {
		const cursor = await this.db.query(aql`
			FOR doc IN ${this.invitesCollection}
				FILTER doc.channelId == ${channelId}
				RETURN {
					id: doc.id,
					channelId: doc.channelId,
					channelType: doc.channelType,
					creationTimestamp: doc.creationTimestamp,
					expires: doc.expires,
					inviteAcceptsCount: doc.inviteAcceptsCount,
				}
		`);
		const invites = (await cursor.all()) as ExportableInviteListItem[];
		return invites;
	}

	/**
	 * Returns a boolean value indicating if the channel has outstanding invites
	 * or not.
	 * @param {string} channelId
	 */
	async channelHasOutstandingInvite(channelId: string) {
		const channelCount = await this.getCountOfInvitesForChannel(channelId);
		return !!channelCount;
	}

	/**
	 * Gets channel meta data. This is used to fetch channel information without
	 * returning channel message data (to help adhere to the strict only-return-
	 * message-once policy).
	 * @param {string} channelId
	 */
	async getChannelInfo(channelId: string) {
		const channelInfoSearchResult = await this.db.query(aql`
			LET channel = DOCUMENT(${this.channelsCollection}, ${channelId})
			RETURN {
				_key: channel._key,
				id: channel.id,
				name: channel.name,
				channelType: channel.channelType,
				passcodeHash: channel.passcodeHash,
				passcodeHashSalt: channel.passcodeHashSalt,
				creationTimestamp: channel.creationTimestamp,
				updateTimestamp: channel.updateTimestamp,
			}
		`);
		if (!channelInfoSearchResult.hasNext) {
			throw new Error('Channel not found');
		}
		const channelInfo = (await channelInfoSearchResult.next()) as
			| ChannelInfo
			| undefined;
		if (!channelInfo) {
			throw new Error('Channel info not found');
		}
		return channelInfo;
	}

	/**
	 * Increments the number of times an invite has been accepted by one. This
	 * is used only for unidirectional invites which can be accepted by more
	 * than one device.
	 * @param {{id: string, inviteAcceptsCount: number}} invite
	 */
	async incrementInviteAcceptsCount(invite: {
		id: string;
		inviteAcceptsCount?: number;
	}) {
		await this.invitesCollection.update(invite.id, {
			inviteAcceptsCount: (invite.inviteAcceptsCount || 0) + 1,
		});
	}

	/**
	 * Returns channel data, including its message. If the channel had message
	 * data, it will be removed before being returned as part of this operation.
	 * Since this is the only operation which returns message data, this means
	 * channel messages can be returned once.
	 * @param {string} channelId
	 */
	async pull(channelId: string): Promise<PulledChannel> {
		// Pull operations cause the update timestamp to be set to the current
		// time.
		const updateTimestamp = Math.round(Date.now() / 1000);
		const channelUpdate = {
			encryptionMode: 'end-to-end-shared',
			e2eEncryptedValue: null,
			e2eEncryptedValueIv: null,
			e2eEncryptedValueSalt: null,
			senderPublicKey: null,
			updateTimestamp,
		};
		const updateResult = await this.channelsCollection.update(
			channelId,
			channelUpdate,
			{
				returnOld: true,
				waitForSync: true,
			}
		);
		const oldChannel = updateResult.old as SaveableChannel;
		const {
			e2eEncryptedValue,
			e2eEncryptedValueIv,
			e2eEncryptedValueSalt,
			encryptionMode,
			channelType,
			senderPublicKey,
		} = oldChannel;
		return {
			id: channelId,
			creationTimestamp: oldChannel.creationTimestamp,
			updateTimestamp,
			channelType,
			encryptionMode,
			e2eEncryptedValue,
			e2eEncryptedValueIv,
			e2eEncryptedValueSalt,
			senderPublicKey,
		};
	}

	/**
	 * Updates the encrypted message data of a channel.
	 * @param {string} channelId
	 * @param {ChannelMessageUpdatePayload} valueInput
	 */
	async push(
		channelId: string,
		valueInput: ChannelMessageUpdatePayload
	): Promise<{ updateTimestamp: number }> {
		const channel = await this.channelsCollection.document(channelId);
		channel.encryptionMode = valueInput.encryptionMode;
		channel.e2eEncryptedValue = valueInput.message.cipher || null;
		channel.e2eEncryptedValueIv = valueInput.message.iv || null;
		channel.e2eEncryptedValueSalt = valueInput.message.salt || null;
		channel.senderPublicKey = valueInput.senderPublicKey;
		channel.updateTimestamp = Math.round(Date.now() / 1000);
		await this.channelsCollection.update(channel._key, channel);
		return {
			updateTimestamp: channel.updateTimestamp,
		};
	}

	/**
	 * Removes a channel: removes all invites, removes all deviceToChannel edges,
	 * removes the channel itself.
	 * @param {string} channelId
	 */
	async deleteChannel(channelId: string) {
		try {
			const channelKey = `channels/${channelId}`;
			await Promise.all([
				this.db.query(aql`
				FOR invite IN invites
					FILTER invite.channelId == ${channelId}
					REMOVE { _key: invite._key } IN invites
			`),
				this.db.query(aql`
				FOR edge IN devicesToChannels
					FILTER edge._to == ${channelKey}
					REMOVE { _key: edge._key } IN devicesToChannels
			`),
			]);
			await this.channelsCollection.remove(channelId);
		} catch (err) {
			if (err.response.statusCode !== 404) {
				throw err;
			}
		}
	}

	/**
	 * Removes a particular device from a given channel.
	 * @param {string} channelId
	 * @param {string} deviceId
	 */
	async deleteDeviceFromChannel(channelId: string, deviceId: string) {
		try {
			const channelKey = `channels/${channelId}`;
			const deviceKey = `devices/${deviceId}`;
			await this.db.query(aql`
				FOR edge IN devicesToChannels
					FILTER edge._from == ${deviceKey} && edge._to == ${channelKey}
					REMOVE { _key: edge._key } IN devicesToChannels
			`);
		} catch (err) {
			if (err.response.statusCode !== 404) {
				throw err;
			}
		}
	}

	/**
	 * Returns boolean value indiciating if a channel exists or not.
	 * @param {string} channelId
	 */
	async getChannelExists(channelId: string) {
		return await this.channelsCollection.documentExists(channelId);
	}

	/**
	 * Deletes an invite and returns the invite data that was just deleted.
	 * @param {string} inviteId
	 */
	async getChannelInviteAndRemove(
		inviteId: string
	): Promise<ChannelInviteDbDoc> {
		const channelInviteResult = await this.invitesCollection.remove(inviteId, {
			returnOld: true,
			waitForSync: true,
		});
		return channelInviteResult.old;
	}

	/**
	 * Gets an invite to a channel.
	 * @param {string} inviteId
	 */
	async getChannelInvite(inviteId: string): Promise<ChannelInviteDbDoc> {
		const channelInviteResult = await this.invitesCollection.document(inviteId);
		return channelInviteResult;
	}

	/**
	 * Saves a channel invite.
	 * @param {any} inviteDoc
	 */
	async saveChannelInvite(inviteDoc: any) {
		await this.invitesCollection.save(inviteDoc);
	}
}
