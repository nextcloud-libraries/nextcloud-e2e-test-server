/**
 * SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Selector } from '../selectors/index.ts'

/**
 *
 * @param selector
 * @param args
 */
export function getNc(selector: Selector, args: object = {}): Cypress.Chainable<JQuery<HTMLElement>> {
	if (typeof selector !== 'function') {
		throw new Error(`Invalid selector: ${String(selector)}`)
	}
	return selector(args)
}
