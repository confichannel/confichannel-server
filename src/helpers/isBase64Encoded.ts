/**
 * Checks if a string is base64 encoded by decoding it, re-encoding it, and
 * comparing if it remains the same.
 * If any error occurs during the decoding/encoding, then false is returned.
 * @param {string} str
 * @returns
 */
export function isBase64Encoded(str: string) {
	try {
		return Buffer.from(str, 'base64').toString('base64') === str;
	} catch (err) {
		return false;
	}
}
