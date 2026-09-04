/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Container } from 'dockerode'
import type { RunExecOptions } from './exec.ts'

import { User } from '../User.ts'
import { runOcc } from './exec.ts'

/**
 * Add a user to the Nextcloud in the container.
 *
 * @param user - The user object containing userId and password
 * @param options - Options for executing the command
 * @param options.container - The container to run the command in. If not provided, the current container will be used.
 * @param options.env - Environment variables to set for the command. Defaults to an empty array.
 * @param options.verbose - If true, the command's output will be printed to the console. Defaults to false.
 */
export function addUser(user: User, { container, env = [], verbose = false }: Partial<Omit<RunExecOptions, 'user'>> = {}) {
	return runOcc(
		['user:add', user.userId, '--password-from-env'],
		{ container, verbose, env: ['OC_PASS=' + user.password, ...env] },
	)
}

/**
 * Setup test users
 *
 * @param container Optional server container to use (defaults to current container)
 */
export async function setupUsers(container?: Container) {
	console.log('\nCreating test users… 👤')
	const users = ['test1', 'test2', 'test3', 'test4', 'test5']
		.map((uid) => new User(uid))
	for (const user of users) {
		await addUser(user, { container, verbose: true })
	}
	console.log('└─ Done')
}
