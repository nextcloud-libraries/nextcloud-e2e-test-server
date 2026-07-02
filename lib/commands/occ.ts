/**
 * SPDX-FileCopyrightText: 2024 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { runCommand } from './docker.ts'

/**
 *
 * @param command
 * @param options
 */
export function runOccCommand(command: string, options?: Partial<Cypress.ExecOptions>): Cypress.Chainable<Cypress.Exec> {
	return runCommand(`php ./occ ${command}`, options)
}
