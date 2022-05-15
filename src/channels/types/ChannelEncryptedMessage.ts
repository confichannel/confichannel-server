export interface ChannelEncryptedMessage {
	/**
	 * Base 64 encoded string
	 */
	cipher: string;

	/**
	 * Base 64 encoded string
	 */
	iv: string;

	/**
	 * Base 64 encoded string
	 */
	salt?: string;
}
