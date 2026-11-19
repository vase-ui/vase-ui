#!/usr/bin/env bash
set -euo pipefail

base=$1
head=$2
if [[ $(git show -s --format=%P HEAD) == "$base $head" ]]; then
  exit 0
fi

# GitHub can update the merge ref after it records the base in the pull request event.
fetch_options=(--no-tags)
if [[ $(git rev-parse --is-shallow-repository) == true ]]; then
  fetch_options+=(--unshallow)
fi
git fetch "${fetch_options[@]}" origin "$base" "$head"
tree=$(git merge-tree --write-tree "$base" "$head")
git read-tree -m -u HEAD "$tree"
