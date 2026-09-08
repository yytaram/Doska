import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ApiError, createOffer } from '../../../../src/api/client';
import { useAuthStore } from '../../../../src/auth/store';
import { Screen } from '../../../../src/components/screen';
import { Field, Notice, PrimaryButton, sharedStyles } from '../../../../src/components/ui';
import { spacing } from '../../../../src/theme';

export default function CreateOfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!accessToken || loading) return;
    if (description.trim().length < 5) {
      setError('Опишите товар хотя бы в пяти символах.');
      return;
    }
    if (price && !/^\d+$/.test(price)) {
      setError('Введите цену целым числом в тенге.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const offer = await createOffer(accessToken, id, {
        description: description.trim(),
        price: price ? Number(price) : null,
      });
      router.replace(`/chats/${offer.chat.id}`);
    } catch (caught: unknown) {
      setError(
        caught instanceof ApiError || caught instanceof Error
          ? caught.message
          : 'Не удалось отправить предложение.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{ headerBackTitle: 'Назад', headerShown: true, title: 'Предложение' }}
      />
      <Screen contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={sharedStyles.screenTitle}>Предложить товар</Text>
          <Text style={sharedStyles.screenSubtitle}>
            После отправки откроется чат с покупателем.
          </Text>
        </View>
        {error ? <Notice>{error}</Notice> : null}
        <Field
          keyboardType="number-pad"
          label="Цена, ₸ (необязательно)"
          onChangeText={setPrice}
          placeholder="Например, 250000"
          value={price}
        />
        <Field
          label="Описание товара"
          maxLength={1000}
          multiline
          numberOfLines={6}
          onChangeText={setDescription}
          placeholder="Состояние, комплект и другие важные детали"
          value={description}
        />
        <PrimaryButton loading={loading} onPress={() => void submit()}>
          Отправить и открыть чат
        </PrimaryButton>
      </Screen>
    </>
  );
}
