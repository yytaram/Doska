import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../src/auth/store';
import { Screen } from '../../src/components/screen';
import { PrimaryButton } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

export default function HomeScreen() {
  const router = useRouter();
  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);
  const nickname = user?.profile?.nickname ?? 'пользователь';
  const city = user?.profile?.city.nameRu ?? 'Казахстан';

  async function logout() {
    await signOut();
    router.replace('/welcome');
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.kicker}>DOSKA</Text>
          <Text style={styles.title}>Здравствуйте, {nickname}</Text>
        </View>
        <PrimaryButton onPress={() => router.push('/profile')} variant="text">
          Профиль
        </PrimaryButton>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ваш город: {city}</Text>
        <Text style={styles.cardText}>
          Лента объявлений появится в следующем этапе. Сейчас аккаунт и профиль уже подключены к
          API.
        </Text>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Всё готово</Text>
        <Text style={styles.emptyText}>
          Вы вошли в тестовую версию Doska. В следующем этапе добавим ленту и создание объявлений.
        </Text>
      </View>

      <PrimaryButton onPress={logout} variant="secondary">
        Выйти из аккаунта
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#EAF0FF',
    borderRadius: radius.card,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  cardText: { color: '#365070', fontSize: 15, lineHeight: 22 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  content: { gap: spacing.xl, padding: spacing.lg, paddingTop: spacing.md },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  emptyText: { color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  title: { color: colors.ink, fontSize: 27, fontWeight: '900', letterSpacing: -0.5 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
