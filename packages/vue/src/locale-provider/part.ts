import { computed, inject, toValue, type InjectionKey, type MaybeRefOrGetter } from 'vue';

/** What a `LocaleProvider` gives to the parts in it. The property is reactive. */
export interface LocaleForPart {
  readonly locale: string;
}

export const localeKey: InjectionKey<LocaleForPart> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'locale' : undefined,
);

/**
 * The locale of a part: its `locale` prop, else the nearest `LocaleProvider`, else `en-US`. It
 * never uses the locale of the visitor, so the server and the browser write the same text.
 */
export function useLocale(locale: MaybeRefOrGetter<Intl.LocalesArgument>) {
  const provider = inject(localeKey, null);
  return computed(() => toValue(locale) ?? provider?.locale ?? 'en-US');
}
