import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radii, spacing, typography } from '../../theme';
import type { IconName } from './Button';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  leadingIcon?: IconName;
  /** Custom trailing content (e.g. a StockStatusBadge). */
  right?: React.ReactNode;
  /** Show a chevron (default: true when onPress is set). */
  chevron?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function ListRow({
  title,
  subtitle,
  leadingIcon,
  right,
  chevron,
  onPress,
  accessibilityLabel,
}: ListRowProps) {
  const showChevron = chevron ?? !!onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {leadingIcon ? (
        <View style={styles.lead}>
          <Ionicons name={leadingIcon} size={20} color={colors.primary} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {showChevron ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouch + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  lead: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
  title: { ...typography.heading, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
});
