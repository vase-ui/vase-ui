import { onMounted, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';

// A test environment of a consumer, such as jsdom, can have a `window` with no `matchMedia`.
function getWindowMatchMedia(): typeof window.matchMedia | null {
  // eslint-disable-next-line no-restricted-globals, @typescript-eslint/unbound-method -- The composable has no element, so `ownerWindow` does not apply. The typeof check makes the read safe on a server. `window.matchMedia` uses the window when it gets no `this`.
  return typeof window === 'undefined' ? null : (window.matchMedia ?? null);
}

/**
 * Gives `true` while the media query matches.
 * Call it in `setup`.
 * The query and the options can each be a value, a ref or a getter.
 *
 * The composable returns a read-only ref.
 * `setup` runs one time, so a plain Boolean does not follow a change.
 * @param query The media query. It can start with `@media`.
 * @param options The options as one object. A member cannot be a ref or a getter, because two
 * members are functions.
 * @public
 */
export function useMediaQuery(
  query: MaybeRefOrGetter<string>,
  options: MaybeRefOrGetter<useMediaQuery.Options>,
): Readonly<Ref<boolean>> {
  const getQuery = () => toValue(query).replace(/^@media( ?)/m, '');
  const getDefaultMatches = () => toValue(options).defaultMatches ?? false;
  const getMatchMedia = () => {
    const { matchMedia = getWindowMatchMedia() } = toValue(options);
    return matchMedia;
  };

  const { noSsr, ssrMatchMedia } = toValue(options);
  const initialMatchMedia = noSsr ? (getMatchMedia() ?? ssrMatchMedia) : ssrMatchMedia;
  const matches = shallowRef(initialMatchMedia?.(getQuery()).matches ?? getDefaultMatches());

  onMounted(() => {
    // A new options object can describe the same subscription.
    watch(
      [getQuery, getMatchMedia, getDefaultMatches],
      ([media, matchMedia, defaultMatches], _previous, onCleanup) => {
        if (matchMedia === null) {
          matches.value = defaultMatches;
          return;
        }
        const list = matchMedia(media);
        matches.value = list.matches;
        onCleanup(
          addEventListener(list, 'change', () => {
            matches.value = list.matches;
          }),
        );
      },
      { immediate: true },
    );
  });

  return matches;
}

export interface UseMediaQueryOptions {
  /**
   * The value on a server and in the first client render, unless `ssrMatchMedia` or `noSsr` gives
   * one. It is also the value from mount when there is no `matchMedia`.
   * @default false
   */
  defaultMatches?: boolean | undefined;
  /**
   * Your own implementation of `matchMedia`.
   * The composable reads the real value from it at mount, and then follows each change.
   * One use is the content window of an iframe.
   */
  matchMedia?: typeof window.matchMedia | undefined;
  /**
   * The first client render gives the value of the server, because a hydration must match the
   * server HTML. At mount, the composable reads the real value and the component renders again.
   * A client-only mount does the same, because `setup` cannot tell it from a hydration.
   * With `true`, the composable reads `matchMedia` in the first render, where one exists.
   * Set it to `true` only when the server HTML does not depend on the value.
   * @default false
   */
  noSsr?: boolean | undefined;
  /**
   * Your own implementation of `matchMedia` for a server render.
   * It gives the value on a server and in the first client render.
   * Give the same function on the client, or the hydration does not match the server HTML.
   */
  ssrMatchMedia?: ((query: string) => { matches: boolean }) | undefined;
}

export interface UseMediaQueryState {}

export namespace useMediaQuery {
  export type State = UseMediaQueryState;
  export type Options = UseMediaQueryOptions;
}
