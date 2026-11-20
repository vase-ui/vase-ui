import CSPProviderComponent from './CSPProvider.vue';
import type { CSPProviderProps, CSPProviderState } from './types';

/**
 * Provides a default Content Security Policy (CSP) configuration for Vase UI components that
 * require inline `<style>` or `<script>` tags.
 * Doesn't render its own HTML element.
 */
export const CSPProvider: typeof CSPProviderComponent = CSPProviderComponent;
export namespace CSPProvider {
  export type Props = CSPProviderProps;
  export type State = CSPProviderState;
}

export type { CSPProviderProps, CSPProviderState };
