import { expectType } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as Resizable from '../index.parts';

const layout: Resizable.Root.Layout = { a: 30, b: 70 };

<Resizable.Root layout={layout} defaultLayout={layout} step={2} largeStep={20} />;
<Resizable.Root orientation="vertical" disabled pushPanels={false} />;
// @ts-expect-error `pushPanels` is a Boolean.
<Resizable.Root pushPanels="no" />;
// @ts-expect-error The orientation is horizontal or vertical.
<Resizable.Root orientation="diagonal" />;
// @ts-expect-error A layout gives a number for each panel id.
<Resizable.Root layout={{ a: '30' }} />;

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
}

<Resizable.Root
  onLayoutChange={(next, details) => {
    expectType<Record<string, number>, typeof next>(next);
    assertChange(details);
    details.cancel();
  }}
  onLayoutCommitted={(next, details) => {
    expectType<Record<string, number>, typeof next>(next);
    assertCommit(details);
  }}
  onDraggingChange={(dragging) => {
    expectType<boolean, typeof dragging>(dragging);
  }}
/>;

<Resizable.Panel id="a" defaultSize={30} minSize="10%" maxSize="90" />;
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
expectType<'horizontal' | 'vertical', Resizable.Handle.State['orientation']>('horizontal');

expectType<Resizable.Panel.Actions['collapse'], typeof panel.collapse>(panel.collapse);
expectType<Resizable.Panel.Actions['expand'], typeof panel.expand>(panel.expand);
expectType<Resizable.Panel.Actions['resize'], typeof panel.resize>(panel.resize);
expectType<Resizable.Panel.Actions['isCollapsed'], typeof panel.isCollapsed>(panel.isCollapsed);
expectType<() => void, Resizable.Panel.Actions['collapse']>(panel.collapse);
expectType<(size: number | string) => void, Resizable.Panel.Actions['resize']>(panel.resize);
expectType<() => boolean, Resizable.Panel.Actions['isCollapsed']>(panel.isCollapsed);
expectType<boolean, Resizable.Panel.State['collapsed']>(true);
expectType<boolean, Resizable.Panel.State['disabled']>(true);
expectType<boolean, Resizable.Handle.State['atMin']>(true);
expectType<boolean, Resizable.Handle.State['atMax']>(true);

expectType<Resizable.Root.Actions['getLayout'], typeof root.getLayout>(root.getLayout);
expectType<Resizable.Root.Actions['setLayout'], typeof root.setLayout>(root.setLayout);
expectType<Resizable.Root.Actions['reset'], typeof root.reset>(root.reset);
expectType<() => Resizable.Root.Layout, Resizable.Root.Actions['getLayout']>(root.getLayout);
expectType<(layout: Resizable.Root.Layout) => void, Resizable.Root.Actions['setLayout']>(
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
