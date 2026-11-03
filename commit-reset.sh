#!/usr/bin/env bash
set -euo pipefail

# Publish the current files as one root commit, preserving the local repository.
dry_run=false
case "${1:-}" in
  --dry-run) dry_run=true ;;
  --help|-h)
    echo 'Usage: ./commit-reset.sh [--dry-run]'
    echo 'Publish a single-commit snapshot to origin/main, or list its files offline.'
    exit 0 ;;
  '') ;;
  *) echo 'Usage: ./commit-reset.sh [--dry-run]' >&2; exit 2 ;;
esac
if (( $# > 1 )); then
  echo 'Too many arguments.' >&2
  exit 2
fi

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
git -C "$repo_root" rev-parse --git-dir >/dev/null
snapshot_root=$(mktemp -d "${TMPDIR:-/tmp}/site-publish.XXXXXX")
trap 'rm -rf -- "$snapshot_root"' EXIT
snapshot="$snapshot_root/site"
mkdir "$snapshot"

# Include working-tree edits and new files, respecting ignores for new files.
# Keep the file list outside the snapshot so it cannot be published.
git -C "$repo_root" ls-files --cached --others --exclude-standard -z > "$snapshot_root/files"
while IFS= read -r -d '' file; do
  source_file="$repo_root/$file"
  [[ -e "$source_file" || -L "$source_file" ]] || continue
  if [[ -d "$source_file" && ! -L "$source_file" ]]; then
    echo "Cannot snapshot a submodule: $file" >&2
    exit 1
  fi
  mkdir -p -- "$snapshot/$(dirname -- "$file")"
  cp -pP -- "$source_file" "$snapshot/$file"
done < "$snapshot_root/files"

git -C "$snapshot" init --quiet --template=
git -C "$snapshot" symbolic-ref HEAD refs/heads/main
# The source file list already applies ignores; preserve tracked ignored files too.
git -C "$snapshot" add --force --all -- .
if "$dry_run"; then
  echo 'Files in the publish snapshot (no commit or push performed):'
  git -C "$snapshot" ls-files
  exit 0
fi

remote_url=$(git -C "$repo_root" remote get-url --push origin)
# Capture the exact remote tip; reject the push if it changes during publication.
remote_ref=$(git -C "$repo_root" ls-remote --refs "$remote_url" refs/heads/main)
expected_tip=${remote_ref%%$'\t'*}
author_name=$(git -C "$repo_root" config user.name || git -C "$repo_root" log -1 --format=%an)
author_email=$(git -C "$repo_root" config user.email || git -C "$repo_root" log -1 --format=%ae)
git -C "$snapshot" -c user.name="$author_name" -c user.email="$author_email" \
  -c commit.gpgSign=false -c core.hooksPath=/dev/null commit --quiet -m 'Publish website'
git -C "$snapshot" -c core.hooksPath=/dev/null push \
  --force-with-lease="refs/heads/main:$expected_tip" "$remote_url" HEAD:refs/heads/main
echo 'Published one snapshot commit. Local history and staging are unchanged.'
