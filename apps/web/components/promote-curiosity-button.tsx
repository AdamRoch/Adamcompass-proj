'use client';

import { promoteCuriosityAction } from '@/app/(app)/inbox/promote-action';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

export function PromoteCuriosityButton({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function promote() {
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('note_id', noteId);
      await promoteCuriosityAction(fd);
      toast({ variant: 'success', title: 'Promoted to learning goal' });
      router.refresh();
    } catch {
      toast({ variant: 'danger', title: 'Promotion failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={() => void promote()}
      leftIcon={<Sparkles className="size-3.5" />}
    >
      Promote to goal
    </Button>
  );
}
