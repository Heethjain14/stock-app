import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radii, spacing, typography } from '../../theme';

export type SearchBarProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
};

export function SearchBar({ value, onChangeText, placeholder = 'Search', ...rest }: SearchBarProps) {
  return (
    <View style={styles.box}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        {...rest}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={rest.accessibilityLabel ?? placeholder}
        style={styles.input}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={12}
          style={({ pressed }) => [styles.clear, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: layout.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.sm },
  clear: { alignItems: 'center', justifyContent: 'center' },
});
