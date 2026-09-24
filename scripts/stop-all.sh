#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export GRACE_STACK_ACTION=stop
exec bash "$ROOT_DIR/scripts/restart-all.sh" "$@"
