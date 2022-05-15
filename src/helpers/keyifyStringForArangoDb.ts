import {
	ALLOWED_ARANGODB_CHARACTERS_PATTERN,
	ALLOWED_ARANGODB_SYMBOLS,
} from './arangoConsts';

export function keyifyStringForArangoDb(input: string): string {
	let keyified = '';
	for (let i = 0; i < input.length; i++) {
		const char = input[i];
		if (ALLOWED_ARANGODB_SYMBOLS.includes(char)) {
			keyified += char;
		} else if (ALLOWED_ARANGODB_CHARACTERS_PATTERN.test(char)) {
			keyified += char;
		}
	}
	return keyified;
}
