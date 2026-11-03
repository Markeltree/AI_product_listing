import React from 'react';
import { STATUS_LABEL } from '@/lib/format';
import { Pill } from './Pill';
import type { Tone } from './types';

const STATUS_TONE: Record<string, Tone> = {
  draft: 'neutral',
  published: 'success',
  ended: 'neutral',
  failed: 'danger',
  generating: 'info',
};

// A listing's status as a coloured pill.
export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  return <Pill label={label} tone={STATUS_TONE[status] ?? 'neutral'} dot accessibilityLabel={`Status: ${label}`} />;
}
