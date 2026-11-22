export type Framework = 'vue' | 'react';

export interface Setup {
  id: 'vdom' | 'vapor-interop' | 'react';
  framework: Framework;
  /** The package of the framework. Each app of the setup uses this one copy. */
  frameworkPackage: string;
  /** The entry of the app of a library, from `harness`. */
  entry: string;
  /** The entry of the empty app, from `harness`. */
  emptyAppEntry: string;
  /** The entry of the page that hydrates the server HTML of `AllComponents`, from `harness`. */
  hydrateEntry: string;
  /** The entry of the server render of `AllComponents`, from `harness`. */
  serverEntry: string;
  /** `true` when the setup compiles the SFCs of the harness and of the fixtures in Vapor mode. */
  vapor: boolean;
}

export interface Library {
  id: 'vase-ui' | 'reka-ui' | 'ark-ui' | 'headless-ui' | 'vuetify0' | 'base-ui';
  package: string;
  framework: Framework;
}

export const SETUPS: readonly Setup[] = [
  {
    id: 'vdom',
    framework: 'vue',
    frameworkPackage: 'vue',
    entry: 'vue/vdom.ts',
    emptyAppEntry: 'vue/vdom.ts',
    hydrateEntry: 'vue/hydrateVdom.ts',
    serverEntry: 'vue/server.ts',
    vapor: false,
  },
  {
    // A Vapor app renders the virtual DOM components of a library through `vaporInteropPlugin`.
    // The empty app has no plugin, so each app of a library carries the runtime that the plugin adds.
    id: 'vapor-interop',
    framework: 'vue',
    frameworkPackage: 'vue-3.6',
    entry: 'vue/vaporInterop.ts',
    emptyAppEntry: 'vue/vapor.ts',
    hydrateEntry: 'vue/hydrateVaporInterop.ts',
    serverEntry: 'vue/server.ts',
    vapor: true,
  },
  {
    id: 'react',
    framework: 'react',
    frameworkPackage: 'react',
    entry: 'react/main.tsx',
    emptyAppEntry: 'react/main.tsx',
    hydrateEntry: 'react/hydrate.tsx',
    serverEntry: 'react/server.tsx',
    vapor: false,
  },
];

export const LIBRARIES: readonly Library[] = [
  { id: 'vase-ui', package: '@vase-ui/vue', framework: 'vue' },
  { id: 'reka-ui', package: 'reka-ui', framework: 'vue' },
  { id: 'ark-ui', package: '@ark-ui/vue', framework: 'vue' },
  { id: 'headless-ui', package: '@headlessui/vue', framework: 'vue' },
  { id: 'vuetify0', package: '@vuetify/v0', framework: 'vue' },
  { id: 'base-ui', package: '@base-ui/react', framework: 'react' },
];

/** Each scenario is a fixture file `libraries/<library>/<scenario>.vue`, or `.tsx` for React. */
export const SCENARIOS: readonly string[] = [
  'Accordion',
  'Checkbox',
  'Combobox',
  'Dialog',
  'Menu',
  'Popover',
  'Select',
  'Slider',
  'Tabs',
  'Tooltip',
  'AllComponents',
];

/** A measure of `time.ts`. Each one is a duration in milliseconds, except `heap`, in bytes. */
export type Measure =
  'mount' | 'heap' | 'open' | 'close' | 'openLong' | 'highlight' | 'filter' | 'hydrate';

/** One page of `time.ts`, which gives the measures of one sample of one library. */
export interface Visit {
  scenario: string;
  kind: 'mount' | 'popup' | 'list' | 'hydration';
  measures: readonly Measure[];
}

/** The instances of the scenario in a mount visit. */
export const MOUNT_INSTANCES = 100;
/** The options of Select and Combobox in a list visit. */
export const LONG_LIST_OPTIONS = 1000;
/** The text of the filter of Combobox, and the count of the labels of the long list that hold it. */
export const FILTER = { text: '9', options: 271 };

const POPUP_SCENARIOS = ['Dialog', 'Popover', 'Menu', 'Select', 'Combobox'];

export const VISITS: readonly Visit[] = [
  ...SCENARIOS.filter((scenario) => scenario !== 'AllComponents').map((scenario): Visit => ({
    scenario,
    kind: 'mount',
    measures: ['mount', 'heap'],
  })),
  ...POPUP_SCENARIOS.map((scenario): Visit => ({
    scenario,
    kind: 'popup',
    measures: ['open', 'close'],
  })),
  { scenario: 'Select', kind: 'list', measures: ['openLong', 'highlight'] },
  { scenario: 'Combobox', kind: 'list', measures: ['openLong', 'highlight', 'filter'] },
  { scenario: 'AllComponents', kind: 'hydration', measures: ['hydrate'] },
];

/** The key of a measure of a scenario in `results.json`, such as `Dialog.open`. */
export function metricOf(scenario: string, measure: Measure): string {
  return `${scenario}.${measure}`;
}
