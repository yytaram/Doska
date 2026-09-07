import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme';

export function Screen({
  children,
  scroll = true,
  ...props
}: ScrollViewProps & { children: ReactNode; scroll?: boolean }) {
  if (!scroll) {
    return (
      <View style={styles.safe}>
        <SafeAreaView>{children}</SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <SafeAreaView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...props}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export function CenteredScreen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.safe}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.centered}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1 },
  content: { flexGrow: 1 },
  flex: { flex: 1 },
  safe: { backgroundColor: colors.background, flex: 1 },
});
