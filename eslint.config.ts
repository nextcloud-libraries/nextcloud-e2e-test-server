/*
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { recommendedLibrary } from '@nextcloud/eslint-config'
import { defineConfig } from 'eslint/config'
import globals from 'globals'

export default defineConfig([
	...recommendedLibrary,

	{
		name: 'playwright-overrides',
		files: ['playwright/**/*.ts'],
		rules: {
			// required for fixtures
			'no-empty-pattern': 'off',
		},
	},

	{
		name: 'node-scripts',
		files: ['lib/docker.ts', 'playwright/**/*.mjs'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			// Node-side tooling where progress output to the console is intentional
			'no-console': 'off',
		},
	},
])
