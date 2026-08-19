'use client';

import { FarmFlowError } from '@/components/dev/FarmFlowError';

export default function ActivitiesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <FarmFlowError error={error} reset={reset} boundary="activities" />;
}
