/* eslint-disable prettier/prettier */
import { Edge } from 'arangojs/documents';
import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { DevicesService } from '../devices/devices.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { MetricsService } from '../metrics/metrics.service';
import { ExportableNewChannel } from './types/ExportableNewChannel';
import { PulledChannel } from './types/PulledChannel';
import { ExportableChannelInvite } from './types/ExportableChannelInvite';
import { ChannelInfo } from './types/ChannelInfo';
import { ChannelInviteDbDoc } from './types/ChannelInviteDbDoc';
import { ChannelType } from './types/ChannelType';
import { EncryptionMode } from './types/EncryptionMode';
import {
	WriteDeleteChannelPermission,
	WriteDeleteOwnDevicePermission,
	WriteInvitePermission,
	WritePushPermission,
	ReadInviteListPermission,
	ReadPullPermission,
	PopPublicKeyPermission,
	WriteDeleteInvitePermission,
} from '../helpers/channelPermissions';
import {
	ERROR_MESSAGE_CHANNEL_ALREADY_EXISTS,
	MAX_CHANNELS_NO_SUBSCRIPTION,
	MAX_CHANNELS_WITH_SUBSCRIPTION,
} from '../config';
import { Subscription } from '../types/Subscription';
import { BadRequestException, ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';

const testDeviceId = '9990ce6d-b03f-47e0-b257-3e3d2637f01c';
const testChannelId = '754a037c-32a4-47ed-9b49-71ac5d4ec88d';
const testChannelPasscodeB64 = 'SSB0aGluayB5b3UgaGF2ZSBzb21ldGhpbmcgdGhlcmU=';
const testChannelPasscodeHashB64 = 'jopuPBKn/xo7lCJ1obTDe4BUXNXnOwKqBjAhX/DnqG8=';
const testChannelPasscodeSaltB64 = 'eQ067PpdCNnIAZUxRzmtMO+OXmfP8F/2fvGoUx+swo4=';
const testInviteId = '0af5eaed-29a6-45db-8efd-ccaf32ea1037';
const testChannelCreationTimestamp = Math.round(
	new Date('2022-01-01T00:00Z').valueOf() / 1000
);
const testChannelUpdateTimestamp = Math.round(
	new Date('2022-01-01T00:00Z').valueOf() / 1000
);
const testChannelType = 'bidirectional' as ChannelType;
const testChannelEncryptionMode = 'end-to-end-shared' as EncryptionMode;
const testChannelName = 'H7X K2V R4R';
const testInvitePasscodeB64 = 'f2RimECr4Rt6redY';
const testInvitePasscodeHashB64 = 'NzpigzjTjgTwVYVkrwSSF4KnRFf5qjbL48acJAZtQpk=';
const testInvitePasscodeSaltB64 = 'beRfxLOki48mfcUZaEmsbFLRXV4TXFhNzQw6zINN70U=';
const testEncryptedEncryptKeyIvB64 = 'WNHa9c8WQnGAzsSe';
const testEncryptedEncryptKeySaltB64 = 'W76paRQh8fRM5FH3lMWwlw==';
const testEncryptedEncryptKeyCipherB64 = '/6tF9jzxAWK8IMAvt9zbGVqRmYIDn4TLBdk9Z9cj+L/KKoJCgL0fMQ==';
const testEncryptedEncryptKeyFull = `${testEncryptedEncryptKeyIvB64
	}.${testEncryptedEncryptKeySaltB64
	}.${testEncryptedEncryptKeyCipherB64
	}`;
const testOriginPublicKey = {
	crv: 'P-384',
	ext: true,
	key_ops: [],
	kty: 'EC',
	x: '1l-uwfw7S2-bW591WMAMMz4EH77r4Y3_666xhMPGn6NmDyw6nJWImGDO342vSppx',
	y: 'ufeMFLsq1Fc_HuwfDp9CsK-b7FmJaYPYzPv9LyOatlpDmPUcOWzBKfjqeGl5PBom',
};
const testReceiverPublicKey = {
	crv: 'P-384',
	ext: true,
	key_ops: [],
	kty: 'EC',
	x: 'uRiXNf1ddg1B-4vBPwtexYKMT6BISkDQZMWUdgr06mPnrYcwHKlTsGTqprSCntw9',
	y: 'gP_0q-X5bJ2cXS3LrN9u53oV3-ElHXMOwUg51A6TJzr492SEp4YFGrdX-sq9P7Jg',
};
const testInviteExpires = testChannelUpdateTimestamp + 172800;
const testDeviceToChannelId = 'e9422e54-8fbd-4b55-8b6f-fe89ce2c9400';
const getPasscodeMock = jest.fn(() => testChannelPasscodeB64);
const mockAuthRequest = {
	testDeviceId,
	get: getPasscodeMock,
} as any;
const testSubscription = {
	id: 'c29cfdc6-26b0-4eb1-bd8e-2868594207a8',
	creationTimestamp: Math.round(new Date('2022-01-01T00:00Z').valueOf() / 1000),
	updateTimestamp: Math.round(new Date('2022-01-01T00:00Z').valueOf() / 1000),
	deviceId: testDeviceId,
	validUntil: Math.round(Date.now() / 1000) + 172800,
} as Subscription;
const testDeviceToChannelEdge = {
	_id: testDeviceToChannelId,
	_key: `devicesToChannels/${testDeviceToChannelId}`,
	_from: `devices/${testDeviceId}`,
	_to: `channels/${testChannelId}`,
	_rev: 'XXX',
	permissions: [
		WriteDeleteChannelPermission,
		WriteDeleteOwnDevicePermission,
		WriteInvitePermission,
		WriteDeleteInvitePermission,
		WritePushPermission,
		ReadInviteListPermission,
		ReadPullPermission,
		PopPublicKeyPermission,
	],
} as Edge<{ permissions: string[] }>;
const testChannelInfo = {
	_key: `channels/${testChannelId}`,
	id: testChannelId,
	name: testChannelName,
	channelType: 'bidirectional',
	creationTimestamp: testChannelCreationTimestamp,
	passcodeHash: testChannelPasscodeHashB64,
	passcodeHashSalt: testChannelPasscodeSaltB64,
	updateTimestamp: testChannelUpdateTimestamp,
} as ChannelInfo
const testExportableNewChannel = {
	id: testChannelId,
	channelType: testChannelType,
	creationTimestamp: testChannelCreationTimestamp,
	updateTimestamp: testChannelUpdateTimestamp,
	passcodeBase64: testChannelPasscodeB64,
	encryptionMode: testChannelEncryptionMode,
	name: testChannelName,
} as ExportableNewChannel

// Note encryption does not happen on the server; therefore, not all the
// components below are necessary for the unit tests. They are included to
// illustrate how all the pieces fit together.

// const testChannelValueEncryptKeyB64 = 'N55ox2cviPiv0DZ1SDaXHY+5rF1gM5b0';
const testChannelValueIvB64 = '4ENlQNdnjcGDMytm';
const testChannelValueSaltB64 = 'IjddqKJiRIHq3ID72t5xLQ==';
// const testChannelValueUnencrypted = 'Hello, World';
const testChannelValueCipherB64 = '3IoQwoFNnCJKk/bd';

describe('ChannelsController', () => {
	let channelsController: ChannelsController;

	const channelsServiceMock = {
		getCountOfChannelsForDevice: jest.fn(async () => 0),
		createChannel: jest.fn(async () => {
			return {
				id: testChannelId,
				channelType: testChannelType,
				creationTimestamp: testChannelCreationTimestamp,
				passcodeBase64: testChannelPasscodeB64,
				updateTimestamp: testChannelUpdateTimestamp,
				encryptionMode: testChannelEncryptionMode,
				name: testChannelName,
			} as ExportableNewChannel;
		}),
		pull: jest.fn(async () => {
			return {
				channelType: 'bidirectional',
				creationTimestamp: testChannelCreationTimestamp,
				updateTimestamp: testChannelUpdateTimestamp,
				encryptionMode: testChannelEncryptionMode,
				name: testChannelName,
				id: testChannelId,
			} as PulledChannel;
		}),
		getChannelExists: jest.fn(async () => true),
		deleteChannel: jest.fn(async () => undefined),
		deleteDeviceFromChannel: jest.fn(async () => undefined),
		getChannelType: jest.fn(async () => 'bidirectional'),
		push: jest.fn(async () => {
			return {
				updateTimestamp: testChannelUpdateTimestamp,
			};
		}),
		popChannelPublicKeys: jest.fn(async () => []),
		channelHasOutstandingInvite: jest.fn(async () => false),
		getCountOfInvitesForChannel: jest.fn(async () => 0),
		createChannelInvite: jest.fn(async () => {
			return {
				channelId: testChannelId,
				channelType: 'bidirectional',
				creationTimestamp: testChannelUpdateTimestamp,
				expires: testInviteExpires,
				id: testInviteId,
				passcode: testInvitePasscodeB64,
			} as ExportableChannelInvite;
		}),
		channelInviteExists: jest.fn(async () => true),
		deleteChannelInvite: jest.fn(async () => undefined),
		getChannelInfo: jest.fn(async () => testChannelInfo),
		getChannelInvite: jest.fn(async () => {
			return {
				_key: `invites/${testInviteId}`,
				id: testInviteId,
				channelId: testChannelId,
				creationTimestamp: testChannelCreationTimestamp,
				channelPasscode: testChannelPasscodeB64,
				encryptedEncryptKey: testEncryptedEncryptKeyFull,
				passcodeHash: testInvitePasscodeHashB64,
				passcodeHashSalt: testInvitePasscodeSaltB64,
				originPublicKey: testOriginPublicKey,
				expires: testInviteExpires,
			} as ChannelInviteDbDoc;
		}),
		getChannelInviteAndRemove: jest.fn(async () => {
			return {
				_key: `invites/${testInviteId}`,
				id: testInviteId,
				channelId: testChannelId,
				creationTimestamp: testChannelCreationTimestamp,
				channelPasscode: testChannelPasscodeB64,
				encryptedEncryptKey: testEncryptedEncryptKeyFull,
				passcodeHash: testInvitePasscodeHashB64,
				passcodeHashSalt: testInvitePasscodeSaltB64,
				originPublicKey: testOriginPublicKey,
				expires: testInviteExpires,
			} as ChannelInviteDbDoc;
		}),
		getChannelPasscodeHash: jest.fn(async () => {
			return {
				_key: `channels/${testChannelId}`,
				id: testChannelId,
				name: testChannelName,
				passcodeHash: testChannelPasscodeHashB64,
				passcodeHashSalt: testChannelPasscodeSaltB64,
				creationTimestamp: testChannelCreationTimestamp,
				updateTimestamp: testChannelUpdateTimestamp,
			};
		}),
		getCountOfDevicesForChannel: jest.fn(async () => 1),
		getInviteChannelId: jest.fn(async () => testChannelId),
		getInvites: jest.fn(async () => []),
		getPasscodeHashInfo: jest.fn(async () => {
			return {
				id: testChannelId,
				passcodeHash: testChannelPasscodeHashB64,
				passcodeHashSalt: testChannelPasscodeSaltB64,
			};
		}),
		incrementInviteAcceptsCount: jest.fn(async () => undefined),
		saveChannelInvite: jest.fn(async () => undefined),
	} as any as jest.Mocked<ChannelsService>;
	const devicesServiceMock = {
		createDeviceToChannelEdge: jest.fn(async () => undefined),
		getDeviceToChannelEdge: jest.fn(async () => {
			return testDeviceToChannelEdge;
		}),
	} as any as jest.Mocked<DevicesService>;
	const subscriptionsServiceMock = {
		getActiveSubsciptionForDevice: jest.fn(async () => null),
	} as any as jest.Mocked<SubscriptionsService>;
	const metricsServiceMock = {
		recordEvent: jest.fn(async () => undefined),
	} as any as jest.Mocked<MetricsService>;

	beforeAll(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ChannelsController],
		})
			.useMocker((token) => {
				if (token === ChannelsService) {
					return channelsServiceMock;
				} else if (token === DevicesService) {
					return devicesServiceMock;
				} else if (token === SubscriptionsService) {
					return subscriptionsServiceMock;
				} else if (token === MetricsService) {
					return metricsServiceMock;
				}
			})
			.compile();

		channelsController = module.get<ChannelsController>(ChannelsController);
	});

	afterEach(async () => {
		metricsServiceMock.recordEvent.mockClear();
	});

	it('should be defined', () => {
		expect(channelsController).toBeDefined();
	});

	describe('/channels', () => {
		describe('POST /channels (create new channel)', () => {
			it('creates a new bidirectional channel', async () => {
				const expectedNewChannel = Object.assign({}, testExportableNewChannel);
				await expect(channelsController.postChannel(
					{
						encryptionMode: 'none',
						channelType: 'bidirectional',
					},
					mockAuthRequest
				)).resolves.toEqual(expectedNewChannel);
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith(
					'channel:created',
					{
						hasSubscription: false,
						channelType: 'bidirectional',
						withValue: false,
					}
				);
			});

			it('creates a new bidirectional channel with initial message', async () => {
				const expectedNewChannel = Object.assign({}, testExportableNewChannel);
				await expect(channelsController.postChannel(
					{
						encryptionMode: 'end-to-end-shared',
						channelType: 'bidirectional',
						message: {
							cipher: testChannelValueCipherB64,
							iv: testChannelValueIvB64,
							salt: testChannelValueSaltB64,
						}
					},
					mockAuthRequest
				)).resolves.toEqual(expectedNewChannel);
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith(
					'channel:created',
					{
						hasSubscription: false,
						channelType: 'bidirectional',
						withValue: true,
					}
				);
			});

			it('creates a new unidirectional channel', async () => {
				const expectedNewChannel = Object.assign({}, testExportableNewChannel, {
					channelType: 'unidirectional',
				} as Partial<ExportableNewChannel>)
				channelsServiceMock.createChannel.mockResolvedValueOnce(expectedNewChannel)
				await expect(channelsController.postChannel({
					channelType: 'unidirectional',
					encryptionMode: 'none'
				}, mockAuthRequest)).resolves.toEqual(expectedNewChannel);
			});

			it('allows bidirectional channel to be created with empty values', async () => {
				const newChannel = await channelsController.postChannel(
					{
						encryptionMode: 'none',
						channelType: 'bidirectional',
						message: {
							cipher: '',
							salt: '',
							iv: '',
						}
					},
					mockAuthRequest
				);
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith(
					'channel:created',
					{
						hasSubscription: false,
						channelType: 'bidirectional',
						withValue: false,
					}
				);
				expect(newChannel).toEqual({
					id: testChannelId,
					channelType: testChannelType,
					creationTimestamp: testChannelCreationTimestamp,
					updateTimestamp: testChannelUpdateTimestamp,
					passcodeBase64: testChannelPasscodeB64,
					encryptionMode: testChannelEncryptionMode,
					name: testChannelName,
				} as ExportableNewChannel);
			});

			it('throws an error if payload is not an object', async () => {
				await expect(channelsController
					.postChannel(true as any, mockAuthRequest)
				).rejects.toThrowError(BadRequestException);
			})

			it('throws an error if payload has unknown prop', async () => {
				await expect(channelsController.postChannel({
					channelType: 'unidirectional',
					encryptionMode: 'none',
					unknownProp: true,
				} as any, mockAuthRequest)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if value payload is not an object', async () => {
				await expect(channelsController.postChannel({
					channelType: 'unidirectional',
					encryptionMode: 'none',
					message: true as any
				}, mockAuthRequest)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if value payload has unknown prop', async () => {
				await expect(channelsController.postChannel({
					channelType: 'unidirectional',
					encryptionMode: 'none',
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
						unknownProp: true,
					} as any
				}, mockAuthRequest)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel type is not string', async () => {
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-shared',
							channelType: true as any,
						},
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel limit reached (without subscription)', async () => {
				channelsServiceMock.getCountOfChannelsForDevice.mockResolvedValueOnce(
					MAX_CHANNELS_NO_SUBSCRIPTION
				);
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-shared',
							channelType: 'bidirectional',
						},
						mockAuthRequest
					)
				).rejects.toThrow(
					`Channel limit (${MAX_CHANNELS_NO_SUBSCRIPTION}) exceeded`
				);
			});

			it('throws an error if channel limit reached (with subscription)', async () => {
				channelsServiceMock.getCountOfChannelsForDevice.mockResolvedValueOnce(
					MAX_CHANNELS_WITH_SUBSCRIPTION
				);
				subscriptionsServiceMock.getActiveSubsciptionForDevice.mockResolvedValueOnce(
					testSubscription
				);
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-shared',
							channelType: 'bidirectional',
						},
						mockAuthRequest
					)
				).rejects.toThrow(
					`Channel limit (${MAX_CHANNELS_WITH_SUBSCRIPTION}) exceeded`
				);
			});

			it('throws an error if channel input missing', async () => {
				await expect(
					channelsController.postChannel(
						undefined as any,
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if initial value provided for bidirectional channel and encryption mode is invalid', async () => {
				await expect(channelsController.postChannel(
					{
						encryptionMode: 'none',
						channelType: 'bidirectional',
						message: {
							cipher: testChannelValueCipherB64,
							iv: testChannelValueIvB64,
							salt: testChannelValueSaltB64,
						}
					},
					mockAuthRequest
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel input has invalid encryption mode', async () => {
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'unrecognised-mode' as any,
							channelType: 'bidirectional',
						},
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: undefined as any,
							channelType: 'bidirectional',
						},
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel input uses private-public encryption mode', async () => {
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-private-public',
							channelType: 'bidirectional',
						},
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error when unidirectional channel is initialised with encryption mode which is not "none"', async () => {
				await expect(channelsController.postChannel(
					{
						encryptionMode: 'end-to-end-password',
						channelType: 'unidirectional',
					},
					mockAuthRequest
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if payload without encrypted value received and channelType is not recognised', async () => {
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-shared',
							channelType: 'unrecognised-channel-type' as any,
						},
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if payload with encrypted value received and channelType does not support encrypted value payloads', async () => {
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-shared',
							channelType: 'unidirectional',
							message: {
								cipher: testChannelValueCipherB64,
								iv: testChannelValueIvB64,
								salt: testChannelValueSaltB64,
							}
						},
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if encrypted value provided with bidirectional channel initialisation is invalid', async () => {
				// Note that unidirectional channel encrypted value tests (which were
				// possible when updating channel messages) supplement the tests below
				// to test more of the _validateEncryptedValue code paths.
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-shared',
							channelType: 'bidirectional',
							message: {
								cipher: testChannelValueCipherB64,
								iv: testChannelValueIvB64,
								salt: 'wrong length should be 24 characters',
							}
						},
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith(
					'channel:creationError',
					{
						errorType:
							'salt was required but was not provided or was of invalid length',
						saltLength: 36,
					}
				);
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-shared',
							channelType: 'bidirectional',
							message: {
								cipher: testChannelValueCipherB64,
								iv: 'wrong length should be 16 chars',
								salt: testChannelValueSaltB64,
							}
						},
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith(
					'channel:creationError',
					{
						errorType: 'iv length was not 16',
						ivLength: 31,
					}
				);
			});

			it('throws an error if encrypted value is too large (without subscription)', async () => {
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-shared',
							channelType: 'bidirectional',
							message: {
								cipher: [...new Array(40025)].map(() => 'X').join(''),
								iv: testChannelValueIvB64,
								salt: testChannelValueSaltB64,
							}
						},
						mockAuthRequest
					)
				).rejects.toThrow(
					'Max size of message reached. Upgrade to send larger values.'
				);
			});

			it('throws an error if encrypted value is too large (with subscription)', async () => {
				subscriptionsServiceMock.getActiveSubsciptionForDevice.mockResolvedValueOnce(
					testSubscription
				);
				await expect(
					channelsController.postChannel(
						{
							encryptionMode: 'end-to-end-shared',
							channelType: 'bidirectional',
							message: {
								cipher: [...new Array(4000025)].map(() => 'X').join(''),
								iv: testChannelValueIvB64,
								salt: testChannelValueSaltB64,
							}
						},
						mockAuthRequest
					)
				).rejects.toThrow('The size of the message is too large.');
			});
		});
	});

	describe('/channels/:channelId', () => {
		describe('GET /channels/:channelId (retrieve channel message)', () => {
			it('returns a channel', async () => {
				const existingChannel = await channelsController.pullChannel(
					testChannelId,
					mockAuthRequest
				);
				expect(existingChannel).toEqual({
					id: testChannelId,
					channelType: testChannelType,
					creationTimestamp: testChannelCreationTimestamp,
					updateTimestamp: testChannelUpdateTimestamp,
					encryptionMode: testChannelEncryptionMode,
					name: testChannelName,
				} as PulledChannel);
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith(
					'channel:pulled'
				);
			});

			it('throws an error if channel id not a valid uuid', async () => {
				await expect(
					channelsController.pullChannel("This isn't a uuid!", mockAuthRequest)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel passcode is invalid', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				await expect(
					channelsController.pullChannel(
						testDeviceId,
						mockAuthRequest
					)
				).rejects.toThrowError(ForbiddenException);

				getPasscodeMock.mockReturnValueOnce(undefined)
				await expect(
					channelsController.pullChannel(
						testDeviceId,
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);

				getPasscodeMock.mockReturnValueOnce(true as any)
				await expect(
					channelsController.pullChannel(
						testDeviceId,
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);

				getPasscodeMock.mockReturnValueOnce('Wrong Length')
				await expect(
					channelsController.pullChannel(
						testDeviceId,
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if device has no permissions to the channel', async () => {
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					undefined
				);
				await expect(
					channelsController.pullChannel(testChannelId, mockAuthRequest)
				).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if device does not have read:Pull permission', async () => {
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [WriteDeleteOwnDevicePermission],
					})
				);
				await expect(
					channelsController.pullChannel(testChannelId, mockAuthRequest)
				).rejects.toThrowError(ForbiddenException);
			});
		});

		describe('DELETE /channels/:channelId (delete a channel)', () => {
			it('deletes a channel completely if device has write:DeleteChannel permission', async () => {
				await channelsController.deleteChannel(testChannelId, mockAuthRequest);
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith(
					'channel:deleted'
				);
			});

			it('removes a device from a channel if device has write:DeleteOwnDeviceFromChannel permission', async () => {
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [WriteDeleteOwnDevicePermission],
					})
				).mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [WriteDeleteOwnDevicePermission],
					})
				);
				await channelsController.deleteChannel(testChannelId, mockAuthRequest);
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith(
					'channel:device-removed'
				);
			});

			it('is successful if the channel no longer exists', async () => {
				channelsServiceMock.getChannelExists.mockResolvedValueOnce(false);
				const res = await channelsController.deleteChannel(
					testDeviceId,
					mockAuthRequest
				);
				expect(res).toBeUndefined();
			});

			it('throws an error if channel id not a valid uuid', async () => {
				await expect(
					channelsController.deleteChannel(
						"This isn't a uuid!",
						mockAuthRequest
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel passcode is invalid', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				await expect(
					channelsController.deleteChannel(
						testDeviceId,
						mockAuthRequest
					)
				).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if device does not have permission', async () => {
				// permissions will be checked twice: 1. delete channel permission,
				// 2. delete device permission.
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [],
					})
				).mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [],
					})
				);
				await expect(
					channelsController.deleteChannel(
						'da3680ac-7953-4166-802f-5558d3d55517',
						mockAuthRequest
					)
				).rejects.toThrowError(ForbiddenException);

				devicesServiceMock.getDeviceToChannelEdge
					.mockResolvedValueOnce(undefined)
					.mockResolvedValueOnce(undefined);
				await expect(
					channelsController.deleteChannel(
						'da3680ac-7953-4166-802f-5558d3d55517',
						mockAuthRequest
					)
				).rejects.toThrowError(ForbiddenException);
			});
		});

		describe('POST /channels/:channelId (send message to channel)', () => {
			it('sends a shared-key encrypted message to a bidirectional channel', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-shared',
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
						salt: testChannelValueSaltB64,
					}
				})).resolves.toEqual({
					updateTimestamp: testChannelUpdateTimestamp
				});
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith('channel:pushed', {
					hasSubscription: false,
					encryptionMode: 'end-to-end-shared',
					hasValue: true,
				})
			});

			it('sends a public-private-key encrypted message to a bidirectional channel', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-private-public',
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
					}
				})).resolves.toEqual({
					updateTimestamp: testChannelUpdateTimestamp
				});
			});

			it('sends a public-private key encrypted message to a unidirectional channel', async () => {
				channelsServiceMock.getChannelType.mockResolvedValueOnce('unidirectional');
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-private-public',
					senderPublicKey: testOriginPublicKey,
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
					}
				})).resolves.toEqual({
					updateTimestamp: testChannelUpdateTimestamp
				});
			});

			it('sends a password-key encrypted message to be sent to a unidirectional channel', async () => {
				channelsServiceMock.getChannelType.mockResolvedValueOnce('unidirectional');
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-password',
					senderPublicKey: testOriginPublicKey,
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
						salt: testChannelValueSaltB64,
					}
				})).resolves.toEqual({
					updateTimestamp: testChannelUpdateTimestamp
				});
			});

			it('sends a password-key encrypted message to a bidirectional channel', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-password',
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
						salt: testChannelValueSaltB64,
					}
				})).resolves.toEqual({
					updateTimestamp: testChannelUpdateTimestamp
				});
			});

			it('allows empty message to be sent to bidirectional channel (this would empty the channel)', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'none',
				})).resolves.toEqual({
					updateTimestamp: testChannelUpdateTimestamp,
				});
			});

			it('allows empty message to be sent to unidirectional channel (this would empty the channel)', async () => {
				channelsServiceMock.getChannelType.mockResolvedValueOnce('unidirectional');
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'none',
				})).resolves.toEqual({
					updateTimestamp: testChannelUpdateTimestamp,
				});
			});

			it('throws an error when message is empty and encryption mode is not none', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-password',
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel id not a valid uuid', async () => {
				await expect(
					channelsController.pushChannel(
						"This isn't a valid uuid",
						mockAuthRequest,
						{
							encryptionMode: 'end-to-end-shared',
							message: {
								cipher: testChannelValueCipherB64,
								iv: testChannelValueIvB64,
								salt: testChannelValueSaltB64,
							}
						}
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel passcode is invalid', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				await expect(
					channelsController.pushChannel(
						testDeviceId,
						mockAuthRequest,
						{
							encryptionMode: 'end-to-end-shared',
							message: {
								cipher: testChannelValueCipherB64,
								iv: testChannelValueIvB64,
								salt: testChannelValueSaltB64,
							}
						}
					)
				).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if device does not have permission', async () => {
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [],
					})
				);
				await expect(
					channelsController.pushChannel(
						testDeviceId,
						mockAuthRequest,
						{
							encryptionMode: 'end-to-end-shared',
							message: {
								cipher: testChannelValueCipherB64,
								iv: testChannelValueIvB64,
								salt: testChannelValueSaltB64,
							}
						}
					)
				).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if encryption mode is not valid', async () => {
				await expect(
					channelsController.pushChannel(
						testDeviceId,
						mockAuthRequest,
						{
							encryptionMode: 'unrecognised-encryption-mode' as any,
							message: {
								cipher: testChannelValueCipherB64,
								iv: testChannelValueIvB64,
								salt: testChannelValueSaltB64,
							}
						}
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if encrypted value is not valid', async () => {

				// Note that bidirectional channel encrypted value tests (which were
				// possible when creating channels) supplement the tests below to test
				// more of the _validateEncryptedValue code paths.
				await expect(
					channelsController.pushChannel(
						testDeviceId,
						mockAuthRequest,
						{
							encryptionMode: 'end-to-end-private-public',
							message: {
								cipher: testChannelValueCipherB64,
								iv: testChannelValueIvB64,
								// Salt is invalid here, not required for private-public key
								// encryption
								salt: testChannelValueSaltB64,
							}
						}
					)
				).rejects.toThrowError(BadRequestException)

				channelsServiceMock.getChannelType.mockResolvedValueOnce('unidirectional');
				await expect(
					channelsController.pushChannel(
						testDeviceId,
						mockAuthRequest,
						{
							encryptionMode: 'end-to-end-private-public',
							message: {
								cipher: testChannelValueCipherB64,
								iv: testChannelValueIvB64,
							},
							// Sender public key required for unidirectional channels
							senderPublicKey: undefined,
						}
					)
				).rejects.toThrowError(BadRequestException)
			});

			it('throws an error when trying to use shared key encryption with unidirectional channel', async () => {
				channelsServiceMock.getChannelType.mockResolvedValueOnce('unidirectional');
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-shared',
					senderPublicKey: testOriginPublicKey,
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
					}
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if unidirectional channel and no public key is provided', async () => {
				channelsServiceMock.getChannelType.mockResolvedValueOnce('unidirectional');
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-private-public',
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
						salt: testChannelValueSaltB64,
					},
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if unidirectional channel and invalid public key provided', async () => {
				channelsServiceMock.getChannelType.mockResolvedValueOnce('unidirectional');
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-private-public',
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
					},
					senderPublicKey: { bad: "This isn't a key" } as any,
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an error when salt has invalid type for shared/password encrypted values', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-shared',
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
						salt: true as any,
					}
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an error when iv has invalid type for shared/password encrypted values', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-shared',
					message: {
						cipher: testChannelValueCipherB64,
						iv: true as any,
						salt: testChannelValueSaltB64,
					}
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an error when iv has invalid type for public-private key encrypted values', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-private-public',
					message: {
						cipher: testChannelValueCipherB64,
						iv: true as any,
					}
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an error when iv has invalid length for public-private key encrypted values', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-private-public',
					message: {
						cipher: testChannelValueCipherB64,
						iv: 'This length isn\'t right"',
					}
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an error when cipher has invalid type public-private key encrypted values', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-private-public',
					message: {
						cipher: true as any,
						iv: testChannelValueIvB64,
					}
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an error when cipher has invalid type for shared/password encrypted values', async () => {
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-shared',
					message: {
						cipher: true as any,
						iv: testChannelValueIvB64,
						salt: testChannelValueSaltB64,
					}
				})).rejects.toThrowError(BadRequestException);
			});

			it('throws an internal server error returned channel type is invalid', async () => {
				channelsServiceMock.getChannelType.mockResolvedValueOnce('invalid' as any);
				await expect(channelsController.pushChannel(testChannelId, mockAuthRequest, {
					encryptionMode: 'end-to-end-private-public',
					message: {
						cipher: testChannelValueCipherB64,
						iv: testChannelValueIvB64,
						salt: testChannelValueSaltB64,
					},
					senderPublicKey: testReceiverPublicKey,
				})).rejects.toThrowError(InternalServerErrorException);
			});
		});
	});

	describe('/channels/:channelId/tempPublicKeys', () => {
		describe('POST /channels/:channelId/tempPublicKeys (pop temporary public keys for channel)', () => {
			it('returns public keys', async () => {
				await expect(
					channelsController
						.popTempPublicKeys(testChannelId, mockAuthRequest))
					.resolves
					.toEqual({ publicKeys: [] })
			});

			it('throws an error if channel id not a valid uuid', async () => {
				await expect(
					channelsController
						.popTempPublicKeys("This isn't a valid uuid", mockAuthRequest)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel passcode is invalid', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				await expect(
					channelsController
						.popTempPublicKeys(testChannelId, mockAuthRequest)
				).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if device does not have permission', async () => {
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [],
					})
				);
				await expect(
					channelsController
						.popTempPublicKeys(testChannelId, mockAuthRequest)
				).rejects.toThrowError(ForbiddenException);
			});
		});
	});

	describe('/channels/:channelId/outstandingInviteFlag', () => {
		describe('GET /channels/:channelId/outstandingInviteFlag (get flag indicating if channel has outstanding invites)', () => {
			it('returns flag indicating whether the channel has an outstanding invite', async () => {
				await expect(
					channelsController
						.getOutstandingInviteFlag(testChannelId, mockAuthRequest)
				).resolves.toEqual({ hasOutstandingInvite: false })
			});

			it('throws an error if channel id not a valid uuid', async () => {
				await expect(
					channelsController
						.getOutstandingInviteFlag('Invalid uuid', mockAuthRequest)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel passcode is invalid', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				await expect(
					channelsController
						.getOutstandingInviteFlag(testChannelId, mockAuthRequest)
				).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if device does not have permission', async () => {
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [],
					})
				);
				await expect(
					channelsController
						.getOutstandingInviteFlag(testChannelId, mockAuthRequest)
				).rejects.toThrowError(ForbiddenException);
			});
		});
	});

	describe('/channels/:channelId/invites', () => {
		describe('POST /channels/:channelId/invites (create a new invite to a channel)', () => {
			it('returns an new invite to the channel', async () => {
				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: testOriginPublicKey,
					}
				))
					.resolves
					.toEqual({
						channelId: testChannelId,
						channelType: testChannelType,
						creationTimestamp: testChannelCreationTimestamp,
						expires: testInviteExpires,
						id: testInviteId,
						passcode: testInvitePasscodeB64,
					} as ExportableChannelInvite)
			});

			it('throws an error if channel id not a valid uuid', async () => {
				await expect(channelsController.pushChannelInvite(
					"This isn't a valid uuid",
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel passcode is invalid', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if device does not have permission', async () => {
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [],
					})
				);
				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if the encrypted encrypt key is invalid', async () => {
				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: undefined,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: 'Invalid encrypted key data',
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: `${testEncryptedEncryptKeyIvB64}.${'Invalid salt length'}.${testEncryptedEncryptKeyCipherB64}`,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: `${'Invalid IV length'}.${testEncryptedEncryptKeySaltB64}.${testEncryptedEncryptKeyCipherB64}`,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: `${testEncryptedEncryptKeyIvB64}.${testEncryptedEncryptKeySaltB64}.${'Invalid cipher length'}`,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if the originPublicKey is not provided', async () => {
				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: undefined as any,
					}
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if the originPublicKey is invalid', async () => {
				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: true as any,
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: {
							ext: true,
							key_ops: [],
							kty: 'EC',
							x: '1l-uwfw7S2-bW591WMAMMz4EH77r4Y3_666xhMPGn6NmDyw6nJWImGDO342vSppx',
							y: 'ufeMFLsq1Fc_HuwfDp9CsK-b7FmJaYPYzPv9LyOatlpDmPUcOWzBKfjqeGl5PBom',
						}, // Expecting props length 6 (crv prop is missing here)
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: {
							d: '928342398', // d is invalid (only found on private keys)
							ext: true,
							key_ops: [],
							kty: 'EC',
							x: '1l-uwfw7S2-bW591WMAMMz4EH77r4Y3_666xhMPGn6NmDyw6nJWImGDO342vSppx',
							y: 'ufeMFLsq1Fc_HuwfDp9CsK-b7FmJaYPYzPv9LyOatlpDmPUcOWzBKfjqeGl5PBom',
						},
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: {
							crv: 'P-555', // Bad curve type
							ext: true,
							key_ops: [],
							kty: 'EC',
							x: '1l-uwfw7S2-bW591WMAMMz4EH77r4Y3_666xhMPGn6NmDyw6nJWImGDO342vSppx',
							y: 'ufeMFLsq1Fc_HuwfDp9CsK-b7FmJaYPYzPv9LyOatlpDmPUcOWzBKfjqeGl5PBom',
						},
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: {
							crv: 'P-384',
							ext: 'true' as any, // This must be a boolean value
							key_ops: [],
							kty: 'EC',
							x: '1l-uwfw7S2-bW591WMAMMz4EH77r4Y3_666xhMPGn6NmDyw6nJWImGDO342vSppx',
							y: 'ufeMFLsq1Fc_HuwfDp9CsK-b7FmJaYPYzPv9LyOatlpDmPUcOWzBKfjqeGl5PBom',
						},
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: {
							crv: 'P-384',
							ext: true,
							key_ops: '' as any, // This must be an array
							kty: 'EC',
							x: '1l-uwfw7S2-bW591WMAMMz4EH77r4Y3_666xhMPGn6NmDyw6nJWImGDO342vSppx',
							y: 'ufeMFLsq1Fc_HuwfDp9CsK-b7FmJaYPYzPv9LyOatlpDmPUcOWzBKfjqeGl5PBom',
						},
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: {
							crv: 'P-384',
							ext: true,
							key_ops: [],
							kty: 'ECC', // This must be 'EC'
							x: '1l-uwfw7S2-bW591WMAMMz4EH77r4Y3_666xhMPGn6NmDyw6nJWImGDO342vSppx',
							y: 'ufeMFLsq1Fc_HuwfDp9CsK-b7FmJaYPYzPv9LyOatlpDmPUcOWzBKfjqeGl5PBom',
						},
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: {
							crv: 'P-384',
							ext: true,
							key_ops: [],
							kty: 'EC',
							x: '1', // This should have length 64
							y: 'ufeMFLsq1Fc_HuwfDp9CsK-b7FmJaYPYzPv9LyOatlpDmPUcOWzBKfjqeGl5PBom',
						},
					}
				)).rejects.toThrowError(BadRequestException);

				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: {
							crv: 'P-384',
							ext: true,
							key_ops: [],
							kty: 'EC',
							x: '1l-uwfw7S2-bW591WMAMMz4EH77r4Y3_666xhMPGn6NmDyw6nJWImGDO342vSppx',
							y: 'u', // This should have length 64
						},
					}
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if the channel has more than 100 invites', async () => {
				channelsServiceMock.getCountOfInvitesForChannel.mockResolvedValueOnce(101);
				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if the channel is bidirectional and already shared with another device', async () => {
				channelsServiceMock.getChannelType.mockResolvedValueOnce('bidirectional');
				channelsServiceMock.getCountOfDevicesForChannel.mockResolvedValueOnce(2);
				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if the channel is unidirectional and already shared with 100 other devices', async () => {
				channelsServiceMock.getChannelType.mockResolvedValueOnce('unidirectional');
				channelsServiceMock.getCountOfDevicesForChannel.mockResolvedValueOnce(101);
				await expect(channelsController.pushChannelInvite(
					testChannelId,
					mockAuthRequest,
					{
						encryptedEncryptKey: testEncryptedEncryptKeyFull,
						originPublicKey: testOriginPublicKey,
					}
				)).rejects.toThrowError(BadRequestException);
			});
		});

		describe('GET /channels/:channelId/invites (get invites which have been created for channel)', () => {
			it('Gets channel invites', async () => {
				await expect(channelsController.getInvites(testChannelId, mockAuthRequest))
					.resolves
					.toEqual([])
			});

			it('throws an error if channel id not a valid uuid', async () => {
				await expect(channelsController.getInvites(
					"This isn't a valid uuid",
					mockAuthRequest,
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel passcode is invalid', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				await expect(channelsController.getInvites(
					testChannelId,
					mockAuthRequest,
				)).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if device does not have permission', async () => {
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [],
					})
				);
				await expect(channelsController.getInvites(
					testChannelId,
					mockAuthRequest,
				)).rejects.toThrowError(ForbiddenException);
			});
		});
	});

	describe('/channels/:channelId/invites/:inviteId', () => {
		describe('DELETE /channels/:channelId/invites/:inviteId (deletes an invite to the channel)', () => {
			it('deletes a channel invite', async () => {
				await expect(channelsController.deleteChannelInvite(
					testInviteId,
					testChannelId,
					mockAuthRequest
				)).resolves.toBeUndefined()
			});

			it('does nothing if invite does not exist', async () => {
				channelsServiceMock.channelInviteExists.mockResolvedValueOnce(false);
				await expect(channelsController.deleteChannelInvite(
					testInviteId,
					testChannelId,
					mockAuthRequest
				)).resolves.toBeUndefined()
			});

			it('throws an error if channel id not a valid uuid', async () => {
				await expect(channelsController.deleteChannelInvite(
					testInviteId,
					"This isn't a valid uuid",
					mockAuthRequest
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if invite id not a valid uuid', async () => {
				await expect(channelsController.deleteChannelInvite(
					"This isn't a valid uuid",
					testChannelId,
					mockAuthRequest
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if the invite does not belong to the target channel', async () => {
				// When checking which channel the invite is linked to, an id that is
				// not testChannelId will be returned.
				channelsServiceMock
					.getInviteChannelId
					.mockResolvedValueOnce('39ce0971-78c1-4255-8aa8-1920f2b81a8f');
				await expect(channelsController.deleteChannelInvite(
					testDeviceId,
					testChannelId,
					mockAuthRequest
				)).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if channel passcode is invalid', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				await expect(channelsController.deleteChannelInvite(
					testInviteId,
					testChannelId,
					mockAuthRequest
				)).rejects.toThrowError(ForbiddenException);
			});

			it('throws an error if device does not have permission', async () => {
				devicesServiceMock.getDeviceToChannelEdge.mockResolvedValueOnce(
					Object.assign({}, testDeviceToChannelEdge, {
						permissions: [],
					})
				);
				await expect(channelsController.getInvites(
					testChannelId,
					mockAuthRequest,
				)).rejects.toThrowError(ForbiddenException);
			});
		});
	});

	describe('/channels/invites/:inviteId', () => {
		describe('GET /channels/invites/:inviteId (gets status of a channel invite)', () => {
			it('returns the channelType', async () => {
				await expect(
					channelsController.checkChannelInvite(testInviteId)
				).resolves.toEqual({
					channelType: testChannelType,
				});
			});

			it('throws an error if invite id not a valid uuid', async () => {
				await expect(
					channelsController.checkChannelInvite(
						"This isn't a valid uuid"
					)).rejects.toThrowError(BadRequestException);
			});

			it('returns NotFoundException if the invite does not exist', async () => {
				channelsServiceMock.channelInviteExists.mockResolvedValueOnce(false);
				await expect(
					channelsController.checkChannelInvite(testInviteId)
				).rejects.toThrowError(NotFoundException);
			});
		});

		describe('POST /channels/invites/:inviteId (consumes an invite to a channel)', () => {
			it('consumes an invite for a bidirectional channel', async () => {
				// Invite recipient doesn't know channel passcode at this point; a
				// passcode for the invite itself is used instead.
				getPasscodeMock.mockReturnValueOnce(testInvitePasscodeB64);
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: testReceiverPublicKey }
					)
				).resolves.toEqual({
					channelType: testChannelType,
					channelId: testChannelId,
					channelName: testChannelName,
					channelPasscode: testChannelPasscodeB64,
					updateTimestamp: testChannelUpdateTimestamp,
					creationTimestamp: testChannelCreationTimestamp,
					encryptedEncryptKey: testEncryptedEncryptKeyFull,
					originPublicKey: testOriginPublicKey,
				});
			});

			it('consumes an invite for a unidirectional channel', async () => {
				// Invite recipient doesn't know channel passcode at this point; a
				// passcode for the invite itself is used instead.
				getPasscodeMock.mockReturnValueOnce(testInvitePasscodeB64);
				channelsServiceMock.getChannelInfo.mockResolvedValueOnce(
					Object.assign(
						{}, testChannelInfo, {
						channelType: 'unidirectional' as ChannelType
					})
				);
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: undefined }
					)
				).resolves.toEqual({
					channelType: 'unidirectional',
					channelId: testChannelId,
					channelName: testChannelName,
					channelPasscode: testChannelPasscodeB64,
					updateTimestamp: testChannelUpdateTimestamp,
					creationTimestamp: testChannelCreationTimestamp,
					encryptedEncryptKey: testEncryptedEncryptKeyFull,
					originPublicKey: testOriginPublicKey,
				});
			});

			it('ignores error when channel already exists for the target device when accepting invite to bidirectional channel', async () => {
				getPasscodeMock.mockReturnValueOnce(testInvitePasscodeB64);
				devicesServiceMock.createDeviceToChannelEdge.mockRejectedValueOnce({
					message: ERROR_MESSAGE_CHANNEL_ALREADY_EXISTS
				});
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: testReceiverPublicKey }
					)
				).resolves.toEqual({
					channelType: testChannelType,
					channelId: testChannelId,
					channelName: testChannelName,
					channelPasscode: testChannelPasscodeB64,
					updateTimestamp: testChannelUpdateTimestamp,
					creationTimestamp: testChannelCreationTimestamp,
					encryptedEncryptKey: testEncryptedEncryptKeyFull,
					originPublicKey: testOriginPublicKey,
				});
			});

			it('ignores error when channel already exists for the target device when accepting invite to unidirectional channel', async () => {
				getPasscodeMock.mockReturnValueOnce(testInvitePasscodeB64);
				devicesServiceMock.createDeviceToChannelEdge.mockRejectedValueOnce({
					message: ERROR_MESSAGE_CHANNEL_ALREADY_EXISTS
				});
				channelsServiceMock.getChannelInfo.mockResolvedValueOnce(
					Object.assign(
						{}, testChannelInfo, {
						channelType: 'unidirectional' as ChannelType
					})
				);
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: undefined }
					)
				).resolves.toEqual({
					channelType: 'unidirectional',
					channelId: testChannelId,
					channelName: testChannelName,
					channelPasscode: testChannelPasscodeB64,
					updateTimestamp: testChannelUpdateTimestamp,
					creationTimestamp: testChannelCreationTimestamp,
					encryptedEncryptKey: testEncryptedEncryptKeyFull,
					originPublicKey: testOriginPublicKey,
				});
			});

			it('throws an error if invite id is invalid', async () => {
				await expect(
					channelsController.consumeInvite(
						"This isn't a valid uuid",
						mockAuthRequest,
						{ receiverPublicKey: testReceiverPublicKey }
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if invite is not found', async () => {
				channelsServiceMock.channelInviteExists.mockResolvedValueOnce(false);
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: testReceiverPublicKey }
					)
				).rejects.toThrowError(NotFoundException);
			});

			it('throws an error if attempt made to accept invite to bidirectional channel without a receiver public key', async () => {
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: undefined }
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if attempt made to accept invite to unidirectional channel with a receiver public key', async () => {
				channelsServiceMock.getChannelInfo.mockResolvedValueOnce(
					Object.assign(
						{}, testChannelInfo, {
						channelType: 'unidirectional' as ChannelType
					})
				);
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: testReceiverPublicKey }
					)
				).rejects.toThrowError(BadRequestException);
			});

			it('throws an error if invite passcode is invalid for bidirectional channels', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: testReceiverPublicKey }
					)
				).rejects.toThrowError(BadRequestException)
			});

			it('throws an error if invite passcode is invalid for unidirectional channels', async () => {
				getPasscodeMock.mockReturnValueOnce(
					[...new Array(44)].map(() => 'X').join('')
				)
				channelsServiceMock.getChannelInfo.mockResolvedValueOnce(
					Object.assign(
						{}, testChannelInfo, {
						channelType: 'unidirectional' as ChannelType
					})
				);
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: undefined }
					)
				).rejects.toThrowError(BadRequestException)
			});

			it('throws an error bidirectional channel is already shared with another device', async () => {
				getPasscodeMock.mockReturnValueOnce(testInvitePasscodeB64);
				channelsServiceMock.getCountOfDevicesForChannel.mockResolvedValueOnce(2);
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: testReceiverPublicKey }
					)
				).rejects.toThrowError(BadRequestException);
				expect(metricsServiceMock.recordEvent).toHaveBeenLastCalledWith('channel:inviteConsumeError', {
					errorType: 'The channel already has at least 1 other devices in it',
					devicesCount: 2,
				});
			});

			it('throws an error if unexpected error caught while checking if device already has access to bidirectional channel', async () => {
				getPasscodeMock.mockReturnValueOnce(testInvitePasscodeB64);
				devicesServiceMock.createDeviceToChannelEdge.mockRejectedValueOnce(new Error(
					'Unknown error'
				));
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: testReceiverPublicKey }
					)
				).rejects.toThrowError('Unknown error');
			});

			it('throws an error if unexpected error caught while checking if device already has access to bidirectional channel', async () => {
				getPasscodeMock.mockReturnValueOnce(testInvitePasscodeB64);
				devicesServiceMock.createDeviceToChannelEdge.mockRejectedValueOnce(new Error(
					'Unknown error'
				));
				channelsServiceMock.getChannelInfo.mockResolvedValueOnce(
					Object.assign(
						{}, testChannelInfo, {
						channelType: 'unidirectional' as ChannelType
					})
				);
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: undefined }
					)
				).rejects.toThrowError('Unknown error');
			});

			it('throws an internal server error unexpected channel type encountered', async () => {
				getPasscodeMock.mockReturnValueOnce(testInvitePasscodeB64);
				channelsServiceMock.getChannelInfo.mockResolvedValueOnce(
					Object.assign(
						{}, testChannelInfo, {
						channelType: 'unknown-channel-type' as ChannelType
					})
				);
				await expect(
					channelsController.consumeInvite(
						testInviteId,
						mockAuthRequest,
						{ receiverPublicKey: undefined }
					)
				).rejects.toThrowError(InternalServerErrorException);
			});
		});
	});
});
