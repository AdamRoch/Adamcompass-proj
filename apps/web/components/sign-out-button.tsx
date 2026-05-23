'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SignOutButtonProps {
  /** Optional className override for layout tweaks. */
  className?: string;
  /** Variant override; defaults to `ghost` to fit inside menus / sidebars. */
  variant?: 'ghost' | 'secondary' | 'destructive';
  /** Show a leading icon — defaults to true. */
  showIcon?: boolean;
  /** Optional label override. */
  children?: React.ReactNode;
}

export function SignOutButton({
  className,
  variant = 'ghost',
  showIcon = true,
  children,
}: SignOutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function handleSignOut() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
    } catch {
      // Network failure → still redirect; the session may be stale.
    }
    router.refresh();
    router.push('/login');
  }

  return (
    <Button
      variant={variant}
      size="sm"
      loading={loading}
      leftIcon={showIcon ? <LogOut className="size-4" aria-hidden /> : undefined}
      onClick={handleSignOut}
      className={className}
      aria-label="Sign out"
    >
      {children ?? 'Sign out'}
    </Button>
  );
}
