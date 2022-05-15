import { EcdhJsonWebKey } from '../../types/EcdhJsonWebKey';

export type InviteCreatePayload = {
	encryptedEncryptKey: string;
	originPublicKey: EcdhJsonWebKey;
};
