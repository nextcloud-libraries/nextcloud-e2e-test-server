/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type Docker from 'dockerode'

import { runOcc } from './exec.ts'

/**
 * Set a Nextcloud system config in the container.
 *
 * @param key - The config key to set
 * @param value - The value to set for the config key
 * @param options - Options for executing the command
 * @param options.container - The container to run the command in. If not provided, the current container will be used.
 */
export function setSystemConfig(key: string, value: string, { container }: { container?: Docker.Container } = {}) {
	return runOcc(['config:system:set', key, '--value', value], { container, verbose: true })
}

/**
 * Get a Nextcloud system config value from the container.
 *
 * @param key - The config key to retrieve
 * @param options - Options for executing the command
 * @param options.container - The container to run the command in. If not provided, the current container will be used.
 */
export async function getSystemConfig(
	key: string,
	{ container }: { container?: Docker.Container } = {},
) {
	const { stdout } = await runOcc(['config:system:get', key], { container })
	return stdout.trim()
}
