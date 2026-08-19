'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { loadDemoFarm } from '@/lib/actions/dev-demo-farm';
import type { LoadDemoFarmState } from '@/lib/actions/dev-demo-farm';

const initialState: LoadDemoFarmState = {};

export function LoadDemoFarmButton() {
  const [state, formAction, isPending] = useActionState(loadDemoFarm, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={formAction} style={{ display: 'inline-flex', flexDirection: 'column', gap: 'var(--space-2)', alignItems: 'center' }}>
      <Button type="submit" variant="secondary" loading={isPending}>
        Load demo farm (development only)
      </Button>
      {state.error && (
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-red)' }}>{state.error}</span>
      )}
    </form>
  );
}
