#!/usr/bin/env node
// Compass CLI entry point.
//
// PRD §8.2: on EVERY invocation, attempt to replay the outbox before running the user's command.
// We do this in a `preAction` hook so it covers all commands without leaking through them.

import { CompassClient } from '@compass/api-client';
import { Command } from 'commander';
import kleur from 'kleur';
import { type CaptureOptions, readAllStdin, runCapture } from './commands/capture.js';
import { runList } from './commands/list.js';
import { runLogin } from './commands/login.js';
import { runLogout } from './commands/logout.js';
import { runStatus } from './commands/status.js';
import { ConfigError, resolveConfig } from './config.js';
import { replayOutbox } from './outbox.js';

const program = new Command();

program
  .name('compass')
  .description('Compass — capture from the terminal.')
  .version('0.1.0')
  .showHelpAfterError();

// Best-effort outbox replay BEFORE every command except `login` (no credentials yet)
// and `logout` (we're about to wipe credentials anyway). Failures here never block
// the actual command — they're surfaced as a final note.
const skipReplayFor = new Set(['login', 'logout']);
let trailingReplayWarnings: string[] = [];

program.hook('preAction', async (_thisCommand, actionCommand) => {
  const name = actionCommand.name();
  if (skipReplayFor.has(name)) return;
  try {
    const cfg = await resolveConfig({ requireToken: false });
    if (!cfg.token) return; // can't replay without a token; defer to the command's own error
    const client = new CompassClient({ baseUrl: cfg.baseUrl, token: cfg.token });
    const res = await replayOutbox(client);
    if (res.failures.length > 0) {
      trailingReplayWarnings = res.failures;
    }
  } catch {
    // resolveConfig may legitimately throw (no base URL) — let the command handle that.
  }
});

program
  .command('capture')
  .description('Capture a note to the inbox.')
  .argument('[text...]', 'capture text (or pipe via stdin)')
  .option('--type <type>', 'idea|note|curiosity|unspecified', 'unspecified')
  .option('--tag <tag>', 'tag (repeatable)', collect, [] as string[])
  .option('--project <ulid>', 'file directly into a project (skips inbox)')
  .action(async (text: string[], opts: CaptureOptions) => {
    const joined = (text ?? []).join(' ').trim();
    const code = await runCapture(joined.length > 0 ? joined : undefined, opts, {
      readStdin: readAllStdin,
    });
    process.exitCode = code;
  });

program
  .command('login')
  .description('Authenticate this terminal via the device-code flow.')
  .option('--base-url <url>', 'override COMPASS_BASE_URL')
  .option('--interval <seconds>', 'poll interval (default 5)', parseIntStrict)
  .option('--max-attempts <n>', 'max poll attempts (default 60)', parseIntStrict)
  .option('--no-browser', 'do not try to open the verification URL automatically')
  .action(
    async (opts: {
      baseUrl?: string;
      interval?: number;
      maxAttempts?: number;
      browser?: boolean;
    }) => {
      process.exitCode = await runLogin({
        baseUrl: opts.baseUrl,
        interval: opts.interval,
        maxAttempts: opts.maxAttempts,
        noBrowser: opts.browser === false,
      });
    },
  );

program
  .command('list')
  .alias('ls')
  .description('Show recent captures, projects, and learning goals.')
  .option('-n, --limit <n>', 'rows per section (default 10)', parseIntStrict)
  .action(async (opts: { limit?: number }) => {
    process.exitCode = await runList(opts);
  });

program
  .command('status')
  .description('Show base URL, login state, queue length, last contact, dialect.')
  .action(async () => {
    process.exitCode = await runStatus();
  });

program
  .command('logout')
  .description('Revoke the token (best-effort) and delete local credentials.')
  .action(async () => {
    process.exitCode = await runLogout();
  });

main().catch((err) => {
  console.error(kleur.red('fatal: ') + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});

async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(kleur.red('error: ') + err.message);
      console.error(kleur.dim('Hint: ') + err.hint);
      process.exitCode = 2;
    } else if (err instanceof Error) {
      console.error(kleur.red('error: ') + err.message);
      process.exitCode = 1;
    } else {
      console.error(kleur.red('error: ') + String(err));
      process.exitCode = 1;
    }
  } finally {
    if (trailingReplayWarnings.length > 0) {
      console.error('');
      console.error(kleur.dim('outbox replay (background):'));
      for (const w of trailingReplayWarnings) {
        console.error(kleur.dim(`  • ${w}`));
      }
    }
  }
}

function collect(value: string, prev: string[]): string[] {
  return [...prev, value];
}

function parseIntStrict(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) {
    throw new Error(`expected an integer, got "${value}"`);
  }
  return n;
}
