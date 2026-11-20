import CSPProviderComponent from './CSPProvider.vue';
import type { CSPProviderProps, CSPProviderState } from './types';

/**
 * Gives a nonce to the inline `<style>` and `<script>` elements of the Vase UI parts below it, and
 * can turn off the `<style>` elements. The nearest provider gives both values, and takes none from
 * a provider around it.
 * Doesn't render its own HTML element.
 */
export const CSPProvider: typeof CSPProviderComponent = CSPProviderComponent;
export namespace CSPProvider {
  export type Props = CSPProviderProps;
  export type State = CSPProviderState;
}

export type { CSPProviderProps, CSPProviderState };
