/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Container } from 'dockerode'

import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { getContainer } from './client.ts'
import { pathExists, runExec } from './exec.ts'

/** Path of the server log inside the container, it lives on the tmpfs mounted data directory */
const NEXTCLOUD_LOG = '/var/www/html/data/nextcloud.log'

/**
 * Read the server log (`data/nextcloud.log`) from the container.
 *
 * The data directory is a tmpfs and the container is removed after the run,
 * so the log has to be fetched while the container still exists.
 * It also has to be read by a command run inside the container:
 * the Docker copy API (`docker cp` / `getArchive`) only sees the container's own
 * filesystem and answers `404` for any path below a tmpfs mount.
 *
 * @param container Optional server container to use (defaults to current container)
 * @return The log contents, or an empty string if the server has not written a log
 */
export async function getNextcloudLog(container?: Container): Promise<string> {
	container = container ?? getContainer()

	try {
		if (!await pathExists(NEXTCLOUD_LOG, container)) {
			// No log written (yet)
			return ''
		}
		const { stdout } = await runExec(['cat', NEXTCLOUD_LOG], { container })
		return stdout
	} catch {
		// The container is already gone
		return ''
	}
}

/**
 * Save the server log (`data/nextcloud.log`) from the container to a local file.
 *
 * Must be called before {@link stopNextcloud}, the log is lost with the container.
 *
 * @param targetPath Local path to write the log to (default 'nextcloud.log' in the current directory)
 * @param container Optional server container to use (defaults to current container)
 * @return Whether a log was found and written
 */
export async function saveNextcloudLog(targetPath = 'nextcloud.log', container?: Container): Promise<boolean> {
	const log = await getNextcloudLog(container)
	if (log === '') {
		console.log('└─ No server log found in the container')
		return false
	}

	const target = resolve(targetPath)
	mkdirSync(dirname(target), { recursive: true })
	writeFileSync(target, log)
	console.log(`└─ Server log saved to ${target} 📝`)
	return true
}
