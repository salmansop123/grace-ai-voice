/**
 * Frees localhost TCP listen ports before `next dev` (avoids EADDRINUSE when a stale
 * Node process holds 3000/3001). Prefer fuser; fall back to lsof PID list.
 */

const { execSync } = require("node:child_process");

const ports = process.argv.slice(2).map((p) => Number.parseInt(p, 10)).filter((n) => Number.isFinite(n) && n > 0);

for (const port of ports) {
  try {
    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
  } catch {
    /* no fuser / nothing listening */
  }
  try {
    const stdout = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    for (const line of stdout.split(/\n/).filter(Boolean)) {
      try {
        process.kill(Number.parseInt(line.trim(), 10), "SIGKILL");
      } catch {
        /* process already exited */
      }
    }
  } catch {
    /* lsof not installed or nothing listening—expected */
  }
}

try {
  execSync("sleep 0.2", { stdio: "ignore" });
} catch {
  /* Windows or minimal env without sleep—ignore */
}
