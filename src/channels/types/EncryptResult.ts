export type EncryptResult = {
	/**
	 * base64 encoded encryption key. (Only return if an existing key was not
	 * provided).
	 */
	key?: string;

	/**
	 * base64 encoded initalisation vector.
	 */
	iv: string;

	/**
	 * base64 encoded encrypted data.
	 */
	encryptedData: string;

	/**
	 * base64 encoded authTag.
	 */
	authTag: string;
};
