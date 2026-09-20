import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radii, spacing, typography } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';
export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const palette = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, pressed: colors.surfaceMuted, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', pressed: colors.primaryTint, fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.danger, pressed: colors.dangerPressed, fg: colors.onPrimary, border: colors.danger },
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        { backgroundColor: pressed ? p.pressed : p.bg, borderColor: p.border },
        fullWidth && styles.full,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={p.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={p.fg} /> : null}
          <Text style={[styles.text, { color: p.fg }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  md: { minHeight: layout.minTouch },
  lg: { minHeight: 52 },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { ...typography.heading },
});
