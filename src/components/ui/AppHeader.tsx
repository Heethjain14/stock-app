import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, spacing, typography } from '../../theme';

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Horizontal padding matching Screen. Set false when placed inside padded content. */
  padded?: boolean;
};

export function AppHeader({ title, subtitle, onBack, right, padded = true }: AppHeaderProps) {
  return (
    <View style={[styles.row, padded && { paddingHorizontal: layout.screenPadding }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  back: {
    width: layout.minTouch,
    height: layout.minTouch,
    marginLeft: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  titles: { flex: 1 },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
