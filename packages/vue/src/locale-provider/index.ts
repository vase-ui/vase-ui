import LocaleProviderComponent from './LocaleProvider.vue';

/**
 * Gives a locale to the Vase UI parts below it. `Meter.Root`, `Progress.Root`, `Slider.Root` and
 * `NumberField.Root` with no `locale` prop format their text in this locale.
 */
export const LocaleProvider: typeof LocaleProviderComponent = LocaleProviderComponent;

export type { LocaleProviderProps } from './types';
