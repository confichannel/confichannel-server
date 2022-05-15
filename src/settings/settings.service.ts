import { Inject, Injectable, Logger } from '@nestjs/common';
import { aql, Database } from 'arangojs';
import { DocumentCollection } from 'arangojs/collection';
import { getSemVersions } from '../helpers/getSemVersions';

const invoiceIdSettingName = 'invoiceId';

const TIME_SPAN_REGEX =
	/^(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)$/i;

@Injectable()
export class SettingsService {
	private settingsCollection: DocumentCollection;
	private _previousVersion: number[];
	private _currentVersion: number[];
	private _deviceJwtExpirationTime: string;
	private _deviceJwtRefreshTime: number;
	private _loadStatus: 'loaded' | 'loading' | Error = 'loading';
	private _waitForLoad: Promise<void>;

	constructor(
		@Inject(Database)
		private db: Database
	) {
		// Initialise JWT settings
		this._deviceJwtExpirationTime =
			process.env.DEVICE_JWT_EXPIRATION_TIME || '90d';
		this._currentVersion = getSemVersions(process.env.npm_package_version);
		const timeSpanMatched = TIME_SPAN_REGEX.exec(this._deviceJwtExpirationTime);
		if (!timeSpanMatched) {
			// https://github.com/panva/jose/blob/main/src/lib/secs.ts
			throw new Error('DEVICE_JWT_EXPIRATION_TIME must be a valid time span');
		}
		this._deviceJwtRefreshTime = parseInt(
			process.env.DEVICE_JWT_REFRESH_TIME || '2592000' // 30 days in seconds
		);
		if (!this._deviceJwtRefreshTime || this._deviceJwtRefreshTime < 0) {
			throw new Error(
				'DEVICE_JWT_REFRESH_TIME must be a positive integer representing a duration, e.g. 1 month, in milliseconds'
			);
		}
		this._waitForLoad = new Promise((resolve, reject) => {
			const waitId = setInterval(() => {
				if (this._loadStatus === 'loaded') {
					resolve(undefined);
				} else if (this._loadStatus instanceof Error) {
					clearInterval(waitId);
					reject(this._loadStatus);
				}
			}, 1);
		});

		// Initialise DB settings
		this.settingsCollection = this.db.collection('settings');
		const settingsCollection = this.settingsCollection;
		const initialseDB = async () => {
			try {
				const settingsCollectionExists = await settingsCollection.exists();
				if (!settingsCollectionExists) {
					await settingsCollection.create();
					const now = new Date();
					await settingsCollection.save({
						_key: invoiceIdSettingName,
						year: now.getUTCFullYear(),
						month: now.getUTCMonth() + 1,
						idCounter: 1,
					});
				}
				const versionDoc = await settingsCollection.document('version', {
					graceful: true,
				});
				if (versionDoc) {
					this._previousVersion = getSemVersions(
						process.env.FORCE_PREVIOUS_VERSION || versionDoc.version || '0.2.0'
					);
				} else {
					this._previousVersion = [0, 2, 0];
				}
				if (
					!(
						this._currentVersion[0] === this._previousVersion[0] &&
						this._currentVersion[1] === this._previousVersion[1] &&
						this._currentVersion[2] === this._previousVersion[2]
					)
				) {
					Logger.log(
						`Detected update from ${this._previousVersion.join(
							'.'
						)} to ${this._currentVersion.join('.')}`
					);
				} else {
					Logger.log('No update detected');
				}
				await settingsCollection.save(
					{
						_key: 'version',
						version: `${this._currentVersion[0]}.${this._currentVersion[1]}.${this._currentVersion[2]}`,
					},
					{
						overwriteMode: 'replace',
					}
				);
				this._loadStatus = 'loaded';
			} catch (err) {
				console.error(err);
			}
		};
		initialseDB();
	}

	async getIsUpgradeToPatchVersion(checkVersion: string) {
		await this._waitForLoad;
		const _checkVersion = getSemVersions(checkVersion);
		if (this._previousVersion[0] !== _checkVersion[0]) {
			return false;
		}
		if (this._previousVersion[1] !== _checkVersion[1]) {
			return false;
		}
		if (this._previousVersion[2] !== _checkVersion[2]) {
			return this.currentVersion[2] === this._previousVersion[2] + 1;
		}
		return false;
	}

	async getIsUpgradeToMinorVersion(checkVersion: string) {
		await this._waitForLoad;
		const _checkVersion = getSemVersions(checkVersion);
		if (this._previousVersion[0] !== _checkVersion[0]) {
			return false;
		}
		if (this._previousVersion[1] !== _checkVersion[1]) {
			return this.currentVersion[1] === this._previousVersion[1] + 1;
		}
		return false;
	}

	/**
	 * Returns duration string indicating after how long a JWT should expire.
	 */
	get deviceJwtExpirationTime() {
		return this._deviceJwtExpirationTime;
	}

	get currentVersion() {
		return this._currentVersion;
	}

	/**
	 * Generates the next invoice id by incrementing the current invoice id
	 * by one or ticking off the invoice id to a new month.
	 * The invoice id is in the format YMMIIIIIII where:
	 *   Y: current year minus 2020
	 *   M: month prefix by 0 if under 10
	 *   I: the incremented if of the invoice within the given month.
	 * For example:
	 * 1050000001 would be the invoice id generated for May 2021, then
	 * 1050000002 would be the next invoice id for May 2021, then
	 * 1060000001 would be the first invoice for June 2021, and so on.
	 */
	async generateNextInvoiceId() {
		const now = new Date();
		const currentInvoiceIdDoc = await this.settingsCollection.document(
			'invoiceId'
		);
		const nowYear = now.getUTCFullYear();
		const nowMonth = now.getUTCMonth() + 1;
		if (
			currentInvoiceIdDoc.year === nowYear &&
			currentInvoiceIdDoc.month === nowMonth
		) {
			const nextIdDocResults = await this.db.query(aql`
				LET invoiceIdSetting = DOCUMENT("settings/${invoiceIdSettingName}")
				UPDATE invoiceIdSetting WITH {
					idCounter: setting.idCounter + 1
				} IN settings
				RETURN OLD
			`);
			const nextIdDoc = await nextIdDocResults.next();
			return `${nowYear - 2020}${('00' + nowMonth).slice(-2)}${(
				'0000000' + nextIdDoc.idCounter
			).slice(-7)}`;
		} else {
			const nextIdDocResults = await this.db.query(aql`
				LET invoiceIdSetting = DOCUMENT("settings/${invoiceIdSettingName}")
				UPDATE invoiceIdSetting WITH {
					year: ${nowYear},
					month: ${nowMonth},
					idCounter: 1
				} IN settings
				RETURN OLD
			`);
			const nextIdDoc = await nextIdDocResults.next();
			return `${nowYear - 2020}${('00' + nowMonth).slice(-2)}${(
				'0000000' + nextIdDoc.idCounter
			).slice(-7)}`;
		}
	}
}
