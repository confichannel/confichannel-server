/**
 * Given a version string in the format \d+\.\d+\.\d+, return an array of length
 * 3 containing the following numeric information:
 * [majorVersion, minorVersion, patchVersion]
 * @param {string} version
 */
export function getSemVersions(version: string) {
	if (typeof version !== 'string') {
		throw new Error('Semantic version not set');
	}
	const [majorVersion, minorVersion, patchVersion] = version
		.split('.')
		.map((i) => {
			if (!i.length) {
				return null;
			}
			const number = parseInt(i);
			if (isNaN(number)) {
				return null;
			} else {
				return number;
			}
		});
	if (
		typeof majorVersion !== 'number' ||
		typeof minorVersion !== 'number' ||
		typeof patchVersion !== 'number'
	) {
		throw new Error('Could not parse sematic version string');
	}
	return [majorVersion, minorVersion, patchVersion];
}
