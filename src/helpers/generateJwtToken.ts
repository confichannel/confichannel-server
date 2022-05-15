import { EncryptJWT, JWTPayload } from 'jose';
import { getJwtEncryptKey } from './getJwtEncryptKey';

/**
 * Generates a JWT token for a device.
 * @param {JWTPayload} payload
 * @param {string} expirationTime
 */
export async function generateDeviceJwtToken(
	payload: JWTPayload,
	expirationTime: string
) {
	const jwt = await new EncryptJWT(payload)
		.setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
		.setIssuedAt()
		.setExpirationTime(expirationTime)
		.encrypt(getJwtEncryptKey());
	return jwt;
}
