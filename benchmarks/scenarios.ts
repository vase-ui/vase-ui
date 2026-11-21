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
    vapor: true,
  },
  {
    id: 'react',
    framework: 'react',
    frameworkPackage: 'react',
    entry: 'react/main.tsx',
    emptyAppEntry: 'react/main.tsx',
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
