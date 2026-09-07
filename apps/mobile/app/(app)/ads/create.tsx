import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ApiError, createAd } from '../../../src/api/client';
import { useAuthStore } from '../../../src/auth/store';
import { AdForm } from '../../../src/components/ad-form';
import { Screen } from '../../../src/components/screen';
import { sharedStyles } from '../../../src/components/ui';
import { spacing } from '../../../src/theme';

export default function CreateAdScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Stack.Screen
        options={{ headerBackTitle: 'Назад', headerShown: true, title: 'Новый запрос' }}
      />
      <Screen contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={sharedStyles.screenTitle}>Что вы хотите купить?</Text>
          <Text style={sharedStyles.screenSubtitle}>
            Опишите запрос — продавцы смогут предложить подходящий товар.
          </Text>
        </View>
        <AdForm
          error={error}
          initial={{ cityId: user?.profile?.city.id }}
          onSubmit={async (input) => {
            if (!accessToken) return;
            setError(null);
            try {
              await createAd(accessToken, input);
              await queryClient.invalidateQueries({ queryKey: ['my-ads'] });
              router.replace('/my-ads');
            } catch (caught: unknown) {
              setError(
                caught instanceof ApiError || caught instanceof Error
                  ? caught.message
                  : 'Не удалось создать объявление.',
              );
            }
          }}
        />
      </Screen>
    </>
  );
}
