import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { getSentOffers, withdrawOffer } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';
import { OfferCard } from '../../src/components/offer-card';
import { Screen } from '../../src/components/screen';
import { Notice, PrimaryButton, sharedStyles } from '../../src/components/ui';
import { spacing } from '../../src/theme';

export default function MyOffersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const offers = useQuery({
    queryKey: ['offers', 'sent'],
    queryFn: () => getSentOffers(accessToken!),
    enabled: Boolean(accessToken),
  });
  const withdraw = useMutation({
    mutationFn: (offerId: string) => withdrawOffer(accessToken!, offerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });

  return (
    <>
      <Stack.Screen
        options={{ headerBackTitle: 'Назад', headerShown: true, title: 'Мои предложения' }}
      />
      <Screen contentContainerStyle={styles.content}>
        <Text style={sharedStyles.screenTitle}>Мои предложения</Text>
        {offers.isError || withdraw.isError ? (
          <Notice>Не удалось выполнить действие. Повторите позже.</Notice>
        ) : null}
        {offers.isLoading ? <Text>Загрузка…</Text> : null}
        {offers.data?.items.length === 0 ? (
          <Notice tone="info">Вы ещё не отправляли предложений.</Notice>
        ) : null}
        <View style={styles.list}>
          {offers.data?.items.map((offer) => (
            <View key={offer.id} style={styles.item}>
              <OfferCard offer={offer} />
              <PrimaryButton
                onPress={() => router.push(`/chats/${offer.chat.id}`)}
                variant="secondary"
              >
                Открыть чат
              </PrimaryButton>
              {offer.status === 'pending' ? (
                <PrimaryButton
                  disabled={withdraw.isPending}
                  onPress={() => withdraw.mutate(offer.id)}
                  variant="text"
                >
                  Отозвать предложение
                </PrimaryButton>
              ) : null}
            </View>
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg },
  item: { gap: spacing.sm },
  list: { gap: spacing.lg },
});
