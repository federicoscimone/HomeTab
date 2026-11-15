# Versions and releases

HomeTab follows [Semantic Versioning 2.0.0](https://semver.org): `MAJOR.MINOR.PATCH`.

- **MAJOR**: incompatible changes — features or APIs removed, data migrations that need manual
  steps, environment variables changed so that an existing deploy breaks.
- **MINOR**: new features, compatible.
- **PATCH**: compatible fixes.
- Release candidates, when needed: `X.Y.Z-rc.N`.

Commits follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`,
`docs:`, `refactor:`, `perf:`, `test:`, `build:`, `ci:`, `chore:`; `!` or `BREAKING CHANGE:` for
an incompatible change): they decide the increment and feed the changelog.

## Which version is running

Every instance says which build it is:

- in the sidebar: version, environment and build date (the full commit in the tooltip);
- at `GET /api/version`, public and without personal data:

  ```json
  { "name": "hometab", "version": "1.2.0+059b385", "commit": "059b3858…",
    "shortCommit": "059b385", "buildDate": "2026-11-15T16:41:00Z", "environment": "production" }
  ```

- in the first line of the log at startup, and in the image's OCI labels
  (`org.opencontainers.image.version`, `revision`, `created`).

The version is `package.json`'s with the short commit SHA as build metadata (`1.2.0+059b385`)
for images built by the CI, and `1.2.0-dev` for a local build. The CI passes the commit and the
build date as build args (`BUILD_SHA`, `BUILD_DATE`); the environment name comes from the deploy
(`APP_ENV`). The app reads them on the server at startup, so one image runs anywhere unchanged.

## Images

| Tag | Moves? | Set by |
| --- | --- | --- |
| `main` | yes, every build of `main` | CI, on every push to `main` |
| full commit SHA | no | CI, on every push to `main` |
| `X.Y.Z` | no | release workflow, on a version tag |
| `X.Y` | yes, latest patch of `X.Y` | release workflow, final versions only |

There is no `latest`. Every image is built for amd64 and arm64.

## Making a release

1. Pick the version from the commits since the last tag (`git log vX.Y.Z..main --oneline`).
2. On `main`, in one commit (`chore(release): X.Y.Z`):
   - `package.json` and `package-lock.json`: `npm version X.Y.Z --no-git-tag-version`;
   - `CHANGELOG.md` ([Keep a Changelog](https://keepachangelog.com)): move the entries from
     `[Unreleased]` to a new `## [X.Y.Z] - YYYY-MM-DD` section and update the links at the bottom.
3. Wait for the CI on that commit, then tag it and push the tag:

   ```bash
   git tag -a vX.Y.Z -m "HomeTab X.Y.Z"
   git push origin vX.Y.Z
   ```

The [release workflow](../.github/workflows/release.yml) checks the tag (annotated, on `main`,
same version as `package.json`, a section in `CHANGELOG.md`), adds the `X.Y.Z` and `X.Y` tags to
the images already built for that commit — nothing is rebuilt, so the release is exactly what was
tested — and publishes a GitHub Release with the notes of that version.

Tags never move and are never deleted: a mistake is fixed with a new version.
