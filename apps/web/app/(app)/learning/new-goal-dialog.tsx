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

export function NewGoalDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [motivation, setMotivation] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/learning-goals', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          ...(motivation.trim() ? { motivation: motivation.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast({
          variant: 'danger',
          title: 'Failed to create goal',
          description: text || `Server responded ${res.status}`,
        });
        return;
      }
      const data = (await res.json()) as { learning_goal: { id: string } };
      setOpen(false);
      setTitle('');
      setMotivation('');
      router.push(`/learning/${data.learning_goal.id}`);
    } catch (err) {
      toast({
        variant: 'danger',
        title: 'Failed to create goal',
        description: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button leftIcon={<Plus className="size-4" />}>New goal</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New learning goal</DialogTitle>
          <DialogDescription>
            What are you curious about, learning, or want to internalize?
          </DialogDescription>
        </DialogHeader>
        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rust ownership model"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-motivation">Motivation (optional)</Label>
            <Textarea
              id="goal-motivation"
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="Why does this matter to you?"
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
              Create goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
