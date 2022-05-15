import { EdgeCollection } from 'arangojs/collection';
import { EcdhJsonWebKey } from './EcdhJsonWebKey';

export type DeviceToChannelEdgeCollection = EdgeCollection<{
	permissions: string[];
	creationTimestamp: number;
	tempPublicKey?: EcdhJsonWebKey;
}>;
