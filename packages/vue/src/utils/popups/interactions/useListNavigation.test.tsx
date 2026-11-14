import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, KeepAlive, nextTick, shallowRef, Teleport } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { platform } from '../../../common/platform';
import { reset as resetWarnings } from '../../../common/warn';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { mergeProps } from '../../../merge-props/mergeProps';
import { FOCUSABLE_ATTRIBUTE } from '../constants';
import type { FloatingRootStore } from '../floating-root/FloatingRootStore';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../tree/FloatingTree';
import type { InteractionProps } from '../types';
import { gridNavigation } from './gridNavigation';
import { useListNavigation } from './useListNavigation';
import type { UseListNavigationProps } from './useListNavigation';

// A module namespace is read-only. The mock gives `engine` as a plain object, so a case can set
// the flag.
vi.mock('../../../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../../../common/platform')>(
    '../../../common/platform',
  );
  return { platform: { ...actual.platform, engine: { ...actual.platform.engine } } };
});

function setWebKit(webkit: boolean) {
  const actual = platform.engine.webkit;
  Object.defineProperty(platform.engine, 'webkit', { value: webkit, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(platform.engine, 'webkit', { value: actual, configurable: true });
  });
}

type Orientation = 'vertical' | 'horizontal' | 'both';
type Options = Omit<Partial<UseListNavigationProps>, 'listRef' | 'activeIndex'>;

/** A click of the reference toggles the popup. */
function useToggle(rootStore: FloatingRootStore): InteractionProps {
  return {
    onClick(event) {
      rootStore.setOpen(
        !rootStore.select('open'),
        createChangeEventDetails(REASONS.triggerPress, event),
      );
    },
  };
}

const FLOATING_PROPS = { tabindex: -1, [FOCUSABLE_ATTRIBUTE]: '' };

interface ListExposed {
  activeIndex: number | null;
  changes: string[];
  proposals: (number | null)[];
  orientation: Orientation | undefined;
  setActiveIndex(index: number | null): void;
}

const renders = new Map<string, number>();

const Item = defineComponent({
  props: {
    name: { type: String, required: true },
    active: Boolean,
    disabled: Boolean,
    itemProps: { type: Object as PropType<InteractionProps>, required: true },
    setElement: {
      type: Function as PropType<(element: HTMLElement | null) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      renders.set(props.name, (renders.get(props.name) ?? 0) + 1);
      return (
        <div
          data-testid={`item-${props.name}`}
          tabindex={-1}
          aria-selected={props.active}
          aria-disabled={props.disabled || undefined}
          ref={(element) => props.setElement(element as HTMLElement | null)}
          {...props.itemProps}
        >
          {props.name}
        </div>
      );
    };
  },
});

/** A list of four items. The reference is a button, or an input for a list with virtual focus. */
const List = defineComponent({
  props: {
    options: { type: Object as PropType<Options>, default: () => ({}) },
    reference: { type: String as PropType<'button' | 'input'>, default: 'button' },
    role: { type: String, default: undefined },
    defaultOpen: Boolean,
    decline: Boolean,
  },
  setup(props, { expose }) {
    const open = shallowRef(props.defaultOpen);
    const activeIndex = shallowRef<number | null>(null);
    const listRef = shallowRef<(HTMLElement | null)[]>([]);
    const proposals: (number | null)[] = [];
    const changes: string[] = [];
    const { refs, context } = useFloating({
      open,
      onOpenChange(next, details) {
        changes.push(`${next}:${details.reason}:${details.event.type}`);
        open.value = next;
      },
    });
    const { rootStore } = context;
    const click = useToggle(rootStore);
    const navigation = useListNavigation(rootStore, {
      ...props.options,
      listRef,
      activeIndex,
      onNavigate(index, event) {
        proposals.push(index);
        if (!props.decline) {
          activeIndex.value = index;
        }
        props.options.onNavigate?.(index, event);
      },
    });
    const setElements = [0, 1, 2, 3].map((index) => (element: HTMLElement | null) => {
      listRef.value[index] = element;
    });
    expose({
      proposals,
      changes,
      get activeIndex() {
        return activeIndex.value;
      },
      get orientation() {
        return rootStore.context.orientation;
      },
      setActiveIndex(index: number | null) {
        activeIndex.value = index;
      },
    } satisfies ListExposed);

    return () => {
      const { disabledIndices } = props.options;
      const Reference = props.reference;
      return (
        <>
          <Reference
            data-testid="reference"
            style={{ pointerEvents: 'none' }}
            role={props.role}
            ref={refs.setReference}
            {...mergeProps(click, navigation.value.reference)}
          />
          {open.value && (
            <div
              role="menu"
              style={{ pointerEvents: 'none' }}
              ref={refs.setFloating}
              {...mergeProps(FLOATING_PROPS, navigation.value.floating)}
            >
              {['0', '1', '2', '3'].map((name, index) => (
                <Item
                  key={name}
                  name={name}
                  active={activeIndex.value === index}
                  disabled={
                    typeof disabledIndices === 'function'
                      ? disabledIndices(index)
                      : disabledIndices?.includes(index)
                  }
                  itemProps={navigation.value.item}
                  setElement={setElements[index]}
                />
              ))}
            </div>
          )}
        </>
      );
    };
  },
});

type Entry =
  string | { label: string; items: Entry[]; orientation?: Orientation; options?: Options };

interface ParentItem {
  props: InteractionProps;
  setElement(element: HTMLElement | null): void;
}

/** A menu with real focus. An entry with `items` is a menu below it. */
const NestedList = defineComponent({
  name: 'NestedList',
  props: {
    label: { type: String, required: true },
    items: { type: Array as PropType<Entry[]>, required: true },
    orientation: { type: String as PropType<Orientation>, default: 'vertical' },
    parentItem: { type: Object as PropType<ParentItem>, default: undefined },
    teleport: { type: Boolean, default: true },
    options: { type: Object as PropType<Options>, default: () => ({}) },
    popupProps: { type: Object as PropType<InteractionProps>, default: undefined },
  },
  setup(props) {
    const open = shallowRef(false);
    const activeIndex = shallowRef<number | null>(null);
    const listRef = shallowRef<(HTMLElement | null)[]>([]);
    const nodeId = useFloatingNodeId();
    const nested = useFloatingParentNodeId().value != null;
    const { refs, context } = useFloating({
      open,
      nodeId,
      onOpenChange(next) {
        open.value = next;
      },
    });
    const { rootStore } = context;
    const click = useToggle(rootStore);
    provideFloatingNode(nodeId);
    const navigation = useListNavigation(rootStore, {
      ...props.options,
      listRef,
      activeIndex,
      nested,
      orientation: () => props.orientation,
      onNavigate(index) {
        activeIndex.value = index;
      },
    });

    return () => (
      <>
        <button
          data-testid={`trigger-${props.label}`}
          data-active-index={activeIndex.value ?? ''}
          ref={(element) => {
            refs.setReference(element);
            props.parentItem?.setElement(element as HTMLElement | null);
          }}
          {...mergeProps(props.parentItem?.props, click, navigation.value.reference)}
        >
          {props.label}
        </button>
        {open.value && (
          <Teleport to="body" disabled={!props.teleport}>
            <div
              role="menu"
              data-testid={`menu-${props.label}`}
              ref={refs.setFloating}
              {...mergeProps(FLOATING_PROPS, navigation.value.floating, props.popupProps)}
            >
              {props.items.map((entry, index) =>
                typeof entry === 'string' ? (
                  <button
                    key={entry}
                    data-testid={`item-${entry}`}
                    ref={(element) => {
                      listRef.value[index] = element as HTMLElement | null;
                    }}
                    {...navigation.value.item}
                  >
                    {entry}
                  </button>
                ) : (
                  <NestedList
                    key={entry.label}
                    label={entry.label}
                    items={entry.items}
                    orientation={entry.orientation}
                    options={entry.options}
                    teleport={props.teleport}
                    parentItem={{
                      props: navigation.value.item,
                      setElement(element) {
                        listRef.value[index] = element;
                      },
                    }}
                  />
                ),
              )}
            </div>
          </Teleport>
        )}
      </>
    );
  },
});

const Tree = defineComponent({
  setup(_, { slots }) {
    provideFloatingTree();
    return () => slots.default?.();
  },
});

const reference = () => screen.getByTestId('reference');
const menu = () => screen.getByRole('menu');
const item = (name: number | string) => screen.getByTestId(`item-${name}`);
const part = (id: string) => screen.getByTestId(id);
const isOpen = (label: string) => screen.queryByTestId(`menu-${label}`) !== null;
const activeIndexOf = (label: string) => part(`trigger-${label}`).getAttribute('data-active-index');
const focused = () => document.activeElement?.getAttribute('data-testid');
const keyDown = (element: Element, key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(element, { key, ...init });
const move = { movementX: 10, movementY: 10 };
// A press of a real mouse. With no pressed button, `isVirtualPointerEvent` takes a 1x1 mouse press
// for a press of a screen reader.
const mousePress = { pointerType: 'mouse', width: 1, height: 1, buttons: 1, pressure: 0.5 };

async function renderList(props: InstanceType<typeof List>['$props'] = {}) {
  let list!: ListExposed;
  const result = await render(() => (
    <List
      {...props}
      ref={(instance) => {
        list = instance as unknown as ListExposed;
      }}
    />
  ));
  return { ...result, list };
}

const { render } = createRenderer();

describe('useListNavigation', () => {
  describe('real focus', () => {
    it('opens for an arrow key of the reference and gives the focus to the first item', async () => {
      const { list } = await renderList();

      const notPrevented = await keyDown(reference(), 'ArrowDown');

      expect(notPrevented).toBe(false);
      expect(list.changes).toEqual(['true:list-navigation:keydown']);
      await waitFor(() => expect(item(0)).toHaveFocus());
      expect(reference()).not.toHaveAttribute('aria-activedescendant');
      expect(menu()).not.toHaveAttribute('aria-activedescendant');
    });

    it('moves the focus with the keys of the popup, in the update of the key', async () => {
      await renderList();
      await keyDown(reference(), 'ArrowUp');
      await waitFor(() => expect(item(3)).toHaveFocus());

      await keyDown(menu(), 'ArrowUp');
      expect(item(2)).toHaveFocus();
      await keyDown(menu(), 'Home');
      expect(item(0)).toHaveFocus();
      await keyDown(menu(), 'End');
      expect(item(3)).toHaveFocus();
    });

    it('gives the focus to the item below the pointer, and to the popup when the pointer leaves', async () => {
      const { list } = await renderList({ options: { focusItemOnOpen: false } });
      await fireEvent.click(reference());

      await fireEvent.mouseMove(item(1), move);
      expect(item(1)).toHaveFocus();
      expect(list.activeIndex).toBe(1);

      await fireEvent.pointerLeave(item(1), { pointerType: 'mouse' });
      expect(menu()).toHaveFocus();
      expect(list.activeIndex).toBe(null);
    });

    it('gives the focus to the first item for a click of a screen reader', async () => {
      await renderList();

      // A dispatched click has no pointer type and the detail 0, as a virtual click has.
      await fireEvent.click(reference());

      await waitFor(() => expect(item(0)).toHaveFocus());
    });

    it('gives the focus to no item for a press of a mouse', async () => {
      const { list } = await renderList();

      await fireEvent.pointerDown(reference(), mousePress);
      await fireEvent.click(reference(), { detail: 1 });
      await flushMicrotasks();

      expect(menu()).toBeInTheDocument();
      expect(list.proposals).toEqual([]);
    });

    it('clears the active index when the reference of an open list gets the focus', async () => {
      const { list } = await renderList();
      await keyDown(reference(), 'ArrowDown');
      await waitFor(() => expect(item(0)).toHaveFocus());

      reference().focus();
      await nextTick();

      expect(list.activeIndex).toBe(null);
    });

    it('makes the selected item the active item at the open, and scrolls to it', async () => {
      const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
      onTestFinished(() => scrollIntoView.mockRestore());
      const { list } = await renderList({ options: { selectedIndex: 2, focusItemOnOpen: true } });

      await fireEvent.pointerDown(reference(), mousePress);
      await fireEvent.click(reference(), { detail: 1 });

      await waitFor(() => expect(item(2)).toHaveFocus());
      expect(list.proposals).toEqual([2]);
      await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
      expect(scrollIntoView.mock.contexts[0]).toBe(item(2));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });

      // The pointer moved, so a highlight from the pointer scrolls nothing.
      await fireEvent.pointerMove(menu(), move);
      await fireEvent.mouseMove(item(0), move);
      expect(item(0)).toHaveFocus();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('ignores a key that an input method handles', async () => {
      const { list } = await renderList();
      await keyDown(reference(), 'ArrowDown');
      await waitFor(() => expect(item(0)).toHaveFocus());

      await keyDown(menu(), 'ArrowDown', { keyCode: 229 });

      expect(list.activeIndex).toBe(0);
    });

    it('closes for Shift+Tab, and for Tab with `closeOnTab`, and gives the focus to the reference', async () => {
      const closeOnTab = shallowRef(false);
      await renderList({ options: { closeOnTab } });
      await keyDown(reference(), 'ArrowDown');
      await waitFor(() => expect(item(0)).toHaveFocus());

      await keyDown(item(0), 'Tab');
      expect(screen.queryByRole('menu')).toBeInTheDocument();

      await keyDown(item(0), 'Tab', { shiftKey: true });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(reference()).toHaveFocus();

      closeOnTab.value = true;
      await keyDown(reference(), 'ArrowDown');
      await waitFor(() => expect(item(0)).toHaveFocus());
      await keyDown(item(0), 'Tab');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('virtual focus', () => {
    const virtual = { virtual: true, id: 'list' };

    it('names the active item on the reference and on the popup, and keeps the focus', async () => {
      await renderList({ reference: 'input', defaultOpen: true, options: virtual });
      reference().focus();
      expect(reference()).not.toHaveAttribute('aria-activedescendant');

      await keyDown(reference(), 'ArrowDown');
      await keyDown(reference(), 'ArrowDown');

      expect(reference()).toHaveAttribute('aria-activedescendant', 'list-1');
      expect(menu()).toHaveAttribute('aria-activedescendant', 'list-1');
      expect(reference()).toHaveFocus();
    });

    it('does not name the active item on the popup of a combobox input', async () => {
      await renderList({
        reference: 'input',
        role: 'combobox',
        defaultOpen: true,
        options: virtual,
      });

      await keyDown(reference(), 'ArrowDown');

      expect(reference()).toHaveAttribute('aria-activedescendant', 'list-0');
      expect(menu()).not.toHaveAttribute('aria-activedescendant');
    });

    it('renders an item again only when its own state changes', async () => {
      await renderList({ reference: 'input', defaultOpen: true, options: virtual });
      renders.clear();

      await keyDown(reference(), 'ArrowDown');
      await keyDown(reference(), 'ArrowDown');

      expect(Object.fromEntries(renders)).toEqual({ '0': 2, '1': 1 });
    });

    it('starts from the active index of the consumer when the consumer declined a navigation', async () => {
      const { list } = await renderList({
        reference: 'input',
        defaultOpen: true,
        decline: true,
        options: virtual,
      });
      list.setActiveIndex(1);
      await nextTick();

      await keyDown(reference(), 'ArrowDown');
      await keyDown(reference(), 'ArrowDown');
      await keyDown(reference(), 'ArrowUp');

      expect(list.proposals).toEqual([2, 2, 0]);
    });
  });

  describe('options', () => {
    it('follows a change of `orientation`, of `loopFocus` and of a `disabledIndices` function', async () => {
      const orientation = shallowRef<Orientation>('vertical');
      const loopFocus = shallowRef(false);
      const disabled = shallowRef<number[]>([]);
      const { list } = await renderList({
        options: {
          orientation,
          loopFocus,
          disabledIndices: (index) => disabled.value.includes(index),
        },
      });
      await keyDown(reference(), 'ArrowDown');
      await waitFor(() => expect(item(0)).toHaveFocus());
      expect(list.orientation).toBe('vertical');

      orientation.value = 'horizontal';
      await nextTick();
      expect(list.orientation).toBe('horizontal');
      await keyDown(menu(), 'ArrowDown');
      expect(item(0)).toHaveFocus();
      await keyDown(menu(), 'ArrowRight');
      expect(item(1)).toHaveFocus();

      disabled.value = [2, 3];
      await keyDown(menu(), 'ArrowRight');
      expect(item(1)).toHaveFocus();

      loopFocus.value = true;
      await keyDown(menu(), 'ArrowRight');
      // A step from one end to the other end gets the focus in the next frame.
      await waitFor(() => expect(item(0)).toHaveFocus());
    });

    it('does nothing while `enabled` is false, and follows a change', async () => {
      const enabled = shallowRef(false);
      const { list } = await renderList({
        reference: 'input',
        defaultOpen: true,
        options: { enabled, virtual: true, id: 'list' },
      });
      list.setActiveIndex(1);
      await nextTick();

      await keyDown(reference(), 'ArrowDown');
      await fireEvent.mouseMove(item(3), move);
      expect(list.proposals).toEqual([]);
      expect(reference()).not.toHaveAttribute('aria-activedescendant');

      enabled.value = true;
      await nextTick();
      expect(reference()).toHaveAttribute('aria-activedescendant', 'list-1');
      await keyDown(reference(), 'ArrowDown');
      expect(list.proposals).toEqual([2]);
    });

    it('with real focus, makes no proposal and moves no focus while `enabled` is false', async () => {
      const { list } = await renderList({
        options: { enabled: false, selectedIndex: 2, focusItemOnOpen: true },
      });

      await fireEvent.click(reference(), { detail: 1 });
      list.setActiveIndex(1);
      await waitSingleFrame();
      await waitSingleFrame();

      expect(menu()).toBeInTheDocument();
      expect(list.proposals).toEqual([]);
      expect(document.body).toHaveFocus();

      await keyDown(menu(), 'ArrowDown');

      expect(list.proposals).toEqual([]);

      item(3).focus();
      await nextTick();
      expect(list.proposals).toEqual([]);

      await fireEvent.pointerLeave(item(3), { pointerType: 'mouse' });
      expect(list.proposals).toEqual([]);

      reference().focus();
      await nextTick();
      expect(list.proposals).toEqual([]);
    });

    it('moves by row with the navigator that the `grid` getter gives', async () => {
      const { list } = await renderList({
        reference: 'input',
        defaultOpen: true,
        options: { virtual: true, orientation: 'horizontal', grid: () => gridNavigation },
      });

      await keyDown(reference(), 'ArrowRight');
      await keyDown(reference(), 'ArrowDown');
      expect(list.activeIndex).toBe(2);
      await keyDown(reference(), 'ArrowRight');
      expect(list.activeIndex).toBe(3);
      await keyDown(reference(), 'ArrowUp');
      expect(list.activeIndex).toBe(1);
    });

    it('warns about options that do not agree', async () => {
      resetWarnings();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => warn.mockRestore());

      await renderList({ options: { allowEscape: true, grid: () => gridNavigation } });

      expect(warn.mock.calls.map(([message]) => message)).toEqual([
        'Vase UI: `useListNavigation` has `allowEscape` and no `loopFocus`. `allowEscape` has no effect while `loopFocus` is `false`. Set `loopFocus` to `true`, or remove `allowEscape`.',
        'Vase UI: `useListNavigation` has `allowEscape` and no `virtual`. With real focus, an item of the list always has the focus. Set `virtual` to `true`, or remove `allowEscape`.',
        'Vase UI: `useListNavigation` has a `grid` and the orientation "vertical". The horizontal arrow keys then do not move the highlight in the grid. Set `orientation` to "horizontal" or "both".',
      ]);
    });

    it('warns again when a change of an option makes the options disagree', async () => {
      const allowEscape = shallowRef(false);
      await renderList({ options: { allowEscape, virtual: true } });
      // `warn` logs a message one time, so an earlier case can have logged this one.
      resetWarnings();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => warn.mockRestore());

      allowEscape.value = true;
      await nextTick();

      expect(warn.mock.calls.map(([message]) => message)).toEqual([
        'Vase UI: `useListNavigation` has `allowEscape` and no `loopFocus`. `allowEscape` has no effect while `loopFocus` is `false`. Set `loopFocus` to `true`, or remove `allowEscape`.',
      ]);
    });
  });

  describe('lists below the list in the component tree', () => {
    const forms = [
      { name: 'a Teleport', teleport: true },
      { name: 'the popup element', teleport: false },
    ];
    const entries: Entry[] = ['one', 'two', { label: 'more', items: ['x', 'y'] }, 'four'];

    async function openMore(
      orientation: Orientation,
      teleport: boolean,
      options: Options = {},
      popupProps?: InteractionProps,
    ) {
      await render(
        <Tree>
          <NestedList
            label="root"
            orientation={orientation}
            teleport={teleport}
            items={entries}
            options={options}
            popupProps={popupProps}
          />
        </Tree>,
      );
      const toEnd = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      await keyDown(part('trigger-root'), toEnd);
      await waitFor(() => expect(item('one')).toHaveFocus());
      await keyDown(part('menu-root'), toEnd);
      await keyDown(part('menu-root'), toEnd);
      expect(part('trigger-more')).toHaveFocus();
      // The key that opens a list below: the cross axis of the list above.
      await keyDown(part('trigger-more'), orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown');
      await waitFor(() => expect(item('x')).toHaveFocus());
    }

    // A click gives the focus to no item, so the focus stays on `<body>`.
    async function clickTriggers(...labels: string[]) {
      for (const label of labels) {
        await fireEvent.click(part(`trigger-${label}`), { detail: 1 });
      }
    }

    it.each(forms)(
      'keeps the keys of a list in $name away from the list above',
      async ({ teleport }) => {
        await openMore('vertical', teleport);

        await keyDown(part('menu-more'), 'ArrowDown');
        expect(item('y')).toHaveFocus();
        expect(activeIndexOf('root')).toBe('2');

        // The close key is not a key of the vertical list above, so the list below stops it.
        const notPrevented = await keyDown(part('menu-more'), 'ArrowLeft');
        expect(notPrevented).toBe(false);
        expect(isOpen('more')).toBe(false);
        expect(part('trigger-more')).toHaveFocus();
        expect(activeIndexOf('root')).toBe('2');

        await keyDown(part('menu-root'), 'ArrowDown');
        expect(item('four')).toHaveFocus();
      },
    );

    it.each(forms)(
      'VUE-46: gives a key that a list in $name does not stop to the list above one time',
      async ({ teleport }) => {
        await openMore('horizontal', teleport);

        // The close key of the list below is also a key of the horizontal list above.
        await keyDown(part('menu-more'), 'ArrowLeft');

        expect(isOpen('more')).toBe(false);
        expect(activeIndexOf('root')).toBe('1');
        expect(item('two')).toHaveFocus();
      },
    );

    it('moves the list above from its own index for a key that the list below does not use', async () => {
      await openMore('horizontal', true);

      // The focus is in the popup below. `Teleport` moved that popup out of the popup above.
      await keyDown(part('menu-more'), 'ArrowRight');

      expect(activeIndexOf('root')).toBe('3');
      expect(item('four')).toHaveFocus();
    });

    it('does not give a key that a list in the middle stops to the list above it', async () => {
      const middle: Entry = {
        label: 'more',
        orientation: 'horizontal',
        items: ['m1', { label: 'deep', items: ['x', 'y'] }, 'm3'],
      };
      await render(
        <Tree>
          <NestedList label="root" orientation="horizontal" items={['one', middle, 'three']} />
        </Tree>,
      );
      await clickTriggers('root', 'more', 'deep');
      expect(isOpen('deep')).toBe(true);

      // The list below does not use this key. The list in the middle uses it and stops it.
      await keyDown(part('menu-deep'), 'ArrowRight');

      expect(activeIndexOf('more')).toBe('0');
      expect(activeIndexOf('root')).toBe('');
    });

    it('lets a handler of the popup element stop a key of a list in that element', async () => {
      await openMore('horizontal', false, undefined, {
        onKeydown(event: KeyboardEvent & { preventVaseUIHandler?: () => void }) {
          if (event.key === 'ArrowLeft') {
            event.preventVaseUIHandler?.();
          }
        },
      });

      await keyDown(part('menu-more'), 'ArrowLeft');

      expect(isOpen('more')).toBe(false);
      expect(activeIndexOf('root')).toBe('2');
    });

    it('passes a key through a list that is not enabled to the list above', async () => {
      const middle: Entry = {
        label: 'more',
        orientation: 'horizontal',
        options: { enabled: false },
        items: [{ label: 'deep', items: ['x', 'y'] }],
      };
      await render(
        <Tree>
          <NestedList label="root" orientation="horizontal" items={['one', middle]} />
        </Tree>,
      );
      await clickTriggers('root', 'more', 'deep');
      expect(isOpen('deep')).toBe(true);

      // The list below does not use this key, and the list in the middle is not enabled.
      await keyDown(part('menu-deep'), 'ArrowRight');

      expect(activeIndexOf('more')).toBe('');
      expect(activeIndexOf('root')).toBe('0');
    });

    it('gives a key of the popup of a list that is not enabled to the list above', async () => {
      const notEnabled: Entry = { label: 'more', options: { enabled: false }, items: ['x', 'y'] };
      await render(
        <Tree>
          <NestedList label="root" orientation="horizontal" items={['one', notEnabled]} />
        </Tree>,
      );
      await clickTriggers('root', 'more');
      expect(isOpen('more')).toBe(true);

      await keyDown(part('menu-more'), 'ArrowRight');

      expect(activeIndexOf('root')).toBe('0');
      expect(activeIndexOf('more')).toBe('');
    });

    it('gives no focus to the popup above when a list that is not enabled closes', async () => {
      const notEnabled: Entry = { label: 'more', options: { enabled: false }, items: ['x', 'y'] };
      await render(
        <Tree>
          <NestedList label="root" items={['one', notEnabled]} />
        </Tree>,
      );

      await clickTriggers('root', 'more', 'more');
      await flushMicrotasks();

      expect(isOpen('more')).toBe(false);
      expect(document.body).toHaveFocus();
    });

    it('keeps the list above open for a Tab key in the list below', async () => {
      await openMore('vertical', true, { closeOnTab: true });

      await keyDown(item('x'), 'Tab');
      expect(isOpen('root')).toBe(true);
      expect(isOpen('more')).toBe(true);

      await keyDown(item('x'), 'Tab', { shiftKey: true });
      expect(isOpen('root')).toBe(true);
      expect(isOpen('more')).toBe(false);
      expect(part('trigger-more')).toHaveFocus();

      await keyDown(part('trigger-more'), 'Tab');
      expect(isOpen('root')).toBe(false);
      expect(part('trigger-root')).toHaveFocus();
    });

    it('gives the focus to the popup above when the list below closes with the focus outside the tree', async () => {
      await render(
        <Tree>
          <NestedList label="root" items={entries} />
        </Tree>,
      );
      await fireEvent.click(part('trigger-root'), { detail: 1 });
      await fireEvent.click(part('trigger-more'), { detail: 1 });
      await flushMicrotasks();
      expect(document.body).toHaveFocus();

      await fireEvent.click(part('trigger-more'), { detail: 1 });
      await flushMicrotasks();

      expect(isOpen('more')).toBe(false);
      expect(part('menu-root')).toHaveFocus();
    });
  });

  describe('WebKit', () => {
    it('ignores a pointer that does not move while the list scrolls below it', async () => {
      setWebKit(true);
      const { list } = await renderList();
      await keyDown(reference(), 'ArrowDown');
      await waitFor(() => expect(item(0)).toHaveFocus());

      await fireEvent.pointerMove(menu(), { pointerType: 'mouse' });
      await fireEvent.mouseMove(item(1));
      expect(list.activeIndex).toBe(0);
      // The pointer still counts as the keyboard, so a leave does not clear the highlight.
      await fireEvent.pointerLeave(item(0), { pointerType: 'mouse' });
      expect(list.activeIndex).toBe(0);

      await fireEvent.mouseMove(item(1), move);
      expect(list.activeIndex).toBe(1);
    });
  });

  describe('KeepAlive', () => {
    it('gives the focus back to the active item at the activation', async () => {
      let list!: ListExposed;
      const page = shallowRef<'list' | 'other'>('list');
      const Other = defineComponent({ setup: () => () => <p>other</p> });
      await render(() => (
        <KeepAlive>
          {page.value === 'list' ? (
            <List
              key="list"
              options={{ selectedIndex: 0 }}
              ref={(instance) => {
                if (instance) {
                  list = instance as unknown as ListExposed;
                }
              }}
            />
          ) : (
            <Other key="other" />
          )}
        </KeepAlive>
      ));
      await keyDown(reference(), 'ArrowDown');
      await waitFor(() => expect(item(0)).toHaveFocus());
      await keyDown(menu(), 'ArrowDown');
      expect(item(1)).toHaveFocus();

      page.value = 'other';
      await flushMicrotasks();
      expect(document.body).toHaveFocus();

      page.value = 'list';
      await waitFor(() => expect(item(1)).toHaveFocus());
      expect(list.proposals).toEqual([0, 1]);
      await keyDown(menu(), 'ArrowDown');
      expect(focused()).toBe('item-2');
    });
  });
});
