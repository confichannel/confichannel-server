import {
	CanActivate,
	ExecutionContext,
	Logger,
	mixin,
	Type,
	UnauthorizedException,
} from '@nestjs/common';
import { jwtDecrypt } from 'jose';
import { getJwtEncryptKey } from '../helpers/getJwtEncryptKey';
import { generateDeviceJwtToken } from '../helpers/generateJwtToken';

export type IEncryptedJwtAuthGuard = CanActivate & {
	handleRequest<TUser = any>(err, user, info, context, status?): TUser;
};

export const EncryptedJwtAuthGuard: () => Type<IEncryptedJwtAuthGuard> =
	memoize(createEncryptedJwtAuthGuard);

const defaultKey = 'default';

// https://github.com/nestjs/passport/blob/master/lib/utils/memoize.util.ts
// https://github.com/kamilmysliwiec
//
// https://github.com/nestjs/passport/blob/master/lib/auth.guard.ts
// https://github.com/kamilmysliwiec
// https://github.com/jmcdo29
// https://github.com/xyide
// https://github.com/michaeljota
// https://github.com/underfin
// https://github.com/Dzixxx
// https://github.com/kamilmysliwiec
//
// The code in this file is based on the code from the above links and authors
// and is licensed under the MIT license:
//
// https://github.com/nestjs/passport/blob/master/LICENSE
//
// (The MIT License)
//
// Copyright (c) 2017-2022 Kamil Mysliwiec <https://kamilmysliwiec.com>
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// 'Software'), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
// IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
// CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
// TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// ---
//
// Modifications were made.
//
// eslint-disable-next-line @typescript-eslint/ban-types
function memoize(fn: any) {
	const cache = {};
	return (...args: any[]) => {
		const n = args[0] || defaultKey;
		if (n in cache) {
			return cache[n];
		} else {
			const result = fn(n === defaultKey ? undefined : n);
			cache[n] = result;
			return result;
		}
	};
}

const deviceJwtRefreshTime = parseInt(
	process.env.DEVICE_JWT_REFRESH_TIME || '2592000' // 30 days in seconds
);
const deviceJwtExpirationTime = process.env.DEVICE_JWT_EXPIRATION_TIME || '90d';

function createEncryptedJwtAuthGuard(): Type<CanActivate> {
	/**
	 * This guard is by requests which have been decorated with
	 * EncryptedJwtAuthGuard. It takes the auth token from the request and
	 * decrypts and decodes it. It then makes the deviceId available on the
	 * request object.
	 *
	 * If this guard fails to decrypt the JWT key (i.e. the given key is not
	 * valid), then an unauthorized exception is thrown.
	 *
	 * Additionally, it detects if the encrypted JWT token is going to expire
	 * soon. If it is, a new one is generated and returned back on the same
	 * header.
	 */
	class MixinAuthGuard implements CanActivate {
		async canActivate(context: ExecutionContext): Promise<boolean> {
			const request = this.getRequest(context);
			const deviceToken = request.headers['x-confi-token'];
			if (!deviceToken) {
				throw new UnauthorizedException();
			}
			try {
				const { payload } = await jwtDecrypt(deviceToken, getJwtEncryptKey());
				if (!payload || typeof payload.exp !== 'number') {
					throw new UnauthorizedException();
				}

				// Add the decrypted/decoded deviceId to the request, so it is available
				// on request methods decorated by this guard.
				request['deviceId'] = payload.sub;
				const now = Math.round(Date.now() / 1000);
				const shouldRefreshPoint = now + deviceJwtRefreshTime;
				const response = this.getResponse(context);

				// If the token is going to expire "soon" (configurable via env vars)
				// then generate a new token and send it back to the frontend.
				if (payload.exp < shouldRefreshPoint) {
					const newToken = await generateDeviceJwtToken(
						{ sub: payload.sub },
						deviceJwtExpirationTime
					);
					response.set('X-Confi-Token', newToken);
				}
			} catch (err) {
				Logger.error(err);
				throw new UnauthorizedException();
			}
			return true;
		}

		// Grants access to HTTP request (as opposed to Websockets, RPC etc). This
		// is then used to get request headers and set the device id on the request.
		getRequest<T = any>(context: ExecutionContext): T {
			return context.switchToHttp().getRequest();
		}

		// Grants access to the HTTP response. This can then be used, if needed, to
		// set the response headers, for example.
		getResponse<T = any>(context: ExecutionContext): T {
			return context.switchToHttp().getResponse();
		}
	}
	const guard = mixin(MixinAuthGuard);
	return guard;
}
