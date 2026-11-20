import LocaleProviderComponent from './LocaleProvider.vue';

/**
 * Gives a locale to the Vase UI parts below it. `Meter.Root`, `Progress.Root`, `Slider.Root`,
 * `NumberField.Root`, `DateField.Root`, `TimeField.Root` and `TimeClock.Root` with no `locale` prop
 * format their text in this locale.
 * Doesn't render its own HTML element.
 */
export const LocaleProvider: typeof LocaleProviderComponent = LocaleProviderComponent;

export type { LocaleProviderProps } from './types';
