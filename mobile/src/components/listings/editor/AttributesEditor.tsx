import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Attribute } from '@/lib/types';
import {
  Button, CardHeader, Field, Row,
} from '@/components/ui';
import { colors } from '@/theme';

// Name/value pairs shown on the listing page (material, color, size...).
export function AttributesEditor({ attributes, onChange }: { attributes: Attribute[]; onChange: (next: Attribute[]) => void }) {
  const update = (i: number, patch: Partial<Attribute>) => onChange(attributes.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  return (
    <>
      <CardHeader icon="list-outline" title="Attributes" />
      {attributes.map((a, i) => (
        <Row key={i} style={{ alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Name" value={a.name} onChangeText={(v) => update(i, { name: v })} placeholder="Material" />
          </View>
          <View style={{ flex: 1.4 }}>
            <Field label="Value" value={a.value} onChangeText={(v) => update(i, { value: v })} placeholder="Stoneware" />
          </View>
          <Pressable
            onPress={() => onChange(attributes.filter((_, j) => j !== i))}
            accessibilityLabel={`Remove attribute ${i + 1}`}
            style={{ height: 46, justifyContent: 'center', paddingHorizontal: 4 }}
          >
            <Ionicons name="close-circle-outline" size={22} color={colors.muted} />
          </Pressable>
        </Row>
      ))}
      <Button title="Add attribute" variant="ghost" icon="add" onPress={() => onChange([...attributes, { name: '', value: '' }])} />
    </>
  );
}
