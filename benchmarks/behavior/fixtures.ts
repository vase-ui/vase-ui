import type { Library } from '../scenarios.ts';
import type { Check } from './types.ts';

/** The fixture of a case of a check. */
export function scenarioOf(check: Check, caseName: string | null): string | undefined {
  return typeof check.scenario === 'string'
    ? check.scenario
    : caseName === null
      ? undefined
      : check.scenario[caseName];
}

/** The file of a fixture in the repository, such as `benchmarks/libraries/vase-ui/behavior/Toasts.vue`. */
export function fixtureFileOf(library: Library, scenario: string): string {
  return `benchmarks/libraries/${library.id}/behavior/${scenario}.${library.framework === 'react' ? 'tsx' : 'vue'}`;
}
