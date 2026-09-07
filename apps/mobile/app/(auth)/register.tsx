import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { ApiError, getCities } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';
import { CityPicker } from '../../src/components/city-picker';
import { Screen } from '../../src/components/screen';
import { Field, Notice, PrimaryButton, sharedStyles } from '../../src/components/ui';
import { colors, spacing } from '../../src/theme';

const formSchema = z
  .object({
    acceptedMinimumAge: z
      .boolean()
      .refine((value) => value, 'Подтвердите, что вам уже исполнилось 16 лет.'),
    cityId: z.string().uuid('Выберите город.'),
    email: z.string().trim().email('Введите корректный email.'),
    nickname: z.string().trim().min(2, 'Минимум 2 символа.').max(40, 'Максимум 40 символов.'),
    password: z.string().min(12, 'Пароль должен содержать минимум 12 символов.').max(128),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: 'Пароли не совпадают.',
    path: ['passwordConfirmation'],
  });

type RegistrationValues = z.infer<typeof formSchema>;

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);
  const citiesQuery = useQuery({
    queryKey: ['reference', 'cities'],
    queryFn: getCities,
    staleTime: 86_400_000,
  });
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = useForm<RegistrationValues>({
    defaultValues: {
      acceptedMinimumAge: false,
      cityId: '',
      email: '',
      nickname: '',
      password: '',
      passwordConfirmation: '',
    },
    resolver: zodResolver(formSchema),
  });
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(values: RegistrationValues) {
    setFormError(null);
    try {
      await register({
        acceptedMinimumAge: true,
        cityId: values.cityId,
        email: values.email.trim(),
        language: 'ru',
        nickname: values.nickname.trim(),
        password: values.password,
      });
      router.replace('/home');
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Не удалось создать аккаунт.',
      );
    }
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={sharedStyles.screenTitle}>Создайте аккаунт</Text>
        <Text style={sharedStyles.screenSubtitle}>
          Это займёт меньше минуты. Используйте только тестовые данные.
        </Text>
      </View>

      <View style={styles.form}>
        {formError ? <Notice>{formError}</Notice> : null}
        <Controller
          control={control}
          name="nickname"
          render={({ field: { onBlur, onChange, value } }) => (
            <Field
              autoComplete="nickname"
              error={errors.nickname?.message}
              label="Как к вам обращаться"
              maxLength={40}
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Например, Алия"
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="cityId"
          render={({ field: { onChange, value } }) => (
            <CityPicker
              cities={citiesQuery.data ?? []}
              error={errors.cityId?.message}
              isLoading={citiesQuery.isLoading}
              onChange={onChange}
              onRetry={() => void citiesQuery.refetch()}
              value={value}
            />
          )}
        />
        {citiesQuery.isError ? (
          <Notice>Города не загрузились. Проверьте подключение и повторите.</Notice>
        ) : null}
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
              autoComplete="new-password"
              error={errors.password?.message}
              label="Пароль"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Не меньше 12 символов"
              secureTextEntry
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="passwordConfirmation"
          render={({ field: { onBlur, onChange, value } }) => (
            <Field
              autoComplete="new-password"
              error={errors.passwordConfirmation?.message}
              label="Повторите пароль"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Повторите пароль"
              secureTextEntry
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="acceptedMinimumAge"
          render={({ field: { onChange, value } }) => (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: value }}
              onPress={() => onChange(!value)}
              style={styles.ageRow}
            >
              <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                {value ? <Text style={styles.check}>✓</Text> : null}
              </View>
              <Text style={styles.ageText}>Мне уже исполнилось 16 лет.</Text>
            </Pressable>
          )}
        />
        {errors.acceptedMinimumAge?.message ? (
          <Text style={styles.errorText}>{errors.acceptedMinimumAge.message}</Text>
        ) : null}
        <PrimaryButton
          disabled={citiesQuery.isLoading}
          loading={isSubmitting}
          onPress={handleSubmit(submit)}
        >
          Создать аккаунт
        </PrimaryButton>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.bottomText}>Уже зарегистрированы?</Text>
        <PrimaryButton onPress={() => router.replace('/login')} variant="text">
          Войти
        </PrimaryButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ageRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  ageText: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 20 },
  bottom: { alignItems: 'center', paddingTop: spacing.md },
  bottomText: { color: colors.muted, fontSize: 15 },
  checkbox: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  check: { color: colors.white, fontSize: 15, fontWeight: '900' },
  content: { gap: spacing.xl, padding: spacing.lg, paddingTop: spacing.xl },
  errorText: { color: colors.danger, fontSize: 13, marginTop: -spacing.sm },
  form: { gap: spacing.md },
  heading: { gap: spacing.sm },
});
