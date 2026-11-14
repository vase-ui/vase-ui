import { afterEach, beforeEach, describe, expect, it, onTestFinished, test, vi } from 'vitest';
import { KeepAlive, defineComponent, onMounted, onUpdated, shallowRef } from 'vue';
import type { MaybeRefOrGetter, PropType } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { useFloating } from '../../../../test/floating-ui-tests/useFloating';
import { getDelay } from '../interactions/useHoverShared';
import { useHoverPopupInteraction } from '../interactions/useHoverPopupInteraction';
import { useHoverTriggerInteraction } from '../interactions/useHoverTriggerInteraction';
import type { Delay } from '../types';
import { provideFloatingDelayGroup, useDelayGroup } from './FloatingDelayGroup';

type DelayGroup = ReturnType<typeof useDelayGroup>;

// A tooltip of a group. It opens on hover, and the group gives it the delay. Its trigger and its
// popup show the instant phase. The counter holds the number of renders since the mount.
const Tooltip = defineComponent({
  props: {
    label: { type: String, required: true },
    // The delay of the tooltip, instead of the delay of its group.
    delay: { type: [Number, Object] as PropType<Delay>, default: undefined },
    defaultOpen: { type: Boolean, default: false },
    onGroup: { type: Function as PropType<(group: DelayGroup) => void>, default: undefined },
  },
  setup(props) {
    const open = shallowRef(props.defaultOpen);
    const { refs, context } = useFloating({
      open,
      onOpenChange(nextOpen) {
        open.value = nextOpen;
      },
    });
    const closeForSibling = () => {
      open.value = false;
    };
    const group = useDelayGroup(Object.assign(context.rootStore, { closeForSibling }), { open });
    props.onGroup?.(group);
    const delay = () => props.delay ?? group.delay();
    const hoverReferenceProps = useHoverTriggerInteraction(context.rootStore, {
      delay,
      triggerElement: refs.reference,
    });
    useHoverPopupInteraction(context.rootStore, {
      closeDelay: () => getDelay(delay(), 'close') ?? 0,
    });

    const counter = shallowRef<HTMLElement | null>(null);
    let renders = 0;
    function showRenders() {
      if (counter.value) {
        counter.value.textContent = String(renders);
      }
    }
    onMounted(showRenders);
    onUpdated(() => {
      renders += 1;
      showRenders();
    });

    return () => (
      <div>
        <button
          data-testid={`reference-${props.label}`}
          data-instant-phase={group.isInstantPhase.value ? '' : undefined}
          {...hoverReferenceProps}
          ref={refs.setReference}
        />
        <span data-testid={`render-count-${props.label}`} ref={counter} />
        {open.value && (
          <div
            data-testid={`floating-${props.label}`}
            data-instant-phase={group.isInstantPhase.value ? '' : undefined}
            ref={refs.setFloating}
          >
            {props.label}
          </div>
        )}
      </div>
    );
  },
});

const Group = defineComponent({
  props: {
    delay: { type: [Number, Object] as PropType<Delay>, required: true },
    timeoutMs: { type: Number, default: undefined },
  },
  setup(props, { slots }) {
    provideFloatingDelayGroup({ delay: () => props.delay, timeoutMs: () => props.timeoutMs });
    return () => slots.default?.();
  },
});

// `KeepAlive` deactivates its child when `Other` takes its place.
const Other = defineComponent({ setup: () => () => <p>other</p> });

async function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  await flushMicrotasks();
}

const isOpen = (label: string) => screen.queryByTestId(`floating-${label}`) !== null;

describe('FloatingDelayGroup', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('groups delays correctly', async () => {
    await render(
      <Group delay={{ open: 1000, close: 200 }}>
        <Tooltip label="one" />
        <Tooltip label="two" />
        <Tooltip label="three" />
      </Group>,
    );

    await fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await tick(1);

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    await tick(999);

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    await fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    await tick(1);

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    await fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    await tick(1);

    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    await fireEvent.mouseLeave(screen.getByTestId('reference-three'));

    await tick(1);

    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    await tick(199);

    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  test('timeoutMs', async () => {
    await render(
      <Group delay={{ open: 1000, close: 100 }} timeoutMs={500}>
        <Tooltip label="one" />
        <Tooltip label="two" />
        <Tooltip label="three" />
      </Group>,
    );

    await fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await tick(1000);

    await fireEvent.mouseLeave(screen.getByTestId('reference-one'));

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    await tick(499);

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    await fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    await tick(1);

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    await fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    await tick(1);

    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    await fireEvent.mouseLeave(screen.getByTestId('reference-three'));

    await tick(1);

    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    await tick(99);

    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  it('resets the instant phase after Strict Mode replays the lifecycle effects', async () => {
    await render(
      <Group delay={{ open: 1000, close: 0 }} timeoutMs={50}>
        <Tooltip label="one" />
        <Tooltip label="two" />
      </Group>,
    );

    await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
    await tick(1000);

    await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
    await tick(1);

    const secondReference = screen.getByTestId('reference-two');
    expect(secondReference).toHaveAttribute('data-instant-phase');

    await fireEvent.mouseLeave(secondReference);
    await tick(50);

    expect(secondReference).not.toHaveAttribute('data-instant-phase');
  });

  it('keeps the active context when an inactive consumer unmounts', async () => {
    const GroupWithRemovableTooltip = defineComponent({
      setup() {
        const showSecond = shallowRef(true);

        return () => (
          <Group delay={{ open: 1000, close: 100 }} timeoutMs={500}>
            <Tooltip label="one" />
            {showSecond.value && <Tooltip label="two" />}
            <Tooltip label="three" />
            <button
              type="button"
              onClick={() => {
                showSecond.value = false;
              }}
            >
              Remove inactive
            </button>
          </Group>
        );
      },
    });

    await render(<GroupWithRemovableTooltip />);

    await fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await tick(1000);

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Remove inactive' }));
    expect(screen.queryByTestId('reference-two')).not.toBeInTheDocument();

    await fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    await tick(1);

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();
  });

  it('keeps the timeout active when the last closed consumer unmounts', async () => {
    const GroupWithRemovableTooltip = defineComponent({
      setup() {
        const showFirst = shallowRef(true);

        return () => (
          <Group delay={{ open: 1000, close: 100 }} timeoutMs={500}>
            {showFirst.value && <Tooltip label="one" />}
            <Tooltip label="two" />
            <button
              type="button"
              onClick={() => {
                showFirst.value = false;
              }}
            >
              Remove closed
            </button>
          </Group>
        );
      },
    });

    await render(<GroupWithRemovableTooltip />);

    await fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await tick(1000);

    await fireEvent.mouseLeave(screen.getByTestId('reference-one'));

    await tick(100);

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Remove closed' }));
    expect(screen.queryByTestId('reference-one')).not.toBeInTheDocument();

    await fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    await tick(1);

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();
  });

  it('does not re-render unrelated consumers', async () => {
    await render(
      <Group delay={{ open: 1000, close: 100 }} timeoutMs={500}>
        <Tooltip label="one" />
        <Tooltip label="two" />
        <Tooltip label="three" />
      </Group>,
    );

    await fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await tick(1000);

    await fireEvent.mouseLeave(screen.getByTestId('reference-one'));

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    await tick(499);

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    await fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    await tick(1);

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();
    // The first tooltip renders when it opens, when it closes, and when the second tooltip puts it
    // in the instant phase. The second renders one time for its open and its instant phase.
    expect(screen.getByTestId('render-count-one').textContent).toBe('3');
    expect(screen.getByTestId('render-count-two').textContent).toBe('1');
    expect(screen.getByTestId('render-count-three').textContent).toBe('0');
  });

  // A member that uses the first store, and the second store after `useSecond` becomes `true`.
  // `closed` lists the stores that the group asked to close. After the render, `member` has the
  // group of the member and the popup id of the second store.
  function createMemberWithChangingStore(open: MaybeRefOrGetter<boolean>) {
    const closed: string[] = [];
    const useSecond = shallowRef(false);
    const member: { group?: DelayGroup; secondId?: string } = {};
    const Member = defineComponent({
      setup() {
        function useStore(name: string) {
          const { context } = useFloating();
          return Object.assign(context.rootStore, { closeForSibling: () => closed.push(name) });
        }
        const first = useStore('first');
        const second = useStore('second');
        member.group = useDelayGroup(() => (useSecond.value ? second : first), { open });
        member.secondId = second.select('defaultPopupId');
        return () => null;
      },
    });
    return { Member, closed, useSecond, member };
  }

  describe('rules with no Base UI case', () => {
    it('sets the instant phase before the popup of the second tooltip is inserted', async () => {
      await render(
        <Group delay={{ open: 1000, close: 0 }} timeoutMs={400}>
          <Tooltip label="one" />
          <Tooltip label="two" />
        </Group>,
      );
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(1000);
      expect(screen.getByTestId('floating-one')).not.toHaveAttribute('data-instant-phase');
      const records: MutationRecord[] = [];
      const observer = new MutationObserver((list) => records.push(...list));
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-instant-phase'],
        subtree: true,
      });
      onTestFinished(() => observer.disconnect());

      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));

      expect(screen.getByTestId('floating-two')).toHaveAttribute('data-instant-phase');
      const popupRecords = records
        .concat(observer.takeRecords())
        .filter((record) => (record.target as HTMLElement).dataset.testid === 'floating-two');
      expect(popupRecords).toHaveLength(0);
    });

    it('gives the new delay to the next open when no popup keeps the group active', async () => {
      const delay = shallowRef<Delay>({ open: 1000, close: 0 });
      await render(() => (
        <Group delay={delay.value}>
          <Tooltip label="one" />
        </Group>
      ));

      delay.value = { open: 300, close: 0 };
      await flushMicrotasks();
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(299);
      expect(isOpen('one')).toBe(false);

      await tick(1);
      expect(isOpen('one')).toBe(true);
    });

    it('keeps the open delay at 0 when the delay changes while a popup keeps the group active', async () => {
      const delay = shallowRef<Delay>({ open: 1000, close: 200 });
      await render(() => (
        <Group delay={delay.value}>
          <Tooltip label="one" />
          <Tooltip label="two" />
        </Group>
      ));
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(1000);

      delay.value = { open: 300, close: 200 };
      await flushMicrotasks();
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      await tick(1);

      expect(isOpen('two')).toBe(true);
    });

    it('gives the new delay to the popup that keeps the group active and to the next open', async () => {
      const delay = shallowRef<Delay>({ open: 1000, close: 200 });
      await render(() => (
        <Group delay={delay.value}>
          <Tooltip label="one" />
          <Tooltip label="two" />
        </Group>
      ));
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(1000);

      delay.value = { open: 300, close: 50 };
      await flushMicrotasks();
      await fireEvent.mouseLeave(screen.getByTestId('reference-one'));
      await tick(49);
      expect(isOpen('one')).toBe(true);

      await tick(1);
      expect(isOpen('one')).toBe(false);

      // The group has no timeout, so it ended with the close of the first popup.
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      await tick(299);
      expect(isOpen('two')).toBe(false);

      await tick(1);
      expect(isOpen('two')).toBe(true);
    });

    it('reads timeoutMs when a popup closes', async () => {
      const timeoutMs = shallowRef(500);
      await render(() => (
        <Group delay={{ open: 1000, close: 0 }} timeoutMs={timeoutMs.value}>
          <Tooltip label="one" />
          <Tooltip label="two" />
        </Group>
      ));
      timeoutMs.value = 100;
      await flushMicrotasks();
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(1000);
      await fireEvent.mouseLeave(screen.getByTestId('reference-one'));

      await tick(100);
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      await tick(999);
      expect(isOpen('two')).toBe(false);

      await tick(1);
      expect(isOpen('two')).toBe(true);
    });

    it('ends the group at once when timeoutMs changes to 0 while the timer of the group runs', async () => {
      const timeoutMs = shallowRef(500);
      await render(() => (
        <Group delay={{ open: 1000, close: 0 }} timeoutMs={timeoutMs.value}>
          <Tooltip label="one" />
          <Tooltip label="two" />
        </Group>
      ));
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(1000);
      await fireEvent.mouseLeave(screen.getByTestId('reference-one'));
      expect(isOpen('one')).toBe(false);

      timeoutMs.value = 0;
      await flushMicrotasks();
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      await tick(999);
      expect(isOpen('two')).toBe(false);

      await tick(1);
      expect(isOpen('two')).toBe(true);
    });

    it('joins the group when its popup is open at the mount', async () => {
      await render(
        <Group delay={{ open: 1000, close: 0 }}>
          <Tooltip label="one" defaultOpen />
          <Tooltip label="two" />
        </Group>,
      );

      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      await tick(1);

      expect({ one: isOpen('one'), two: isOpen('two') }).toEqual({ one: false, two: true });
    });

    it('ends the instant phase of a popup when it closes', async () => {
      await render(
        <Group delay={{ open: 1000, close: 0 }} timeoutMs={400}>
          <Tooltip label="one" />
          <Tooltip label="two" />
        </Group>,
      );
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(1000);
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      expect(screen.getByTestId('reference-two')).toHaveAttribute('data-instant-phase');

      await fireEvent.mouseLeave(screen.getByTestId('reference-two'));

      expect(isOpen('two')).toBe(false);
      expect(screen.getByTestId('reference-two')).not.toHaveAttribute('data-instant-phase');
    });

    it('gives the provider and the id of the popup that keeps the group active', async () => {
      const groups: Record<string, DelayGroup> = {};
      await render(
        <>
          <Tooltip label="outside" onGroup={(group) => (groups.outside = group)} />
          <Group delay={{ open: 1000, close: 0 }} timeoutMs={400}>
            <Tooltip label="one" onGroup={(group) => (groups.one = group)} />
          </Group>
        </>,
      );
      expect({ outside: groups.outside.hasProvider, one: groups.one.hasProvider }).toEqual({
        outside: false,
        one: true,
      });
      expect(groups.one.activeId()).toBeNull();

      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(1000);
      expect(groups.one.activeId()).toEqual(expect.any(String));

      await fireEvent.mouseLeave(screen.getByTestId('reference-one'));
      expect(groups.one.activeId()).toEqual(expect.any(String));

      await tick(400);
      expect(groups.one.activeId()).toBeNull();
    });

    it('shares one group between the tooltips that have no provider', async () => {
      await render(
        <>
          <Tooltip label="one" delay={{ open: 0, close: 5000 }} />
          <Tooltip label="two" delay={{ open: 0, close: 5000 }} />
        </>,
      );
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await fireEvent.mouseLeave(screen.getByTestId('reference-one'));
      await tick(100);
      expect(isOpen('one')).toBe(true);

      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));

      expect({ one: isOpen('one'), two: isOpen('two') }).toEqual({ one: false, two: true });
      expect(screen.getByTestId('floating-two')).toHaveAttribute('data-instant-phase');
    });

    it('leaves the group when its open popup unmounts', async () => {
      const GroupWithRemovableTooltip = defineComponent({
        setup() {
          const showFirst = shallowRef(true);

          return () => (
            <Group delay={{ open: 1000, close: 0 }} timeoutMs={500}>
              {showFirst.value && <Tooltip label="one" />}
              <Tooltip label="two" />
              <button
                type="button"
                onClick={() => {
                  showFirst.value = false;
                }}
              >
                Remove open
              </button>
            </Group>
          );
        },
      });
      await render(<GroupWithRemovableTooltip />);
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(1000);
      expect(isOpen('one')).toBe(true);

      await fireEvent.click(screen.getByRole('button', { name: 'Remove open' }));
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      await tick(999);
      expect(isOpen('two')).toBe(false);

      await tick(1);
      expect(isOpen('two')).toBe(true);
    });

    it('VUE-48: a popup that unmounts does not stop the timer that another popup started', async () => {
      const GroupWithRemovableTooltip = defineComponent({
        setup() {
          const showFirst = shallowRef(true);

          return () => (
            <Group delay={{ open: 1000, close: 0 }} timeoutMs={500}>
              {showFirst.value && <Tooltip label="one" />}
              <Tooltip label="two" />
              <Tooltip label="three" />
              <button
                type="button"
                onClick={() => {
                  showFirst.value = false;
                }}
              >
                Remove first
              </button>
            </Group>
          );
        },
      });
      await render(<GroupWithRemovableTooltip />);
      // The first popup closes and then the second popup takes the group. The second popup
      // closes, so its timer is the one that ends the group.
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(1000);
      await fireEvent.mouseLeave(screen.getByTestId('reference-one'));
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      await tick(1);
      await fireEvent.mouseLeave(screen.getByTestId('reference-two'));
      expect(isOpen('two')).toBe(false);

      await fireEvent.click(screen.getByRole('button', { name: 'Remove first' }));
      await tick(500);
      await fireEvent.mouseEnter(screen.getByTestId('reference-three'));
      await tick(999);
      expect(isOpen('three')).toBe(false);

      await tick(1);
      expect(isOpen('three')).toBe(true);
    });

    it('ends the instant phase on time while KeepAlive holds the group', async () => {
      const show = shallowRef(true);
      await render(() => (
        <KeepAlive>
          {show.value ? (
            <Group key="group" delay={{ open: 600, close: 0 }} timeoutMs={400}>
              <Tooltip label="one" />
              <Tooltip label="two" />
            </Group>
          ) : (
            <Other key="other" />
          )}
        </KeepAlive>
      ));
      await fireEvent.mouseEnter(screen.getByTestId('reference-one'));
      await tick(600);
      await fireEvent.mouseLeave(screen.getByTestId('reference-one'));
      expect(isOpen('one')).toBe(false);

      show.value = false;
      await flushMicrotasks();
      await tick(10000);
      show.value = true;
      await flushMicrotasks();
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      await tick(599);
      expect(isOpen('two')).toBe(false);

      await tick(1);
      expect(isOpen('two')).toBe(true);
    });

    it('uses the store that it has now', async () => {
      const open = shallowRef(false);
      const { Member, closed, useSecond } = createMemberWithChangingStore(open);
      await render(
        <Group delay={{ open: 1000, close: 0 }}>
          <Member />
          <Tooltip label="two" />
        </Group>,
      );

      useSecond.value = true;
      open.value = true;
      await flushMicrotasks();
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));

      expect(closed).toEqual(['second']);
    });

    it('keeps the group for its own popup when its store changes while the popup is open', async () => {
      const { Member, closed, useSecond, member } = createMemberWithChangingStore(true);
      await render(
        <Group delay={{ open: 1000, close: 0 }}>
          <Member />
        </Group>,
      );

      useSecond.value = true;
      await flushMicrotasks();

      expect(closed).toEqual([]);
      // The id is a string, so the next check cannot pass with two `undefined` values.
      expect(member.secondId).toEqual(expect.any(String));
      expect(member.group?.activeId()).toBe(member.secondId);
    });

    it('starts the timer of the group when its popup closes after a change of its store', async () => {
      const open = shallowRef(true);
      const { Member, useSecond } = createMemberWithChangingStore(open);
      await render(
        <Group delay={{ open: 1000, close: 0 }} timeoutMs={500}>
          <Member />
          <Tooltip label="two" />
        </Group>,
      );

      useSecond.value = true;
      await flushMicrotasks();
      open.value = false;
      await flushMicrotasks();
      await fireEvent.mouseEnter(screen.getByTestId('reference-two'));
      await tick(1);

      // The timer of the group runs, so the open delay of the group is 0.
      expect(isOpen('two')).toBe(true);
    });

    it('keeps the group active while the popup is open for another trigger', async () => {
      const open = shallowRef(false);
      const active = shallowRef('a');
      type TriggerStore = ReturnType<typeof useFloating>['context']['rootStore'] & {
        closeForSibling(): void;
      };
      // Vue runs the watchers of two parts in the order of their creation, so the watcher of `b`
      // runs before the watcher of `a`.
      const Trigger = defineComponent({
        props: {
          name: { type: String, required: true },
          store: { type: Object as PropType<TriggerStore>, required: true },
        },
        setup(props) {
          useDelayGroup(props.store, { open: () => open.value && active.value === props.name });
          return () => null;
        },
      });
      // One popup with two triggers.
      const PopupWithTwoTriggers = defineComponent({
        setup() {
          const { context } = useFloating({ open });
          const store = Object.assign(context.rootStore, { closeForSibling() {} });
          return () => (
            <>
              <Trigger name="b" store={store} />
              <Trigger name="a" store={store} />
            </>
          );
        },
      });
      await render(
        <Group delay={{ open: 1000, close: 0 }} timeoutMs={500}>
          <PopupWithTwoTriggers />
          <Tooltip label="other" />
        </Group>,
      );
      open.value = true;
      await flushMicrotasks();

      active.value = 'b';
      await flushMicrotasks();
      await tick(500);
      await fireEvent.mouseEnter(screen.getByTestId('reference-other'));
      await tick(1);

      expect(isOpen('other')).toBe(true);
    });
  });
});
