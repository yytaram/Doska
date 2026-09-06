import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Doska</Text>
      <Text style={styles.subtitle}>Покупайте то, что вам нужно.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  subtitle: {
    color: '#475569',
    fontSize: 18,
    textAlign: 'center',
  },
  title: {
    color: '#0F172A',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 8,
  },
});
