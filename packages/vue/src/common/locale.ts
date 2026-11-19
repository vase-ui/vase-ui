import { computed, inject, toValue } from 'vue';
import type { ComputedRef, InjectionKey, MaybeRefOrGetter } from 'vue';

/** The locale of the nearest `LocaleProvider`. */
export const localeKey: InjectionKey<() => string> = Symbol('locale');

/**
 * The locale of a part: its `locale` prop, else the nearest `LocaleProvider`, else `en-US`. It
 * never uses the locale of the visitor, so the server and the browser write the same text.
 */
export function useLocale(
  locale: MaybeRefOrGetter<Intl.LocalesArgument>,
): ComputedRef<Intl.LocalesArgument> {
  const provided = inject(localeKey, null);
  return computed(() => toValue(locale) ?? provided?.() ?? 'en-US');
}
