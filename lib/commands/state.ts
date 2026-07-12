/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { runCommand } from './docker.ts'

/**
 * Save the current state of the Nextcloud instance by creating a snapshot of the data directory.
 */
export function saveState(): Cypress.Chainable<string> {
	const snapshot = Math.random().toString(36).substring(7)

	runCommand(`rm /var/www/html/data-${snapshot}.tar`, { failOnNonZeroExit: false })
	// The instance keeps writing into ./data while we archive it (e.g. the
	// nextcloud.log, caches, session files), so a file can change mid-read and
	// GNU tar exits 1 with "file changed as we read it". That is harmless for a
	// test-state snapshot: silence the warning and treat exit 1 (benign,
	// "some files differ") as success while still failing on a real error
	// (exit 2, fatal).
	runCommand(`tar --warning=no-file-changed -cf /var/www/html/data-${snapshot}.tar ./data || [ $? -eq 1 ]`)

	cy.log(`Created snapshot ${snapshot}`)

	return cy.wrap(snapshot)
}

/**
 * Restore the state of the Nextcloud instance from a previously created snapshot.
 *
 * @param snapshot - The name of the snapshot to restore. If not provided, the default snapshot 'init' will be used.
 */
export function restoreState(snapshot: string = 'init') {
	runCommand('rm -vfr ./data/*')
	runCommand(`tar -xf '/var/www/html/data-${snapshot}.tar'`)

	// Any user sessions created between saveState() and restoreState()
	// are not present in the database, but exist in the web server.
	// Using them leads to unknown behavior, so we clear them all to prevent session errors.
	Cypress.session.clearAllSavedSessions()

	cy.log(`Restored snapshot ${snapshot}`)
}
