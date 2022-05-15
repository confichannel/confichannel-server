import { Inject, Injectable } from '@nestjs/common';
import { aql, Database } from 'arangojs';
import { CollectionType, DocumentCollection } from 'arangojs/collection';
import { Edge } from 'arangojs/documents';
import { v4 as uuidv4 } from 'uuid';
import { ERROR_MESSAGE_CHANNEL_ALREADY_EXISTS } from '../config';
import { DeviceToEdgeParams } from '../types/DeviceToEdgeParams';
import { DeviceToChannelEdgeCollection } from '../types/DeviceToChannelEdgeCollection';
import { ExportableNewDevice } from '../types/ExportableNewDevice';
import { SettingsService } from '../settings/settings.service';
import {
	WriteDeleteInvitePermission,
	WriteInvitePermission,
} from '../helpers/channelPermissions';

@Injectable()
export class DevicesService {
	private devicesCollection: DocumentCollection;
	private devicesToChannelsCollection: DeviceToChannelEdgeCollection;
	// private settingsService: SettingsService;

	constructor(
		@Inject(Database)
		private db: Database,
		@Inject(SettingsService)
		private settingsService: SettingsService
	) {
		this.devicesCollection = this.db.collection('devices');
		const devicesCollection = this.devicesCollection;
		this.devicesToChannelsCollection = this.db.collection('devicesToChannels');
		const devicesToChannelsCollection = this.devicesToChannelsCollection;

		// Ensure device related collections exist on start-up.
		async function initialiseDb() {
			const devicesCollectionExists = await devicesCollection.exists();
			if (!devicesCollectionExists) {
				await devicesCollection.create();
			}
			const devicesToChannelsCollectionExists =
				await devicesToChannelsCollection.exists();
			if (!devicesToChannelsCollectionExists) {
				await devicesToChannelsCollection.create({
					type: CollectionType.EDGE_COLLECTION,
				});
			}
			if (await settingsService.getIsUpgradeToMinorVersion('0.5.0')) {
				const devicesToChannelsCursor = await db.query(
					aql`FOR edge in ${devicesToChannelsCollection}
					RETURN edge`
				);
				while (devicesToChannelsCursor.hasNext) {
					const edge = (await devicesToChannelsCursor.next()) as
						| Edge<{
								permissions?: string[];
						  }>
						| undefined;
					if (
						edge &&
						edge.permissions &&
						edge.permissions.includes(WriteInvitePermission) &&
						!edge.permissions.includes(WriteDeleteInvitePermission)
					) {
						await devicesToChannelsCollection.update(edge._id, {
							permissions: edge.permissions.concat([
								WriteDeleteInvitePermission,
							]),
						});
					}
				}
			}
		}
		initialiseDb();
	}

	/**
	 * Creates a new device.
	 */
	async createDevice(): Promise<ExportableNewDevice> {
		const id = uuidv4();
		const creationTimestamp = Math.round(Date.now() / 1000);
		const updateTimestamp = creationTimestamp;
		await this.devicesCollection.save(
			{ _key: id, id, updateTimestamp, creationTimestamp },
			{
				// Conflict means: if the device id already exists in the db, then fail.
				// This is default behaviour, but explicit definition means its enforced
				// even if defaults change in the library.
				overwriteMode: 'conflict',
			}
		);
		return { id, creationTimestamp, updateTimestamp };
	}

	/**
	 * Creates a new device to edge connection with the given permissions.
	 * @param {DeviceToEdgeParams} edgeParams
	 */
	async createDeviceToChannelEdge(
		edgeParams: DeviceToEdgeParams
	): Promise<void> {
		const { deviceId, channelId, permissions, tempPublicKey } = edgeParams;
		const existing = await this.getDeviceToChannelEdge({
			deviceId,
			channelId,
		});
		if (existing) {
			throw new Error(ERROR_MESSAGE_CHANNEL_ALREADY_EXISTS);
		}
		await this.devicesToChannelsCollection.save({
			_from: `devices/${deviceId}`,
			_to: `channels/${channelId}`,
			permissions,
			tempPublicKey,
			creationTimestamp: Math.round(Date.now() / 1000),
		});
	}

	/**
	 * Returns a deviceToChannel edge
	 * @param {{deviceId: string, channelId: string}} edgeIds
	 */
	async getDeviceToChannelEdge(edgeIds: {
		deviceId: string;
		channelId: string;
	}): Promise<Edge<{ permissions: string[] }> | undefined> {
		const { deviceId, channelId } = edgeIds;
		const deviceKey = `devices/${deviceId}`;
		const channelKey = `channels/${channelId}`;
		const result = await this.db
			.query(aql`FOR edge IN ${this.devicesToChannelsCollection}
		FILTER edge._from == ${deviceKey} && edge._to == ${channelKey}
		LIMIT 1
		RETURN edge`);
		const firstResult = await result.next();
		return firstResult;
	}
}
