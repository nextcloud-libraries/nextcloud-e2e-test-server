/* eslint-disable no-console */
/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Container } from 'dockerode'
import type { Stream } from 'stream'

import Docker from 'dockerode'
import waitOn from 'wait-on'

import { PassThrough } from 'stream'
import { basename, join, resolve, sep } from 'path'
import { existsSync, readFileSync } from 'fs'
import { XMLParser } from 'fast-xml-parser'

import { User } from './User'

const SERVER_IMAGE = 'ghcr.io/nextcloud/continuous-integration-shallow-server'
const VENDOR_APPS = {
	text: 'https://github.com/nextcloud/text.git',
	viewer: 'https://github.com/nextcloud/viewer.git',
	notifications: 'https://github.com/nextcloud/notifications.git',
	activity: 'https://github.com/nextcloud/activity.git',
}

export const docker = new Docker()

// Store the container name, different names are used to prevent conflicts when testing multiple apps locally
let _containerName: string|null = null
// Store latest server branch used, will be used for vendored apps
let _serverBranch = 'master'

/**
 * Get the container name that is currently created and/or used by dockerode
 */
export const getContainerName = function(): string {
	if (_containerName === null) {
		const app = basename(process.cwd()).replace(' ', '')
		_containerName = `nextcloud-e2e-test-server_${app}`
	}
	return _containerName
}

/**
 * Get the current container used
 * Throws if not found
 */
export const getContainer = function(): Container {
	return docker.getContainer(getContainerName())
}

interface StartOptions {
	/**
	 * Force recreate the container even if an old one is found
	 * @default false
	 */
	forceRecreate?: boolean

	/**
	 * Additional mounts to create on the container
	 * You can pass a mapping from server path (relative to Nextcloud root) to your local file system
	 * @example ```js
	 * { config: '/path/to/local/config' }
	 * ```
	 */
	mounts?: Record<string, string>

	/**
	 * Optional port binding
	 * The default port (TCP 80) will be exposed to this host port
	 */
	exposePort?: number
}

/**
 * Start the testing container
 *
 * @param {string|undefined} branch server branch to use (default 'master')
 * @param {boolean|string|undefined} mountApp bind mount app within server (`true` for autodetect, `false` to disable, or a string to force a path) (default true)
 * @param {StartOptions|undefined} options Optional parameters to configure the container creation
 * @return Promise resolving to the IP address of the server
 * @throws {Error} If Nextcloud container could not be started
 */
export async function startNextcloud(branch = 'master', mountApp: boolean|string = true, options: StartOptions = {}): Promise<string> {
	let appPath = mountApp === true ? process.cwd() : mountApp
	let appId: string|undefined
	let appVersion: string|undefined
	if (appPath) {
		console.log('Mounting app directories…')
		while (appPath) {
			const appInfoPath = resolve(join(appPath, 'appinfo', 'info.xml'))
			if (existsSync(appInfoPath)) {
				const parser = new XMLParser()
				const xmlDoc = parser.parse(readFileSync(appInfoPath))
				appId = xmlDoc.info.id
				appVersion = xmlDoc.info.version
				console.log(`└─ Found ${appId} version ${appVersion}`)
				break
			} else {
				// skip if root is reached or manual directory was set
				if (appPath === sep || typeof mountApp === 'string') {
					console.log('└─ No appinfo found')
					appPath = false
					break
				}
				appPath = join(appPath, '..')
			}
		}
	}

	try {
		await pullImage()

		// Getting latest image
		console.log('\nChecking running containers… 🔍')
		const localImage = await docker.listImages({ filters: `{"reference": ["${SERVER_IMAGE}"]}` })

		// Remove old container if exists and not initialized by us
		try {
			const oldContainer = getContainer()
			const oldContainerData = await oldContainer.inspect()
			if (oldContainerData.State.Running) {
				console.log('├─ Existing running container found')
				if (options.forceRecreate === true) {
					console.log('└─ Forced recreation of container was enabled, removing…')
				} else if (localImage[0].Id !== oldContainerData.Image) {
					console.log('└─ But running container is outdated, replacing…')
				} else {
					// Get container's IP
					console.log('├─ Reusing that container')
					const ip = await getContainerIP(oldContainer)
					return ip
				}
			} else {
				console.log('└─ None found!')
			}
			// Forcing any remnants to be removed just in case
			await oldContainer.remove({ force: true })
		} catch (error) {
			console.log('└─ None found!')
		}

		// Starting container
		console.log('\nStarting Nextcloud container… 🚀')
		console.log(`├─ Using branch '${branch}'`)

		const mounts: string[] = []
		if (appPath !== false) {
			mounts.push(`${appPath}:/var/www/html/apps/${appId}:ro`)
		}
		Object.entries(options.mounts ?? {})
			.forEach(([server, local]) => mounts.push(`${local}:/var/www/html/${server}:ro`))

		const PortBindings = !options.exposePort ? undefined : {
			'80/tcp': [{
				HostIP: '0.0.0.0',
				HostPort: options.exposePort.toString(),
			}],
		}

		// On macOS we need to expose the port since the docker container is running within a VM
		const autoExposePort = process.platform === 'darwin'

		const container = await docker.createContainer({
			Image: SERVER_IMAGE,
			name: getContainerName(),
			Env: [`BRANCH=${branch}`, 'APCU=1'],
			HostConfig: {
				Binds: mounts.length > 0 ? mounts : undefined,
				PortBindings,
				PublishAllPorts: autoExposePort,
				// Mount data directory in RAM for faster IO
				Mounts: [{
					Target: '/var/www/html/data',
					Source: '',
					Type: 'tmpfs',
					ReadOnly: false,
				}],
			},
		})
		await container.start()

		// Set proper permissions for the data folder
		await runExec(['chown', '-R', 'www-data:www-data', '/var/www/html/data'], { container, user: 'root' })
		await runExec(['chmod', '0770', '/var/www/html/data'], { container, user: 'root' })

		// Get container's IP
		const ip = await getContainerIP(container)
		console.log(`├─ Nextcloud container's IP is ${ip} 🌏`)

		_serverBranch = branch

		return ip
	} catch (err) {
		console.log('└─ Unable to start the container 🛑')
		console.log(err)
		stopNextcloud()
		throw new Error('Unable to start the container')
	}
}

const pullImage = function() {
	// Pulling images
	console.log('\nPulling images… ⏳')
	return new Promise((resolve, reject) => docker.pull(SERVER_IMAGE, (_err, stream: Stream) => {
		const onFinished = function(err: Error | null) {
			if (!err) {
				return resolve(true)
			}
			reject(err)
		}
		// https://github.com/apocas/dockerode/issues/357
		if(stream) {
			docker.modem.followProgress(stream, onFinished)
		} else {
			reject('Failed to open stream')
		}
	}))
		.then(() => console.log('└─ Done'))
		.catch(err => console.log(`└─ 🛑 FAILED! Trying to continue with existing image. (${err})`))
}

/**
 * Configure Nextcloud
 *
 * @param {string[]} apps List of default apps to install (default is ['viewer'])
 * @param {string|undefined} vendoredBranch The branch used for vendored apps, should match server (defaults to latest branch used for `startNextcloud` or fallsback to `master`)
 * @param {Container|undefined} container Optional server container to use (defaults to current container)
 */
export const configureNextcloud = async function(apps = ['viewer'], vendoredBranch?: string, container?: Container) {
	vendoredBranch = vendoredBranch || _serverBranch

	console.log('\nConfiguring Nextcloud…')
	container = container ?? getContainer()
	await runOcc('--version', { container, verbose: true })

	// Be consistent for screenshots
	await setSystemConfig('default_language', 'en', { container })
	await setSystemConfig('force_language', 'en', { container })
	await setSystemConfig('default_locale', 'en_US', { container })
	await setSystemConfig('force_locale', 'en_US', { container })
	await setSystemConfig('enforce_theme', 'light', { container })

	// Checking apcu
	console.log('├─ Checking APCu configuration... 👀')
	const distributed = await getSystemConfig('memcache.distributed', { container })
	const local = await getSystemConfig('memcache.local', { container })
	const hashing = await getSystemConfig('hashing_default_password', { container })
	if (!distributed.includes('Memcache\\APCu')
		|| !local.includes('Memcache\\APCu')
		|| !hashing.includes('true')) {
		console.log('└─ APCu is not properly configured 🛑')
		throw new Error('APCu is not properly configured')
	}
	console.log('│  └─ OK !')

	// Build app list
	const json = await runOcc(['app:list', '--output', 'json'], { container, verbose: true })
	const applist = JSON.parse(json)

	// Enable apps and give status
	for (const app of apps) {
		if (app in applist.enabled) {
			console.log(`├─ ${app} version ${applist.enabled[app]} already installed and enabled`)
		} else if (app in applist.disabled) {
			// built in or mounted already as the app under development
			await runOcc(['app:enable', '--force', app], { container, verbose: true })
		} else if (app in VENDOR_APPS) {
			// apps that are vendored but still missing (i.e. not build in or mounted already)
			// NOTE: This currently fails in workflows since mounts are RO at this point
			await runExec(['git', 'clone', '--depth=1', `--branch=${vendoredBranch}`, VENDOR_APPS[app], `apps/${app}`], { container, verbose: true })
			await runOcc(['app:enable', '--force', app], { container, verbose: true })
		} else {
			// try appstore
			await runOcc(['app:install', '--force', app], { container, verbose: true })
		}
	}
	console.log('└─ Nextcloud is now ready to use 🎉')
}

/**
 * Setup test users
 *
 * @param {Container|undefined} container Optional server container to use (defaults to current container)
 */
export const setupUsers = async function(container?: Container) {
	console.log('\nCreating test users… 👤')
	const users = ['test1', 'test2', 'test3', 'test4', 'test5']
		.map(uid => new User(uid))
	for (const user of users) {
		await addUser(user, { container, verbose: true })
	}
	console.log('└─ Done')
}

/**
 * Create a snapshot of the current database
 * @param {string|undefined} snapshot Name of the snapshot (default is a timestamp)
 * @param {Container|undefined} container Optional server container to use (defaults to current container)
 * @return Promise resolving to the snapshot name
 */
export const createSnapshot = async function(snapshot?: string, container?: Container): Promise<string> {
	const hash = new Date().toISOString().replace(/[^0-9]/g, '')
	console.log('\nCreating init DB snapshot…')
	await runExec(['cp', '/var/www/html/data/owncloud.db', `/var/www/html/data/owncloud.db-${snapshot ?? hash}`], { container, verbose: true })
	console.log('└─ Done')
	return snapshot ?? hash
}

/**
 * Restore a snapshot of the database
 * @param {string|undefined} snapshot Name of the snapshot (default is 'init')
 * @param {Container|undefined} container Optional server container to use (defaults to current container)
 */
export const restoreSnapshot = async function(snapshot = 'init', container?: Container) {
	console.log('\nRestoring DB snapshot…')
	await runExec(['cp', `/var/www/html/data/owncloud.db-${snapshot}`, '/var/www/html/data/owncloud.db'], { container, verbose: true })
	console.log('└─ Done')
}

/**
 * Force stop the testing container
 */
export const stopNextcloud = async function() {
	try {
		const container = getContainer()
		console.log('Stopping Nextcloud container…')
		container.remove({ force: true })
		console.log('└─ Nextcloud container removed 🥀')
	} catch (err) {
		console.log(err)
	}
}

/**
 * Get the testing container's IP
 *
 * @param container name of the container
 */
export const getContainerIP = async function(
	container = getContainer()
): Promise<string> {
	const containerInspect = await container.inspect()
	const hostPort = containerInspect.NetworkSettings.Ports['80/tcp']?.[0]?.HostPort

	if (hostPort) {
		return `localhost:${hostPort}`
	}

	let ip = ''
	let tries = 0
	while (ip === '' && tries < 10) {
		tries++

		await container.inspect((_err, data) => {
			ip = data?.NetworkSettings?.IPAddress || ''
		})

		if (ip !== '') {
			break
		}

		await sleep(1000 * tries)
	}

	return ip
}

// Would be simpler to start the container from cypress.config.ts,
// but when checking out different branches, it can take a few seconds
// Until we can properly configure the baseUrl retry intervals,
// We need to make sure the server is already running before cypress
// https://github.com/cypress-io/cypress/issues/22676
export const waitOnNextcloud = async function(ip: string) {
	console.log('├─ Waiting for Nextcloud to be ready… ⏳')
	await waitOn({ resources: [`http://${ip}/index.php`] })
	console.log('└─ Done')
}

interface RunExecOptions {
	container: Docker.Container;
	user: string;
	env: string[];
	verbose: boolean;
}

type RunExecResult = {
	stdout: string
	stderr: string
}

/**
 * Execute a command in the container and return stdout/stderr separately.
 */
export const runExecRaw = async function(
	command: string | string[],
	{ container, user='www-data', verbose=false, env=[] }: Partial<RunExecOptions> = {},
): Promise<RunExecResult> {
	container = container || getContainer()
	const exec = await container.exec({
		Cmd: typeof command === 'string' ? [command] : command,
		AttachStdout: true,
		AttachStderr: true,
		User: user,
		Env: env,
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

		const maybeResolve = () => {
			finishedStreams++
			if (finishedStreams === 2) {
				settleResolve({
					stdout: stdout.join(''),
					stderr: stderr.join(''),
				})
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
 * Execute a command in the container and return stdout only.
 */
export const runExec = async function(
	command: string | string[],
	options: Partial<RunExecOptions> = {},
): Promise<string> {
	const { stdout } = await runExecRaw(command, options)
	return stdout
}

/**
 * Execute an occ command in the container
 */
export const runOcc = function(
	command: string | string[],
	{ container, env=[], verbose=false }: Partial<Omit<RunExecOptions, 'user'>> = {},
) {
	const cmdArray = typeof command === 'string' ? [command] : command
	return runExec(['php', 'occ', ...cmdArray], { container, verbose, env })
}

/**
 * Set a Nextcloud system config in the container.
 */
export const setSystemConfig = function(
	key: string,
	value: string,
	{ container }: { container?: Docker.Container } = {},
) {
	return runOcc(['config:system:set', key, '--value', value], { container, verbose: true })
}

/**
 * Get a Nextcloud system config value from the container.
 */
export const getSystemConfig = function(
	key: string,
	{ container }: { container?: Docker.Container } = {},
) {
	return runOcc(['config:system:get', key], { container })
}


/**
 * Add a user to the Nextcloud in the container.
 */
export const addUser = function(
	user: User,
	{ container, env=[], verbose=false }: Partial<Omit<RunExecOptions, 'user'>> = {},
) {
	return runOcc(
		['user:add', user.userId, '--password-from-env'],
		{ container, verbose, env: ['OC_PASS=' + user.password, ...env] }
	)
}

const sleep = function(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
