import { expectType } from '#test-utils';
import {
  Resizable,
  type ResizableHandleState,
  type ResizableLayout,
  type ResizablePanelState,
  type ResizableRootChangeEventDetails,
  type ResizableRootCommitEventDetails,
  type ResizableRootProps,
  type ResizableRootState,
} from '@vase-ui/vue/resizable';
import type { ElementSlotProps } from '@vase-ui/vue/types';

const onClick = (event: MouseEvent) => event.preventDefault();

// Each part takes the native attributes and listeners of its element. The events give the layout.
export const withAttributes = (
  <Resizable.Root
    lang="fr"
    onClick={onClick}
    modelValue={{ a: 30, b: '240px' }}
    onUpdate:modelValue={(layout) => expectType<ResizableLayout, typeof layout>(layout)}
    onLayoutChange={(layout, details) => {
      expectType<ResizableLayout, typeof layout>(layout);
      expectType<ResizableRootChangeEventDetails, typeof details>(details);
    }}
    onLayoutCommitted={(layout, details) => {
      expectType<ResizableLayout, typeof layout>(layout);
      expectType<ResizableRootCommitEventDetails, typeof details>(details);
    }}
    onDraggingChange={(dragging) => expectType<boolean, typeof dragging>(dragging)}
  >
    <Resizable.Panel
      id="a"
      lang="fr"
      onClick={onClick}
      defaultSize="240px"
      onCollapsedChange={(collapsed) => expectType<boolean, typeof collapsed>(collapsed)}
    />
    <Resizable.Handle lang="fr" onClick={onClick} aria-valuetext="30 percent" />
    <Resizable.Panel id="b" />
  </Resizable.Root>
);

// @ts-expect-error `lang` is a string.
export const wrongAttribute = <Resizable.Handle lang={5} />;

// @ts-expect-error The `id` of a panel is a string.
export const wrongId = <Resizable.Panel id={5} />;

type RootSlots = InstanceType<typeof Resizable.Root>['$slots'];
const rootSlotProps = null as unknown as Parameters<NonNullable<RootSlots['default']>>[0];
expectType<
  { state: ResizableRootState; sizes: Readonly<Record<string, number>> },
  typeof rootSlotProps
>(rootSlotProps);

type PanelSlots = InstanceType<typeof Resizable.Panel>['$slots'];
const panelSlotProps = null as unknown as Parameters<NonNullable<PanelSlots['default']>>[0];
expectType<{ state: ResizablePanelState }, typeof panelSlotProps>(panelSlotProps);

type HandleSlots = InstanceType<typeof Resizable.Handle>['$slots'];
const handleElementProps = null as unknown as Parameters<NonNullable<HandleSlots['element']>>[0];
expectType<
  ElementSlotProps<ResizableHandleState> & { targetProps: Record<string, unknown> },
  typeof handleElementProps
>(handleElementProps);

// A template ref of a panel has its element and its methods.
const panel = null as unknown as InstanceType<typeof Resizable.Panel>;
expectType<HTMLElement | null, typeof panel.element>(panel.element);
expectType<() => void, typeof panel.collapse>(panel.collapse);
expectType<() => void, typeof panel.expand>(panel.expand);
expectType<(wanted: number | string) => void, typeof panel.resize>(panel.resize);
expectType<() => boolean, typeof panel.isCollapsed>(panel.isCollapsed);

// The types of a part are on the part, and the layout is on the family.
const rootProps = null as unknown as Resizable.Root.Props;
const handleState = null as unknown as Resizable.Handle.State;
const layout = null as unknown as Resizable.Layout;
expectType<ResizableRootProps, typeof rootProps>(rootProps);
expectType<ResizableHandleState, typeof handleState>(handleState);
expectType<ResizableLayout, typeof layout>(layout);
expectType<'as', keyof ResizableRootProps & 'as'>('as');
