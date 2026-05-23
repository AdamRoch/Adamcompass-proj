import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import * as notifQ from '@compass/db/queries/notifications';
import * as webhookQ from '@compass/db/queries/webhook';
import * as adminQ from '@compass/db/queries/admin';
import type { NotificationRow } from '@compass/db/queries/notifications';
import type { WebhookDeliveryRow } from '@compass/db/queries/webhook';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'sent' || status === 'accepted'
      ? 'bg-success/15 text-success'
      : status === 'failed' ||
          status === 'rejected_auth' ||
          status === 'rejected_signature' ||
          status === 'internal_error'
        ? 'bg-danger/15 text-danger'
        : status === 'pending'
          ? 'bg-warning/15 text-warning'
          : 'bg-surface-elevated text-text-muted';
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-sm px-1.5',
        'text-2xs font-semibold uppercase tracking-[0.05em]',
        tone,
      )}
    >
      {status}
    </span>
  );
}

function preview(text: string | null, max = 80): string {
  if (!text) return '';
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export default async function AdminPage() {
  // Audit log row shape — listAudit returns a Drizzle select result with these fields.
  type AuditRow = {
    id: string;
    actor: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata_json: string;
    at: string;
  };
  const [deliveries, notifications, audits] = await Promise.all([
    webhookQ.listRecent(200).catch(() => [] as WebhookDeliveryRow[]),
    notifQ.listRecent(200).catch(() => [] as NotificationRow[]),
    adminQ.listAudit(200).catch(() => [] as AuditRow[]) as Promise<AuditRow[]>,
  ]);

  return (
    <div className="space-y-5">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
      >
        <ArrowLeft className="size-3" aria-hidden /> Settings
      </Link>

      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
          Observability
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Webhook deliveries, notification queue, and audit log.
        </p>
      </header>

      <Tabs defaultValue="deliveries">
        <TabsList>
          <TabsTrigger value="deliveries">
            Webhook deliveries
            {deliveries.length > 0 ? (
              <span className="ml-1 text-2xs text-text-muted">{deliveries.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            Notifications
            {notifications.length > 0 ? (
              <span className="ml-1 text-2xs text-text-muted">{notifications.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="audit">
            Audit log
            {audits.length > 0 ? (
              <span className="ml-1 text-2xs text-text-muted">{audits.length}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deliveries">
          <Card variant="glass" padding="md">
            <CardHeader>
              <CardTitle>Recent webhook deliveries</CardTitle>
            </CardHeader>
            {deliveries.length === 0 ? (
              <EmptyState
                title="No deliveries yet"
                description="When webhooks hit the app they'll appear here with body + status."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                      <th className="py-2 pr-3 font-semibold">Time</th>
                      <th className="py-2 pr-3 font-semibold">Endpoint</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">Body preview</th>
                      <th className="py-2 pr-3 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id} className="border-b border-border/40">
                        <td className="py-2 pr-3 text-2xs text-text-muted whitespace-nowrap">
                          {new Date(d.received_at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 font-mono text-2xs text-text-primary">
                          {d.endpoint}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="py-2 pr-3 text-xs text-text-primary">
                          {preview(d.body_text, 96)}
                        </td>
                        <td className="py-2 pr-3 text-xs text-danger">
                          {preview(d.error_message, 80)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card variant="glass" padding="md">
            <CardHeader>
              <CardTitle>Recent notifications</CardTitle>
            </CardHeader>
            {notifications.length === 0 ? (
              <EmptyState
                title="No notifications yet"
                description="Stall alerts, digests, and build run pings appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                      <th className="py-2 pr-3 font-semibold">Created</th>
                      <th className="py-2 pr-3 font-semibold">Kind</th>
                      <th className="py-2 pr-3 font-semibold">Channel</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">Payload preview</th>
                      <th className="py-2 pr-3 font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n) => (
                      <tr key={n.id} className="border-b border-border/40">
                        <td className="py-2 pr-3 text-2xs text-text-muted whitespace-nowrap">
                          {new Date(n.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-xs text-text-primary">{n.kind}</td>
                        <td className="py-2 pr-3 text-2xs text-text-muted">{n.channel}</td>
                        <td className="py-2 pr-3">
                          <StatusBadge status={n.status} />
                        </td>
                        <td className="py-2 pr-3 text-xs text-text-primary">
                          {preview(n.payload_json, 96)}
                        </td>
                        <td className="py-2 pr-3 text-xs text-danger">
                          {preview(n.error_message, 80)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card variant="glass" padding="md">
            <CardHeader>
              <CardTitle>Audit log</CardTitle>
            </CardHeader>
            {audits.length === 0 ? (
              <EmptyState
                title="No audit events yet"
                description="Mutations like token mints, snoozes, and filings will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                      <th className="py-2 pr-3 font-semibold">Time</th>
                      <th className="py-2 pr-3 font-semibold">Actor</th>
                      <th className="py-2 pr-3 font-semibold">Action</th>
                      <th className="py-2 pr-3 font-semibold">Entity</th>
                      <th className="py-2 pr-3 font-semibold">Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((a) => (
                      <tr key={a.id} className="border-b border-border/40">
                        <td className="py-2 pr-3 text-2xs text-text-muted whitespace-nowrap">
                          {new Date(a.at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-3 text-2xs text-text-muted">{a.actor}</td>
                        <td className="py-2 pr-3 text-xs text-text-primary">{a.action}</td>
                        <td className="py-2 pr-3 text-2xs text-text-muted">
                          {a.entity_type
                            ? `${a.entity_type}${a.entity_id ? `/${a.entity_id.slice(0, 8)}…` : ''}`
                            : '—'}
                        </td>
                        <td className="py-2 pr-3 text-xs text-text-primary">
                          {preview(a.metadata_json, 96)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
