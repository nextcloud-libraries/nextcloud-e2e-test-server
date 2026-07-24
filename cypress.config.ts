/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Making sure we're forcing the development mode
process.env.NODE_ENV = 'development'
process.env.npm_package_name = 'nextcloud-e2e-test-server'

import type { RunExecOptions, RunExecResult } from './lib'

import { defineConfig } from 'cypress'
import vitePreprocessor from 'cypress-vite'
import {
	configureNextcloud,
	createSnapshot,
	docker,
	runExec as dockerRunExec,
	setupUsers,
	startNextcloud,
	stopNextcloud,
	waitOnNextcloud,
} from './lib/docker.ts'

export default defineConfig({
	projectId: 'h2z7r3',

	// Needed to trigger `after:run` events with cypress open
	experimentalInteractiveRunEvents: true,

	// faster video processing
	videoCompression: false,

	e2e: {
		// Disable session isolation
		testIsolation: false,

		async setupNodeEvents(on, config) {
			on('file:preprocessor', vitePreprocessor({ configFile: false }))

			// Remove container after run
			on('after:run', async () => {
				await stopNextcloud()
				await docker.getVolume('apps_writable').remove()
			})

			on('task', {
				async runExec({ command, options }: { command: string | string[], options: Partial<RunExecOptions> }): Promise<RunExecResult> {
					return await dockerRunExec(command, options)
				},
			})

			// Before the browser launches
			// starting Nextcloud testing container
			const ip = await startNextcloud(process.env.BRANCH, false, { forceRecreate: true, exposePort: 8086 })
			// Setting container's IP as base Url
			config.baseUrl = `http://${ip}/index.php`
			const ip_1 = ip
			await waitOnNextcloud(ip_1)
			await configureNextcloud()
			await setupUsers()
			await createSnapshot('init')
			return config
		},
	},
})
