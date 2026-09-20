import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

export type ErrorStateProps = {
  message: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  message,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={28} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button title={retryLabel} icon="refresh" variant="secondary" onPress={onRetry} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.dangerTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.heading, color: colors.text, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  action: { marginTop: spacing.md, alignSelf: 'center' },
});
