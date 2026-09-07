import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { ApiError, getCities } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';
import { CityPicker } from '../../src/components/city-picker';
import { Screen } from '../../src/components/screen';
import { Field, Notice, PrimaryButton, sharedStyles } from '../../src/components/ui';
import { spacing } from '../../src/theme';

const formSchema = z.object({
  cityId: z.string().uuid('Выберите город.'),
  nickname: z.string().trim().min(2, 'Минимум 2 символа.').max(40, 'Максимум 40 символов.'),
});

type ProfileValues = z.infer<typeof formSchema>;

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const saveProfile = useAuthStore((state) => state.updateProfile);
  const citiesQuery = useQuery({
    queryKey: ['reference', 'cities'],
    queryFn: getCities,
    staleTime: 86_400_000,
  });
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
  } = useForm<ProfileValues>({
    defaultValues: {
      cityId: user?.profile?.city.id ?? '',
      nickname: user?.profile?.nickname ?? '',
    },
    resolver: zodResolver(formSchema),
  });
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(values: ProfileValues) {
    setFormError(null);
    try {
      await saveProfile({
        cityId: values.cityId,
        language: 'ru',
        nickname: values.nickname.trim(),
      });
      router.back();
    } catch (error: unknown) {
      setFormError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Не удалось сохранить профиль.',
      );
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerBackTitle: 'Назад', headerShown: true, title: 'Профиль' }} />
      <Screen contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={sharedStyles.screenTitle}>Ваш профиль</Text>
          <Text style={sharedStyles.screenSubtitle}>Эти данные видны в ваших объявлениях.</Text>
        </View>
        <View style={styles.form}>
          {formError ? <Notice>{formError}</Notice> : null}
          <Controller
            control={control}
            name="nickname"
            render={({ field: { onBlur, onChange, value } }) => (
              <Field
                error={errors.nickname?.message}
                label="Как к вам обращаться"
                maxLength={40}
                onBlur={onBlur}
                onChangeText={onChange}
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
          <PrimaryButton
            disabled={citiesQuery.isLoading}
            loading={isSubmitting}
            onPress={handleSubmit(submit)}
          >
            Сохранить изменения
          </PrimaryButton>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, padding: spacing.lg },
  form: { gap: spacing.md },
  heading: { gap: spacing.sm },
});
