/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { RunExecOptions, RunExecResult } from '../docker.ts'

const defaultOptions = {
	failOnError: false,
	user: 'www-data',
	verbose: false,
}

/**
 *
 * @param command
 * @param options
 */
export function runCommand(command: string[] | string, options?: Partial<RunExecOptions>): Cypress.Chainable<RunExecResult> {
	const env = Object.entries(options?.env ?? {})
		.map(([name, value]) => `${name}=${value}`)

	return cy.task('runExec', {
		command,
		options: {
			...defaultOptions,
			...options,
			env,
		},
	})
}
