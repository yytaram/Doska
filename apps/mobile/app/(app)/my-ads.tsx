import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { closeAd, getMyAds } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';
import { AdCard } from '../../src/components/ad-card';
import { Screen } from '../../src/components/screen';
import { Notice, PrimaryButton, sharedStyles } from '../../src/components/ui';
import { spacing } from '../../src/theme';

export default function MyAdsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const ads = useQuery({
    queryKey: ['my-ads'],
    queryFn: () => getMyAds(accessToken!),
    enabled: Boolean(accessToken),
  });
  const closeMutation = useMutation({
    mutationFn: (id: string) => closeAd(accessToken!, id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-ads'] }),
        queryClient.invalidateQueries({ queryKey: ['ads'] }),
      ]);
    },
  });

  function confirmClose(id: string) {
    Alert.alert('Закрыть объявление?', 'Открыть его снова будет нельзя.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Закрыть', style: 'destructive', onPress: () => closeMutation.mutate(id) },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{ headerBackTitle: 'Назад', headerShown: true, title: 'Мои объявления' }}
      />
      <Screen contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={sharedStyles.screenTitle}>Мои объявления</Text>
          <Text style={sharedStyles.screenSubtitle}>
            Черновики, модерация и опубликованные запросы.
          </Text>
        </View>
        <PrimaryButton onPress={() => router.push('/ads/create')}>+ Создать запрос</PrimaryButton>
        {ads.isError || closeMutation.isError ? (
          <Notice>Не удалось выполнить действие. Повторите позже.</Notice>
        ) : null}
        {ads.isLoading ? <Text>Загрузка…</Text> : null}
        {ads.data?.items.length === 0 ? (
          <Notice tone="info">У вас ещё нет объявлений.</Notice>
        ) : null}
        <View style={styles.list}>
          {ads.data?.items.map((ad) => (
            <View key={ad.id} style={styles.item}>
              <AdCard ad={ad} onPress={() => router.push(`/ads/${ad.id}/edit`)} showStatus />
              <View style={styles.actions}>
                {ad.status !== 'closed' && ad.status !== 'expired' ? (
                  <PrimaryButton
                    onPress={() => router.push(`/ads/${ad.id}/edit`)}
                    variant="secondary"
                  >
                    Редактировать
                  </PrimaryButton>
                ) : null}
                {ad.status !== 'closed' ? (
                  <PrimaryButton
                    disabled={closeMutation.isPending}
                    onPress={() => confirmClose(ad.id)}
                    variant="text"
                  >
                    Закрыть
                  </PrimaryButton>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.xs },
  content: { gap: spacing.lg, padding: spacing.lg },
  heading: { gap: spacing.sm },
  item: { gap: spacing.sm },
  list: { gap: spacing.lg },
});
