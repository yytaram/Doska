import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';

interface ReferenceItem {
  id: string;
  nameRu: string;
  subtitle?: string;
}

export function ReferencePicker({
  error,
  items,
  label,
  onChange,
  placeholder,
  value,
}: {
  error?: string;
  items: ReferenceItem[];
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = items.find((item) => item.id === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.nameRu} ${item.subtitle ?? ''}`.toLocaleLowerCase('ru').includes(normalized),
    );
  }, [items, query]);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.trigger, error && styles.errorBorder]}
      >
        <View style={styles.triggerText}>
          <Text style={selected ? styles.value : styles.placeholder}>
            {selected?.nameRu ?? placeholder}
          </Text>
          {selected?.subtitle ? <Text style={styles.subtitle}>{selected.subtitle}</Text> : null}
        </View>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal animationType="slide" onRequestClose={() => setOpen(false)} visible={open}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{label}</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text style={styles.done}>Готово</Text>
            </Pressable>
          </View>
          <TextInput
            autoFocus
            onChangeText={setQuery}
            placeholder="Поиск"
            placeholderTextColor={colors.placeholder}
            style={styles.search}
            value={query}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                  setQuery('');
                }}
                style={styles.row}
              >
                <View style={styles.triggerText}>
                  <Text style={styles.value}>{item.nameRu}</Text>
                  {item.subtitle ? <Text style={styles.subtitle}>{item.subtitle}</Text> : null}
                </View>
                {item.id === value ? <Text style={styles.done}>✓</Text> : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chevron: { color: colors.muted, fontSize: 20 },
  done: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.xs },
  errorBorder: { borderColor: colors.danger },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  modal: { backgroundColor: colors.background, flex: 1 },
  placeholder: { color: colors.placeholder, fontSize: 16 },
  row: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 66,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  search: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    marginBottom: spacing.md,
    marginHorizontal: spacing.lg,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  trigger: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.input,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  triggerText: { flex: 1 },
  value: { color: colors.ink, fontSize: 16, fontWeight: '600' },
});
