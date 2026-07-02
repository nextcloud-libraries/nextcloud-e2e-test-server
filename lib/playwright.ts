/**
 * SPDX-FileCopyrightText: 2024 Ferdinand Thiessen <opensource@fthiessen.de>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { APIRequestContext } from 'playwright'

import { addUser } from './docker.ts'
import { User } from './User.ts'

/**
 * Create a new random user
 *
 * @return The new user
 */
export async function createRandomUser(): Promise<User> {
	const user = User.createRandom()
	await addUser(user)
	return user
}

/**
 * Helper to login on the Nextcloud instance
 *
 * Throws if the login did not actually succeed. A rejected Nextcloud login does
 * not return an error status: it answers `303` and redirects back to `./login`,
 * whereas a successful login redirects to the default app. Following the
 * redirect (the default) would collapse both cases into a `200`, letting a
 * failed login pass silently and only surface much later as a confusing `403`
 * on the first authenticated request. So we stop at the redirect and inspect it.
 *
 * @param request API request object
 * @param user The user to login
 * @throws {Error} If the credentials are rejected or the login redirect is unexpected
 */
export async function login(
	request: APIRequestContext,
	user: User,
) {
	const tokenResponse = await request.get('./csrftoken', {
		failOnStatusCode: true,
	})
	const requesttoken = (await tokenResponse.json()).token

	const loginResponse = await request.post('./login', {
		form: {
			user: user.userId,
			password: user.password,
			requesttoken,
		},
		headers: {
			Origin: tokenResponse.url().replace(/index.php.*/, ''),
		},
		// Do not follow the redirect — its target tells us whether login succeeded
		maxRedirects: 0,
	})

	const location = loginResponse.headers().location ?? ''
	if (loginResponse.status() !== 303 || /\/login(\?|$)/.test(location)) {
		throw new Error(`Failed to login as "${user.userId}": expected a redirect away from the login page `
			+ `but got status ${loginResponse.status()} redirecting to "${location || '<none>'}"`)
	}
}
