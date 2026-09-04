/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Container } from 'dockerode'
import type { Stream } from 'stream'

import { XMLParser } from 'fast-xml-parser'
import { existsSync, readFileSync } from 'fs'
import { join, resolve, sep } from 'path'
import waitOn from 'wait-on'
import { docker, getContainer, getContainerName, setServerBranch } from './client.ts'
import { runExec } from './exec.ts'
import { sleep } from './internal.ts'
import { saveNextcloudLog } from './logs.ts'
import { APPS_WRITABLE_VOLUME, pruneAppsWritableVolume } from './volumes.ts'

const SERVER_IMAGE = 'ghcr.io/nextcloud/continuous-integration-shallow-server'

interface StartOptions {
	/**
	 * Force recreate the container even if an old one is found
	 *
	 * @default false
	 */
	forceRecreate?: boolean

	/**
	 * Additional mounts to create on the container
	 * You can pass a mapping from server path (relative to Nextcloud root) to your local file system
	 *
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
 * @param branch server branch to use (default 'master')
 * @param mountApp bind mount app within server (`true` for autodetect, `false` to disable, or a string to force a path) (default true)
 * @param options Optional parameters to configure the container creation
 * @return Promise resolving to the IP address of the server
 * @throws {Error} If Nextcloud container could not be started
 */
export async function startNextcloud(branch = 'master', mountApp: boolean | string = true, options: StartOptions = {}): Promise<string> {
	let appPath = mountApp === true ? process.cwd() : mountApp
	let appId: string | undefined
	let appVersion: string | undefined
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
		} catch {
			console.log('└─ None found!')
		}

		// Starting container
		console.log('\nStarting Nextcloud container… 🚀')
		console.log(`├─ Using branch '${branch}'`)

		// The volume outlives the container, so it has to be pruned to not carry
		// apps cloned for a previous run (possibly of another branch) into the new container
		await pruneAppsWritableVolume()

		const mounts: string[] = []
		Object.entries(options.mounts ?? {})
			.forEach(([server, local]) => mounts.push(`${local}:/var/www/html/${server}:ro`))

		if (appPath !== false) {
			mounts.push(`${appPath}:/var/www/html/apps-writable/${appId}:ro`)
		}

		const PortBindings = !options.exposePort
			? undefined
			: {
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
				}, {
					Target: '/var/www/html/apps-writable',
					Source: APPS_WRITABLE_VOLUME,
					Type: 'volume',
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

		setServerBranch(branch)

		return ip
	} catch (err) {
		console.log('└─ Unable to start the container 🛑')
		console.log(err)
		stopNextcloud()
		throw new Error('Unable to start the container', { cause: err })
	}
}

/**
 *
 */
function pullImage() {
	// Pulling images
	console.log('\nPulling images… ⏳')
	return new Promise((resolve, reject) => docker.pull(SERVER_IMAGE, (_: unknown, stream: Stream) => {
		const onFinished = function(err: Error | null) {
			if (!err) {
				return resolve(true)
			}
			reject(err)
		}
		// https://github.com/apocas/dockerode/issues/357
		if (stream) {
			docker.modem.followProgress(stream, onFinished)
		} else {
			reject('Failed to open stream')
		}
	}))
		.then(() => console.log('└─ Done'))
		.catch((err) => console.log(`└─ 🛑 FAILED! Trying to continue with existing image. (${err})`))
}

interface StopOptions {
	/**
	 * Local path to save the server log (`data/nextcloud.log`) to before the container is removed.
	 *
	 * @default process.env.NEXTCLOUD_E2E_LOG_FILE (disabled if unset)
	 */
	saveLogTo?: string
}

/**
 * Force stop the testing container
 *
 * @param options Optional parameters to configure the container removal
 */
export async function stopNextcloud(options: StopOptions = {}) {
	try {
		const container = getContainer()

		const logTarget = options.saveLogTo ?? process.env.NEXTCLOUD_E2E_LOG_FILE
		if (logTarget) {
			console.log('\nSaving Nextcloud server log…')
			await saveNextcloudLog(logTarget, container)
		}

		console.log('Stopping Nextcloud container…')
		await container.remove({ force: true })
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
export async function getContainerIP(container: Container = getContainer()): Promise<string> {
	const containerInspect = await container.inspect()
	const hostPort = containerInspect.NetworkSettings.Ports['80/tcp']?.[0]?.HostPort

	if (hostPort) {
		return `localhost:${hostPort}`
	}

	let ip = ''
	let tries = 0
	while (ip === '' && tries < 10) {
		tries++

		try {
			const containerInfo = await container.inspect()
			const network = containerInfo.NetworkSettings.Networks.default
				|| containerInfo.NetworkSettings.Networks.bridge
				|| Object.values(containerInfo.NetworkSettings.Networks)[0]
			if (network.IPAddress) {
				ip = network.IPAddress
				break
			}
		} catch {
			// ignore and retry
		}

		await sleep(1000 * tries)
	}

	return ip
}

/**
 * Wait for Nextcloud to be ready
 *
 * @param ip - The IP address of the Nextcloud container
 */
export async function waitOnNextcloud(ip: string) {
	console.log('├─ Waiting for Nextcloud to be ready… ⏳')
	await waitOn({ resources: [`http://${ip}/index.php`] })
	console.log('└─ Done')
}
