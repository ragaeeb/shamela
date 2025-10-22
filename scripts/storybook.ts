/**
 * Command tuple describing the executable and its arguments for {@link Bun.spawn}.
 */
type Command = readonly [string, ...string[]];

const STORYBOOK_PORT = process.env.STORYBOOK_PORT ?? '6006';

/**
 * Spawns a subprocess with inherited stdio so its output streams appear directly in the terminal.
 *
 * @param command - The command tuple to execute
 * @returns The spawned subprocess instance
 */
const spawnProcess = (command: Command) => {
    return Bun.spawn({
        cmd: command,
        stderr: 'inherit',
        stdout: 'inherit',
        env: process.env,
    });
};

const proxyProcess = spawnProcess(['bun', 'scripts/proxy.ts']);
const storybookProcess = spawnProcess(['bunx', 'storybook', 'dev', '-p', STORYBOOK_PORT]);

let shuttingDown = false;

/**
 * Terminates both subprocesses and exits the current process with the provided code.
 *
 * @param code - The exit code to use when shutting down the orchestrator
 */
const terminate = (code: number) => {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    if (!storybookProcess.killed) {
        storybookProcess.kill();
    }

    if (!proxyProcess.killed) {
        proxyProcess.kill();
    }

    process.exit(code);
};

proxyProcess.exited.then((code) => {
    if (!shuttingDown && code !== 0) {
        console.error(`Proxy exited unexpectedly with code ${code}.`);
        terminate(code);
    }
});

const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
for (const signal of signals) {
    process.on(signal, () => terminate(0));
}

const exitCode = await storybookProcess.exited;
terminate(exitCode);
