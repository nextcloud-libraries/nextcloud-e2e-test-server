/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type Docker from 'dockerode'
import type { Container } from 'dockerode'

import { PassThrough } from 'stream'
import { getContainer } from './client.ts'

export interface RunExecOptions {
	/**
	 * The container to run the command in. If not provided, the current container will be used.
	 */
	container: Docker.Container
	/**
	 * The user to run the command as. Defaults to 'www-data'.
	 */
	user: string
	/**
	 * The command will throw an error if it exits with a non-zero exit code. Defaults to true.
	 */
	failOnError: boolean
	/**
	 * Environment variables to set for the command. Defaults to an empty array.
	 */
	env: string[]
	/**
	 * If true, the command's output will be printed to the console. Defaults to false.
	 */
	verbose: boolean
	/**
	 * Working directory to run the command in. Defaults to the Nextcloud root.
	 */
	workingDir: string
}

export type RunExecResult = {
	stdout: string
	stderr: string
	exitCode: number
}

/**
 * Execute a command in the container and return stdout/stderr separately.
 *
 * @param command - The command to execute, either as a string or an array of strings (arguments)
 * @param options - Options for executing the command
 * @param options.container - The container to run the command in. If not provided, the current container will be used.
 * @param options.user - The user to run the command as. Defaults to 'www-data'.
 * @param options.verbose - If true, the command's output will be printed to the console. Defaults to false.
 * @param options.env - Environment variables to set for the command. Defaults to an empty array.
 * @param options.failOnError - The command will throw an error if it exits with a non-zero exit code. Defaults to true.
 * @param options.workingDir - Working directory to run the command in. Defaults to the Nextcloud root.
 */
export async function runExec(
	command: string | string[],
	{ container, user = 'www-data', verbose = false, env = [], failOnError = true, workingDir }: Partial<RunExecOptions> = {},
): Promise<RunExecResult> {
	container = container || getContainer()
	const exec = await container.exec({
		Cmd: typeof command === 'string' ? [command] : command,
		AttachStdout: true,
		AttachStderr: true,
		User: user,
		Env: env,
		WorkingDir: workingDir,
	})

	return new Promise<RunExecResult>((resolve, reject) => {
		const stdoutStream = new PassThrough()
		const stderrStream = new PassThrough()

		const stdout: string[] = []
		const stderr: string[] = []

		let settled = false
		let finishedStreams = 0

		const cleanup = () => {
			stdoutStream.removeAllListeners()
			stderrStream.removeAllListeners()
		}

		const settleResolve = (result: RunExecResult) => {
			if (settled) {
				return
			}
			settled = true
			cleanup()
			resolve(result)
		}

		const settleReject = (err: unknown) => {
			if (settled) {
				return
			}
			settled = true
			cleanup()
			reject(err)
		}

		const maybeResolve = async () => {
			finishedStreams++
			if (finishedStreams === 2) {
				const inspectionResult = await exec.inspect()
				const result = {
					stdout: stdout.join(''),
					stderr: stderr.join(''),
					exitCode: inspectionResult.ExitCode ?? 0,
				}

				if (result.exitCode && failOnError) {
					settleReject(new Error('command exited with non-zero exit code', { cause: result }))
					return
				}
				settleResolve(result)
			}
		}

		stdoutStream.on('data', (chunk) => {
			const text = chunk.toString('utf8')
			stdout.push(text)
			if (verbose && text.trim()) {
				console.log(`├─ stdout: ${text.trim().replace(/\n/gi, '\n├─ stdout: ')}`)
			}
		})

		stderrStream.on('data', (chunk) => {
			const text = chunk.toString('utf8')
			stderr.push(text)
			if (verbose && text.trim()) {
				console.log(`├─ stderr: ${text.trim().replace(/\n/gi, '\n├─ stderr: ')}`)
			}
		})

		stdoutStream.on('error', settleReject)
		stderrStream.on('error', settleReject)

		stdoutStream.on('end', maybeResolve)
		stderrStream.on('end', maybeResolve)

		exec.start({}, (err, stream) => {
			if (err) {
				settleReject(err)
				return
			}
			if (!stream) {
				settleReject(new Error('No exec stream returned'))
				return
			}

			stream.on('error', settleReject)
			stream.on('end', () => {
				stdoutStream.end()
				stderrStream.end()
			})

			exec.modem.demuxStream(stream, stdoutStream, stderrStream)
		})
	})
}

/**
 * Execute an occ command in the container
 *
 * @param command - The occ command to execute, either as a string or an array of strings (arguments)
 * @param options - Options for executing the command
 * @param options.container - The container to run the command in. If not provided, the current container will be used.
 * @param options.env - Environment variables to set for the command. Defaults to an empty array.
 * @param options.verbose - If true, the command's output will be printed to the console. Defaults to false.
 */
export async function runOcc(
	command: string | string[],
	{ container, env = [], verbose = false, ...rest }: Partial<Omit<RunExecOptions, 'user'>> = {},
) {
	const cmdArray = typeof command === 'string' ? [command] : command
	return runExec(['php', 'occ', ...cmdArray], { ...rest, container, verbose, env })
}

/**
 * Check whether a path exists inside the container
 *
 * @param path Absolute path to check
 * @param container The server container to use
 */
export async function pathExists(path: string, container: Container): Promise<boolean> {
	const { exitCode } = await runExec(['test', '-e', path], { container, failOnError: false })
	return exitCode === 0
}
