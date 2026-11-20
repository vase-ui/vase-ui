import { expectType } from '#test-utils';
import {
  PreviewCard,
  type PreviewCardRootChangeEventDetails,
  type PreviewCardRootChangeEventReason,
} from '@vase-ui/vue/preview-card';

// A handle carries the type of the payload of its root and its links.
const handle = PreviewCard.createHandle<{ id: number }>();
expectType<PreviewCard.Handle<{ id: number }>, typeof handle>(handle);
expectType<boolean, typeof handle.isOpen>(handle.isOpen);
export const constructed: PreviewCard.Handle<string> = new PreviewCard.Handle<string>();
export const rootProps: PreviewCard.Root.Props<{ id: number }> = { handle, defaultOpen: true };
export const triggerProps: PreviewCard.Trigger.Props<{ id: number }> = {
  handle,
  payload: { id: 1 },
  href: '/typography',
};
// @ts-expect-error The payload of the link has the type of the handle.
export const wrongPayload: PreviewCard.Trigger.Props<{ id: number }> = { handle, payload: 'x' };

// The details of a change name its reason and its trigger. A press on the link changes no card.
declare const details: PreviewCardRootChangeEventDetails;
expectType<PreviewCardRootChangeEventReason, typeof details.reason>(details.reason);
expectType<Element | undefined, typeof details.trigger>(details.trigger);
expectType<PreviewCard.Root.ChangeEventDetails, typeof details>(details);
// @ts-expect-error No code sends `trigger-press`.
export const pressReason: PreviewCardRootChangeEventReason = 'trigger-press';

// The positioner takes the placement props of the popup layer, and no `keepMounted`.
export const positionerProps: PreviewCard.Positioner.Props = {
  side: 'inline-end',
  sideOffset: ({ anchor }) => anchor.height,
  anchor: { getBoundingClientRect: () => new DOMRect() },
};
// @ts-expect-error `keepMounted` is a prop of the portal.
export const keptPositioner: PreviewCard.Positioner.Props = { keepMounted: true };

// A template ref of a part has its element.
const popup = null as unknown as InstanceType<typeof PreviewCard.Popup>;
expectType<HTMLElement | null, typeof popup.element>(popup.element);
