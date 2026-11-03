import React, { useEffect, useState } from 'react';
import {
  Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import type { TaxonomyNode } from '@/lib/types';
import { colors, font, radius } from '@/theme';

// Etsy category field: tap to open, type to search Etsy's category tree, tap a result to choose it.
export function CategoryPicker({ taxonomyId, taxonomyPath, onChoose, error }: {
  taxonomyId: number | null; taxonomyPath: string | null; onChoose: (node: TaxonomyNode) => void; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaxonomyNode[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const { results: found } = await api<{ results: TaxonomyNode[] }>(`/api/etsy/taxonomy?q=${encodeURIComponent(query.trim())}`);
        setResults(found);
        setSearchError(null);
      } catch (e) {
        setResults([]);
        setSearchError((e as Error).message);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const choose = (node: TaxonomyNode) => {
    onChoose(node);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="Choose Etsy category"
        style={[styles.field, open && styles.fieldOpen, error ? { borderColor: colors.danger } : null]}
      >
        <Text style={[styles.value, !taxonomyPath && { color: colors.placeholder }]} numberOfLines={2}>
          {taxonomyPath ?? (taxonomyId ? `Category ${taxonomyId}` : 'Choose a category')}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {open ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search, e.g. mugs or necklaces"
            placeholderTextColor={colors.placeholder}
            autoFocus
            accessibilityLabel="Search Etsy categories"
            style={styles.search}
          />
          {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
          {results.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => choose(n)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.result, pressed && { backgroundColor: colors.accent50 }]}
            >
              <Text style={styles.resultName}>{n.name}</Text>
              <Text style={font.small} numberOfLines={1}>{n.path}</Text>
            </Pressable>
          ))}
          {!results.length && !searchError && query.trim() ? <Text style={font.small}>No categories match. Try a broader word.</Text> : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderRadius: radius.sm, borderWidth: 1.5,
    borderColor: colors.line, paddingHorizontal: 15, backgroundColor: colors.surface2,
  },
  fieldOpen: { borderColor: colors.accent, backgroundColor: colors.surface },
  value: { flex: 1, fontSize: 15, color: colors.ink },
  error: { fontSize: 12.5, color: colors.danger },
  search: {
    minHeight: 46, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14,
    fontSize: 15, color: colors.ink, backgroundColor: colors.surface2,
  },
  result: { paddingVertical: 11, paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  resultName: { fontSize: 14, fontWeight: '600', color: colors.ink },
});
