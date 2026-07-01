/*
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { after, before, describe, test } from 'node:test'
import { configureNextcloud, getContainer, runExec, startNextcloud, stopNextcloud, waitOnNextcloud } from '../lib/docker.ts'

describe('Docker: Pre-installation of apps', async () => {
	before(async () => {
		const ip = await startNextcloud('master', false)
		await waitOnNextcloud(ip)
		await configureNextcloud(['viewer', 'text', 'forms'])
	})

	after(async () => await stopNextcloud())

	await test('Additional apps: Default mapping works', async () => {
		const container = getContainer()
		// this must not throw
		await runExec(['file', '-f', 'apps/viewer/appinfo/info.xml'], { container, failOnError: true })
	})

	await test('Additional apps: Mapping "main" branches', async () => {
		const container = getContainer()
		// this must not throw
		await runExec(['file', '-f', 'apps/text/appinfo/info.xml'], { container, failOnError: true})
	})

	await test('Additional apps: fetching from appstore works', async () => {
		const container = getContainer()
		// this must not throw
		await runExec(['file', '-f', 'apps/forms/appinfo/info.xml'], { container, failOnError: true})
	})
})
