import { expectType } from '#test-utils';
import {
  NavigationMenu,
  type NavigationMenuRootChangeEventDetails,
  type NavigationMenuRootChangeEventReason,
} from '@vase-ui/vue/navigation-menu';

// The root and the item take the type of the value.
export const rootProps: NavigationMenu.Root.Props<number> = { modelValue: 1, defaultValue: null };
export const itemProps: NavigationMenu.Item.Props<number> = { value: 2 };
// @ts-expect-error The value of the root is a number.
export const wrongValue: NavigationMenu.Root.Props<number> = { modelValue: 'one' };

// The details of a change name its reason, its trigger and the propagation of its event.
declare const details: NavigationMenuRootChangeEventDetails;
expectType<NavigationMenuRootChangeEventReason, typeof details.reason>(details.reason);
expectType<Element | undefined, typeof details.trigger>(details.trigger);
expectType<() => void, typeof details.cancel>(details.cancel);
expectType<NavigationMenu.Root.ChangeEventDetails, typeof details>(details);

// A content takes the props of `<Transition>`.
export const contentProps: NavigationMenu.Content.Props = {
  keepMounted: true,
  transition: { name: 'slide', mode: 'out-in', onAfterLeave: () => {} },
};

// The state of the parts.
declare const contentState: NavigationMenu.Content.State;
expectType<'left' | 'right' | 'up' | 'down' | null, typeof contentState.activationDirection>(
  contentState.activationDirection,
);
declare const positionerState: NavigationMenu.Positioner.State;
expectType<boolean, typeof positionerState.instant>(positionerState.instant);

// A template ref of a part has its element, and the root has `close()`.
const root = null as unknown as InstanceType<typeof NavigationMenu.Root>;
expectType<HTMLElement | null, typeof root.element>(root.element);
expectType<() => void, typeof root.close>(root.close);
