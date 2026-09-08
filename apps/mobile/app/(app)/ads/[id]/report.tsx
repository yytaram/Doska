import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ApiError, reportAd } from '../../../../src/api/client';
import { useAuthStore } from '../../../../src/auth/store';
import { Screen } from '../../../../src/components/screen';
import { Field, Notice, PrimaryButton, sharedStyles } from '../../../../src/components/ui';
import { spacing } from '../../../../src/theme';

export default function ReportAdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!accessToken || loading) return;
    if (reason.trim().length < 3) return setError('Кратко укажите причину жалобы.');
    setLoading(true);
    setError(null);
    try {
      await reportAd(accessToken, id, {
        reason: reason.trim(),
        details: details.trim() || undefined,
      });
      router.back();
    } catch (caught) {
      setError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : 'Не удалось отправить жалобу.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Жалоба', headerBackTitle: 'Назад' }} />
      <Screen contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={sharedStyles.screenTitle}>Сообщить о нарушении</Text>
          <Text style={sharedStyles.screenSubtitle}>
            Команда Doska проверит объявление. Не указывайте здесь личные данные.
          </Text>
        </View>
        {error ? <Notice>{error}</Notice> : null}
        <Field
          label="Причина"
          value={reason}
          onChangeText={setReason}
          maxLength={80}
          placeholder="Например, запрещённый товар"
        />
        <Field
          label="Подробности (необязательно)"
          value={details}
          onChangeText={setDetails}
          maxLength={2000}
          multiline
          numberOfLines={6}
        />
        <PrimaryButton loading={loading} onPress={() => void submit()}>
          Отправить жалобу
        </PrimaryButton>
      </Screen>
    </>
  );
}
