'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
const READING_STATUSES = ['to_read', 'reading', 'read', 'abandoned'] as const;
const RESOURCE_KINDS = ['article', 'book', 'paper', 'video', 'course', 'other'] as const;
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';

export interface GoalOption {
  id: string;
  title: string;
}

export function NewResourceDialog({ goals }: { goals: GoalOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [author, setAuthor] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [kind, setKind] = React.useState<string>('article');
  const [status, setStatus] = React.useState<string>('to_read');
  const [goalId, setGoalId] = React.useState<string>('');
  const [submitting, setSubmitting] = React.useState(false);

  function reset() {
    setTitle('');
    setAuthor('');
    setUrl('');
    setKind('article');
    setStatus('to_read');
    setGoalId('');
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        kind,
        reading_status: status,
      };
      if (author.trim()) body.author_source = author.trim();
      if (url.trim()) body.url = url.trim();
      if (goalId) body.learning_goal_id = goalId;
      const res = await fetch('/api/v1/resources', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast({
          variant: 'danger',
          title: 'Failed to create resource',
          description: text || `Server responded ${res.status}`,
        });
        return;
      }
      toast({ variant: 'success', title: 'Resource added' });
      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Failed to create resource',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button leftIcon={<Plus className="size-4" />}>Add resource</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add resource</DialogTitle>
          <DialogDescription>Article, book, paper, video, or course.</DialogDescription>
        </DialogHeader>
        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="space-y-1.5">
            <Label htmlFor="rsrc-title">Title</Label>
            <Input
              id="rsrc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rsrc-author">Author / source</Label>
              <Input
                id="rsrc-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rsrc-url">URL</Label>
              <Input
                id="rsrc-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {READING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Linked goal (optional)</Label>
            <Select value={goalId || 'none'} onValueChange={(v) => setGoalId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— none —</SelectItem>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              Add resource
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
