/*!
 * SPDX-FileCopyrightText: 2025 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ConfigEnv } from 'vite'

import { createLibConfig } from '@nextcloud/vite-config'
import { join } from 'node:path'

export default createLibConfig({
	index: join(__dirname, 'lib/index.ts'),
	commands: join(__dirname, 'lib/commands/index.ts'),
	selectors: join(__dirname, 'lib/selectors/index.ts'),
	docker: join(__dirname, 'lib/docker.ts'),
	cypress: join(__dirname, 'lib/cypress.ts'),
	playwright: join(__dirname, 'lib/playwright.ts'),
}, {
	libraryFormats: ['es', 'cjs'],
})