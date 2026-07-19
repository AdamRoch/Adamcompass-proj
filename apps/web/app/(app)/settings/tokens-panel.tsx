'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { Copy, KeyRound, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import {
  type MintResult,
  type TokenRow,
  mintTokenAction,
  revokeTokenAction,
} from './token-actions';

export function TokensPanel({ tokens }: { tokens: TokenRow[] }) {
  const router = useRouter();
  const [mintOpen, setMintOpen] = React.useState(false);
  const [revealed, setRevealed] = React.useState<MintResult | null>(null);
  const [name, setName] = React.useState('');
  const [scope, setScope] = React.useState<'cli' | 'helper' | 'webhook'>('cli');
  const [busy, setBusy] = React.useState(false);

  async function mint() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('name', name.trim());
      fd.set('scope', scope);
      const result = await mintTokenAction(fd);
      setRevealed(result);
      setName('');
      setScope('cli');
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Failed to mint token' });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const fd = new FormData();
    fd.set('id', id);
    try {
      await revokeTokenAction(fd);
      toast({ variant: 'success', title: 'Token revoked' });
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Failed to revoke token' });
    }
  }

  async function copyToken(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast({ variant: 'success', title: 'Copied to clipboard' });
    } catch {
      toast({ variant: 'danger', title: 'Copy failed' });
    }
  }

  const active = tokens.filter((t) => !t.revoked_at);
  const revoked = tokens.filter((t) => t.revoked_at);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Tokens</h3>
          <p className="text-xs text-text-muted">
            Bearer tokens for the CLI, helper, and incoming webhooks. The plain value is shown once
            at creation.
          </p>
        </div>
        <Button
          size="sm"
          leftIcon={<Plus className="size-3.5" />}
          onClick={() => setMintOpen(true)}
        >
          Mint token
        </Button>
      </div>

      {active.length === 0 ? (
        <p className="rounded-md border border-border bg-surface-elevated/40 p-3 text-xs italic text-text-muted">
          No active tokens.
        </p>
      ) : (
        <div className="rounded-md border border-border divide-y divide-border/60">
          <div className="grid grid-cols-[1fr_80px_120px_120px_80px] gap-3 px-3 py-2 text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
            <span>Name</span>
            <span>Scope</span>
            <span>Created</span>
            <span>Last used</span>
            <span />
          </div>
          {active.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[1fr_80px_120px_120px_80px] gap-3 px-3 py-2 text-sm"
            >
              <span className="inline-flex items-center gap-2 truncate">
                <KeyRound className="size-3.5 text-text-muted" aria-hidden />
                <span className="truncate">{t.name}</span>
              </span>
              <span className="text-text-muted">{t.scope}</span>
              <span className="text-2xs text-text-muted">
                {new Date(t.created_at).toLocaleDateString()}
              </span>
              <span className="text-2xs text-text-muted">
                {t.last_used_at ? new Date(t.last_used_at).toLocaleDateString() : 'never'}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void revoke(t.id)}
                className="!h-7 !px-2 !text-2xs text-danger"
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}

      {revoked.length > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-text-muted hover:text-text-primary">
            Revoked ({revoked.length})
          </summary>
          <ul className="mt-2 space-y-1 pl-3">
            {revoked.map((t) => (
              <li key={t.id} className="text-text-muted">
                <span className="line-through">{t.name}</span> · {t.scope} · revoked{' '}
                {new Date(t.revoked_at ?? '').toLocaleDateString()}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Dialog
        open={mintOpen}
        onOpenChange={(o) => {
          setMintOpen(o);
          if (!o) setRevealed(null);
        }}
      >
        <DialogContent>
          {revealed ? (
            <>
              <DialogHeader>
                <DialogTitle>Token minted</DialogTitle>
                <DialogDescription>
                  Copy this token now. It will NOT be shown again. Compass only stores its hash.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3 space-y-2">
                <div className="rounded-md border border-border bg-surface-sunken px-3 py-2 font-mono text-xs text-text-primary break-all">
                  {revealed.token}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Copy className="size-3.5" />}
                    onClick={() => void copyToken(revealed.token)}
                  >
                    Copy to clipboard
                  </Button>
                </div>
                <p className="text-2xs text-text-muted">
                  {revealed.meta.scope} token "{revealed.meta.name}" (
                  {new Date(revealed.meta.created_at).toLocaleString()})
                </p>
              </div>
              <DialogFooter>
                <Button
                  size="sm"
                  onClick={() => {
                    setRevealed(null);
                    setMintOpen(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Mint a new token</DialogTitle>
                <DialogDescription>
                  Issues a long-lived bearer token. You will see the plain value exactly once.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="token-name">Name</Label>
                  <Input
                    id="token-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. MacBook CLI"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Scope</Label>
                  <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cli">cli</SelectItem>
                      <SelectItem value="helper">helper</SelectItem>
                      <SelectItem value="webhook">webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => setMintOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={mint} loading={busy} disabled={!name.trim()}>
                  Mint
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
