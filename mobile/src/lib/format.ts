export const money = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : `$${Number(n).toFixed(2)}`;

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export const STATUS_LABEL: Record<string, string> = {
  generating: 'Generating',
  draft: 'Draft',
  published: 'Published',
  ended: 'Ended',
  failed: 'Needs attention',
};
