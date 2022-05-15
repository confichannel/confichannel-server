export interface EcdhJsonWebKey {
	crv?: string;
	ext?: boolean;
	d?: string;
	key_ops?: string[];
	kty?: string;
	x?: string;
	y?: string;
}
