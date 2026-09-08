import { StyleSheet, Text, View } from 'react-native';

import type { Offer, OfferStatus } from '../api/client';
import { colors, radius, spacing } from '../theme';

export const offerStatusLabels: Record<OfferStatus, string> = {
  accepted: 'Принято',
  pending: 'Ожидает решения',
  rejected: 'Отклонено',
  withdrawn: 'Отозвано',
};

export function OfferCard({ offer }: { offer: Offer }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{offer.ad.title}</Text>
        <Text style={styles.status}>{offerStatusLabels[offer.status]}</Text>
      </View>
      <Text style={styles.price}>
        {offer.price === null ? 'Цена договорная' : `${offer.price.toLocaleString('ru-RU')} ₸`}
      </Text>
      {offer.description ? <Text style={styles.description}>{offer.description}</Text> : null}
      <Text style={styles.sender}>
        От: {offer.sender.profile?.nickname ?? 'Пользователь Doska'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  description: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  price: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  sender: { color: colors.muted, fontSize: 13 },
  status: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  title: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '800' },
});
