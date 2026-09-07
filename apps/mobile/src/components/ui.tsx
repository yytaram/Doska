import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '../theme';

export function PrimaryButton({
  children,
  disabled,
  loading,
  onPress,
  variant = 'primary',
}: {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'text';
}) {
  const isDisabled = disabled || loading;
  const buttonStyle = [
    styles.button,
    variant === 'primary' && styles.primaryButton,
    variant === 'secondary' && styles.secondaryButton,
    variant === 'text' && styles.textButton,
    isDisabled && styles.disabledButton,
  ];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [buttonStyle, pressed && !isDisabled && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.white : colors.accent} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' ? styles.primaryButtonText : styles.secondaryButtonText,
            variant === 'text' && styles.textButtonText,
          ]}
        >
          {children}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  error,
  label,
  style,
  ...props
}: TextInputProps & { error?: string; label: string; style?: ViewStyle }) {
  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, error && styles.inputError]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Notice({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'info';
}) {
  return (
    <View style={[styles.notice, tone === 'error' ? styles.errorNotice : styles.infoNotice]}>
      <Text
        style={[
          styles.noticeText,
          tone === 'error' ? styles.errorNoticeText : styles.infoNoticeText,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

export function LoadingView({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg },
  screenTitle: { color: colors.ink, fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  screenSubtitle: { color: colors.muted, fontSize: 16, lineHeight: 23 },
});

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.input,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
  errorNotice: { backgroundColor: '#FFF1ED' },
  errorNoticeText: { color: colors.danger },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  infoNotice: { backgroundColor: '#EFF6FF' },
  infoNoticeText: { color: '#1E40AF' },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: colors.danger },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  loading: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  loadingText: { color: colors.muted, fontSize: 15 },
  notice: { borderRadius: radius.input, padding: 12 },
  noticeText: { fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.86 },
  primaryButton: { backgroundColor: colors.accent },
  primaryButtonText: { color: colors.white },
  secondaryButton: { backgroundColor: '#EAF0FF' },
  secondaryButtonText: { color: colors.accent },
  textButton: { alignSelf: 'center', minHeight: 44 },
  textButtonText: { color: colors.accent },
});
