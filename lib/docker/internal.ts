/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Pack } from 'tar-stream'

/**
 * Present a `tar-stream` stream as the Node.js stream its consumers expect.
 *
 * `tar-stream` is typed as the `streamx` streams it is built on. Those behave
 * like Node.js streams at runtime, but are not structurally assignable to them,
 * so `dockerode` needs the stream to be cast.
 *
 * @param stream The pack stream to cast
 */
export function asNodeStream(stream: Pack): NodeJS.ReadableStream {
	return stream as unknown as NodeJS.ReadableStream
}

/**
 * Pauses execution for a specified number of milliseconds.
 *
 * @param milliseconds - The number of milliseconds to sleep.
 */
export function sleep(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
