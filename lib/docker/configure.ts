/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Container } from 'dockerode'

import tarStreamer from 'tar-stream'
import { getContainer, getServerBranch } from './client.ts'
import { getSystemConfig, setSystemConfig } from './config.ts'
import { pathExists, runExec, runOcc } from './exec.ts'
import { asNodeStream } from './internal.ts'

// The server image ships PHP but no Composer, so it is downloaded on demand
const COMPOSER_VERSION = process.env.NEXTCLOUD_E2E_COMPOSER_VERSION || 'latest-stable'
const COMPOSER_PHAR = '/tmp/composer.phar'
/** `COMPOSER_HOME` used inside the server container, must be writable by `www-data` */
const COMPOSER_HOME = '/tmp/composer-home'

/**
 * Configure Nextcloud
 *
 * Shipped apps that are missing from the server image are cloned and their Composer dependencies
 * are installed. Set `NEXTCLOUD_E2E_COMPOSER_VERSION` to pin the Composer version used for that.
 *
 * @param apps List of default apps to install (default is ['viewer'])
 * @param vendoredBranch The branch used for vendored apps, should match server (defaults to latest branch used for `startNextcloud` or fallsback to `master`)
 * @param container Optional server container to use (defaults to current container)
 */
export async function configureNextcloud(apps = ['viewer'], vendoredBranch?: string, container?: Container) {
	vendoredBranch = vendoredBranch || getServerBranch()

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
		throw new Error('APCu is not properly configured', { cause: { distributed, local, hashing } })
	}
	console.log('│  └─ OK !')

	console.log('├─ Using "apps-writable" folder for mounted apps')
	await runExec(['mkdir', '-p', '/var/www/html/apps-writable'], { container })
	await runExec(['chown', 'www-data:www-data', '/var/www/html/apps-writable'], { container, user: 'root' })
	const appsConfig = `<?php
	$CONFIG = [
		'apps_paths' => [
			[
					'path' => '/var/www/html/apps',
					'url' => '/apps',
					'writable' => false,
			],
			[
					'path' => '/var/www/html/apps-writable',
					'url' => '/apps-writable',
					'writable' => true,
			],
	],
];`
	const stream = tarStreamer.pack()
	stream.entry({ name: 'apps.config.php' }, appsConfig)
	stream.finalize()
	await container.putArchive(asNodeStream(stream), { path: '/var/www/html/config' })

	// Build app list, only now that "apps-writable" is a known apps path so that mounted apps show up
	const { stdout: json } = await runOcc(['app:list', '--output', 'json'], { container })
	const applist = JSON.parse(json)

	// Enable apps and give status
	for (const app of apps) {
		if (app in applist.enabled) {
			console.log(`├─ ${app} version ${applist.enabled[app]} already installed and enabled`)
		} else if (app in applist.disabled) {
			// built in or mounted already as the app under development
			await runOcc(['app:enable', '--force', app], { container, verbose: true })
		} else {
			const { stdout: jsonOutput } = await runExec(['cat', 'core/shipped.json'], { container })
			const { shippedApps } = JSON.parse(jsonOutput)
			if (shippedApps.includes(app)) {
				const branchOption = ['main', 'master'].includes(vendoredBranch) ? [] : [`--branch=${vendoredBranch}`]
				await runExec(
					['git', 'clone', '--depth=1', ...branchOption, `https://github.com/nextcloud/${encodeURIComponent(app)}.git`, `apps-writable/${app}`],
					{ container, verbose: true },
				)
				await installComposerDependencies(app, container)
				await runOcc(['app:enable', '--force', app], { container, verbose: true })
			} else {
				// try appstore
				await runOcc(['app:install', '--force', app], { container, verbose: true })
			}
		}
	}
	console.log('└─ Nextcloud is now ready to use 🎉')
}

/**
 * Install the Composer dependencies of a cloned app
 *
 * A bare `git clone` is only usable as long as the app commits its dependencies. Since Nextcloud 34
 * `notifications` does not, and `OC_App::registerAutoloading()` then fatals on the missing
 * `vendor/autoload.php`. Scripts are run on purpose, apps like that one only assemble the prefixed
 * copies of their dependencies (`lib/Vendor`) in `post-install-cmd`.
 *
 * @param app The app id, cloned to `apps-writable/<app>`
 * @param container The server container to use
 */
async function installComposerDependencies(app: string, container: Container) {
	const appPath = `/var/www/html/apps-writable/${app}`
	if (!await pathExists(`${appPath}/composer.json`, container)) {
		return
	}

	await ensureComposer(container)
	console.log(`│  ├─ Running 'composer install' for ${app}…`)
	await runExec(
		['php', COMPOSER_PHAR, 'install', '--no-dev', '--no-interaction', '--no-progress', '--no-ansi'],
		{ container, workingDir: appPath, env: [`COMPOSER_HOME=${COMPOSER_HOME}`] },
	)
	console.log('│  └─ Done')
}

/**
 * Download the Composer binary into the container, unless it is already there
 *
 * @param container The server container to use
 */
async function ensureComposer(container: Container) {
	if (await pathExists(COMPOSER_PHAR, container)) {
		return
	}

	console.log(`│  ├─ Downloading Composer ${COMPOSER_VERSION} into the container…`)
	const url = `https://getcomposer.org/download/${COMPOSER_VERSION}/composer.phar`
	await runExec(['curl', '--silent', '--show-error', '--location', '--fail', '--output', COMPOSER_PHAR, url], { container })
}
