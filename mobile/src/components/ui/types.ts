import type { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'dark';
