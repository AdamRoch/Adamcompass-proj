'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Settings } from '@compass/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';

interface PatchSettingsProps {
  initial: Settings;
}

async function patchSettings(patch: Partial<Settings>) {
  const res = await fetch('/api/v1/settings', {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

export function NotificationsForm({ initial }: PatchSettingsProps) {
  const router = useRouter();
  const [telegram, setTelegram] = React.useState(initial.notif_telegram_enabled);
  const [digest, setDigest] = React.useState(initial.notif_digest_enabled);
  const [stall, setStall] = React.useState(initial.notif_stall_enabled);
  const [buildRun, setBuildRun] = React.useState(initial.notif_build_run_enabled);
  const [quietStart, setQuietStart] = React.useState(initial.quiet_hours_start);
  const [quietEnd, setQuietEnd] = React.useState(initial.quiet_hours_end);
  const [digestTime, setDigestTime] = React.useState(initial.digest_send_time);
  const [saving, setSaving] = React.useState(false);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    try {
      const ok = await patchSettings(patch);
      if (ok) {
        toast({ variant: 'success', title: 'Saved' });
        router.refresh();
      } else {
        toast({ variant: 'danger', title: 'Save failed' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Row
        label="Telegram"
        description="Master switch for all Telegram notifications."
        control={
          <Switch
            checked={telegram}
            onCheckedChange={(c) => {
              setTelegram(c);
              void save({ notif_telegram_enabled: c });
            }}
            disabled={saving}
          />
        }
      />

      <fieldset className="space-y-3 rounded-md border border-border p-3">
        <legend className="px-1 text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
          Per trigger
        </legend>
        <Row
          label="Daily digest"
          control={
            <Switch
              checked={digest}
              onCheckedChange={(c) => {
                setDigest(c);
                void save({ notif_digest_enabled: c });
              }}
              disabled={saving}
            />
          }
        />
        <Row
          label="Stall alerts"
          control={
            <Switch
              checked={stall}
              onCheckedChange={(c) => {
                setStall(c);
                void save({ notif_stall_enabled: c });
              }}
              disabled={saving}
            />
          }
        />
        <Row
          label="Build run events"
          control={
            <Switch
              checked={buildRun}
              onCheckedChange={(c) => {
                setBuildRun(c);
                void save({ notif_build_run_enabled: c });
              }}
              disabled={saving}
            />
          }
        />
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-border p-3">
        <legend className="px-1 text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
          Timing
        </legend>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="quiet-start">Quiet hours start</Label>
            <Input
              id="quiet-start"
              type="time"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
              onBlur={() => {
                if (quietStart !== initial.quiet_hours_start) {
                  void save({ quiet_hours_start: quietStart });
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quiet-end">Quiet hours end</Label>
            <Input
              id="quiet-end"
              type="time"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
              onBlur={() => {
                if (quietEnd !== initial.quiet_hours_end) {
                  void save({ quiet_hours_end: quietEnd });
                }
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="digest-time">Digest send time</Label>
            <Input
              id="digest-time"
              type="time"
              value={digestTime}
              onChange={(e) => setDigestTime(e.target.value)}
              onBlur={() => {
                if (digestTime !== initial.digest_send_time) {
                  void save({ digest_send_time: digestTime });
                }
              }}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}

export function StallsForm({ initial }: PatchSettingsProps) {
  const router = useRouter();
  const [projDays, setProjDays] = React.useState(initial.default_stall_threshold_project_days);
  const [goalDays, setGoalDays] = React.useState(initial.default_stall_threshold_learning_days);
  const [saving, setSaving] = React.useState(false);

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    try {
      const ok = await patchSettings(patch);
      if (ok) {
        toast({ variant: 'success', title: 'Saved' });
        router.refresh();
      } else {
        toast({ variant: 'danger', title: 'Save failed' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Defaults applied to projects + learning goals without an explicit threshold. Smaller =
        more aggressive nudging.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="proj-stall">Project stall threshold (days)</Label>
          <Input
            id="proj-stall"
            type="number"
            min={1}
            max={365}
            value={projDays}
            onChange={(e) => setProjDays(Number(e.target.value))}
            onBlur={() => {
              if (projDays !== initial.default_stall_threshold_project_days) {
                void save({ default_stall_threshold_project_days: projDays });
              }
            }}
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-stall">Learning goal threshold (days)</Label>
          <Input
            id="goal-stall"
            type="number"
            min={1}
            max={365}
            value={goalDays}
            onChange={(e) => setGoalDays(Number(e.target.value))}
            onBlur={() => {
              if (goalDays !== initial.default_stall_threshold_learning_days) {
                void save({ default_stall_threshold_learning_days: goalDays });
              }
            }}
            disabled={saving}
          />
        </div>
      </div>
    </div>
  );
}

export function DensityToggle() {
  const [density, setDensity] = React.useState<'comfortable' | 'compact' | 'dense'>('compact');

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const stored = window.localStorage.getItem('compass.density') as
      | 'comfortable'
      | 'compact'
      | 'dense'
      | null;
    if (stored) setDensity(stored);
  }, []);

  function apply(next: 'comfortable' | 'compact' | 'dense') {
    setDensity(next);
    try {
      window.localStorage.setItem('compass.density', next);
    } catch {
      // ignore
    }
    if (typeof document !== 'undefined') {
      const multiplier = next === 'comfortable' ? '1.15' : next === 'dense' ? '0.9' : '1';
      document.documentElement.style.setProperty('--density', multiplier);
    }
  }

  return (
    <div className="flex gap-2">
      {(['comfortable', 'compact', 'dense'] as const).map((d) => (
        <Button
          key={d}
          variant={d === density ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => apply(d)}
        >
          {d.charAt(0).toUpperCase() + d.slice(1)}
        </Button>
      ))}
    </div>
  );
}

function Row({
  label,
  description,
  control,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
