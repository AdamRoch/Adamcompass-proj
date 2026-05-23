'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Folder, Inbox, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

export interface FilePopoverOption {
  id: string;
  title: string;
}

export interface FilePopoverProps {
  noteId: string;
  projects: FilePopoverOption[];
  goals: FilePopoverOption[];
}

/**
 * Popover that lets the user file an inbox note into an existing project /
 * learning goal, or create a new one. Posts to `/api/v1/inbox/[id]/file`.
 */
export function FilePopover({ noteId, projects, goals }: FilePopoverProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [projectQuery, setProjectQuery] = React.useState('');
  const [goalQuery, setGoalQuery] = React.useState('');
  const [newProjectTitle, setNewProjectTitle] = React.useState('');
  const [newGoalTitle, setNewGoalTitle] = React.useState('');

  const filteredProjects = React.useMemo(
    () =>
      projects
        .filter((p) => p.title.toLowerCase().includes(projectQuery.toLowerCase()))
        .slice(0, 20),
    [projects, projectQuery],
  );
  const filteredGoals = React.useMemo(
    () =>
      goals.filter((g) => g.title.toLowerCase().includes(goalQuery.toLowerCase())).slice(0, 20),
    [goals, goalQuery],
  );

  async function postFile(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/inbox/${noteId}/file`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast({
          variant: 'danger',
          title: 'Failed to file note',
          description: text || `Server responded ${res.status}`,
        });
        return;
      }
      toast({ variant: 'success', title: 'Filed', description: 'Note removed from inbox.' });
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Failed to file note',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setBusy(false);
    }
  }

  function fileToExisting(type: 'project' | 'learning_goal', id: string) {
    void postFile({ target: 'existing', target_type: type, target_id: id });
  }

  function fileToNewProject(title: string) {
    const t = title.trim();
    if (!t) return;
    void postFile({ target: 'new_project', title: t });
  }

  function fileToNewGoal(title: string) {
    const t = title.trim();
    if (!t) return;
    void postFile({ target: 'new_learning_goal', title: t });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" leftIcon={<Folder className="size-3.5" />}>
          File
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] max-w-none p-0">
        <Tabs defaultValue="project">
          <TabsList className="px-2 pt-2">
            <TabsTrigger value="project" className="text-xs">
              <Folder className="size-3.5" aria-hidden /> Project
            </TabsTrigger>
            <TabsTrigger value="goal" className="text-xs">
              <Target className="size-3.5" aria-hidden /> Goal
            </TabsTrigger>
            <TabsTrigger value="keep" className="text-xs">
              <Inbox className="size-3.5" aria-hidden /> Keep
            </TabsTrigger>
          </TabsList>

          <TabsContent value="project" className="m-0 mt-0 p-3">
            <Input
              placeholder="Search projects..."
              value={projectQuery}
              onChange={(e) => setProjectQuery(e.target.value)}
              wrapperClassName="mb-2"
            />
            <div className="max-h-[180px] overflow-auto rounded-sm border border-border/60">
              {filteredProjects.length === 0 ? (
                <div className="px-2 py-3 text-xs text-text-muted">No matching projects</div>
              ) : (
                filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => fileToExisting('project', p.id)}
                    disabled={busy}
                    className={cn(
                      'flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm',
                      'hover:bg-accent/10 focus:bg-accent/10 focus:outline-none',
                      'disabled:opacity-50',
                    )}
                  >
                    <Folder className="size-3.5 text-text-muted" aria-hidden />
                    <span className="truncate">{p.title}</span>
                  </button>
                ))
              )}
            </div>

            <div className="mt-3 border-t border-border/60 pt-3">
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                Or create new
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="New project title"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fileToNewProject(newProjectTitle);
                  }}
                  wrapperClassName="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => fileToNewProject(newProjectTitle)}
                  loading={busy}
                  disabled={!newProjectTitle.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="goal" className="m-0 mt-0 p-3">
            <Input
              placeholder="Search learning goals..."
              value={goalQuery}
              onChange={(e) => setGoalQuery(e.target.value)}
              wrapperClassName="mb-2"
            />
            <div className="max-h-[180px] overflow-auto rounded-sm border border-border/60">
              {filteredGoals.length === 0 ? (
                <div className="px-2 py-3 text-xs text-text-muted">No matching goals</div>
              ) : (
                filteredGoals.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => fileToExisting('learning_goal', g.id)}
                    disabled={busy}
                    className={cn(
                      'flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm',
                      'hover:bg-accent/10 focus:bg-accent/10 focus:outline-none',
                      'disabled:opacity-50',
                    )}
                  >
                    <Target className="size-3.5 text-text-muted" aria-hidden />
                    <span className="truncate">{g.title}</span>
                  </button>
                ))
              )}
            </div>

            <div className="mt-3 border-t border-border/60 pt-3">
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-[0.05em] text-text-muted">
                Or create new
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="New learning goal title"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fileToNewGoal(newGoalTitle);
                  }}
                  wrapperClassName="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => fileToNewGoal(newGoalTitle)}
                  loading={busy}
                  disabled={!newGoalTitle.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="keep" className="m-0 mt-0 p-3">
            <p className="text-sm text-text-muted">
              Keep this note in the inbox without filing it. You can come back to it later.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => void postFile({ target: 'keep_unfiled_note' })}
              loading={busy}
            >
              Keep unfiled
            </Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
