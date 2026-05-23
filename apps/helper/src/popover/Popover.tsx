import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { v4 as uuidv4 } from 'uuid';
import { CompassClient, CompassApiError } from '@compass/api-client';
import type { InboxTypeHint } from '@compass/shared';
import type { CaptureRequest } from '@compass/shared/zod';
import { loadConfig, type HelperConfig } from '../lib/config.js';
import { enqueueCapture } from '../lib/outbox.js';

// Per PRD §8.4 we keep type-hint inference client-side via a tiny prefix
// convention so a user never has to think about it: "! " = idea,
// "? " = curiosity, everything else falls through to plain note. The Inbox UI
// in the web app lets them reclassify in one click.
function inferTypeHint(raw: string): { hint: InboxTypeHint; body: string } {
  if (raw.startsWith('! ')) return { hint: 'idea', body: raw.slice(2) };
  if (raw.startsWith('? ')) return { hint: 'curiosity', body: raw.slice(2) };
  return { hint: 'note', body: raw };
}

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'queued' }
  | { kind: 'error'; message: string };

export function Popover() {
  const [text, setText] = useState('');
  const [config, setConfig] = useState<HelperConfig | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const win = useMemo(() => getCurrentWebviewWindow(), []);

  const client = useMemo(() => {
    if (!config) return null;
    return new CompassClient({ baseUrl: config.base_url, token: config.token });
  }, [config]);

  // Load config once, focus the input, listen for re-show events so we can
  // reset state without unmounting the window (cheaper than tear-down).
  useEffect(() => {
    loadConfig().then(setConfig).catch((e) => {
      console.error(e);
      setStatus({ kind: 'error', message: 'failed to load config' });
    });
    inputRef.current?.focus();

    const unlisten = win.listen('popover:reset', () => {
      setText('');
      setStatus({ kind: 'idle' });
      inputRef.current?.focus();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [win]);

  const hide = useCallback(async () => {
    try {
      await invoke('cmd_hide_popover');
    } catch (e) {
      console.error('hide_popover failed', e);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!client || !config) return;
    const trimmed = text.trim();
    if (!trimmed) {
      await hide();
      return;
    }
    const { hint, body } = inferTypeHint(trimmed);
    const req: CaptureRequest = {
      idem_key: uuidv4(),
      client_id: config.client_id,
      body,
      type_hint: hint,
      tags: [],
      captured_at: new Date().toISOString(),
    };

    setStatus({ kind: 'sending' });

    try {
      await client.capture(req);
      setStatus({ kind: 'sent' });
      // brief flash so the user sees the confirmation, then dismiss.
      setTimeout(() => {
        setText('');
        setStatus({ kind: 'idle' });
        hide();
      }, 280);
    } catch (err) {
      // Server unreachable / 5xx → queue it; 4xx other than 409 surfaces.
      // Per PRD §8.4 the helper's contract is "never lose a capture".
      const isApi = err instanceof CompassApiError;
      const code = isApi ? err.status : 0;
      if (!isApi || code >= 500 || code === 0) {
        try {
          await enqueueCapture(req);
          setStatus({ kind: 'queued' });
          setTimeout(() => {
            setText('');
            setStatus({ kind: 'idle' });
            hide();
          }, 400);
        } catch (queueErr) {
          console.error('enqueue failed', queueErr);
          setStatus({
            kind: 'error',
            message: 'send failed and could not queue locally',
          });
        }
      } else if (code === 409) {
        // Idempotency hit = success.
        setStatus({ kind: 'sent' });
        setTimeout(() => {
          setText('');
          setStatus({ kind: 'idle' });
          hide();
        }, 280);
      } else {
        setStatus({
          kind: 'error',
          message: `capture rejected (${code}); check your token`,
        });
      }
    }
  }, [client, config, text, hide]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setText('');
        void hide();
      }
    },
    [submit, hide],
  );

  return (
    <div className="popover-shell">
      <input
        ref={inputRef}
        className="popover-input"
        value={text}
        placeholder="Capture to Compass… (! for idea, ? for curiosity)"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
        spellCheck={false}
      />
      <div className="popover-hint">
        <span>
          {status.kind === 'sending' && 'sending…'}
          {status.kind === 'sent' && 'captured.'}
          {status.kind === 'queued' && 'queued — will retry'}
          {status.kind === 'idle' && 'Enter to send · Esc to dismiss'}
        </span>
        {status.kind === 'error' && (
          <span className="popover-error">{status.message}</span>
        )}
      </div>
    </div>
  );
}
