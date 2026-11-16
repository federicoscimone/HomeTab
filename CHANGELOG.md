# Changelog

All notable changes to HomeTab are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (see [docs/releasing.md](docs/releasing.md)).

## [Unreleased]

### Added

- Split a movement in two, both while reviewing an import and when editing a movement: each
  part becomes a movement of its own, with its own category. The parts remember the original
  bank row, so importing the same statement again still recognises it as a duplicate.

### Fixed

- Import: two identical rows in the same statement (two coffees on the same day) are both saved;
  duplicates are now decided against the movements that existed before the import.
- Import: "exclude from analysis" set during the review is saved.
- A revoked session (user removed or disabled, password changed, demo data regenerated) no
  longer makes the login page redirect to itself forever over HTTPS: the session cookie is now
  actually deleted.

## [1.2.0] - 2026-11-15

The first tagged release. It covers everything since `package.json` was set to 1.1.0 (May 2026),
a version that was never tagged.

### Added

- The running version in the sidebar (with environment and build date), at `GET /api/version`
  and in the first line of the log; images carry it in their OCI labels.
- Release workflow: a version tag adds `X.Y.Z` and `X.Y` to the images already built for that
  commit and publishes a GitHub Release.
- Images on GHCR for amd64 and arm64, tagged `main` and with the commit SHA.
- `deploy` branch, written by the CI after the images are published, for automatic updates of a
  self-hosted instance.
- Nightly reset of the demo on a self-hosted server (`demo` profile) and several instances on the
  same host (`INSTANCE`).
- AI through LangChain: Anthropic, OpenAI, Gemini, Mistral and local models with Ollama; settings
  from the interface with the API key encrypted in the database; a guaranteed monthly spending
  cap; stricter masking with a preview of what is sent; prices updated from the official pages.
- Import: categories suggested by the AI for rows without a rule, merchants recognised from the
  history, the bank's own category, a template proposed for a new bank, a sample statement in the
  demo.
- Chat on your data, read-only, with a verified calculator and a link to check every number.
- Quick entry from one line of text or a receipt photo, in the app and from the Telegram bot.
- Telegram bot (webhook for public deploys, polling in the home network) and optional two-step
  verification with codes on Telegram.
- Monthly budgets per category, with alerts at 80% and 100%.
- Payment deadlines, with the amounts to set aside and reminders.
- Goals as projects, with budget items and to-dos.
- "What if…?" simulator: the effect of a decision on savings and goals.
- Year-end projection, savings tips on request, comparison with similar households (ISTAT data).
- Tax-deductible expenses by type, with the traceable-payment check.
- Interface in Italian and English.
- On a fresh install, the login page leads to creating the administrator account.

### Changed

- `docker compose up` pulls the images from GHCR instead of building them; to build from source,
  add `compose.build.yml` (see the README).
- The MongoDB image includes its init script, with no relative bind mount; the Traefik router
  listens only on HTTPS.

### Fixed

- Deadlines are recognised by their regularity, monthly ones included.
- A quarterly payment is no longer taken for a monthly one in the savings tips.
- Reports compare and average over the same periods.
- Imported amounts with an explicit "+" are read correctly.
- A failed database connection is retried on the next request.
- An explicitly chosen language wins over the browser's.

### Security

- The movements API accepts only the expected fields; categories, keywords and import templates
  are validated and fully audited.
- Security review before the repository went public (#53).

[Unreleased]: https://github.com/federicoscimone/HomeTab/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/federicoscimone/HomeTab/releases/tag/v1.2.0
