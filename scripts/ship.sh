#!/usr/bin/env bash
# Guarded "accept to ship": review -> accept -> commit -> push (-> open PR).
# Nothing is committed or pushed until you answer "y". Hooks still run on commit.
# Reasoning: docs/adr/0002-git-workflow-and-versioning.md
#
# Usage: bash scripts/ship.sh "type(scope): description" [--pr]
#   --pr   also open a pull request with GitHub CLI (gh), using the PR template
set -euo pipefail

open_pr=0
msg=""
for arg in "$@"; do
  if [[ $arg == --pr ]]; then open_pr=1; else msg=$arg; fi
done

branch=$(git rev-parse --abbrev-ref HEAD)
if [[ $branch == master || $branch == main ]]; then
  echo "ship: you are on '$branch'. Work on a branch: git switch -c <type>/<topic>" >&2
  exit 1
fi

if [[ -z $(git status --porcelain) ]]; then
  echo "ship: nothing to commit."
  exit 0
fi

git add -A
echo "== Staged changes on '$branch'"
git diff --cached --stat
echo

if [[ -z $msg ]]; then
  read -r -p "Commit message: " msg
fi
echo "  message: $msg"
read -r -p "Accept? commit and push to origin/$branch [y/N] " answer
if [[ ! $answer =~ ^[Yy]$ ]]; then
  git reset -q
  echo "ship: cancelled. Nothing was committed."
  exit 1
fi

git commit -m "$msg"
git push -u origin "$branch"

if (( open_pr )) && command -v gh >/dev/null 2>&1; then
  gh pr create --title "$msg" --body-file .github/pull_request_template.md
else
  url=$(git remote get-url origin)
  url=${url%.git}
  url=${url/git@github.com:/https://github.com/}
  echo
  echo "Open a pull request: $url/pull/new/$branch"
fi
