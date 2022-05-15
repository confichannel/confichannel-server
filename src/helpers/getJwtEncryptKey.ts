import { createSecretKey } from 'crypto';

if (!process.env.JWT_ENCRYPT_KEY) {
	throw new Error('Ensure a JWT_ENCRYPT_KEY has been set');
}
const secretKey = createSecretKey(
	Buffer.from(process.env.JWT_ENCRYPT_KEY, 'utf8')
);

/**
 * Gets the secret key used to encrypt JWT tokens.
 */
export function getJwtEncryptKey() {
	return secretKey;
}
