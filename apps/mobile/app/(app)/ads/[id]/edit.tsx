import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ApiError, getMyAd, updateAd } from '../../../../src/api/client';
import { useAuthStore } from '../../../../src/auth/store';
import { AdForm } from '../../../../src/components/ad-form';
import { CenteredScreen, Screen } from '../../../../src/components/screen';
import { LoadingView, Notice, sharedStyles } from '../../../../src/components/ui';
import { spacing } from '../../../../src/theme';

export default function EditAdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [error, setError] = useState<string | null>(null);
  const adQuery = useQuery({
    queryKey: ['my-ad', id],
    queryFn: () => getMyAd(accessToken!, id),
    enabled: Boolean(accessToken && id),
  });

  if (adQuery.isLoading)
    return (
      <CenteredScreen>
        <LoadingView label="Загружаем объявление…" />
      </CenteredScreen>
    );
  if (!adQuery.data)
    return (
      <Screen contentContainerStyle={{ padding: spacing.lg }}>
        <Notice>Объявление не найдено.</Notice>
      </Screen>
    );
  const ad = adQuery.data;
  const editable = !['closed', 'expired'].includes(ad.status);

  return (
    <>
      <Stack.Screen
        options={{ headerBackTitle: 'Назад', headerShown: true, title: 'Редактирование' }}
      />
      <Screen contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={sharedStyles.screenTitle}>Редактировать запрос</Text>
          <Text style={sharedStyles.screenSubtitle}>
            После изменения опубликованное объявление снова отправится на модерацию.
          </Text>
        </View>
        {editable ? (
          <AdForm
            error={error}
            initial={{
              budget: ad.budget,
              categoryId: ad.category.id,
              cityId: ad.city.id,
              condition: ad.condition,
              description: ad.description,
              title: ad.title,
            }}
            onSubmit={async (input) => {
              if (!accessToken) return;
              setError(null);
              try {
                await updateAd(accessToken, id, input);
                await queryClient.invalidateQueries({ queryKey: ['my-ads'] });
                router.replace('/my-ads');
              } catch (caught: unknown) {
                setError(
                  caught instanceof ApiError || caught instanceof Error
                    ? caught.message
                    : 'Не удалось сохранить объявление.',
                );
              }
            }}
          />
        ) : (
          <Notice>Закрытое или истёкшее объявление нельзя изменить.</Notice>
        )}
      </Screen>
    </>
  );
}
