<!--
  - SPDX-FileCopyrightText: 2025 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
# Changelog

All notable changes to this project will be documented in this file.

## v0.6.0 - 2026-09-05
### Added
* feat: allow to store log on teardown \([#1086](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1086)\)

### Fixed
* fix(docker): prune volume on start \([#1087](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1087)\)

### Changed
* refactor(docker): split docker.ts into modules \([#1093](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1093)\)
* ci: add Typescript linting \([#1092](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1092)\)
* Updated dependencies
  * Bump `fast-xml-parser` to 5.11.1
  * Bump `tar-stream` to 3.2.1

## v0.5.1 - 2026-08-04
### Fixed
* fix(docker): always provide `apps-writable` \([#1051](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1051)\)
* fix: Avoid error when files are changed during tar \([#1047](\([#1047](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1047)\))\)
* fix(podman): Ensure compatibility with Podman \([#1061](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1061)\)
* fix(docker): install the composer dependencies of cloned shipped apps \([#1064](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1064)\)
* fix(docker): list the apps after `apps-writable` is a known apps path \([#1063](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1063)\)

### Changed
* ci: update all workflow templates from organization template repository \([#963](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/963)\)
* chore: add ESLint and fix issues detected \([#1042](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1042)\)
* chore(deps): Bump `fast-xml-parser` to 5.10.1 \([#1052](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1052)\)
* chore(deps): Bump `axios` to 1.18.1 \([#1054](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1054)\)
* chore(deps): Bump `immutable` to 4.3.9 \([#1057](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1057)\)
* chore(deps): Bump `wait-on`  to 9.1.0 \([#1060](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1060)\)

## v0.5.0 - 2026-07-02
### Breaking changes
`runExec` and `runOcc` now return an object instead of the plain output string.
The response object has the following format:
```ts
interface ExecResponse {
  /** The stdout messages */
  stdout: string
  /** The stderr messages */
  stderr: string
  /** The exit code of the command */
  exitCode: number
}
```

By default both commands fail if the command exists with a non-zero exit code,
this can be disabled with `failOnError: false` on the command options.

### Fixed
* fix!(docker): clean up exec output handling and remove app:list workaround \([\#985](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/985)\)
* fix(playwright): make login method more robust \([\#1034](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1034)\)
* fix(docker): allow to install all shipped apps in `configureNextcloud` \([\#1039](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1039)\)
* fix(docker): add special handling for server usage \([\#1040](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/1040)\)

### Changed
* ci: updated workflows
* Updated dependencies
  * Bump axios to 1.16.0
  * Bump wait-on to 9.0.10
  * Bump @nextcloud/paths to 3.1.0
  * Bump fast-xml-parser to 5.9.3
  * Bump dockerode to 5.0.1

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
- ci: update reuse.yml workflow \([#862](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/862)\)
- ci: update npm-publish.yml workflow \([#863](https://github.com/nextcloud-libraries/nextcloud-e2e-test-server/pull/863)\)
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
- feat!: Export docker functions entry

### Changed
- test: docker tooling with playwright (f60d530)

## v0.1.0 - 2025-02-05
### Added
- Initial release of `@nextcloud/e2e-test-server` - previously known as `@nextcloud/cypress`.
