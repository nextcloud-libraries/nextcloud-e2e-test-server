/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Container } from 'dockerode'

import { runExec } from './exec.ts'

/**
 * Create a snapshot of the current database
 *
 * @param snapshot Name of the snapshot (default is a timestamp)
 * @param container Optional server container to use (defaults to current container)
 * @return Promise resolving to the snapshot name
 */
export async function createSnapshot(snapshot?: string, container?: Container): Promise<string> {
	const hash = new Date().toISOString().replace(/[^0-9]/g, '')
	console.log('\nCreating init DB snapshot…')
	await runExec(['cp', '/var/www/html/data/owncloud.db', `/var/www/html/data/owncloud.db-${snapshot ?? hash}`], { container, verbose: true })
	console.log('└─ Done')
	return snapshot ?? hash
}

/**
 * Restore a snapshot of the database
 *
 * @param snapshot Name of the snapshot (default is 'init')
 * @param container Optional server container to use (defaults to current container)
 */
export async function restoreSnapshot(snapshot = 'init', container?: Container) {
	console.log('\nRestoring DB snapshot…')
	await runExec(['cp', `/var/www/html/data/owncloud.db-${snapshot}`, '/var/www/html/data/owncloud.db'], { container, verbose: true })
	console.log('└─ Done')
}
