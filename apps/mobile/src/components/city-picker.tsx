import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { City } from '../api/client';
import { colors, radius, spacing } from '../theme';

export function CityPicker({
  cities,
  error,
  isLoading,
  onChange,
  onRetry,
  value,
}: {
  cities: City[];
  error?: string;
  isLoading: boolean;
  onChange: (cityId: string) => void;
  onRetry: () => void;
  value?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = cities.find((city) => city.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  const filteredCities = useMemo(
    () =>
      cities.filter((city) =>
        `${city.nameRu} ${city.regionRu}`.toLocaleLowerCase('ru-RU').includes(normalizedQuery),
      ),
    [cities, normalizedQuery],
  );

  function choose(city: City) {
    onChange(city.id);
    setIsOpen(false);
    setQuery('');
  }

  return (
    <View>
      <Text style={styles.label}>Город</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={[styles.select, error && styles.selectError]}
      >
        <Text style={selected ? styles.selectedText : styles.placeholderText}>
          {selected ? `${selected.nameRu}, ${selected.regionRu}` : 'Выберите город'}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal animationType="slide" onRequestClose={() => setIsOpen(false)} visible={isOpen}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Выберите город</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsOpen(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>Готово</Text>
            </Pressable>
          </View>
          <TextInput
            autoFocus
            onChangeText={setQuery}
            placeholder="Поиск по городу или области"
            placeholderTextColor={colors.placeholder}
            style={styles.search}
            value={query}
          />
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.muted}>Загружаем города…</Text>
            </View>
          ) : cities.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.muted}>Не удалось загрузить города.</Text>
              <Pressable onPress={onRetry} style={styles.retryButton}>
                <Text style={styles.retryText}>Повторить</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filteredCities}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              keyExtractor={(city) => city.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>Ничего не найдено.</Text>}
              renderItem={({ item }) => (
                <Pressable onPress={() => choose(item)} style={styles.cityRow}>
                  <View>
                    <Text style={styles.cityName}>{item.nameRu}</Text>
                    <Text style={styles.regionName}>{item.regionRu}</Text>
                  </View>
                  {item.id === value ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center' },
  check: { color: colors.accent, fontSize: 20, fontWeight: '800' },
  chevron: { color: colors.muted, fontSize: 22 },
  cityName: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  cityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
  },
  closeButton: { paddingVertical: spacing.sm },
  closeText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  empty: { color: colors.muted, padding: spacing.lg, textAlign: 'center' },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18, marginTop: spacing.xs },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  modal: { backgroundColor: colors.background, flex: 1 },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
  },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 15 },
  placeholderText: { color: colors.placeholder, flex: 1, fontSize: 16 },
  regionName: { color: colors.muted, fontSize: 13, marginTop: 2 },
  retryButton: { padding: spacing.sm },
  retryText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  search: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    margin: spacing.lg,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  select: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  selectedText: { color: colors.ink, flex: 1, fontSize: 16 },
  selectError: { borderColor: colors.danger },
  separator: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth },
});
