import PreviewCardRoot from './root/PreviewCardRoot.vue';
import type {
  PreviewCardRootActions,
  PreviewCardRootChangeEventDetails,
  PreviewCardRootChangeEventReason,
  PreviewCardRootProps,
  PreviewCardRootState,
} from './root/PreviewCardRoot.vue';
import PreviewCardTrigger from './trigger/PreviewCardTrigger.vue';
import type {
  PreviewCardTriggerProps,
  PreviewCardTriggerState,
} from './trigger/PreviewCardTrigger.vue';

/**
 * Groups all parts of the preview card.
 * Doesn't render its own HTML element.
 */
export const Root: typeof PreviewCardRoot = PreviewCardRoot;
export namespace Root {
  export type State = PreviewCardRootState;
  export type Props<Payload = unknown> = PreviewCardRootProps<Payload>;
  export type Actions = PreviewCardRootActions;
  export type ChangeEventReason = PreviewCardRootChangeEventReason;
  export type ChangeEventDetails = PreviewCardRootChangeEventDetails;
}

/**
 * A link that opens the preview card.
 * Renders an `<a>` element.
 */
export const Trigger: typeof PreviewCardTrigger = PreviewCardTrigger;
export namespace Trigger {
  export type State = PreviewCardTriggerState;
  export type Props<Payload = unknown> = PreviewCardTriggerProps<Payload>;
}

export {
  createPreviewCardHandle as createHandle,
  PreviewCardHandle as Handle,
} from './store/PreviewCardHandle';
