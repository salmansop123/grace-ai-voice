#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/.run/logs"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
API_VENV_DIR="$API_DIR/.venv"

API_PID_FILE="$RUN_DIR/api.pid"
CELERY_PID_FILE="$RUN_DIR/celery.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
WATCH_LOGS="${1:-}"

mkdir -p "$RUN_DIR" "$LOG_DIR"

kill_if_running() {
  local pid_file="$1"
  local name="$2"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name (PID: $pid)"
      kill "$pid" || true
      sleep 1
      if kill -0 "$pid" 2>/dev/null; then
        echo "Force stopping $name (PID: $pid)"
        kill -9 "$pid" || true
      fi
    fi
    rm -f "$pid_file"
  fi
}

kill_processes_on_port() {
  local port="$1"
  local service_name="$2"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "$port"/tcp 2>/dev/null || true)"
  fi

  if [[ -n "${pids// }" ]]; then
    echo "Stopping stale $service_name process(es) on port $port: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
    for pid in $pids; do
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    done
  fi
}

is_redis_reachable() {
  local redis_url
  redis_url="${REDIS_URL:-}"

  if [[ -z "$redis_url" ]] && [[ -f "$ROOT_DIR/.env" ]]; then
    redis_url="$(awk -F= '/^REDIS_URL=/{print $2; exit}' "$ROOT_DIR/.env" || true)"
  fi
  if [[ -z "$redis_url" ]] && [[ -f "$API_DIR/.env" ]]; then
    redis_url="$(awk -F= '/^REDIS_URL=/{print $2; exit}' "$API_DIR/.env" || true)"
  fi
  if [[ -z "$redis_url" ]]; then
    redis_url="redis://localhost:6379/0"
  fi

  local redis_host
  local redis_port
  redis_host="$(echo "$redis_url" | sed -E 's#^redis://([^:/]+).*$#\1#')"
  redis_port="$(echo "$redis_url" | sed -E 's#^redis://[^:/]+:([0-9]+).*$#\1#')"
  if [[ "$redis_port" == "$redis_url" ]]; then
    redis_port="6379"
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$redis_host" "$redis_port" <<'PY'
import socket
import sys
host = sys.argv[1]
port = int(sys.argv[2])
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(1.5)
try:
    s.connect((host, port))
except Exception:
    sys.exit(1)
finally:
    s.close()
PY
  else
    return 1
  fi
}

echo "Restarting Grace AI stack from: $ROOT_DIR"

kill_if_running "$API_PID_FILE" "backend API"
kill_if_running "$CELERY_PID_FILE" "celery worker"
kill_if_running "$WEB_PID_FILE" "frontend web"
kill_processes_on_port "8000" "backend API"
kill_processes_on_port "3000" "frontend web"

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Warning: .env not found at project root."
fi

if [[ ! -f "$API_DIR/.env" ]]; then
  echo "Warning: apps/api/.env not found. uvicorn/celery may fail."
fi

if [[ ! -f "$WEB_DIR/.env.local" ]]; then
  echo "Warning: apps/web/.env.local not found. Next.js may fail."
fi

PYTHON_BIN="python3"
CELERY_BIN="celery"
if [[ -x "$API_VENV_DIR/bin/python" ]]; then
  PYTHON_BIN="$API_VENV_DIR/bin/python"
fi
if [[ -x "$API_VENV_DIR/bin/celery" ]]; then
  CELERY_BIN="$API_VENV_DIR/bin/celery"
fi

echo "Skipping Docker infra startup (manual local services mode)."

echo "Starting backend API..."
(
  cd "$API_DIR"
  nohup "$PYTHON_BIN" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload \
    > "$LOG_DIR/api.log" 2>&1 &
  echo $! > "$API_PID_FILE"
)

echo "Starting celery worker..."
if is_redis_reachable; then
  (
    cd "$API_DIR"
    nohup "$CELERY_BIN" -A workers.celery_app worker --loglevel=info -Q campaigns,post_call \
      > "$LOG_DIR/celery.log" 2>&1 &
    echo $! > "$CELERY_PID_FILE"
  )
else
  echo "Warning: Redis is not reachable. Skipping Celery startup."
fi

echo "Starting frontend..."
(
  cd "$WEB_DIR"
  if command -v pnpm >/dev/null 2>&1; then
    nohup pnpm dev -- --port 3000 > "$LOG_DIR/web.log" 2>&1 &
  elif command -v npm >/dev/null 2>&1; then
    nohup npm run dev -- --port 3000 > "$LOG_DIR/web.log" 2>&1 &
  else
    echo "Error: neither pnpm nor npm found."
    exit 1
  fi
  echo $! > "$WEB_PID_FILE"
)

echo "Grace AI services started."
echo "API log:    $LOG_DIR/api.log"
echo "Celery log: $LOG_DIR/celery.log"
echo "Web log:    $LOG_DIR/web.log"
echo
echo "PIDs:"
echo "  API:    $(cat "$API_PID_FILE")"
if [[ -f "$CELERY_PID_FILE" ]]; then
  echo "  Celery: $(cat "$CELERY_PID_FILE")"
else
  echo "  Celery: skipped (Redis unavailable)"
fi
echo "  Web:    $(cat "$WEB_PID_FILE")"

if [[ "$WATCH_LOGS" == "--watch" ]]; then
  echo
  echo "Streaming API + Web logs (Ctrl+C to stop)..."
  tail -f "$LOG_DIR/api.log" "$LOG_DIR/web.log"
else
  echo
  echo "Tip: run 'bash scripts/restart-all.sh --watch' to stream live API/Web requests."
fi
