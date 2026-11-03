import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '@/theme';

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeHeader({
  name, total, live, drafts, needsAttention, query, onQuery, onNew,
}: {
  name: string; total: number | null; live: number; drafts: number; needsAttention: number;
  query: string; onQuery: (q: string) => void; onNew: () => void;
}) {
  const insets = useSafeAreaInsets();
  const initial = (name.trim()[0] || 'V').toUpperCase();
  return (
    <View style={{ marginHorizontal: -(space.lg + 2), marginBottom: 6 }}>
      <View
        style={{
          backgroundColor: colors.hero, paddingTop: insets.top + space.md, paddingHorizontal: space.lg + 4,
          paddingBottom: 46, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden',
        }}
      >
        {/* Soft shapes give the flat orange some depth, like a gradient. */}
        <View pointerEvents="none" style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: colors.heroDeep, opacity: 0.45, top: -120, right: -70 }} />
        <View pointerEvents="none" style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#FFFFFF', opacity: 0.12, bottom: -90, left: -40 }} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(20,20,22,0.7)', fontSize: 13, fontWeight: '600' }}>{greeting()},</Text>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>{name || 'Seller'}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 22 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'rgba(20,20,22,0.7)', fontSize: 13, fontWeight: '600' }}>Your listings</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
              <Text style={{ color: colors.ink, fontSize: 40, fontWeight: '900', letterSpacing: -1.2 }}>{total ?? '–'}</Text>
              <View style={{ backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' }} />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{live} live</Text>
              </View>
            </View>
            <Text style={{ color: 'rgba(20,20,22,0.7)', fontSize: 13, marginTop: 4 }}>
              {drafts} draft{drafts === 1 ? '' : 's'}{needsAttention ? ` · ${needsAttention} need${needsAttention === 1 ? 's' : ''} attention` : ''}
            </Text>
          </View>
          <Pressable
            onPress={onNew}
            accessibilityRole="button"
            accessibilityLabel="New listing"
            style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Search field floating over the bottom edge of the hero. */}
      <View
        style={{
          marginTop: -26, marginHorizontal: space.lg + 2, flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 18, height: 52, ...shadow,
        }}
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="Search your listings"
          placeholderTextColor={colors.placeholder}
          style={{ flex: 1, height: 52, fontSize: 15, color: colors.ink }}
          accessibilityLabel="Search listings"
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  );
}
