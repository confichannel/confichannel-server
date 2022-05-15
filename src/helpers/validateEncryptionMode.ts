import { EncryptionMode } from '../channels/types/EncryptionMode';

/**
 * Throws an error if the encryption mode is not recognised.
 * @param {EncryptionMode | undefined} value
 */
export function validateEncryptionMode(value: EncryptionMode | undefined) {
	if (
		!(
			value === 'end-to-end-shared' ||
			value === 'end-to-end-password' ||
			value === 'end-to-end-private-public'
		)
	) {
		throw new Error('Invalid encryption mode');
	}
}
