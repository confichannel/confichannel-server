import { randomBytes } from 'crypto';

const capitalLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const capitalLettersLength = capitalLetters.length;
const numbers = '0123456789';
const numbersLength = numbers.length;

/**
 * Generates a random name in the format "ADA DAD ADA" where:
 *   A: is alphabetic character A-Z
 *   D: is a digit 0-9
 */
export function getRandomName(): string {
	const nameLength = 9;
	let randomName = '';
	for (let i = 0; i < nameLength; i++) {
		const randomNumber = parseInt(randomBytes(4).toString('hex'), 16);
		if (i % 2 === 0) {
			randomName += capitalLetters[randomNumber % capitalLettersLength] || ' ';
		} else {
			randomName += numbers[randomNumber % numbersLength] || ' ';
		}
		// The following conditions means: if not at the beginning nor the end of
		// the randomName string, then put a space after every 3 characters.
		if (i && i < nameLength - 1 && (i + 1) % 3 === 0) {
			randomName += ' ';
		}
	}
	return randomName;
}
