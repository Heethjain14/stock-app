import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../../theme';
import type { IconName } from './Button';

export type InlineBannerTone = 'info' | 'warning' | 'error' | 'success';

export type InlineBannerProps = {
  tone?: InlineBannerTone;
  title?: string;
  message: string;
};

const tones: Record<InlineBannerTone, { fg: string; bg: string; icon: IconName }> = {
  info: { fg: colors.primary, bg: colors.primaryTint, icon: 'information-circle' },
  warning: { fg: colors.warning, bg: colors.warningTint, icon: 'warning' },
  error: { fg: colors.danger, bg: colors.dangerTint, icon: 'alert-circle' },
  success: { fg: colors.success, bg: colors.successTint, icon: 'checkmark-circle' },
};

export function InlineBanner({ tone = 'info', title, message }: InlineBannerProps) {
  const t = tones[tone];
  return (
    <View
      style={[styles.box, { backgroundColor: t.bg }]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={t.icon} size={20} color={t.fg} style={styles.icon} />
      <View style={styles.texts}>
        {title ? <Text style={[styles.title, { color: t.fg }]}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radii.md },
  icon: { marginTop: 1 },
  texts: { flex: 1, gap: 2 },
  title: { ...typography.heading },
  message: { ...typography.caption, color: colors.text },
});
