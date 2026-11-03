import React, { useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type ViewStyle,
  type TextStyle, KeyboardAvoidingView, Platform, type StyleProp,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TAB_BAR_SPACE, colors, font, glow, radius, shadow, space } from '@/theme';
import { STATUS_LABEL } from '@/lib/format';

type IconName = keyof typeof Ionicons.glyphMap;

export function Screen({
  children, scroll = true, edges = ['top'], padded = true, style,
}: { children: React.ReactNode; scroll?: boolean; edges?: Edge[]; padded?: boolean; style?: StyleProp<ViewStyle> }) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.pad, { paddingBottom: TAB_BAR_SPACE + space.lg }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.pad]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.screen, style]} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Page title. `eyebrow` is a small line above the title (for example the user's name).
export function Heading({ title, subtitle, right, eyebrow }: {
  title: string; subtitle?: string; right?: React.ReactNode; eyebrow?: string;
}) {
  return (
    <View style={styles.headRow}>
      <View style={{ flex: 1, paddingRight: space.sm }}>
        {eyebrow ? <Text style={[font.overline, { marginBottom: 6 }]}>{eyebrow}</Text> : null}
        <Text style={font.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={[font.body, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const BUTTON_TONES: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: '#FFFFFF', border: colors.accent },
  secondary: { bg: colors.surface, fg: colors.ink, border: colors.line2 },
  ghost: { bg: 'transparent', fg: colors.ink2, border: 'transparent' },
  danger: { bg: colors.danger50, fg: colors.dangerDark, border: colors.danger50 },
};

export function Button({
  title, onPress, variant = 'primary', loading = false, disabled = false, icon, style, full = false,
}: {
  title: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean;
  icon?: IconName; style?: StyleProp<ViewStyle>; full?: boolean;
}) {
  const isDisabled = disabled || loading;
  const tone = BUTTON_TONES[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: tone.bg, borderColor: tone.border },
        variant === 'primary' && !isDisabled && glow,
        full && { alignSelf: 'stretch' },
        isDisabled && { opacity: 0.45 },
        pressed && !isDisabled && { transform: [{ scale: 0.98 }], opacity: 0.88 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={tone.fg} /> : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={tone.fg} /> : null}
          <Text style={[styles.btnText, { color: tone.fg }]} numberOfLines={1}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// Small square icon button, used for row actions (move, delete, open).
export function IconButton({ icon, onPress, label, color = colors.ink2, disabled = false, tone = 'plain', size = 36 }: {
  icon: IconName; onPress: () => void; label: string; color?: string; disabled?: boolean;
  tone?: 'plain' | 'soft' | 'danger'; size?: number;
}) {
  const bg = { plain: 'transparent', soft: colors.surface3, danger: colors.danger50 }[tone];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size, backgroundColor: bg },
        disabled && { opacity: 0.3 },
        pressed && !disabled && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={tone === 'danger' ? colors.danger : color} />
    </Pressable>
  );
}

export function Field({
  label, value, onChangeText, placeholder, error, hint, multiline, keyboardType, maxLength, counter,
  secureTextEntry, autoCapitalize = 'sentences', autoComplete, onSubmitEditing, editable = true, warning,
}: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; error?: string;
  warning?: string; hint?: string; multiline?: boolean; keyboardType?: 'default' | 'numeric' | 'email-address' | 'decimal-pad';
  maxLength?: number; counter?: { length: number; max: number }; secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words'; autoComplete?: 'email' | 'password' | 'name' | 'off';
  onSubmitEditing?: () => void; editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const over = counter && counter.length > counter.max;
  return (
    <View style={{ gap: 7 }}>
      <View style={styles.fieldTop}>
        <Text style={font.label}>{label}</Text>
        {counter ? <Text style={[styles.counter, over && { color: colors.danger }]}>{counter.length}/{counter.max}</Text> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={!secureTextEntry}
        onSubmitEditing={onSubmitEditing}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.inputFocused,
          !editable && { backgroundColor: colors.surface3, color: colors.muted },
          error && { borderColor: colors.danger, backgroundColor: colors.surface },
          warning && !error && { borderColor: '#E8B04C' },
        ]}
      />
      {error ? (
        <Row style={{ gap: 5 }}>
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text style={[styles.errorText, { flex: 1 }]} accessibilityLiveRegion="polite">{error}</Text>
        </Row>
      ) : warning ? <Text style={[styles.errorText, { color: colors.warn }]}>{warning}</Text>
        : hint ? <Text style={font.small}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style, soft = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; soft?: boolean }) {
  return <View style={[styles.card, soft && styles.cardSoft, style]}>{children}</View>;
}

// Title row for a card, with an optional icon and something on the right (count, badge).
export function CardHeader({ title, subtitle, icon, right }: {
  title: string; subtitle?: string; icon?: IconName; right?: React.ReactNode;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ flex: 1, gap: 10 }}>
          {icon ? <View style={styles.cardIcon}><Ionicons name={icon} size={17} color={colors.accentDark} /></View> : null}
          <Text style={[font.h2, { flexShrink: 1 }]}>{title}</Text>
        </Row>
        {right}
      </Row>
      {subtitle ? <Text style={font.small}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  draft: { bg: colors.surface3, fg: '#6B665D' },
  published: { bg: colors.ok50, fg: colors.okDark },
  failed: { bg: colors.danger50, fg: colors.dangerDark },
  generating: { bg: colors.info50, fg: colors.infoDark },
};

export function StatusBadge({ status }: { status: string }) {
  const t = STATUS_TONES[status] ?? STATUS_TONES.draft;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]} accessibilityLabel={`Status: ${STATUS_LABEL[status] ?? status}`}>
      <View style={[styles.badgeDot, { backgroundColor: t.fg }]} />
      <Text style={[styles.badgeText, { color: t.fg }]}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

const BANNER_TONES = {
  info: { bg: colors.info50, fg: colors.infoDark, border: '#D6E3FD', icon: 'information-circle' as const },
  warn: { bg: colors.warn50, fg: colors.warn, border: '#F6E2B3', icon: 'alert-circle' as const },
  error: { bg: colors.danger50, fg: colors.dangerDark, border: '#F8D3CE', icon: 'close-circle' as const },
  success: { bg: colors.ok50, fg: colors.okDark, border: '#CBEBDB', icon: 'checkmark-circle' as const },
};

export function Banner({ tone, title, text, action }: {
  tone: 'info' | 'warn' | 'error' | 'success'; title?: string; text: string;
  action?: { label: string; onPress: () => void };
}) {
  const t = BANNER_TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityRole="alert">
      <Ionicons name={t.icon} size={19} color={t.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <Text style={{ color: t.fg, fontWeight: '700', fontSize: 14 }}>{title}</Text> : null}
        <Text style={{ color: t.fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
        {action ? (
          <Pressable onPress={action.onPress} accessibilityRole="link" hitSlop={6}>
            <Text style={{ color: t.fg, fontWeight: '700', fontSize: 14, textDecorationLine: 'underline' }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Horizontally scrolling filter chips. The selected chip is solid.
export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.seg, on && styles.segOn]}
          >
            <Text style={[styles.segText, on && { color: '#FFFFFF' }]}>{o.label}</Text>
            {o.count !== undefined ? (
              <View style={[styles.segCount, on && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={[styles.segCountText, on && { color: '#FFFFFF' }]}>{o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// Two to four equal options in one track (like iOS segmented controls).
export function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.trackItem, on && styles.trackItemOn]}
          >
            <Text style={[styles.trackText, on && { color: colors.ink }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Dropdown that opens a bottom sheet. Works the same on iOS, Android and web.
export function Select({ label, value, options, onChange, placeholder = 'Choose', hint, error }: {
  label: string; value: string | null | undefined; options: { value: string; label: string }[];
  onChange: (v: string) => void; placeholder?: string; hint?: string; error?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label;
  return (
    <View style={{ gap: 7 }}>
      <Text style={font.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        style={[styles.input, styles.selectBox, open && styles.inputFocused, error && { borderColor: colors.danger }]}
      >
        <Text style={{ fontSize: 15, color: current ? colors.ink : colors.placeholder, flex: 1 }} numberOfLines={1}>
          {current ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={17} color={colors.muted} />
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : hint ? <Text style={font.small}>{hint}</Text> : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={[font.h2, { marginBottom: space.sm }]}>{label}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {options.map((o) => {
              const on = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => { onChange(o.value); setOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.sheetRow, on && { backgroundColor: colors.accent50 }, pressed && { backgroundColor: colors.surface3 }]}
                >
                  <Text style={{ flex: 1, fontSize: 16, color: on ? colors.accentDark : colors.ink, fontWeight: on ? '600' : '400' }}>{o.label}</Text>
                  {on ? <Ionicons name="checkmark-circle" size={21} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{label}</Text>
        {hint ? <Text style={font.small}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.line2, true: colors.accent }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}

// Tag and keyword input. Return, comma or the add button adds a chip. Tap a chip's x to remove it.
export function ChipInput({ values, onChange, placeholder, maxCount, maxLength, label, hint }: {
  values: string[]; onChange: (v: string[]) => void; placeholder?: string; maxCount?: number;
  maxLength?: number; label: string; hint?: string;
}) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const next = [...values];
    for (const p of parts) {
      if (maxCount && next.length >= maxCount) break;
      if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    if (next.length !== values.length) onChange(next);
    setDraft('');
  };
  return (
    <View style={{ gap: 7 }}>
      <View style={styles.fieldTop}>
        <Text style={font.label}>{label}</Text>
        {maxCount ? <Text style={[styles.counter, values.length > maxCount && { color: colors.danger }]}>{values.length}/{maxCount}</Text> : null}
      </View>
      <View style={[styles.chipBox, focused && styles.inputFocused]}>
        {values.map((v, i) => (
          <Pressable
            key={`${v}-${i}`}
            onPress={() => onChange(values.filter((_, j) => j !== i))}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${v}`}
            style={[styles.chip, maxLength !== undefined && v.length > maxLength ? styles.chipLong : undefined]}
          >
            <Text style={styles.chipText} numberOfLines={1}>{v}</Text>
            <Ionicons name="close" size={13} color={colors.accentDark} />
          </Pressable>
        ))}
        <TextInput
          value={draft}
          onChangeText={(t) => {
            if (/[,\n]/.test(t)) add(t);
            else setDraft(t);
          }}
          onSubmitEditing={() => add(draft)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (draft.trim()) add(draft);
          }}
          placeholder={values.length ? '' : placeholder}
          placeholderTextColor={colors.placeholder}
          returnKeyType="done"
          blurOnSubmit={false}
          style={styles.chipInput}
          accessibilityLabel={`${label} input`}
        />
      </View>
      {hint ? <Text style={font.small}>{hint}</Text> : null}
    </View>
  );
}

export function Empty({ icon, title, text, action }: {
  icon: IconName; title: string; text: string; action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconOuter}>
        <View style={styles.emptyIcon}><Ionicons name={icon} size={28} color={colors.accent} /></View>
      </View>
      <Text style={[font.h2, { textAlign: 'center', fontSize: 18 }]}>{title}</Text>
      <Text style={[font.body, { textAlign: 'center', maxWidth: 300, color: colors.muted }]}>{text}</Text>
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityLabel={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i <= current && { backgroundColor: colors.accent }, i === current && { width: 24 }]} />
      ))}
    </View>
  );
}

// Numbered steps with labels, joined by lines. Finished steps show a check.
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={styles.stepper} accessibilityLabel={`Step ${current + 1} of ${steps.length}: ${steps[current]}`}>
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepNum, done && styles.stepNumDone, on && styles.stepNumOn]}>
                {done ? <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  : <Text style={[styles.stepNumText, on && { color: '#FFFFFF' }]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, (on || done) && { color: colors.ink }]}>{label}</Text>
            </View>
            {i < steps.length - 1 ? <View style={[styles.stepLine, done && { backgroundColor: colors.accent }]} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// Label / value line for summaries.
export function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={[font.small, { fontSize: 14 }]}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.lg + 2, paddingTop: space.lg },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.lg + 4 },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 14.5, lineHeight: 20 },
  btn: {
    minHeight: 50, paddingHorizontal: space.lg + 2, borderRadius: radius.md, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnText: { fontSize: 15.5, fontWeight: '700', letterSpacing: -0.1, flexShrink: 1 },
  iconBtn: { borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  fieldTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  counter: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'], fontWeight: '500' },
  input: {
    minHeight: 50, paddingHorizontal: 15, paddingVertical: 12, borderRadius: radius.sm, borderWidth: 1.5,
    borderColor: colors.line, backgroundColor: colors.surface2, color: colors.ink, fontSize: 15.5,
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.surface },
  multiline: { minHeight: 120, textAlignVertical: 'top', lineHeight: 22 },
  errorText: { fontSize: 12.5, color: colors.danger, fontWeight: '500' },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line,
    padding: space.lg + 2, gap: space.md + 2, ...shadow,
  },
  cardSoft: { backgroundColor: colors.surface2, shadowOpacity: 0, elevation: 0 },
  cardIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.accent50, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...font.overline, marginTop: space.xl, marginBottom: space.sm, marginLeft: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, height: 26, borderRadius: radius.pill },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  banner: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, borderWidth: 1 },
  seg: {
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 38, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  segOn: { borderColor: colors.ink, backgroundColor: colors.ink },
  segText: { fontSize: 13.5, fontWeight: '600', color: colors.ink2 },
  segCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
  segCountText: { fontSize: 11.5, color: colors.ink2, fontWeight: '700' },
  track: { flexDirection: 'row', backgroundColor: colors.surface3, borderRadius: radius.md, padding: 4 },
  trackItem: { flex: 1, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  trackItemOn: { backgroundColor: colors.surface, ...shadow, shadowOpacity: 0.08 },
  trackText: { fontSize: 14.5, fontWeight: '700', color: colors.muted },
  selectBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(23,20,15,0.45)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: space.lg + 2, paddingBottom: space.xxl },
  sheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.line2, marginBottom: space.lg },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, marginBottom: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
  chipBox: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center', minHeight: 50, padding: 9,
    borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface2,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingLeft: 12, paddingRight: 9,
    borderRadius: radius.pill, backgroundColor: colors.accent50, borderWidth: 1, borderColor: colors.accent100,
  },
  chipLong: { backgroundColor: colors.warn50, borderColor: '#F0D28A' },
  chipText: { fontSize: 13.5, fontWeight: '600', color: colors.accentDark, maxWidth: 220 },
  chipInput: { flexGrow: 1, minWidth: 120, height: 32, fontSize: 15, color: colors.ink, paddingHorizontal: 4 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: space.lg },
  emptyIconOuter: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent50, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.accent100, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line2 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, paddingHorizontal: 14 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepNum: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.line2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  stepNumOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepNumDone: { backgroundColor: colors.ink, borderColor: colors.ink },
  stepNumText: { fontSize: 12.5, fontWeight: '700', color: colors.muted },
  stepLabel: { fontSize: 13.5, fontWeight: '700', color: colors.muted },
  stepLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.line, marginHorizontal: 8 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  kvValue: { flex: 1, textAlign: 'right', fontSize: 14.5, fontWeight: '600', color: colors.ink },
});

export type { TextStyle };
