'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export function NewProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          ...(summary.trim() ? { summary: summary.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast({
          variant: 'danger',
          title: 'Failed to create project',
          description: text || `Server responded ${res.status}`,
        });
        return;
      }
      const data = (await res.json()) as { project: { id: string } };
      setOpen(false);
      setTitle('');
      setSummary('');
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Failed to create project',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button leftIcon={<Plus className="size-4" />}>New project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Create a project with a title. You can edit the stage, summary, links, and more on the
            detail page.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="space-y-1.5">
            <Label htmlFor="project-title">Title</Label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Compass v1"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-summary">Summary (optional)</Label>
            <Textarea
              id="project-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One or two sentences."
              minRows={2}
              maxRows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={submitting}
              disabled={!title.trim()}
              onClick={handleCreate}
            >
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
