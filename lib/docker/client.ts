/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Container } from 'dockerode'

import Docker from 'dockerode'
import { basename } from 'path'

export const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET ?? '/var/run/docker.sock' })

// Store the container name, different names are used to prevent conflicts when testing multiple apps locally
let _containerName: string | null = null
// Store latest server branch used, will be used for vendored apps
let _serverBranch = 'master'

/**
 * Get the container name that is currently created and/or used by dockerode
 */
export function getContainerName(): string {
	if (_containerName === null) {
		const app = basename(process.cwd()).replace(' ', '')
		_containerName = `nextcloud-e2e-test-server_${app}`
	}
	return _containerName
}

/**
 * Get the current container used
 * Throws if not found
 */
export function getContainer(): Container {
	return docker.getContainer(getContainerName())
}

/**
 * Get the server branch of the container started last, used as the default for vendored apps
 */
export function getServerBranch(): string {
	return _serverBranch
}

/**
 * Remember the server branch a container was started with
 *
 * @param branch The branch passed to `startNextcloud`
 */
export function setServerBranch(branch: string): void {
	_serverBranch = branch
}
