import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { getAd } from '../../../src/api/client';
import { useAuthStore } from '../../../src/auth/store';
import { conditionLabels, formatBudget } from '../../../src/components/ad-card';
import { CenteredScreen, Screen } from '../../../src/components/screen';
import { LoadingView, Notice, PrimaryButton } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/theme';

export default function AdDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const adQuery = useQuery({
    queryKey: ['ad', id],
    queryFn: () => getAd(id),
    enabled: Boolean(id),
  });

  if (adQuery.isLoading)
    return (
      <CenteredScreen>
        <LoadingView label="Загружаем объявление…" />
      </CenteredScreen>
    );
  if (!adQuery.data)
    return (
      <Screen contentContainerStyle={styles.content}>
        <Notice>Объявление недоступно или уже закрыто.</Notice>
      </Screen>
    );
  const ad = adQuery.data;

  return (
    <>
      <Stack.Screen
        options={{ headerBackTitle: 'Назад', headerShown: true, title: 'Объявление' }}
      />
      <Screen contentContainerStyle={styles.content}>
        <Text style={styles.category}>{ad.category.nameRu}</Text>
        <Text style={styles.title}>{ad.title}</Text>
        <Text style={styles.budget}>{formatBudget(ad.budget)}</Text>
        <View style={styles.metaCard}>
          <Meta label="Город" value={ad.city.nameRu} />
          <Meta label="Состояние" value={conditionLabels[ad.condition]} />
          <Meta
            label="Опубликовано"
            value={new Date(ad.publishedAt ?? ad.createdAt).toLocaleDateString('ru-RU')}
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Описание</Text>
          <Text style={styles.description}>{ad.description}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Покупатель</Text>
          <Text style={styles.description}>
            {ad.owner.profile?.nickname ?? 'Пользователь Doska'}
          </Text>
        </View>
        {ad.owner.id === userId ? (
          <PrimaryButton onPress={() => router.push(`/ads/${ad.id}/offers`)}>
            Посмотреть предложения
          </PrimaryButton>
        ) : (
          <PrimaryButton onPress={() => router.push(`/ads/${ad.id}/offer`)}>
            Предложить товар
          </PrimaryButton>
        )}
        {ad.owner.id !== userId ? (
          <PrimaryButton variant="text" onPress={() => router.push(`/ads/${ad.id}/report`)}>
            Пожаловаться на объявление
          </PrimaryButton>
        ) : null}
      </Screen>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  budget: { color: colors.accent, fontSize: 24, fontWeight: '900' },
  category: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  content: { gap: spacing.lg, padding: spacing.lg },
  description: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  metaCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    gap: spacing.md,
    padding: spacing.md,
  },
  metaLabel: { color: colors.muted, fontSize: 14 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaValue: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', lineHeight: 36 },
});
