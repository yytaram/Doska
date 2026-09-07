import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../src/components/screen';
import { PrimaryButton } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Text style={styles.markText}>D</Text>
        </View>
        <Text style={styles.title}>Doska</Text>
        <Text style={styles.subtitle}>
          Находите то, что нужно — через предложения от продавцов.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Как это работает</Text>
        <Text style={styles.cardText}>1. Расскажите, что хотите купить.</Text>
        <Text style={styles.cardText}>2. Получайте предложения от людей, у которых это есть.</Text>
        <Text style={styles.cardText}>3. Выберите подходящее и договоритесь в чате.</Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton onPress={() => router.push('/register')}>Создать аккаунт</PrimaryButton>
        <PrimaryButton onPress={() => router.push('/login')} variant="secondary">
          У меня уже есть аккаунт
        </PrimaryButton>
        <Text style={styles.footnote}>
          Тестовая версия для Казахстана. Используйте только тестовые данные.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md, marginTop: 'auto' },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  cardText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: spacing.xs },
  content: { gap: spacing.xl, padding: spacing.lg },
  footnote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  mark: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.card,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  markText: { color: colors.white, fontSize: 37, fontWeight: '900' },
  subtitle: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 26,
    maxWidth: 330,
    textAlign: 'center',
  },
  title: { color: colors.ink, fontSize: 38, fontWeight: '900', letterSpacing: -1 },
});
