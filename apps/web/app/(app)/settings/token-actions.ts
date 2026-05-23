'use server';

import { revalidatePath } from 'next/cache';
import * as authQ from '@compass/db/queries/auth';
import * as adminQ from '@compass/db/queries/admin';
import type { TokenScope } from '@compass/shared';
import { hashToken, newRandomToken, requireUserOrRedirect } from '@/lib/auth';

export interface TokenRow {
  id: string;
  name: string;
  scope: TokenScope;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export async function listTokensAction(): Promise<TokenRow[]> {
  await requireUserOrRedirect();
  const rows = await authQ.listTokens();
  return rows as TokenRow[];
}

export interface MintResult {
  token: string;
  meta: { id: string; name: string; scope: TokenScope; created_at: string };
}

export async function mintTokenAction(formData: FormData): Promise<MintResult> {
  await requireUserOrRedirect();
  const name = String(formData.get('name') ?? '').trim() || 'Untitled';
  const scopeRaw = String(formData.get('scope') ?? 'cli');
  const scope: TokenScope =
    scopeRaw === 'helper' || scopeRaw === 'webhook' ? (scopeRaw as TokenScope) : 'cli';
  // Prefix convention matches admin/tokens API route + device-code flow:
  // cli=cpsc, helper=cpsh, webhook=cpsw. Lets logs/audit classify tokens by prefix.
  const prefix = scope === 'cli' ? 'cpsc' : scope === 'helper' ? 'cpsh' : 'cpsw';
  const plain = newRandomToken(prefix);
  const created = await authQ.createToken({
    name,
    scope,
    token_hash: hashToken(plain),
  });
  await adminQ.writeAudit({
    actor: 'user',
    action: 'token.mint',
    metadata: { token_id: created.id, name, scope },
  });
  revalidatePath('/settings');
  return {
    token: plain,
    meta: {
      id: created.id,
      name: created.name,
      scope: created.scope as TokenScope,
      created_at: created.created_at,
    },
  };
}

export async function revokeTokenAction(formData: FormData): Promise<void> {
  await requireUserOrRedirect();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await authQ.revokeToken(id);
  await adminQ.writeAudit({
    actor: 'user',
    action: 'token.revoke',
    metadata: { token_id: id },
  });
  revalidatePath('/settings');
}
