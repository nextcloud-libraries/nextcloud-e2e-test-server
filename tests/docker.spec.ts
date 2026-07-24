/*
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import * as expect from 'node:assert'
import { after, before, describe, test } from 'node:test'
import { configureNextcloud, docker, getContainer, runExec, runOcc, startNextcloud, stopNextcloud, waitOnNextcloud } from '../lib/docker.ts'

describe('Docker: Pre-installation of apps', async () => {
	before(async () => {
		const ip = await startNextcloud('master', false, { forceRecreate: true })
		await waitOnNextcloud(ip)
		await configureNextcloud(['viewer', 'text', 'forms'])
	})

	after(async () => {
		await stopNextcloud()
		await docker.getVolume('apps_writable').remove()
	})

	await test('Additional apps: Default mapping works', async () => {
		const container = getContainer()
		// this must not throw
		await runExec(['file', '-f', 'apps-writable/viewer/appinfo/info.xml'], { container, failOnError: true })
	})

	await test('Additional apps: Mapping "main" branches', async () => {
		const container = getContainer()
		// this must not throw
		await runExec(['file', '-f', 'apps-writable/text/appinfo/info.xml'], { container })
		const { enabled } = await getAppsList()
		expect.equal('text' in enabled, true, 'Text app should be enabled')
	})

	await test('Additional apps: fetching from appstore works', async () => {
		const container = getContainer()
		// this must not throw
		await runExec(['file', '-f', 'apps-writable/forms/appinfo/info.xml'], { container })
		const { enabled } = await getAppsList()
		expect.equal('forms' in enabled, true, 'Forms app should be enabled')
	})
})

async function getAppsList(): Promise<{ enabled: Record<string, string>, disabled: Record<string, string> }> {
	const { stdout } = await runOcc(['app:list', '--output=json'], { failOnError: true })
	return JSON.parse(stdout)
}
