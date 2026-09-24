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
WATCH_LOGS=""

mkdir -p "$RUN_DIR" "$LOG_DIR"

resolve_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return 0
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return 0
  fi
  return 1
}

kill_processes_on_port() {
  local port="$1"
  local service_name="$2"

  if command -v fuser >/dev/null 2>&1; then
    if fuser "${port}/tcp" >/dev/null 2>&1; then
      echo "Stopping $service_name listener(s) on port $port (fuser -k)..."
      fuser -k "${port}/tcp" >/dev/null 2>&1 || true
      sleep 0.5
    fi
  fi

  if command -v lsof >/dev/null 2>&1; then
    local pid
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      if kill -0 "$pid" 2>/dev/null; then
        echo "Stopping $service_name on port $port (PID: $pid)"
        kill "$pid" 2>/dev/null || true
        sleep 0.5
        if kill -0 "$pid" 2>/dev/null; then
          kill -9 "$pid" 2>/dev/null || true
        fi
      fi
    done < <(lsof -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)
  fi
}

kill_process_tree() {
  local pid="$1"
  [[ -z "${pid:-}" ]] && return 0
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  local child
  if command -v pgrep >/dev/null 2>&1; then
    for child in $(pgrep -P "$pid" 2>/dev/null || true); do
      kill_process_tree "$child"
    done
  fi

  kill "$pid" 2>/dev/null || true
  sleep 0.5
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
}

kill_if_running() {
  local pid_file="$1"
  local name="$2"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "Stopping $name (PID: $pid and child processes)..."
      kill_process_tree "$pid"
    fi
    rm -f "$pid_file"
  fi
}

port_is_listening() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
    return $?
  fi
  if command -v python3 >/dev/null 2>&1; then
    _tcp_reachable "127.0.0.1" "$port"
    return $?
  fi
  return 1
}

verify_stack_stopped() {
  local still_running=false
  for spec in "3000:Web app" "3001:Web dev (alt)" "8000:API"; do
    local port="${spec%%:*}"
    local label="${spec#*:}"
    if port_is_listening "$port"; then
      echo "Warning: $label still listening on port $port."
      still_running=true
    fi
  done
  if [[ "$still_running" == "true" ]]; then
    echo "Try: bash scripts/stop-all.sh again, or run:"
    echo "  fuser -k 3000/tcp 3001/tcp 8000/tcp"
    return 1
  fi
  echo "Ports 3000, 3001, and 8000 are free."
  return 0
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

  _tcp_reachable "$redis_host" "$redis_port"
}

is_postgres_reachable() {
  local db_url
  db_url="${DATABASE_URL:-}"

  if [[ -z "$db_url" ]] && [[ -f "$API_DIR/.env" ]]; then
    db_url="$(awk -F= '/^DATABASE_URL=/{print $2; exit}' "$API_DIR/.env" || true)"
  fi
  if [[ -z "$db_url" ]] && [[ -f "$ROOT_DIR/.env" ]]; then
    db_url="$(awk -F= '/^DATABASE_URL=/{print $2; exit}' "$ROOT_DIR/.env" || true)"
  fi
  if [[ -z "$db_url" ]]; then
    db_url="postgresql+asyncpg://postgres:password@localhost:5432/graceai"
  fi

  local pg_host pg_port
  if [[ "$db_url" == *"@"* ]]; then
    pg_host="$(echo "$db_url" | sed -E 's#^[^/]*//[^@]+@([^:/]+).*#\1#')"
    pg_port="$(echo "$db_url" | sed -E 's#^[^/]*//[^@]+@[^:/]+:([0-9]+)/.*#\1#')"
  else
    pg_host="$(echo "$db_url" | sed -E 's#^[^/]*//([^:/]+).*#\1#')"
    pg_port="$(echo "$db_url" | sed -E 's#^[^/]*//[^:/]+:([0-9]+)/.*#\1#')"
  fi
  if [[ "$pg_port" == "$db_url" ]] || [[ -z "$pg_port" ]]; then
    pg_port="5432"
  fi

  _tcp_reachable "$pg_host" "$pg_port"
}

_tcp_reachable() {
  local host="$1"
  local port="$2"

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$host" "$port" <<'PY'
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

start_docker_infra_if_needed() {
  local need_postgres=false
  local need_redis=false

  if ! is_postgres_reachable; then
    need_postgres=true
  fi
  if ! is_redis_reachable; then
    need_redis=true
  fi

  if [[ "$need_postgres" == "false" ]] && [[ "$need_redis" == "false" ]]; then
    echo "Postgres and Redis are already reachable (local or Docker)."
    return 0
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "Warning: Postgres or Redis is not reachable and Docker is not installed."
    echo "  Start Postgres + Redis manually, or install Docker and run:"
    echo "  docker-compose -f \"$ROOT_DIR/docker-compose.yml\" up -d postgres redis"
    return 1
  fi

  if [[ ! -f "$ROOT_DIR/docker-compose.yml" ]]; then
    echo "Warning: docker-compose.yml not found; cannot start Postgres/Redis automatically."
    return 1
  fi

  local compose_cmd
  if ! compose_cmd="$(resolve_compose_cmd)"; then
    echo "Warning: Neither 'docker compose' nor 'docker-compose' is available."
    echo "  Install Docker Compose or start Postgres + Redis manually."
    return 1
  fi

  echo "Starting Docker infra (postgres, redis) via $compose_cmd..."
  local compose_rc=0
  (
    cd "$ROOT_DIR"
    $compose_cmd up -d postgres redis
  ) || compose_rc=$?

  if [[ $compose_rc -ne 0 ]]; then
    echo "Warning: $compose_cmd up -d postgres redis failed (exit $compose_rc)."
    return 1
  fi

  local attempt=0
  while [[ $attempt -lt 30 ]]; do
    local pg_ok=true
    local redis_ok=true
    if [[ "$need_postgres" == "true" ]] && ! is_postgres_reachable; then
      pg_ok=false
    fi
    if [[ "$need_redis" == "true" ]] && ! is_redis_reachable; then
      redis_ok=false
    fi
    if [[ "$pg_ok" == "true" ]] && [[ "$redis_ok" == "true" ]]; then
      echo "Docker infra is ready."
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "Warning: Timed out waiting for Postgres/Redis after Docker start."
  return 1
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempt=0

  while [[ $attempt -lt 45 ]]; do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS -o /dev/null "$url" 2>/dev/null; then
        echo "$label is responding at $url"
        return 0
      fi
    elif command -v python3 >/dev/null 2>&1; then
      if python3 - "$url" <<'PY'
import sys
import urllib.request
try:
    urllib.request.urlopen(sys.argv[1], timeout=2)
except Exception:
    sys.exit(1)
PY
      then
        echo "$label is responding at $url"
        return 0
      fi
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "Warning: $label did not respond at $url within 45s (check logs)."
  return 1
}

verify_pid_alive() {
  local pid_file="$1"
  local name="$2"

  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "${pid:-}" ]] || ! kill -0 "$pid" 2>/dev/null; then
    echo "Error: $name failed to stay running (PID file: $pid_file)."
    return 1
  fi
  return 0
}

stop_stack() {
  kill_if_running "$API_PID_FILE" "backend API"
  kill_if_running "$CELERY_PID_FILE" "celery worker"
  kill_if_running "$WEB_PID_FILE" "frontend web"

  # npm/next and uvicorn --reload spawn child processes; PID files often point at the parent only.
  kill_processes_on_port "8000" "backend API"
  kill_processes_on_port "3000" "frontend web"
  kill_processes_on_port "3001" "frontend web (alt)"

  if [[ -f "$WEB_DIR/scripts/free-dev-ports.cjs" ]] && command -v node >/dev/null 2>&1; then
    node "$WEB_DIR/scripts/free-dev-ports.cjs" 3000 3001 >/dev/null 2>&1 || true
  fi
}

stop_docker_infra() {
  if [[ ! -f "$ROOT_DIR/docker-compose.yml" ]]; then
    echo "No docker-compose.yml found; skipping Docker infra stop."
    return 0
  fi

  local compose_cmd
  if ! compose_cmd="$(resolve_compose_cmd)"; then
    echo "Docker Compose not available; skipping Docker infra stop."
    return 0
  fi

  echo "Stopping Docker infra (postgres, redis) via $compose_cmd..."
  (
    cd "$ROOT_DIR"
    $compose_cmd stop postgres redis
  ) || echo "Warning: $compose_cmd stop postgres redis failed."
}

STACK_ARGS=()
STOP_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    --docker)
      STOP_DOCKER=true
      ;;
    --watch)
      WATCH_LOGS="--watch"
      ;;
    *)
      STACK_ARGS+=("$arg")
      ;;
  esac
done

if [[ "${GRACE_STACK_ACTION:-restart}" == "stop" ]]; then
  echo "Stopping Grace AI stack from: $ROOT_DIR"
  stop_stack
  if [[ "$STOP_DOCKER" == "true" ]]; then
    stop_docker_infra
  fi
  echo
  verify_stack_stopped || true
  echo
  echo "Grace AI services stopped."
  if [[ "$STOP_DOCKER" == "false" ]]; then
    echo "Tip: Postgres/Redis were left running. Use 'bash scripts/stop-all.sh --docker' to stop Docker infra too."
  fi
  exit 0
fi

if [[ "${GRACE_STACK_ACTION:-restart}" == "start" ]]; then
  echo "Starting Grace AI stack from: $ROOT_DIR"
else
  echo "Restarting Grace AI stack from: $ROOT_DIR"
fi

stop_stack

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Warning: .env not found at project root."
fi

if [[ ! -f "$API_DIR/.env" ]]; then
  echo "Warning: apps/api/.env not found. uvicorn/celery may fail."
fi

if [[ ! -f "$WEB_DIR/.env.local" ]]; then
  echo "Warning: apps/web/.env.local not found. Next.js may fail."
fi

if [[ -f "$API_DIR/.env" ]] && grep -q '^FRONTEND_URL=.*Project:' "$API_DIR/.env" 2>/dev/null; then
  echo "Error: apps/api/.env looks corrupted (extra text on FRONTEND_URL line)."
  echo "  Restore from .env.example — each line must be KEY=value or a # comment."
  exit 1
fi

start_docker_infra_if_needed || true

PYTHON_BIN="python3"
CELERY_BIN="celery"
if [[ -x "$API_VENV_DIR/bin/python" ]]; then
  PYTHON_BIN="$API_VENV_DIR/bin/python"
fi
if [[ -x "$API_VENV_DIR/bin/celery" ]]; then
  CELERY_BIN="$API_VENV_DIR/bin/celery"
fi

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

sleep 2
startup_ok=true
verify_pid_alive "$API_PID_FILE" "backend API" || startup_ok=false
if [[ -f "$CELERY_PID_FILE" ]]; then
  verify_pid_alive "$CELERY_PID_FILE" "celery worker" || startup_ok=false
fi
verify_pid_alive "$WEB_PID_FILE" "frontend web" || startup_ok=false

if [[ "$startup_ok" == "true" ]]; then
  wait_for_http "http://127.0.0.1:8000/docs" "API" || true
  wait_for_http "http://127.0.0.1:3000" "Web app" || true
else
  echo
  echo "One or more services exited immediately. Recent log output:"
  tail -n 20 "$LOG_DIR/api.log" 2>/dev/null || true
  tail -n 20 "$LOG_DIR/web.log" 2>/dev/null || true
  exit 1
fi

if [[ "$WATCH_LOGS" == "--watch" ]]; then
  echo
  echo "Streaming API + Web logs (Ctrl+C to stop)..."
  tail -f "$LOG_DIR/api.log" "$LOG_DIR/web.log"
else
  echo
  echo "Tip: run 'bash scripts/restart-all.sh --watch' to stream live API/Web requests."
  echo "      run 'bash scripts/stop-all.sh' to stop all services."
fi
