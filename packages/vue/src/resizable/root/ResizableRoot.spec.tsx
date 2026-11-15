import { expectType } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as Resizable from '../index.parts';

const layout: Resizable.Root.Layout = { a: 30, b: 70 };
const snapshot: Resizable.Root.LayoutSnapshot = { a: '240px', b: 70, c: '30%' };

<Resizable.Root layout={layout} defaultLayout={layout} step={2} largeStep={20} />;
// The layout of the app can have sizes with a unit, and the events give percent.
<Resizable.Root layout={snapshot} defaultLayout={snapshot} />;
<Resizable.Root step="16px" largeStep="2rem" dragStep="5%" />;
<Resizable.Root dragStep={5} />;
<Resizable.Root orientation="vertical" disabled pushPanels={false} />;
// @ts-expect-error `pushPanels` is a Boolean.
<Resizable.Root pushPanels="no" />;
// @ts-expect-error The orientation is horizontal or vertical.
<Resizable.Root orientation="diagonal" />;
// @ts-expect-error A size is a number or a string.
<Resizable.Root layout={{ a: null }} />;
// @ts-expect-error A step is a number or a string.
<Resizable.Root step={null} />;

type ChangeDetails = Resizable.Root.ChangeEventDetails;

function assertChange(details: ChangeDetails) {
  expectType<'drag' | 'keyboard' | 'imperative-action' | 'reset' | 'none', typeof details.reason>(
    details.reason,
  );

  if (details.reason === REASONS.drag) {
    const event: PointerEvent | TouchEvent = details.event;
    void event;
    // @ts-expect-error A drag does not give a keyboard event.
    const keyboardEvent: KeyboardEvent = details.event;
    void keyboardEvent;
  }

  if (details.reason === REASONS.keyboard) {
    const event: KeyboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.none) {
    const event: Event = details.event;
    void event;
  }

  if (details.reason === REASONS.imperativeAction || details.reason === 'reset') {
    const event: Event = details.event;
    void event;
  }
}

type CommitDetails = Resizable.Root.CommitEventDetails;

function assertCommit(details: CommitDetails) {
  expectType<'drag' | 'keyboard' | 'imperative-action' | 'reset', typeof details.reason>(
    details.reason,
  );
  // The snapshot has the sizes that the app can give back to `layout`.
  expectType<Resizable.Root.LayoutSnapshot, typeof details.snapshot>(details.snapshot);
}

<Resizable.Root
  onLayoutChange={(next, details) => {
    expectType<Resizable.Root.Layout, typeof next>(next);
    assertChange(details);
    details.cancel();
  }}
  onLayoutCommitted={(next, details) => {
    expectType<Resizable.Root.Layout, typeof next>(next);
    assertCommit(details);
  }}
  onUpdate:layout={(next) => {
    expectType<Resizable.Root.Layout, typeof next>(next);
  }}
  onDraggingChange={(dragging) => {
    expectType<boolean, typeof dragging>(dragging);
  }}
/>;

<Resizable.Panel id="a" defaultSize={30} minSize="10%" maxSize="90" />;
<Resizable.Panel defaultSize="240px" minSize="12rem" maxSize="40vw" />;
// @ts-expect-error A size is a number or a string.
<Resizable.Panel minSize={null} />;
<Resizable.Panel
  collapsible
  collapsedSize="4%"
  collapseThreshold={5}
  disabled
  onCollapsedChange={(collapsed) => {
    expectType<boolean, typeof collapsed>(collapsed);
  }}
/>;
// @ts-expect-error A size is a number or a string.
<Resizable.Panel collapsedSize={null} />;
// @ts-expect-error `collapsible` is a Boolean.
<Resizable.Panel collapsible="yes" />;
<Resizable.Panel
  rootResizeBehavior="fixed"
  rootResizePriority={1}
  snapPoints={[25, '300px']}
  snapTolerance="8px"
  onResize={(size, previousSize) => {
    expectType<Resizable.Panel.Size, typeof size>(size);
    expectType<Resizable.Panel.Size | undefined, typeof previousSize>(previousSize);
  }}
/>;
<Resizable.Panel rootResizeBehavior="proportional" snapTolerance={5} />;
// @ts-expect-error The behavior is proportional or fixed.
<Resizable.Panel rootResizeBehavior="grow" />;
// @ts-expect-error A snap point is a number or a string.
<Resizable.Panel snapPoints={[null]} />;
// @ts-expect-error A priority is a number.
<Resizable.Panel rootResizePriority="high" />;

<Resizable.Handle primaryPanel="next" disabled />;
// @ts-expect-error The primary panel is the previous panel or the next panel.
<Resizable.Handle primaryPanel="both" />;

declare const panel: InstanceType<typeof Resizable.Panel>;
declare const handle: InstanceType<typeof Resizable.Handle>;
declare const root: InstanceType<typeof Resizable.Root>;
expectType<HTMLElement | null, typeof panel.element>(panel.element);
expectType<HTMLElement | null, typeof handle.element>(handle.element);
expectType<HTMLElement | null, typeof root.element>(root.element);

expectType<number, Resizable.Panel.State['size']>(0);
expectType<{ percent: number; pixels: number }, Resizable.Panel.Size>({ percent: 0, pixels: 0 });
expectType<'horizontal' | 'vertical', Resizable.Handle.State['orientation']>('horizontal');

expectType<Resizable.Panel.Actions['collapse'], typeof panel.collapse>(panel.collapse);
expectType<Resizable.Panel.Actions['expand'], typeof panel.expand>(panel.expand);
expectType<Resizable.Panel.Actions['resize'], typeof panel.resize>(panel.resize);
expectType<Resizable.Panel.Actions['isCollapsed'], typeof panel.isCollapsed>(panel.isCollapsed);
expectType<() => void, Resizable.Panel.Actions['collapse']>(panel.collapse);
expectType<(size: number | string) => void, Resizable.Panel.Actions['resize']>(panel.resize);
expectType<() => boolean, Resizable.Panel.Actions['isCollapsed']>(panel.isCollapsed);
expectType<Resizable.Panel.Actions['getSize'], typeof panel.getSize>(panel.getSize);
expectType<() => Resizable.Panel.Size, Resizable.Panel.Actions['getSize']>(panel.getSize);
expectType<boolean, Resizable.Panel.State['collapsed']>(true);
expectType<boolean, Resizable.Panel.State['disabled']>(true);
expectType<boolean, Resizable.Handle.State['atMin']>(true);
expectType<boolean, Resizable.Handle.State['atMax']>(true);

expectType<Resizable.Root.Actions['getLayout'], typeof root.getLayout>(root.getLayout);
expectType<Resizable.Root.Actions['setLayout'], typeof root.setLayout>(root.setLayout);
expectType<Resizable.Root.Actions['reset'], typeof root.reset>(root.reset);
expectType<() => Resizable.Root.Layout, Resizable.Root.Actions['getLayout']>(root.getLayout);
expectType<(layout: Resizable.Root.LayoutSnapshot) => void, Resizable.Root.Actions['setLayout']>(
  root.setLayout,
);
expectType<() => void, Resizable.Root.Actions['reset']>(root.reset);

const parentPanel = Resizable.useParentPanel();
if (parentPanel) {
  expectType<string, typeof parentPanel.id.value>(parentPanel.id.value);
  expectType<Resizable.Panel.State, typeof parentPanel.state.value>(parentPanel.state.value);
  expectType<Resizable.Panel.Actions['collapse'], typeof parentPanel.collapse>(
    parentPanel.collapse,
  );
  expectType<Resizable.Panel.Actions['resize'], typeof parentPanel.resize>(parentPanel.resize);
  expectType<Resizable.Panel.Actions['getSize'], typeof parentPanel.getSize>(parentPanel.getSize);
} else {
  expectType<null, typeof parentPanel>(parentPanel);
}

const parentRoot = Resizable.useParentRoot();
if (parentRoot) {
  expectType<'horizontal' | 'vertical', typeof parentRoot.orientation.value>(
    parentRoot.orientation.value,
  );
  expectType<Resizable.Root.Actions['getLayout'], typeof parentRoot.getLayout>(
    parentRoot.getLayout,
  );
  expectType<Resizable.Root.Actions['setLayout'], typeof parentRoot.setLayout>(
    parentRoot.setLayout,
  );
  expectType<Resizable.Root.Actions['reset'], typeof parentRoot.reset>(parentRoot.reset);
} else {
  expectType<null, typeof parentRoot>(parentRoot);
}
