/*
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'
import { docker, startNextcloud, stopNextcloud, waitOnNextcloud } from '../lib/docker/index.ts'

describe('Docker: server branch', async () => {
	after(async () => {
		await stopNextcloud()
		await docker.getVolume('apps_writable').remove()
	})

	await test('fails when the requested branch could not be checked out', async () => {
		const ip = await startNextcloud('branch-that-does-not-exist', false, { forceRecreate: true, exposePort: 8086 })
		await assert.rejects(waitOnNextcloud(ip), /instead of 'branch-that-does-not-exist'/)
	})
})
