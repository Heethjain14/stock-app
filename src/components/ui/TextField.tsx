import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radii, spacing, typography } from '../../theme';
import type { IconName } from './Button';

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  /** Custom right-side element (e.g. an IconButton); overrides rightIcon. */
  right?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export function TextField({
  label,
  error,
  hint,
  leftIcon,
  right,
  rightIcon,
  multiline,
  containerStyle,
  onFocus,
  onBlur,
  style,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          multiline ? styles.boxMulti : styles.boxSingle,
          { borderColor },
          rest.editable === false && styles.readonly,
        ]}
      >
        {leftIcon ? <Ionicons name={leftIcon} size={18} color={colors.textMuted} /> : null}
        <TextInput
          {...rest}
          multiline={multiline}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMulti, style]}
        />
        {right ?? (rightIcon ? <Ionicons name={rightIcon} size={18} color={colors.textMuted} /> : null)}
      </View>
      {error ? (
        <Text style={[styles.helper, { color: colors.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.helper, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs + 2 },
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  boxSingle: { minHeight: layout.minTouch + 4, alignItems: 'center' },
  boxMulti: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  readonly: { backgroundColor: colors.surfaceMuted },
  input: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  helper: { ...typography.caption, marginTop: spacing.xs },
});
