import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Ad } from '../api/client';
import { colors, radius, spacing } from '../theme';

export const conditionLabels = {
  any: 'Любое состояние',
  new: 'Новое',
  like_new: 'Как новое',
  good: 'Хорошее',
  fair: 'Удовлетворительное',
  for_parts: 'На запчасти',
} as const;

export const statusLabels = {
  active: 'Активно',
  closed: 'Закрыто',
  draft: 'Черновик',
  expired: 'Истекло',
  moderation: 'На модерации',
  paused: 'Приостановлено',
  rejected: 'Отклонено',
} as const;

export function formatBudget(value: number | null) {
  return value === null
    ? 'Бюджет не указан'
    : `до ${new Intl.NumberFormat('ru-RU').format(value)} ₸`;
}

export function AdCard({
  ad,
  onPress,
  showStatus = false,
}: {
  ad: Ad;
  onPress: () => void;
  showStatus?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <Text numberOfLines={2} style={styles.title}>
          {ad.title}
        </Text>
        {showStatus ? <Text style={styles.status}>{statusLabels[ad.status]}</Text> : null}
      </View>
      <Text style={styles.budget}>{formatBudget(ad.budget)}</Text>
      <Text numberOfLines={2} style={styles.description}>
        {ad.description}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{ad.city.nameRu}</Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.metaText}>{ad.category.nameRu}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  budget: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  dot: { color: colors.placeholder },
  meta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  metaText: { color: colors.muted, fontSize: 13 },
  pressed: { opacity: 0.84 },
  status: {
    backgroundColor: '#EAF0FF',
    borderRadius: radius.pill,
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  title: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: '800', lineHeight: 23 },
  top: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
});
