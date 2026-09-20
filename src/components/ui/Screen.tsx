import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../../theme';

export type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  /** Add horizontal padding (default true). */
  padded?: boolean;
  edges?: Edge[];
  /** Fixed content rendered above the scroll area (e.g. AppHeader). */
  header?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  header,
  contentContainerStyle,
}: ScreenProps) {
  const pad = padded ? { paddingHorizontal: layout.screenPadding } : null;
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <KeyboardAvoidingView
        style={[styles.flex, styles.frame]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {header}
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[pad, styles.scrollContent, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, pad, contentContainerStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  // Fills a phone; on tablets/desktops the content stays a readable, centred column.
  frame: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  scrollContent: { paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
});
