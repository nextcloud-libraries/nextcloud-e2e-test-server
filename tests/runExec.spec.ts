/*
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Container } from 'dockerode'

import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { getContainer, runExec, startNextcloud, stopNextcloud, waitOnNextcloud } from '../lib/docker.ts'

describe('Docker: runExec', async () => {
	let container: Container

	before(async () => {
		const ip = await startNextcloud('master', false)
		await waitOnNextcloud(ip)
		container = getContainer()
	})

	after(async () => await stopNextcloud())

	await test('captures stdout of a command', async () => {
		const { stdout, stderr, exitCode } = await runExec(['echo', 'hello world'], { container })
		assert.equal(stdout.trim(), 'hello world')
		assert.equal(stderr, '')
		assert.equal(exitCode, 0)
	})

	await test('accepts a plain string command', async () => {
		const { stdout, exitCode } = await runExec('hostname', { container })
		assert.ok(stdout.trim().length > 0)
		assert.equal(exitCode, 0)
	})

	await test('captures stderr separately from stdout', async () => {
		const { stdout, stderr, exitCode } = await runExec(
			['sh', '-c', 'echo out; echo err >&2'],
			{ container },
		)
		assert.equal(stdout.trim(), 'out')
		assert.equal(stderr.trim(), 'err')
		assert.equal(exitCode, 0)
	})

	await test('rejects on a non-zero exit code by default', async () => {
		await assert.rejects(
			runExec(['sh', '-c', 'echo boom >&2; exit 3'], { container }),
			(err: Error & { cause?: { stderr: string, exitCode: number } }) => {
				assert.match(err.message, /non-zero exit code/)
				// the collected result is attached as the error cause
				assert.equal(err.cause?.exitCode, 3)
				assert.equal(err.cause?.stderr.trim(), 'boom')
				return true
			},
		)
	})

	await test('does not reject on a non-zero exit code when failOnError is false', async () => {
		const { stdout, stderr, exitCode } = await runExec(
			['sh', '-c', 'echo out; echo err >&2; exit 5'],
			{ container, failOnError: false },
		)
		assert.equal(exitCode, 5)
		assert.equal(stdout.trim(), 'out')
		assert.equal(stderr.trim(), 'err')
	})

	await test('runs as the www-data user by default', async () => {
		const { stdout } = await runExec('whoami', { container })
		assert.equal(stdout.trim(), 'www-data')
	})

	await test('runs as the requested user', async () => {
		const { stdout } = await runExec('whoami', { container, user: 'root' })
		assert.equal(stdout.trim(), 'root')
	})

	await test('forwards environment variables to the command', async () => {
		const { stdout } = await runExec(
			['sh', '-c', 'echo "$MY_TEST_VAR"'],
			{ container, env: ['MY_TEST_VAR=from-env'] },
		)
		assert.equal(stdout.trim(), 'from-env')
	})

	await test('handles large multi-chunk output without truncation', async () => {
		// seq produces 100000 lines, forcing the stream to be delivered in
		// multiple chunks that runExec must concatenate in order
		const { stdout, exitCode } = await runExec(['seq', '1', '100000'], { container })
		const lines = stdout.trim().split('\n')
		assert.equal(exitCode, 0)
		assert.equal(lines.length, 100000)
		assert.equal(lines[0], '1')
		assert.equal(lines.at(-1), '100000')
	})
})
