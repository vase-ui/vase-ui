import { computed, toValue } from 'vue';
import type { ComputedRef, MaybeRefOrGetter } from 'vue';
import { useIsHydrating } from '../common/hydration';

/**
 * The server cannot know the locale of the visitor, so the format has a fixed locale until the
 * component is mounted. The server HTML then equals the first render of the hydration, and the
 * locale of the visitor applies after it.
 * @param locale The locale of the consumer. It wins over the fixed locale.
 */
export function useFormatLocale(
  locale: MaybeRefOrGetter<Intl.LocalesArgument | undefined>,
): ComputedRef<Intl.LocalesArgument | undefined> {
  const isHydrating = useIsHydrating();
  return computed(() => toValue(locale) ?? (isHydrating.value ? 'en-US' : undefined));
}
