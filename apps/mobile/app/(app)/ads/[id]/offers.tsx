import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { acceptOffer, getAdOffers, rejectOffer } from '../../../../src/api/client';
import { useAuthStore } from '../../../../src/auth/store';
import { OfferCard } from '../../../../src/components/offer-card';
import { Screen } from '../../../../src/components/screen';
import { Notice, PrimaryButton, sharedStyles } from '../../../../src/components/ui';
import { spacing } from '../../../../src/theme';

export default function AdOffersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const offers = useQuery({
    queryKey: ['offers', 'ad', id],
    queryFn: () => getAdOffers(accessToken!, id),
    enabled: Boolean(accessToken && id),
  });
  const decision = useMutation({
    mutationFn: ({ action, offerId }: { action: 'accept' | 'reject'; offerId: string }) =>
      action === 'accept' ? acceptOffer(accessToken!, offerId) : rejectOffer(accessToken!, offerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['offers'] });
    },
  });

  return (
    <>
      <Stack.Screen
        options={{ headerBackTitle: 'Назад', headerShown: true, title: 'Предложения' }}
      />
      <Screen contentContainerStyle={styles.content}>
        <Text style={sharedStyles.screenTitle}>Предложения продавцов</Text>
        {offers.isError || decision.isError ? (
          <Notice>Не удалось выполнить действие. Повторите позже.</Notice>
        ) : null}
        {offers.isLoading ? <Text>Загрузка…</Text> : null}
        {offers.data?.items.length === 0 ? (
          <Notice tone="info">Предложений пока нет.</Notice>
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
                <View style={styles.actions}>
                  <PrimaryButton
                    disabled={decision.isPending}
                    onPress={() => decision.mutate({ action: 'accept', offerId: offer.id })}
                  >
                    Принять
                  </PrimaryButton>
                  <PrimaryButton
                    disabled={decision.isPending}
                    onPress={() => decision.mutate({ action: 'reject', offerId: offer.id })}
                    variant="secondary"
                  >
                    Отклонить
                  </PrimaryButton>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  content: { gap: spacing.lg, padding: spacing.lg },
  item: { gap: spacing.sm },
  list: { gap: spacing.lg },
});
