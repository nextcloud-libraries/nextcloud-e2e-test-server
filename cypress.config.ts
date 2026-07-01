/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Making sure we're forcing the development mode
process.env.NODE_ENV = 'development'
process.env.npm_package_name = 'nextcloud-e2e-test-server'

import { configureNextcloud, createSnapshot, setupUsers, startNextcloud, stopNextcloud, waitOnNextcloud } from './lib/docker'
import { defineConfig } from 'cypress'

export default defineConfig({
	projectId: 'h2z7r3',

	// Needed to trigger `after:run` events with cypress open
	experimentalInteractiveRunEvents: true,

	// faster video processing
	videoCompression: false,

	e2e: {
		// Disable session isolation
		testIsolation: false,

		setupNodeEvents(on, config) {
			// Remove container after run
			on('after:run', () => {
				stopNextcloud()
			})

			// Before the browser launches
			// starting Nextcloud testing container
			return startNextcloud(process.env.BRANCH)
				.then((ip) => {
					// Setting container's IP as base Url
					config.baseUrl = `http://${ip}/index.php`
					return ip
				})
				.then(waitOnNextcloud as (ip: string) => Promise<undefined>) // void !== undefined for Typescript
				.then(configureNextcloud as () => Promise<undefined>)
				.then(setupUsers as () => Promise<undefined>)
				.then(() => createSnapshot('init'))
				.then(() => {
					return config
				})
		},
	},
})
