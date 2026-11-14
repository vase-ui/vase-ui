import { expectType } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import * as Resizable from '../index.parts';

const layout: Resizable.Root.Layout = { a: 30, b: 70 };

<Resizable.Root layout={layout} defaultLayout={layout} step={2} largeStep={20} />;
<Resizable.Root orientation="vertical" disabled />;
// @ts-expect-error The orientation is horizontal or vertical.
<Resizable.Root orientation="diagonal" />;
// @ts-expect-error A layout gives a number for each panel id.
<Resizable.Root layout={{ a: '30' }} />;

type ChangeDetails = Resizable.Root.ChangeEventDetails;

function assertChange(details: ChangeDetails) {
  expectType<'drag' | 'keyboard' | 'none', typeof details.reason>(details.reason);

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
}

type CommitDetails = Resizable.Root.CommitEventDetails;

function assertCommit(details: CommitDetails) {
  expectType<'drag' | 'keyboard', typeof details.reason>(details.reason);
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
