import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getAds, getCategories, getCities, type ItemCondition } from '../../src/api/client';
import { AdCard, conditionLabels } from '../../src/components/ad-card';
import { ReferencePicker } from '../../src/components/reference-picker';
import { Screen } from '../../src/components/screen';
import { Notice, PrimaryButton } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

type FeedFilters = {
  budgetMax?: number;
  budgetMin?: number;
  categoryId?: string;
  cityId?: string;
  condition?: ItemCondition;
  publishedAfter?: string;
  search?: string;
};

const conditionOptions: Array<{ label: string; value?: ItemCondition }> = [
  { label: 'Все' },
  { label: conditionLabels.new, value: 'new' },
  { label: conditionLabels.like_new, value: 'like_new' },
  { label: conditionLabels.good, value: 'good' },
  { label: conditionLabels.fair, value: 'fair' },
  { label: conditionLabels.for_parts, value: 'for_parts' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [draftDateDays, setDraftDateDays] = useState(0);
  const [draft, setDraft] = useState<FeedFilters>({});
  const [filters, setFilters] = useState<FeedFilters>({});
  const categoriesQuery = useQuery({
    queryKey: ['reference', 'categories'],
    queryFn: getCategories,
    staleTime: 86_400_000,
  });
  const citiesQuery = useQuery({
    queryKey: ['reference', 'cities'],
    queryFn: getCities,
    staleTime: 86_400_000,
  });
  const adsQuery = useInfiniteQuery({
    queryKey: ['ads', filters],
    queryFn: ({ pageParam }) => getAds({ ...filters, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const ads = adsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  function applyFilters() {
    setFilters({ ...draft, search: search.trim() || undefined });
    setShowFilters(false);
  }

  function resetFilters() {
    setSearch('');
    setDraftDateDays(0);
    setDraft({});
    setFilters({});
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>DOSKA</Text>
          <Text style={styles.title}>Что вы ищете?</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/chats')}>
            <Text style={styles.profile}>Чаты</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/profile')}>
            <Text style={styles.profile}>Профиль</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          onChangeText={setSearch}
          onSubmitEditing={applyFilters}
          placeholder="Например, iPhone 15"
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          style={styles.search}
          value={search}
        />
        <Pressable onPress={() => setShowFilters((value) => !value)} style={styles.filterButton}>
          <Text style={styles.filterButtonText}>Фильтры</Text>
        </Pressable>
      </View>

      {showFilters ? (
        <View style={styles.filters}>
          <ReferencePicker
            items={(categoriesQuery.data ?? []).map((item) => ({
              id: item.id,
              nameRu: item.nameRu,
            }))}
            label="Категория"
            onChange={(categoryId) => setDraft((value) => ({ ...value, categoryId }))}
            placeholder="Все категории"
            value={draft.categoryId}
          />
          <ReferencePicker
            items={(citiesQuery.data ?? []).map((item) => ({
              id: item.id,
              nameRu: item.nameRu,
              subtitle: item.regionRu,
            }))}
            label="Город"
            onChange={(cityId) => setDraft((value) => ({ ...value, cityId }))}
            placeholder="Весь Казахстан"
            value={draft.cityId}
          />
          <View>
            <Text style={styles.label}>Бюджет, ₸</Text>
            <View style={styles.budgetRow}>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    budgetMin: value ? Number(value) : undefined,
                  }))
                }
                placeholder="От"
                placeholderTextColor={colors.placeholder}
                style={styles.budgetInput}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    budgetMax: value ? Number(value) : undefined,
                  }))
                }
                placeholder="До"
                placeholderTextColor={colors.placeholder}
                style={styles.budgetInput}
              />
            </View>
          </View>
          <View>
            <Text style={styles.label}>Состояние</Text>
            <View style={styles.chips}>
              {conditionOptions.map((option) => (
                <Pressable
                  key={option.label}
                  onPress={() => setDraft((value) => ({ ...value, condition: option.value }))}
                  style={[styles.chip, draft.condition === option.value && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      draft.condition === option.value && styles.chipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View>
            <Text style={styles.label}>Дата публикации</Text>
            <View style={styles.chips}>
              {[
                { label: 'За всё время', days: 0 },
                { label: '7 дней', days: 7 },
                { label: '30 дней', days: 30 },
              ].map(({ days, label }) => {
                const selected = draftDateDays === days;
                return (
                  <Pressable
                    key={label}
                    onPress={() => {
                      setDraftDateDays(days);
                      setDraft((value) => ({
                        ...value,
                        publishedAfter: days ? dateFromDays(days) : undefined,
                      }));
                    }}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.actions}>
            <PrimaryButton onPress={resetFilters} variant="secondary">
              Сбросить
            </PrimaryButton>
            <PrimaryButton onPress={applyFilters}>Показать</PrimaryButton>
          </View>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Новые запросы</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/my-offers')}>
            <Text style={styles.link}>Мои предложения</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/my-ads')}>
            <Text style={styles.link}>Мои объявления</Text>
          </Pressable>
        </View>
      </View>

      {adsQuery.isError ? (
        <Notice>Не удалось загрузить объявления. Проверьте API и повторите.</Notice>
      ) : null}
      {adsQuery.isLoading ? <Text style={styles.muted}>Загружаем объявления…</Text> : null}
      {ads.length === 0 && !adsQuery.isLoading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Пока ничего не найдено</Text>
          <Text style={styles.muted}>Измените фильтры или создайте первый запрос.</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        {ads.map((ad) => (
          <AdCard ad={ad} key={ad.id} onPress={() => router.push(`/ads/${ad.id}`)} />
        ))}
      </View>
      {adsQuery.hasNextPage ? (
        <PrimaryButton
          loading={adsQuery.isFetchingNextPage}
          onPress={() => void adsQuery.fetchNextPage()}
          variant="secondary"
        >
          Загрузить ещё
        </PrimaryButton>
      ) : null}
      <PrimaryButton onPress={() => router.push('/ads/create')}>+ Создать запрос</PrimaryButton>
    </Screen>
  );
}

function dateFromDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  budgetInput: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  budgetRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  content: { gap: spacing.lg, padding: spacing.lg, paddingTop: spacing.md },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  filterButton: {
    alignItems: 'center',
    backgroundColor: '#EAF0FF',
    borderRadius: radius.input,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  filterButtonText: { color: colors.accent, fontWeight: '800' },
  filters: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerActions: { alignItems: 'flex-end', gap: spacing.sm },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  link: { color: colors.accent, fontSize: 14, fontWeight: '800' },
  list: { gap: spacing.md },
  muted: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  profile: { color: colors.accent, fontSize: 15, fontWeight: '800' },
  search: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900' },
});
