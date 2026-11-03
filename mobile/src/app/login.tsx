import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Banner, Card, Field, Row, SegmentedControl } from '@/components/ui';
import { API_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { colors, font, glow, space } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const submit = async () => {
    setError(null);
    const errs: Record<string, string> = {};
    if (mode === 'signup' && name.trim().length < 2) errs.name = 'Enter your name.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (mode === 'signup' && password.length < 8) errs.password = 'Use at least 8 characters.';
    if (mode === 'login' && !password) errs.password = 'Enter your password.';
    setFieldErr(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      if (mode === 'signup') await signUp(name.trim(), email.trim().toLowerCase(), password);
      else await signIn(email.trim().toLowerCase(), password);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 409) {
        setMode('login');
        setError(err.message);
      } else {
        setError(err.message);
      }
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: space.xl, gap: space.xl, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Row style={{ gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...glow }}>
              <Ionicons name="sparkles" size={22} color="#FFFFFF" />
            </View>
            <View>
              <Text style={{ fontSize: 19, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 }}>Velista</Text>
              <Text style={[font.small, { fontSize: 12.5 }]}>AI listings for Etsy sellers</Text>
            </View>
          </Row>

          <View style={{ gap: 8 }}>
            <Text style={font.display} accessibilityRole="header">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={[font.body, { color: colors.muted }]}>
              {mode === 'login'
                ? 'Sign in to manage your Etsy listings from your phone.'
                : 'Turn product photos and videos into published Etsy listings.'}
            </Text>
          </View>

          <SegmentedControl
            options={[{ value: 'login' as const, label: 'Sign in' }, { value: 'signup' as const, label: 'Create account' }]}
            value={mode}
            onChange={(v) => { setMode(v); setError(null); setFieldErr({}); }}
          />

          <Card style={{ gap: space.lg }}>
            {error ? <Banner tone="error" text={error} /> : null}
            {mode === 'signup' ? (
              <Field label="Full name" value={name} onChangeText={setName} placeholder="Ayesha Khan" autoComplete="name" error={fieldErr.name} />
            ) : null}
            <Field
              label="Email" value={email} onChangeText={setEmail} placeholder="you@shop.com" keyboardType="email-address"
              autoCapitalize="none" autoComplete="email" error={fieldErr.email}
            />
            <Field
              label="Password" value={password} onChangeText={setPassword}
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              secureTextEntry autoComplete="password" error={fieldErr.password}
              onSubmitEditing={submit}
            />
            <Button title={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} full style={{ marginTop: 4 }} />
          </Card>

          <View style={{ gap: 10 }}>
            {[
              ['camera-outline', 'Photos or a short video in, a full listing out'],
              ['pricetags-outline', 'SEO title, 13 tags, description and alt text'],
              ['storefront-outline', 'Review, then publish straight to your shop'],
            ].map(([icon, text]) => (
              <Row key={text} style={{ gap: 10 }}>
                <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={17} color={colors.accent} />
                <Text style={[font.small, { fontSize: 13.5, color: colors.ink2 }]}>{text}</Text>
              </Row>
            ))}
          </View>

          <View style={{ marginTop: 'auto' }}>
            <Text style={[font.small, { textAlign: 'center', fontSize: 12 }]}>Server: {API_URL}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
