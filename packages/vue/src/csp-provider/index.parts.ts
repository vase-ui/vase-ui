import CSPProviderComponent from './CSPProvider.vue';
import type { CSPProviderProps, CSPProviderState } from './CSPProvider.vue';

/**
 * Provides a default Content Security Policy (CSP) configuration for Vase UI components that
 * require inline `<style>` or `<script>` tags.
 */
export const CSPProvider: typeof CSPProviderComponent = CSPProviderComponent;
export namespace CSPProvider {
  export type Props = CSPProviderProps;
  export type State = CSPProviderState;
}
