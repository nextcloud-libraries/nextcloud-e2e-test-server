/**
 * SPDX-FileCopyrightText: 2024 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { RunExecOptions, RunExecResult } from '../docker.ts'

import { runCommand } from './docker.ts'

/**
 *
 * @param command
 * @param options
 */
export function runOccCommand(command: string, options?: Partial<RunExecOptions>): Cypress.Chainable<RunExecResult> {
	return runCommand(['php', 'occ', command], { verbose: true, ...options })
}
