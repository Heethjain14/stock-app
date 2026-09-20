import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthProvider';
import {
  Button,
  IconButton,
  InlineBanner,
  Screen,
  TextField,
} from '../src/components/ui';
import { colors, radii, spacing, typography } from '../src/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // Root layout guard redirects to "/" once the session is set.
    } catch (e: any) {
      setError(e?.message ?? 'Could not sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll contentContainerStyle={styles.container}>
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Ionicons name="cube-outline" size={32} color={colors.onPrimary} />
        </View>
        <Text style={styles.appName}>StockApp</Text>
        <Text style={styles.tagline}>Track every piece of stock with a scan.</Text>
      </View>

      <View style={styles.form}>
        {error ? <InlineBanner tone="error" title="Sign in failed" message={error} /> : null}
        <TextField
          label="Email"
          placeholder="you@company.com"
          value={email}
          onChangeText={setEmail}
          leftIcon="mail-outline"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!submitting}
          returnKeyType="next"
        />
        <TextField
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          leftIcon="lock-closed-outline"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          editable={!submitting}
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          right={
            <IconButton
              icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              size={20}
              color={colors.textMuted}
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eye}
            />
          }
        />
        <Button
          title="Sign in"
          size="lg"
          fullWidth
          loading={submitting}
          disabled={!canSubmit && !submitting}
          onPress={onSubmit}
        />
      </View>

      <Text style={styles.note}>Accounts are created by your administrator.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', gap: spacing.xl },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  appName: { ...typography.display, color: colors.text },
  tagline: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  form: { gap: spacing.lg },
  eye: { width: 36, height: 36, marginRight: -spacing.xs },
  note: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
