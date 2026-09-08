import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getChats } from '../../src/api/client';
import { useAuthStore } from '../../src/auth/store';
import { Screen } from '../../src/components/screen';
import { Notice, sharedStyles } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/theme';

export default function ChatsScreen() {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const chats = useQuery({
    queryKey: ['chats'],
    queryFn: () => getChats(accessToken!),
    enabled: Boolean(accessToken),
    refetchInterval: 15_000,
  });

  return (
    <>
      <Stack.Screen options={{ headerBackTitle: 'Назад', headerShown: true, title: 'Чаты' }} />
      <Screen contentContainerStyle={styles.content}>
        <Text style={sharedStyles.screenTitle}>Чаты</Text>
        {chats.isError ? <Notice>Не удалось загрузить чаты.</Notice> : null}
        {chats.isLoading ? <Text style={styles.muted}>Загрузка…</Text> : null}
        {chats.data?.length === 0 ? (
          <Notice tone="info">Чат появится после отправки предложения.</Notice>
        ) : null}
        <View style={styles.list}>
          {chats.data?.map((chat) => (
            <Pressable
              key={chat.id}
              onPress={() => router.push(`/chats/${chat.id}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.row}>
                <Text style={styles.name}>
                  {chat.counterpart.profile?.nickname ?? 'Пользователь Doska'}
                </Text>
                {chat.unreadCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{chat.unreadCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={styles.title}>
                {chat.offer.ad.title}
              </Text>
              <Text numberOfLines={2} style={styles.preview}>
                {chat.lastMessage?.body ?? 'Начните обсуждение предложения'}
              </Text>
            </Pressable>
          ))}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 24,
    minWidth: 24,
    paddingHorizontal: 7,
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  content: { gap: spacing.lg, padding: spacing.lg },
  list: { gap: spacing.md },
  muted: { color: colors.muted },
  name: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.86 },
  preview: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { color: colors.accent, fontSize: 13, fontWeight: '700' },
});
