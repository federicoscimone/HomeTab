# deploy

Generated branch, written by the CI (`deploy/release-lab-int.sh` on `main`): do not edit.

Each commit is a release of the local production instance, made only after the images of that
commit have been published to GHCR. The Portainer stack follows this branch and redeploys
when it changes.

- `docker-compose.yml`: the compose file of `main` with the image tag pinned to the commit SHA
- `RELEASE`: the SHA of the release

Roll back with `git revert` on this branch; the next push to `main` releases again.
