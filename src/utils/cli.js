/**
 * LLMux - CLI Execution Utilities
 * Functions for executing CLI commands with timeout and streaming support
 */

const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

/**
 * Execute CLI command (non-streaming)
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {string|null} input - Optional stdin input
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<{success: boolean, output: string, stderr: string, exitCode: number, duration: number}>}
 */
async function executeCLI(command, args, input, timeout) {
  return new Promise((resolve, reject) => {
    const requestId = uuidv4().slice(0, 8);
    const startTime = Date.now();

    console.log(
      `[${requestId}] Executing: ${command} ${args.join(' ').slice(0, 100)}...`
    );

    const stdinMode = input ? 'pipe' : 'ignore';
    const proc = spawn(command, args, {
      env: { ...process.env, TERM: 'dumb', CI: 'true' },
      stdio: [stdinMode, 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    }

    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Request timeout after ${timeout}ms`));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      console.log(
        `[${requestId}] Completed in ${duration}ms, exit code: ${code}`
      );

      if (code === 0 || stdout.length > 0) {
        resolve({
          success: true,
          output: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          duration: duration,
        });
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Execute CLI command with streaming output
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {number} timeout - Timeout in milliseconds
 * @param {Function} onData - Callback for data chunks (string)
 * @param {Function} onEnd - Callback when complete (duration)
 * @param {Function} onError - Callback for errors (Error)
 * @returns {ChildProcess} - The spawned process
 */
function executeCLIStream(command, args, timeout, onData, onEnd, onError) {
  const requestId = uuidv4().slice(0, 8);
  const startTime = Date.now();

  console.log(
    `[${requestId}] Streaming: ${command} ${args.join(' ').slice(0, 100)}...`
  );

  const proc = spawn(command, args, {
    env: { ...process.env, TERM: 'dumb', CI: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';

  proc.stdout.on('data', (data) => {
    onData(data.toString());
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  const timeoutId = setTimeout(() => {
    proc.kill('SIGTERM');
    onError(new Error(`Stream timeout after ${timeout}ms`));
  }, timeout);

  proc.on('close', (code) => {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Stream completed in ${duration}ms`);

    if (code === 0) {
      onEnd(duration);
    } else if (stderr) {
      onError(new Error(stderr));
    } else {
      onEnd(duration);
    }
  });

  proc.on('error', (err) => {
    clearTimeout(timeoutId);
    onError(err);
  });

  return proc;
}

/**
 * Check if a CLI command is available
 * @param {string} command - Command to check
 * @returns {Promise<boolean>}
 */
async function isCommandAvailable(command) {
  return new Promise((resolve) => {
    const proc = spawn('which', [command], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}

module.exports = {
  executeCLI,
  executeCLIStream,
  isCommandAvailable,
};
