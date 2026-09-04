/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { docker } from './client.ts'

/** Named volume mounted at `/var/www/html/apps-writable`, holds the mounted and cloned apps */
export const APPS_WRITABLE_VOLUME = 'apps_writable'

/**
 * Remove the `apps-writable` volume, so that a newly created container starts with an empty apps path
 *
 * Docker keeps the named volume around when the container is removed, meaning apps cloned by
 * `configureNextcloud` would otherwise be reused - including apps of a different server branch.
 */
export async function pruneAppsWritableVolume() {
	try {
		await docker.getVolume(APPS_WRITABLE_VOLUME).remove()
		console.log('├─ Pruned the "apps-writable" volume')
	} catch (error) {
		// The volume does not exist (yet), nothing to prune
		if ((error as { statusCode?: number }).statusCode === 404) {
			return
		}
		throw new Error(`Unable to remove the "${APPS_WRITABLE_VOLUME}" volume`, { cause: error })
	}
}
