<!--
  - SPDX-FileCopyrightText: 2025 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# Changelog

All notable changes to this project will be documented in this file.


## v0.4.0 - 2025-10-21
### Notes
The Cypress selectors provided by the package are now deprecated and will be removed with the next release.
Instead use role based selectors like `cy.findByRole` from `@testing-library/cypress`.

### Added
* feat(cypress): return exec context to allow working with exit code or output \([#896](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/896)\)

### Changed
* chore: deprecate Cypress selectors \([#898](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/898)\)
* docs: provide a changelog to keep track of all notable changes \([#897](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/897)\)
* Updated development dependencies

## v0.3.0 - 2025-10-14
### Added
- feat: rename repository to e2e test server \([#758](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/758)\)

### Changed
- chore: adjust node versions \([#869](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/869)\)
- chore: simplify build process by use vite \([#870](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/870)\)
- ci: update reuse.yml workflow from template \([#862](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/862)\)
- ci: update npm-publish.yml workflow from template \([#863](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/863)\)
- chore(deps): Bump fast-xml-parser to 5.2.5
- chore(deps): Bump pbkdf2 to 3.1.3
- chore(deps): Bump tmp to 0.2.4
- chore(deps): Bump cipher-base to 1.0.6
- chore(deps): Bump sha.js to 2.4.12
- chore(deps): Bump tar-fs to 2.1.4
- chore(deps): Bump form-data to 4.0.4
- chore(deps): Bump on-headers and compression
- chore(deps): Bump dockerode to 4.0.9
- chore(deps): Bump wait-on to 9.0.1

## v0.2.1 - 2025-02-11
### Added
- feat: add playwright export

## v0.2.0 - 2025-02-11
### Added
- feat: expose user in random-user-fixture
- feat: User.createRandom(), use User in docker addUser
- feat(e2e-test-server): Rename package and move to separate branch
- feat(playwright): `createRandomUser()` and `login()`
- feat!: Export docker functions from main entry

### Changed
- test: docker tooling with playwright (f60d530)

## v0.1.0 - 2025-02-05
### Added
- Initial release of `@nextcloud/e2e-test-server` - previously known as `@nextcloud/cypress`.
