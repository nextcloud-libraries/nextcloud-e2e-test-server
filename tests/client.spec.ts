/*
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { getDockerOptions } from '../lib/docker/client.ts'

describe('Docker: client options', async () => {
	await test('uses DOCKER_SOCKET when it is set', () => {
		assert.deepEqual(getDockerOptions({ DOCKER_SOCKET: '/tmp/docker.sock' }), { socketPath: '/tmp/docker.sock' })
	})

	await test('leaves DOCKER_HOST and the default sockets to docker-modem otherwise', () => {
		assert.equal(getDockerOptions({ DOCKER_HOST: 'unix:///tmp/other.sock' }), undefined)
		assert.equal(getDockerOptions({}), undefined)
	})
})
