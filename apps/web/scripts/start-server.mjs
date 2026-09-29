/**
 * Production entry point.
 *
 * This exists because of a real incident: the first Hostinger deploy
 * restarted every two seconds and the panel reported "Errors: 0". The
 * panel captures stdout; Node crashes go to stderr; so the one thing that
 * would have explained it was the one thing nobody could see.
 *
 * Adding `2>&1` to the npm script does NOT fix that — a host that execs
 * the command directly rather than through a shell passes `2>&1` to
 * `next start` as a positional directory argument, and the server then
 * looks for a build in a folder of that name. (Also learned the hard way.)
 *
 * So: a Node wrapper, invoked as a single argument, that works whether or
 * not a shell is involved. It forwards stderr to stdout and, crucially,
 * reports the exit code and signal — which distinguishes "the app threw"
 * (code 1) from "something killed it" (SIGKILL/SIGTERM, i.e. an OOM or a
 * supervisor giving up on a slow boot).
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function log(message) {
  process.stdout.write(`[flowhrms] ${message}\n`);
}

const startedAt = Date.now();
log(`starting: node ${process.version}, cwd ${process.cwd()}`);
log(`PORT=${process.env.PORT ?? "(unset, next will use 3000)"}`);

let nextBin;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch (error) {
  log(`FATAL: cannot resolve the next binary — ${error.message}`);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [nextBin, "start", "--keepAliveTimeout", "70000"],
  { stdio: ["inherit", "inherit", "pipe"], env: process.env },
);

// The whole point: stderr becomes stdout so the platform's log viewer
// shows it.
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  for (const line of chunk.split(/\r?\n/)) {
    if (line.trim()) process.stdout.write(`[flowhrms:stderr] ${line}\n`);
  }
});

child.on("exit", (code, signal) => {
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(`server exited after ${seconds}s — code=${code} signal=${signal}`);
  if (signal === "SIGKILL" || signal === "SIGTERM") {
    log(
      "a signal means something outside the app stopped it: an out-of-memory kill, or a supervisor that gave up waiting for the port to open",
    );
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  log(`FATAL: could not spawn the server — ${error.message}`);
  process.exit(1);
});

// Pass shutdown signals through so in-flight requests and `after()`
// callbacks finish (self-hosting guide → graceful shutdown).
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    log(`received ${signal}, forwarding to the server`);
    child.kill(signal);
  });
}
