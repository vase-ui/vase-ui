import DirectionProvider from './DirectionProvider.vue';
import type { DirectionProviderProps, DirectionProviderState } from './DirectionProvider.vue';

/**
 * Enables RTL behavior for Vase UI components.
 */
export const Provider: typeof DirectionProvider = DirectionProvider;
export namespace Provider {
  export type Props = DirectionProviderProps;
  export type State = DirectionProviderState;
}

export { useDirection } from '../internals/direction-context/DirectionContext';

export type { TextDirection } from '../internals/direction-context/DirectionContext';
