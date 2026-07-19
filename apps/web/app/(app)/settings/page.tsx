import { SignOutButton } from '@/components/sign-out-button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { currentUser } from '@/lib/auth';
import * as settingsQ from '@compass/db/queries/settings';
import * as tagsQ from '@compass/db/queries/tags';
import { Activity, Mail } from 'lucide-react';
import Link from 'next/link';
import { DensityToggle, NotificationsForm, StallsForm } from './settings-forms';
import { TagsPanel } from './tags-panel';
import { ThemePicker } from './theme-picker';
import { listTokensAction } from './token-actions';
import { TokensPanel } from './tokens-panel';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [settings, tokens, user, tags] = await Promise.all([
    settingsQ.getSettings(),
    listTokensAction(),
    currentUser(),
    tagsQ.listWithCounts().catch(() => []),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
            Settings
          </h1>
          <p className="mt-1 text-sm text-text-muted">Personalize Compass.</p>
        </div>
        <Link
          href="/settings/admin"
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary"
        >
          <Activity className="size-3" aria-hidden /> Observability
        </Link>
      </header>

      <Tabs defaultValue="appearance">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="stalls">Stalls</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance">
          <Card variant="glass" padding="md" className="space-y-5">
            <div>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
              </CardHeader>
              <div className="flex items-center gap-3">
                <ThemePicker value={settings.active_theme} />
                <p className="text-xs text-text-muted">
                  Active: <span className="text-text-primary">{settings.active_theme}</span>
                </p>
              </div>
            </div>
            <div>
              <CardHeader>
                <CardTitle>Density</CardTitle>
              </CardHeader>
              <DensityToggle />
              <p className="mt-2 text-xs text-text-muted">
                Adjusts row + control heights for this browser. Saved locally.
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card variant="glass" padding="md">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <NotificationsForm initial={settings} />
          </Card>
        </TabsContent>

        <TabsContent value="stalls">
          <Card variant="glass" padding="md">
            <CardHeader>
              <CardTitle>Stall thresholds</CardTitle>
            </CardHeader>
            <StallsForm initial={settings} />
          </Card>
        </TabsContent>

        <TabsContent value="tags">
          <Card variant="glass" padding="md">
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <TagsPanel tags={tags} />
          </Card>
        </TabsContent>

        <TabsContent value="tokens">
          <Card variant="glass" padding="md">
            <TokensPanel tokens={tokens} />
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card variant="glass" padding="md" className="space-y-4">
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                  Email
                </p>
                <p className="inline-flex items-center gap-2 text-sm text-text-primary">
                  <Mail className="size-4 text-text-muted" aria-hidden />
                  {user?.email ?? 'unknown'}
                </p>
              </div>
              <SignOutButton variant="secondary" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                Timezone
              </p>
              <p className="text-sm text-text-primary">{settings.timezone}</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
