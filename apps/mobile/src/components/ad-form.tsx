import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { getCategories, getCities, type AdInput, type ItemCondition } from '../api/client';
import { colors, radius, spacing } from '../theme';
import { conditionLabels } from './ad-card';
import { ReferencePicker } from './reference-picker';
import { Field, Notice, PrimaryButton } from './ui';

const schema = z.object({
  budget: z
    .string()
    .refine((value) => !value || /^\d+$/.test(value), 'Введите сумму целым числом.'),
  categoryId: z.string().uuid('Выберите категорию.'),
  cityId: z.string().uuid('Выберите город.'),
  condition: z.enum(['any', 'new', 'like_new', 'good', 'fair', 'for_parts']),
  description: z.string().trim().min(20, 'Минимум 20 символов.').max(5000),
  title: z.string().trim().min(5, 'Минимум 5 символов.').max(120),
});

type Values = z.infer<typeof schema>;

export function AdForm({
  error,
  initial,
  loading,
  onSubmit,
}: {
  error?: string | null;
  initial?: Partial<AdInput>;
  loading?: boolean;
  onSubmit: (input: AdInput) => Promise<void>;
}) {
  const categories = useQuery({
    queryKey: ['reference', 'categories'],
    queryFn: getCategories,
    staleTime: 86_400_000,
  });
  const cities = useQuery({
    queryKey: ['reference', 'cities'],
    queryFn: getCities,
    staleTime: 86_400_000,
  });
  const {
    control,
    formState: { isSubmitting },
    handleSubmit,
  } = useForm<Values>({
    defaultValues: {
      budget:
        initial?.budget === null || initial?.budget === undefined ? '' : String(initial.budget),
      categoryId: initial?.categoryId ?? '',
      cityId: initial?.cityId ?? '',
      condition: initial?.condition ?? 'any',
      description: initial?.description ?? '',
      title: initial?.title ?? '',
    },
    resolver: zodResolver(schema),
  });
  const busy = loading || isSubmitting || categories.isLoading || cities.isLoading;

  function submit(status: 'draft' | 'moderation') {
    return handleSubmit(async (values) =>
      onSubmit({
        budget: values.budget ? Number(values.budget) : null,
        categoryId: values.categoryId,
        cityId: values.cityId,
        condition: values.condition,
        description: values.description.trim(),
        status,
        title: values.title.trim(),
      }),
    )();
  }

  return (
    <View style={styles.form}>
      {error ? <Notice>{error}</Notice> : null}
      <Controller
        control={control}
        name="title"
        render={({ field: { onBlur, onChange, value }, fieldState }) => (
          <Field
            error={fieldState.error?.message}
            label="Что хотите купить"
            maxLength={120}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Например, куплю iPhone 15"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field: { onBlur, onChange, value }, fieldState }) => (
          <Field
            error={fieldState.error?.message}
            label="Описание"
            maxLength={5000}
            multiline
            numberOfLines={5}
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Опишите модель, характеристики и важные детали"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="categoryId"
        render={({ field: { onChange, value }, fieldState }) => (
          <ReferencePicker
            error={fieldState.error?.message}
            items={(categories.data ?? []).map((item) => ({ id: item.id, nameRu: item.nameRu }))}
            label="Категория"
            onChange={onChange}
            placeholder="Выберите категорию"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="cityId"
        render={({ field: { onChange, value }, fieldState }) => (
          <ReferencePicker
            error={fieldState.error?.message}
            items={(cities.data ?? []).map((item) => ({
              id: item.id,
              nameRu: item.nameRu,
              subtitle: item.regionRu,
            }))}
            label="Город"
            onChange={onChange}
            placeholder="Выберите город"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="budget"
        render={({ field: { onBlur, onChange, value }, fieldState }) => (
          <Field
            error={fieldState.error?.message}
            keyboardType="number-pad"
            label="Максимальный бюджет, ₸"
            onBlur={onBlur}
            onChangeText={onChange}
            placeholder="Например, 350000"
            value={value}
          />
        )}
      />
      <Controller
        control={control}
        name="condition"
        render={({ field: { onChange, value } }) => (
          <View>
            <Text style={styles.label}>Желаемое состояние</Text>
            <View style={styles.chips}>
              {(Object.keys(conditionLabels) as ItemCondition[]).map((condition) => (
                <Pressable
                  key={condition}
                  onPress={() => onChange(condition)}
                  style={[styles.chip, value === condition && styles.chipActive]}
                >
                  <Text style={[styles.chipText, value === condition && styles.chipTextActive]}>
                    {conditionLabels[condition]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      />
      {categories.isError || cities.isError ? (
        <Notice>Не удалось загрузить категории или города.</Notice>
      ) : null}
      <PrimaryButton
        disabled={busy}
        loading={isSubmitting}
        onPress={() => void submit('moderation')}
      >
        Отправить на модерацию
      </PrimaryButton>
      <PrimaryButton disabled={busy} onPress={() => void submit('draft')} variant="secondary">
        Сохранить черновик
      </PrimaryButton>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  form: { gap: spacing.md },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
});
