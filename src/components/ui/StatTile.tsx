import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, toneColors, typography, type Tone } from '../../theme';
import type { IconName } from './Button';

export type StatTileProps = {
  label: string;
  value: string | number;
  tone?: Tone;
  icon?: IconName;
  onPress?: () => void;
};

export function StatTile({ label, value, tone = 'neutral', icon, onPress }: StatTileProps) {
  const t = toneColors[tone];
  const valueColor = tone === 'neutral' ? colors.text : t.fg;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <View style={styles.top}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {icon ? (
          <View style={[styles.icon, { backgroundColor: t.bg }]}>
            <Ionicons name={icon} size={16} color={t.fg} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 88,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md + 2,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  label: { ...typography.label, color: colors.textSecondary, flexShrink: 1 },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  value: { ...typography.display },
});
