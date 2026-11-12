import SinglePartComponent from './SinglePart.vue';
import type { SinglePartProps, SinglePartState } from './SinglePart.vue';

export const SinglePart: typeof SinglePartComponent = SinglePartComponent;
export namespace SinglePart {
  export type Props = SinglePartProps;
  export type State = SinglePartState;
}

export type * from './SinglePart.vue';
export * as SinglePartDataAttributes from './SinglePartDataAttributes';
