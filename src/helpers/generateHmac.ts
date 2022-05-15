import { createHmac, randomBytes } from 'crypto';

export type HashResult = {
	/**
	 * base64 encoded hash.
	 */
	hash: string;

	/**
	 * base64 encoded salt used for the hash.
	 */
	salt: string;
};

/**
 * Given some data (if string, then base64 string; else Buffer) and optionally
 * a salt (if string, then base64 string; else Buffer), get the sha256 HMAC
 * hash of that data.
 * If no salt is provided, then one will be generated and returned.
 * The returned object contains the hash and its salt, both encoded as base64
 * strings.
 * @param {string | Buffer} data
 * @param {string | Buffer} salt
 */
export function generateHmac(
	data: string | Buffer,
	salt?: string | Buffer
): HashResult {
	let dataBuffer: Buffer = null;
	if (data instanceof Buffer) {
		dataBuffer = data;
	} else {
		dataBuffer = Buffer.from(data, 'base64');
	}
	let saltBuffer: Buffer = null;
	if (typeof salt !== 'undefined') {
		if (salt instanceof Buffer) {
			saltBuffer = salt;
		} else {
			saltBuffer = Buffer.from(salt, 'base64');
		}
	} else {
		saltBuffer = randomBytes(32);
	}
	const hasher = createHmac('sha256', saltBuffer);
	hasher.update(dataBuffer);
	const hash = hasher.digest('base64');
	const saltString = saltBuffer.toString('base64');
	return {
		hash,
		salt: saltString,
	};
}
