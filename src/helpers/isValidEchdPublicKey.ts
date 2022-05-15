import { EcdhJsonWebKey } from '../types/EcdhJsonWebKey';

/**
 * Returns true if given publicKey is a valid ECDH JSON Web Key.
 * @param {EcdhJsonWebKey} publicKey
 */
export function isValidEchdPublicKey(publicKey: EcdhJsonWebKey) {
	if (typeof publicKey !== 'object') {
		return false;
	}
	if (Object.keys(publicKey).length !== 6) {
		return false;
	}
	if (typeof publicKey.d !== 'undefined') {
		// d is only set on private keys
		return false;
	}
	if (publicKey.crv !== 'P-384') {
		return false;
	}
	if (typeof publicKey.ext !== 'boolean') {
		return false;
	}
	if (!Array.isArray(publicKey.key_ops) || publicKey.key_ops.length) {
		return false;
	}
	if (publicKey.kty !== 'EC') {
		return false;
	}
	if (typeof publicKey.x !== 'string' || publicKey.x.length !== 64) {
		return false;
	}
	if (typeof publicKey.y !== 'string' || publicKey.y.length !== 64) {
		return false;
	}
	return true;
}
