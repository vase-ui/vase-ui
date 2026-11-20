import LocaleProviderComponent from './LocaleProvider.vue';

/**
 * Gives a locale to the Vase UI parts below it. A part that formats its text, or compares the text
 * of its items, uses this locale when its `locale` prop has no value.
 * Doesn't render its own HTML element.
 */
export const LocaleProvider: typeof LocaleProviderComponent = LocaleProviderComponent;

export type { LocaleProviderProps } from './types';
