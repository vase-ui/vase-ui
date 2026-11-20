import LocaleProviderComponent from './LocaleProvider.vue';

/**
 * Gives a locale to the Vase UI parts below it. A part with no `locale` prop formats its text, or
 * compares the text of its items, in this locale.
 * Doesn't render its own HTML element.
 */
export const LocaleProvider: typeof LocaleProviderComponent = LocaleProviderComponent;

export type { LocaleProviderProps } from './types';
