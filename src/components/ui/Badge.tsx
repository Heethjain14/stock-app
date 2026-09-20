import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type BadgeProps = { label: string; tone?: BadgeTone };

const tones: Record<BadgeTone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textSecondary, bg: colors.surfaceMuted },
  success: { fg: colors.success, bg: colors.successTint },
  warning: { fg: colors.warning, bg: colors.warningTint },
  danger: { fg: colors.danger, bg: colors.dangerTint },
  info: { fg: colors.primary, bg: colors.primaryTint },
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]} accessible accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: t.fg }]} />
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...typography.caption, fontWeight: '600', lineHeight: 16 },
});
