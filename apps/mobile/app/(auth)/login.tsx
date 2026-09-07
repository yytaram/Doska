import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { ApiError } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';
import { Screen } from '../../src/components/screen';
import { Field, Notice, PrimaryButton, sharedStyles } from '../../src/components/ui';
import { spacing } from '../../src/theme';

const formSchema = z.object({
  email: z.string().trim().email('Введите корректный email.'),
  password: z.string().min(1, 'Введите пароль.'),
});

type LoginValues = z.infer<typeof formSchema>;

export default function LoginScreen() {
  const router = useRouter();
  const signIn = useAuthStore((state) => state.signIn);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(formSchema),
  });
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(values: LoginValues) {
    setFormError(null);
    try {
      await signIn({ email: values.email.trim(), password: values.password });
      router.replace('/home');
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError || error instanceof Error ? error.message : 'Не удалось войти.',
      );
    }
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={sharedStyles.screenTitle}>С возвращением</Text>
        <Text style={sharedStyles.screenSubtitle}>Войдите, чтобы продолжить работу с Doska.</Text>
      </View>

      <View style={styles.form}>
        {formError ? <Notice>{formError}</Notice> : null}
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <Field
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email?.message}
              keyboardType="email-address"
              label="Email"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="name@example.com"
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <Field
              autoComplete="password"
              error={errors.password?.message}
              label="Пароль"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Ваш пароль"
              secureTextEntry
              value={value}
            />
          )}
        />
        <PrimaryButton loading={isSubmitting} onPress={handleSubmit(submit)}>
          Войти
        </PrimaryButton>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.bottomText}>Нет аккаунта?</Text>
        <PrimaryButton onPress={() => router.replace('/register')} variant="text">
          Создать аккаунт
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bottom: { alignItems: 'center', marginTop: 'auto', paddingTop: spacing.xl },
  bottomText: { color: '#667085', fontSize: 15 },
  content: { gap: spacing.xl, padding: spacing.lg, paddingTop: 72 },
  form: { gap: spacing.md },
  heading: { gap: spacing.sm },
});
