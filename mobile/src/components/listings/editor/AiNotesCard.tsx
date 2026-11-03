import React from 'react';
import { Text, View } from 'react-native';
import { money } from '@/lib/format';
import type { Analysis } from '@/lib/types';
import {
  Banner, Button, Card, CardHeader, Pill, Row,
} from '@/components/ui';
import { colors, font, radius } from '@/theme';

const sourceLabel = (a: Analysis) => {
  if (a.source !== 'ai') return 'Template';
  return a.provider === 'anthropic' ? 'Claude Vision' : 'OpenAI Vision';
};

// What the AI noticed: voice transcript, suggested price and warnings.
export function AiNotesCard({ analysis, suggestedPrice, pricingNote, onUsePrice }: {
  analysis: Analysis; suggestedPrice: number | null; pricingNote: string; onUsePrice: (price: number) => void;
}) {
  return (
    <Card>
      <CardHeader icon="sparkles-outline" title="AI notes" right={<Pill label={sourceLabel(analysis)} tone={analysis.source === 'ai' ? 'accent' : 'neutral'} />} />
      {analysis.source === 'template' ? (
        <Text style={font.small}>Written from the details you entered. Add an AI key on the server to let Velista read your photos.</Text>
      ) : null}
      {analysis.transcript ? <Text style={[font.body, { fontStyle: 'italic' }]}>“{analysis.transcript.slice(0, 280)}”</Text> : null}
      {suggestedPrice ? (
        <Row style={{
          justifyContent: 'space-between', backgroundColor: colors.accent50, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent100,
        }}
        >
          <View>
            <Text style={font.small}>Suggested price</Text>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{money(suggestedPrice)}</Text>
          </View>
          <Button title="Use it" variant="secondary" onPress={() => onUsePrice(suggestedPrice)} style={{ minHeight: 38, paddingHorizontal: 14 }} />
        </Row>
      ) : null}
      {pricingNote ? <Text style={font.small}>{pricingNote}</Text> : null}
      {(analysis.warnings ?? []).map((w) => <Banner key={w} tone="warn" text={w} />)}
    </Card>
  );
}
