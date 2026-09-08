import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Socket } from 'socket.io-client';

import {
  blockUser,
  getChatMessages,
  getChats,
  markChatRead,
  sendChatMessage,
  unblockUser,
  type ChatMessage,
} from '../../../src/api/client';
import { useAuthStore } from '../../../src/auth/store';
import { createChatSocket } from '../../../src/chat/socket';
import { Screen } from '../../../src/components/screen';
import { Notice, PrimaryButton } from '../../../src/components/ui';
import { colors, radius, spacing } from '../../../src/theme';

type SocketAck = { error?: { message: string }; message?: ChatMessage; ok?: true };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const chats = useQuery({
    queryKey: ['chats'],
    queryFn: () => getChats(accessToken!),
    enabled: Boolean(accessToken),
  });
  const chat = chats.data?.find((item) => item.id === id);
  const messages = useInfiniteQuery({
    queryKey: ['chat-messages', id],
    queryFn: ({ pageParam }) => getChatMessages(accessToken!, id, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(accessToken && id),
  });
  const orderedMessages = (messages.data?.pages.flatMap((page) => page.items) ?? []).reverse();

  useEffect(() => {
    if (!accessToken || !id) return;
    const socket = createChatSocket(accessToken);
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('chat:join', { id }, (result: SocketAck) => {
        if (result.error) setError(result.error.message);
      });
    });
    socket.on('message:new', () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-messages', id] });
      void queryClient.invalidateQueries({ queryKey: ['chats'] });
      void markChatRead(accessToken, id).catch(() => undefined);
    });
    socket.on('connect_error', () => setError('Не удалось подключить чат в реальном времени.'));
    void markChatRead(accessToken, id).then(() =>
      queryClient.invalidateQueries({ queryKey: ['chats'] }),
    );
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, id, queryClient]);

  async function submit() {
    const value = body.trim();
    if (!accessToken || !value || sending) return;
    if (value.length > 2000) {
      setError('Сообщение не может быть длиннее 2000 символов.');
      return;
    }
    setSending(true);
    setError(null);
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('message:send', { body: value, id }, (result: SocketAck) => {
        setSending(false);
        if (result.error) {
          setError(result.error.message);
          return;
        }
        setBody('');
      });
      return;
    }
    try {
      await sendChatMessage(accessToken, id, value);
      setBody('');
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', id] });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Не удалось отправить сообщение.');
    } finally {
      setSending(false);
    }
  }

  async function toggleBlock() {
    if (!accessToken || !chat) return;
    setError(null);
    try {
      if (blocked) await unblockUser(accessToken, chat.counterpart.id);
      else await blockUser(accessToken, chat.counterpart.id);
      setBlocked(!blocked);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Не удалось изменить блокировку.');
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: 'Назад',
          headerShown: true,
          title: chat?.counterpart.profile?.nickname ?? 'Чат',
        }}
      />
      <Screen contentContainerStyle={styles.content}>
        {chat ? (
          <View style={styles.heading}>
            <View style={styles.headingText}>
              <Text style={styles.title}>{chat.offer.ad.title}</Text>
              <Text style={styles.muted}>
                {chat.counterpart.profile?.nickname ?? 'Пользователь Doska'}
              </Text>
            </View>
            <Pressable onPress={() => void toggleBlock()}>
              <Text style={styles.blockLink}>{blocked ? 'Разблокировать' : 'Заблокировать'}</Text>
            </Pressable>
          </View>
        ) : null}
        {error ? <Notice>{error}</Notice> : null}
        {messages.hasNextPage ? (
          <PrimaryButton
            loading={messages.isFetchingNextPage}
            onPress={() => void messages.fetchNextPage()}
            variant="secondary"
          >
            Показать предыдущие
          </PrimaryButton>
        ) : null}
        <View style={styles.messages}>
          {orderedMessages.map((message) => {
            const mine = message.senderId === userId;
            return (
              <View key={message.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.messageText, mine && styles.mineText]}>{message.body}</Text>
                <Text style={[styles.time, mine && styles.mineTime]}>
                  {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            );
          })}
        </View>
        {messages.isLoading ? <Text style={styles.muted}>Загрузка сообщений…</Text> : null}
        <View style={styles.composer}>
          <TextInput
            maxLength={2000}
            multiline
            onChangeText={setBody}
            placeholder="Напишите сообщение"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
            value={body}
          />
          <PrimaryButton
            disabled={!body.trim() || blocked}
            loading={sending}
            onPress={() => void submit()}
          >
            Отправить
          </PrimaryButton>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  blockLink: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  bubble: { borderRadius: radius.card, gap: spacing.xs, maxWidth: '86%', padding: spacing.md },
  composer: { gap: spacing.sm },
  content: { gap: spacing.lg, padding: spacing.lg },
  heading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  headingText: { flex: 1, gap: spacing.xs },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.input,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 70,
    padding: 14,
  },
  messageText: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  messages: { gap: spacing.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  mineText: { color: colors.white },
  mineTime: { color: '#DCE6FF' },
  muted: { color: colors.muted, fontSize: 14 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card },
  time: { color: colors.muted, fontSize: 11, textAlign: 'right' },
  title: { color: colors.ink, fontSize: 18, fontWeight: '900' },
});
