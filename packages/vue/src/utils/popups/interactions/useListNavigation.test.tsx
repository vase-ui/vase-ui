import { describe, expect, it, onTestFinished, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  defineComponent,
  inject,
  KeepAlive,
  nextTick,
  onMounted,
  provide,
  shallowRef,
  Teleport,
  useId,
  watch,
} from 'vue';
import type { InjectionKey, PropType, StyleValue } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  useTestInteractions,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import CompositeList from '../../../../test/fixtures/CompositeListPart.vue';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { reset as resetWarnings } from '../../../common/warn';
import { useCompositeListItem } from '../../../internals/composite/list/useCompositeListItem';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { mergeProps } from '../../../merge-props/mergeProps';
import { FOCUSABLE_ATTRIBUTE } from '../constants';
import type { FloatingRootStore } from '../floating-root/FloatingRootStore';
import FloatingFocusManager from '../focus/FloatingFocusManager.vue';
import FloatingPortal from '../portal/FloatingPortal.vue';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
} from '../tree/FloatingTree';
import type { InteractionProps } from '../types';
import { gridNavigation } from './gridNavigation';
import { useClick } from './useClick';
import { useDismiss } from './useDismiss';
import { useListNavigation } from './useListNavigation';
import type { UseListNavigationProps } from './useListNavigation';
import { useTypeahead } from './useTypeahead';

const { render } = createRenderer();

type AppProps = Omit<Partial<UseListNavigationProps>, 'listRef'> & {
  disableFirstItem?: boolean;
  hideFirstItem?: boolean;
  firstItemStyle?: StyleValue;
};

const App = defineComponent(
  (inProps: AppProps) => {
    const { disableFirstItem, hideFirstItem, firstItemStyle, ...props } = inProps;
    const open = shallowRef(false);
    const listRef = shallowRef<Array<HTMLLIElement | null>>([]);
    const activeIndex = shallowRef<null | number>(null);
    const { refs, context } = useFloating({
      open,
      onOpenChange(nextOpen) {
        open.value = nextOpen;
      },
    });
    const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([
      useClick(context.rootStore),
      useListNavigation(context.rootStore, {
        ...props,
        listRef,
        activeIndex,
        onNavigate(index) {
          activeIndex.value = index;
          props.onNavigate?.(index, undefined);
        },
      }),
    ]);

    return () => (
      <>
        <button {...getReferenceProps({ ref: refs.setReference })} />
        {open.value && (
          <div role="menu" {...getFloatingProps({ ref: refs.setFloating })}>
            <ul>
              {['one', 'two', 'three'].map((string, index) => {
                let style: StyleValue | undefined;

                if (index === 0) {
                  style = hideFirstItem ? { display: 'none' } : firstItemStyle;
                }

                return (
                  <li
                    data-testid={`item-${index}`}
                    aria-selected={activeIndex.value === index}
                    key={string}
                    style={style}
                    tabindex={-1}
                    aria-disabled={
                      (disableFirstItem && index === 0) ||
                      (typeof props.disabledIndices === 'function'
                        ? props.disabledIndices(index)
                        : props.disabledIndices?.includes(index))
                    }
                    {...getItemProps({
                      ref(node) {
                        listRef.value[index] = node as HTMLLIElement | null;
                      },
                    })}
                  >
                    {string}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </>
    );
  },
  {
    props: [
      'disableFirstItem',
      'hideFirstItem',
      'firstItemStyle',
      'onNavigate',
      'orientation',
      'loopFocus',
      'rtl',
      'disabledIndices',
      'focusItemOnOpen',
      'focusItemOnHover',
      'selectedIndex',
      'allowEscape',
      'virtual',
      'openOnArrowKeyDown',
    ],
  },
);

const VirtualizedGridRows = defineComponent(
  ({
    totalItems = 100,
    initialActiveIndex = 0,
    loopFocus = true,
    disabledIndices,
    hiddenIndices,
  }: {
    totalItems?: number;
    initialActiveIndex?: number;
    loopFocus?: boolean;
    disabledIndices?: UseListNavigationProps['disabledIndices'];
    hiddenIndices?: number[];
  }) => {
    const COLUMNS = 5;
    const VISIBLE_ROWS = 3;

    const open = shallowRef(true);
    const activeIndex = shallowRef<number | null>(initialActiveIndex);
    const listRef = shallowRef<Array<HTMLButtonElement | null>>([]);

    const { refs, context } = useFloating({
      open,
      onOpenChange(nextOpen) {
        open.value = nextOpen;
      },
    });

    const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([
      useListNavigation(context.rootStore, {
        listRef,
        activeIndex,
        onNavigate(index) {
          activeIndex.value = index;
        },
        virtual: true,
        loopFocus,
        orientation: 'horizontal',
        disabledIndices,
        grid: () => gridNavigation,
      }),
    ]);

    onMounted(() => {
      listRef.value.length = totalItems;
    });

    return () => (
      <>
        <input
          data-testid="virtual-grid-reference"
          {...getReferenceProps({ ref: refs.setReference })}
        />
        {open.value && (
          <div
            role="grid"
            data-testid="virtual-grid-floating"
            {...getFloatingProps({ ref: refs.setFloating })}
          >
            {Array.from({ length: VISIBLE_ROWS }, (_row, rowIndex) => (
              <div key={rowIndex} role="row">
                {Array.from({ length: COLUMNS }, (_column, columnIndex) => {
                  const itemIndex = rowIndex * COLUMNS + columnIndex;
                  if (itemIndex >= totalItems) {
                    return null;
                  }

                  return (
                    <button
                      key={itemIndex}
                      type="button"
                      role="gridcell"
                      style={hiddenIndices?.includes(itemIndex) ? { display: 'none' } : undefined}
                      data-active={activeIndex.value === itemIndex ? '' : undefined}
                      {...getItemProps({
                        ref(node) {
                          listRef.value[itemIndex] = node as HTMLButtonElement | null;
                        },
                      })}
                    >
                      {itemIndex}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <span data-testid="virtual-grid-active-index" data-active-index={activeIndex.value ?? ''} />
      </>
    );
  },
  {
    props: ['totalItems', 'initialActiveIndex', 'loopFocus', 'disabledIndices', 'hiddenIndices'],
  },
);

// The test components of Base UI in `test/floating-ui-tests`, with only what the cases read.

function gridNavigationWithColumns(cols: number): typeof gridNavigation {
  return (
    event,
    prevIndex,
    listRef,
    orientation,
    loopFocus,
    rtl,
    disabledIndices,
    minIndex,
    maxIndex,
  ) =>
    gridNavigation(
      event,
      prevIndex,
      listRef,
      orientation,
      loopFocus,
      rtl,
      disabledIndices,
      minIndex,
      maxIndex,
      cols,
    );
}

interface GridProps {
  orientation?: 'horizontal' | 'both';
  loopFocus?: boolean;
  rtl?: boolean;
}

/** `Main` of `Grid.tsx` and of `ComplexGrid.tsx`. They differ only in these values. */
function createGrid(options: {
  cols: number;
  count: number;
  disabledIndices: number[];
  role: string | undefined;
}) {
  const grid = gridNavigationWithColumns(options.cols);
  const { disabledIndices } = options;
  const columns = Array.from({ length: options.cols }, () => '100px').join(' ');

  return defineComponent(
    ({ orientation = 'horizontal', loopFocus = false, rtl = false }: GridProps) => {
      const open = shallowRef(false);
      const activeIndex = shallowRef<number | null>(null);

      const listRef = shallowRef<Array<HTMLElement | null>>([]);

      const { refs, context } = useFloating({
        open,
        onOpenChange(nextOpen) {
          open.value = nextOpen;
        },
        placement: 'bottom-start',
      });

      const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([
        useClick(context.rootStore),
        useListNavigation(context.rootStore, {
          listRef,
          activeIndex,
          onNavigate(index) {
            activeIndex.value = index;
          },
          orientation,
          loopFocus,
          rtl,
          openOnArrowKeyDown: false,
          disabledIndices,
          grid: () => grid,
        }),
        useDismiss(context.rootStore),
      ]);

      return () => (
        <>
          <button type="button" {...getReferenceProps({ ref: refs.setReference })}>
            Reference
          </button>
          {open.value && (
            <FloatingFocusManager store={context.rootStore}>
              <div
                role={options.role}
                data-testid="floating"
                style={{ display: 'grid', gridTemplateColumns: columns }}
                {...getFloatingProps({ ref: refs.setFloating })}
              >
                {Array.from({ length: options.count }, (_, index) => (
                  <button
                    type="button"
                    role="option"
                    key={index}
                    aria-selected={activeIndex.value === index}
                    tabindex={activeIndex.value === index ? 0 : -1}
                    disabled={disabledIndices.includes(index) || undefined}
                    {...getItemProps({
                      ref(node) {
                        listRef.value[index] = node as HTMLElement | null;
                      },
                    })}
                  >
                    Item {index}
                  </button>
                ))}
              </div>
            </FloatingFocusManager>
          )}
        </>
      );
    },
    { props: ['orientation', 'loopFocus', 'rtl'] },
  );
}

const Grid = createGrid({
  cols: 5,
  count: 49,
  disabledIndices: [0, 1, 2, 3, 4, 5, 6, 7, 10, 15, 45, 48],
  role: 'menu',
});

const ComplexGrid = createGrid({
  cols: 7,
  count: 37,
  disabledIndices: [0, 1, 2, 3, 4, 5, 6, 9, 14, 23, 35],
  role: undefined,
});

const emojiGrid = gridNavigationWithColumns(3);

const emojis = [
  { name: 'apple', emoji: '🍎' },
  { name: 'orange', emoji: '🍊' },
  { name: 'watermelon', emoji: '🍉' },
  { name: 'strawberry', emoji: '🍓' },
  { name: 'pear', emoji: '🍐' },
  { name: 'banana', emoji: '🍌' },
  { name: 'pineapple', emoji: '🍍' },
  { name: 'cherry', emoji: '🍒' },
  { name: 'peach', emoji: '🍑' },
];

/** `Main` of `EmojiPicker.tsx`. Base UI also positions the picker, and no case reads the place. */
const EmojiPicker = defineComponent(() => {
  const open = shallowRef(false);
  const search = shallowRef('');
  const selectedEmoji = shallowRef<string | null>(null);
  const activeIndex = shallowRef<number | null>(null);

  const listRef = shallowRef<Array<HTMLElement | null>>([]);

  const noResultsId = useId();

  const { refs, context } = useFloating({
    placement: 'bottom-start',
    open,
    onOpenChange(nextOpen) {
      open.value = nextOpen;
    },
  });

  // Handles opening the floating element via the Choose Emoji button.
  const { getReferenceProps, getFloatingProps } = useTestInteractions([
    useClick(context.rootStore),
    useDismiss(context.rootStore),
    () => ({
      reference: { 'aria-haspopup': 'menu' as const, 'aria-expanded': open.value },
      floating: { role: 'menu' },
    }),
  ]);

  // Handles the list navigation where the reference is the inner input, not
  // the button that opens the floating element.
  const {
    getReferenceProps: getInputProps,
    getFloatingProps: getListFloatingProps,
    getItemProps,
  } = useTestInteractions([
    useListNavigation(context.rootStore, {
      listRef,
      onNavigate(index) {
        if (open.value) {
          activeIndex.value = index;
        }
      },
      activeIndex,
      orientation: 'horizontal',
      loopFocus: true,
      focusItemOnOpen: false,
      virtual: true,
      allowEscape: true,
      grid: () => emojiGrid,
    }),
  ]);

  watch(open, (isOpen) => {
    if (!isOpen) {
      search.value = '';
      activeIndex.value = null;
    }
  });

  const filteredEmojis = () =>
    emojis.filter(({ name }) =>
      name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()),
    );

  const handleEmojiClick = () => {
    if (activeIndex.value !== null) {
      selectedEmoji.value = filteredEmojis()[activeIndex.value].emoji;
      open.value = false;
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleEmojiClick();
    }
  };

  const handleInputChange = (event: Event) => {
    activeIndex.value = null;
    search.value = (event.target as HTMLInputElement).value;
  };

  return () => {
    const filtered = filteredEmojis();
    return (
      <>
        <button
          type="button"
          aria-label="Choose emoji"
          data-open={open.value ? '' : undefined}
          {...getReferenceProps({ ref: refs.setReference })}
        >
          ☻
        </button>
        {selectedEmoji.value && <span>{selectedEmoji.value} selected</span>}
        <FloatingPortal>
          {open.value && (
            <FloatingFocusManager store={context.rootStore} modal={false}>
              <div {...getFloatingProps({ ...getListFloatingProps(), ref: refs.setFloating })}>
                <span>Emoji Picker</span>
                <input
                  placeholder="Search emoji"
                  value={search.value}
                  aria-controls={filtered.length === 0 ? noResultsId : undefined}
                  {...getInputProps({
                    onInput: handleInputChange,
                    onKeydown: handleKeyDown,
                  })}
                />
                {filtered.length === 0 && (
                  <p key={search.value} id={noResultsId} role="region">
                    No results.
                  </p>
                )}
                {filtered.length > 0 && (
                  <div role="listbox">
                    {filtered.map(({ name, emoji }, index) => (
                      <button
                        key={name}
                        role="option"
                        aria-selected={selectedEmoji.value === emoji}
                        disabled={name === 'orange' || undefined}
                        aria-label={name}
                        tabindex={-1}
                        data-active={activeIndex.value === index ? '' : undefined}
                        type="button"
                        {...getItemProps({
                          ref(node) {
                            listRef.value[index] = node as HTMLElement | null;
                          },
                          onClick: handleEmojiClick,
                        })}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <span
                  data-testid="emoji-picker-active-index"
                  data-active-index={activeIndex.value ?? ''}
                  style={{ display: 'none' }}
                />
              </div>
            </FloatingFocusManager>
          )}
        </FloatingPortal>
      </>
    );
  };
});

interface SelectContextValue {
  activeIndex: () => number | null;
  selectedIndex: () => number | null;
  getItemProps: ReturnType<typeof useTestInteractions>['getItemProps'];
  handleSelect: (index: number | null) => void;
}

const SelectContext: InjectionKey<SelectContextValue> = Symbol('SelectContext');

/** `Listbox` of `ListboxFocus.tsx`. */
const Listbox = defineComponent((_props, { slots }) => {
  const activeIndex = shallowRef<number | null>(1);
  const selectedIndex = shallowRef<number | null>(null);

  const { refs, context } = useFloating({
    open: true,
  });

  const elementsRef = shallowRef<Array<HTMLElement | null>>([]);
  const labelsRef = shallowRef<Array<string | null>>([]);

  function handleSelect(index: number | null) {
    selectedIndex.value = index;
  }

  function handleTypeaheadMatch(index: number | null) {
    activeIndex.value = index;
  }

  const listNav = useListNavigation(context.rootStore, {
    listRef: elementsRef,
    activeIndex,
    selectedIndex,
    onNavigate(index) {
      activeIndex.value = index;
    },
    focusItemOnHover: false,
  });
  const typeahead = useTypeahead(context.rootStore, {
    listRef: labelsRef,
    activeIndex,
    selectedIndex,
    onMatch: handleTypeaheadMatch,
  });
  const { getFloatingProps, getItemProps } = useTestInteractions([listNav, typeahead]);

  provide(SelectContext, {
    activeIndex: () => activeIndex.value,
    selectedIndex: () => selectedIndex.value,
    getItemProps,
    handleSelect,
  });

  return () => (
    <>
      <button
        onClick={() => {
          selectedIndex.value = 1;
        }}
        data-testid="reference"
        type="button"
      >
        Select
      </button>
      <div role="listbox" {...getFloatingProps({ ref: refs.setFloating })}>
        <CompositeList elementsRef={elementsRef} labelsRef={labelsRef}>
          {slots.default?.()}
        </CompositeList>
      </div>
    </>
  );
});

/** `Option` of `ListboxFocus.tsx`. */
const ListboxOption = defineComponent(
  (props: { label: string }) => {
    const { activeIndex, selectedIndex, getItemProps, handleSelect } = inject(SelectContext)!;

    const { ref, index } = useCompositeListItem({ label: () => props.label });

    return () => {
      const isActive = activeIndex() === index.value;
      const isSelected = selectedIndex() === index.value;

      const isFocusable =
        activeIndex() !== null
          ? isActive
          : selectedIndex() !== null
            ? isSelected
            : index.value === 0;

      return (
        <button
          ref={(node) => ref(node as HTMLElement | null)}
          type="button"
          role="option"
          aria-selected={isActive && isSelected}
          tabindex={isFocusable ? 0 : -1}
          style={{
            background: isActive ? 'cyan' : '',
            fontWeight: isSelected ? 'bold' : '',
          }}
          {...getItemProps({
            onClick: () => handleSelect(index.value),
          })}
        >
          {props.label}
        </button>
      );
    };
  },
  { props: ['label'] },
);

/** `Main` of `ListboxFocus.tsx`. */
const ListboxFocus = defineComponent(() => () => (
  <Listbox>
    <ListboxOption label="Apple" />
    <ListboxOption label="Blueberry" />
    <ListboxOption label="Watermelon" />
    <ListboxOption label="Banana" />
  </Listbox>
));

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
  proposals: Array<number | null>;
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
    const listRef = shallowRef<Array<HTMLElement | null>>([]);
    const proposals: Array<number | null> = [];
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
            role={props.role}
            ref={refs.setReference}
            {...mergeProps(click, navigation.value.reference)}
          />
          {open.value && (
            <div
              role="menu"
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
    const listRef = shallowRef<Array<HTMLElement | null>>([]);
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
    // A positioner gives its context to the node of the popup. The node registers in
    // `onBeforeMount`, so it is in the tree here.
    const tree = useFloatingTree();
    onMounted(() => {
      const node = tree.value?.nodesRef.value.find((entry) => entry.id === nodeId);
      if (node) {
        node.context = rootStore.context.positioning;
      }
    });
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

describe('useListNavigation', () => {
  it('does not add role-dependent aria-orientation', async () => {
    await render(<App orientation="horizontal" />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    expect(screen.getByRole('menu')).not.toHaveAttribute('aria-orientation');
  });

  it('opens on ArrowDown and focuses first item', async () => {
    await render(<App />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });
  });

  it('opens on ArrowUp and focuses last item', async () => {
    await render(<App />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('navigates down on ArrowDown', async () => {
    await render(<App />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });

    // Reached the end of the list.
    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('navigates up on ArrowUp', async () => {
    await render(<App />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    // Reached the end of the list.
    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });
  });

  it('skips disabled item on initial navigation', async () => {
    await render(<App disableFirstItem loopFocus disabledIndices={[]} />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });
  });

  it('skips items hidden with CSS in navigation', async () => {
    await render(<App hideFirstItem loopFocus disabledIndices={[]} />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('skips visibility:hidden items in navigation', async () => {
    await render(<App firstItemStyle={{ visibility: 'hidden' }} loopFocus disabledIndices={[]} />);

    await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('resets indexRef to -1 upon close', async () => {
    const data = ['a', 'ab', 'abc', 'abcd'];

    const Autocomplete = defineComponent(() => {
      const open = shallowRef(false);
      const inputValue = shallowRef('');
      const activeIndex = shallowRef<number | null>(null);

      const listRef = shallowRef<Array<HTMLElement | null>>([]);

      const { context, refs } = useFloating({
        open,
        onOpenChange(nextOpen) {
          open.value = nextOpen;
        },
      });

      const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([
        useDismiss(context.rootStore),
        useListNavigation(context.rootStore, {
          listRef,
          activeIndex,
          onNavigate(index) {
            activeIndex.value = index;
          },
          virtual: true,
          loopFocus: true,
        }),
      ]);

      function onInput(event: Event) {
        const value = (event.target as HTMLInputElement).value;
        inputValue.value = value;

        if (value) {
          activeIndex.value = null;
          open.value = true;
        } else {
          open.value = false;
        }
      }

      return () => {
        const items = data.filter((item) =>
          item.toLowerCase().startsWith(inputValue.value.toLowerCase()),
        );

        return (
          <>
            <input
              value={inputValue.value}
              placeholder="Enter fruit"
              {...getReferenceProps({
                ref: refs.setReference,
                onInput,
                'aria-autocomplete': 'list',
              })}
              data-testid="reference"
            />
            {open.value && (
              <div
                {...getFloatingProps({
                  ref: refs.setFloating,
                  style: {
                    background: '#eee',
                    color: 'black',
                    overflowY: 'auto',
                  },
                })}
                data-testid="floating"
              >
                <ul>
                  {items.map((item, index) => (
                    <li
                      key={item}
                      {...getItemProps({
                        ref(node) {
                          listRef.value[index] = node as HTMLElement | null;
                        },
                        onClick() {
                          inputValue.value = item;
                          open.value = false;
                          (refs.reference.value as HTMLElement | null)?.focus();
                        },
                      })}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div data-testid="active-index">{activeIndex.value}</div>
          </>
        );
      };
    });

    await render(<Autocomplete />);

    screen.getByTestId('reference').focus();
    await flushMicrotasks();
    await userEvent.keyboard('a');

    expect(screen.getByTestId('floating')).toBeInTheDocument();
    expect(screen.getByTestId('active-index').textContent).toBe('');

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByTestId('active-index').textContent).toBe('2');

    await userEvent.keyboard('{Escape}');

    expect(screen.getByTestId('active-index').textContent).toBe('');

    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('a');

    expect(screen.getByTestId('floating')).toBeInTheDocument();
    expect(screen.getByTestId('active-index').textContent).toBe('');

    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByTestId('active-index').textContent).toBe('0');
  });

  describe('prop: loopFocus', () => {
    it('ArrowDown looping', async () => {
      await render(<App loopFocus />);

      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      // Reached the end of the list and loops.
      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });
    });

    it('ArrowUp looping', async () => {
      await render(<App loopFocus />);

      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      // Reached the end of the list and loops.
      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });
    });
  });

  describe('prop: orientation', () => {
    it('navigates down on ArrowRight', async () => {
      await render(<App orientation="horizontal" />);

      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowRight' });
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      // Reached the end of the list.
      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });
    });

    it('navigates up on ArrowLeft', async () => {
      await render(<App orientation="horizontal" />);

      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowLeft' });
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      // Reached the end of the list.
      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });
    });
  });

  describe('prop: rtl', () => {
    it('navigates down on ArrowLeft', async () => {
      await render(<App rtl orientation="horizontal" />);

      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowLeft' });
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      // Reached the end of the list.
      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });
    });

    it('navigates up on ArrowRight', async () => {
      await render(<App rtl orientation="horizontal" />);

      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowRight' });
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('item-2')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });

      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      // Reached the end of the list.
      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });
    });
  });

  describe('prop: focusItemOnOpen', () => {
    it('focuses the first item on click when true', async () => {
      await render(<App focusItemOnOpen />);
      await fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });
    });

    it('does not focus the first item on click when false', async () => {
      await render(<App focusItemOnOpen={false} />);
      await fireEvent.click(screen.getByRole('button'));
      // The focus of an item waits for one animation frame. Wait for two, then assert.
      await waitSingleFrame();
      await waitSingleFrame();
      expect(screen.getByTestId('item-0')).not.toHaveFocus();
    });
  });

  describe('prop: selectedIndex', () => {
    it('scrolls the selected item into view on open', async ({ onTestFinished }) => {
      const requestAnimationFrame = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation(() => 0);
      const scrollIntoView = vi.fn();
      const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
      HTMLElement.prototype.scrollIntoView = scrollIntoView;

      onTestFinished(() => {
        requestAnimationFrame.mockRestore();
        HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      });

      await render(<App selectedIndex={0} />);
      await fireEvent.click(screen.getByRole('button'));
      await flushMicrotasks();
      expect(requestAnimationFrame).toHaveBeenCalled();
      // Run the timer
      requestAnimationFrame.mock.calls.forEach((call) => call[0](0));
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('allowEscape + virtual', () => {
    it('when true', async () => {
      await render(<App allowEscape virtual loopFocus />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('true');
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('false');
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('true');
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.getByTestId('item-1').getAttribute('aria-selected')).toBe('true');
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.getByTestId('item-2').getAttribute('aria-selected')).toBe('true');
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.getByTestId('item-2').getAttribute('aria-selected')).toBe('false');
      await flushMicrotasks();
    });

    it('when false', async () => {
      await render(<App allowEscape={false} virtual loopFocus />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.getByTestId('item-0').getAttribute('aria-selected')).toBe('true');
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.getByTestId('item-1').getAttribute('aria-selected')).toBe('true');
      await flushMicrotasks();
    });

    it('true - onNavigate is called with `null` when escaped', async () => {
      const spy = vi.fn();
      await render(<App allowEscape virtual loopFocus onNavigate={spy} />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls.some((args) => args[0] === null)).toBe(true);
      await flushMicrotasks();
    });
  });

  describe('reference focus', () => {
    it('clears ordinary item focus when the open reference receives focus', async () => {
      await render(<App />);
      const reference = screen.getByRole('button');

      await fireEvent.keyDown(reference, { key: 'ArrowDown' });
      await waitFor(() => {
        expect(screen.getByTestId('item-0')).toHaveFocus();
      });

      reference.focus();
      await flushMicrotasks();

      expect(screen.getByTestId('item-0')).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('prop: openOnArrowKeyDown', () => {
    it('opens on ArrowDown when true', async () => {
      await render(<App openOnArrowKeyDown />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await flushMicrotasks();
    });

    it('opens on ArrowUp when true', async () => {
      await render(<App openOnArrowKeyDown />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await flushMicrotasks();
    });

    it('does not open on ArrowDown when false', async () => {
      await render(<App openOnArrowKeyDown={false} />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('does not open on ArrowUp when false', async () => {
      await render(<App openOnArrowKeyDown={false} />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowUp' });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('prop: disabledIndices', () => {
    it('indices are skipped in focus order', async () => {
      await render(<App disabledIndices={[0]} />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });
      await fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
      await waitFor(() => {
        expect(screen.getByTestId('item-1')).toHaveFocus();
      });
    });
  });

  describe('prop: focusItemOnHover', () => {
    it.skipIf(isJSDOM)(
      'cancels pending item focus when the pointer leaves before focus lands',
      async () => {
        const frameCallbacks = new Map<number, FrameRequestCallback>();
        let frameId = 0;
        const requestAnimationFrameSpy = vi
          .spyOn(window, 'requestAnimationFrame')
          .mockImplementation((callback) => {
            frameId += 1;
            frameCallbacks.set(frameId, callback);
            return frameId;
          });
        const cancelAnimationFrameSpy = vi
          .spyOn(window, 'cancelAnimationFrame')
          .mockImplementation((id) => {
            frameCallbacks.delete(id);
          });
        const spy = vi.fn();

        try {
          await render(<App focusItemOnOpen onNavigate={(index) => spy(index)} />);

          await fireEvent.click(screen.getByRole('button'));
          await flushMicrotasks();

          const menu = screen.getByRole('menu');
          const item = screen.getByTestId('item-0');

          expect(item).toHaveAttribute('aria-selected', 'true');
          expect(item).not.toHaveFocus();

          await fireEvent.pointerLeave(item, {
            pointerType: 'mouse',
            relatedTarget: document.body,
          });

          const callbacks = Array.from(frameCallbacks.values());
          frameCallbacks.clear();
          callbacks.forEach((callback) => callback(performance.now()));
          await flushMicrotasks();

          expect(item).not.toHaveFocus();
          expect(menu).not.toHaveFocus();
          await waitFor(() => {
            expect(item).toHaveAttribute('aria-selected', 'false');
          });
          expect(spy).toHaveBeenLastCalledWith(null);
        } finally {
          requestAnimationFrameSpy.mockRestore();
          cancelAnimationFrameSpy.mockRestore();
        }
      },
    );

    it('true - focuses item on hover and syncs the active index', async () => {
      const spy = vi.fn();
      await render(<App onNavigate={spy} />);
      await fireEvent.click(screen.getByRole('button'));
      await fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 10, movementY: 10 });
      expect(screen.getByTestId('item-1')).toHaveFocus();
      await fireEvent.pointerLeave(screen.getByTestId('item-1'));
      expect(screen.getByRole('menu')).toHaveFocus();
      expect(spy.mock.calls.some((args) => args[0] === 1)).toBe(true);
      await flushMicrotasks();
    });

    it('true - syncs an item on hover when activeIndex is null but selectedIndex matches', async () => {
      const spy = vi.fn();
      await render(
        <App focusItemOnOpen={false} selectedIndex={1} onNavigate={(index) => spy(index)} />,
      );

      await fireEvent.click(screen.getByRole('button'));
      await fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 10, movementY: 10 });

      expect(screen.getByTestId('item-1')).toHaveFocus();
      expect(spy).toHaveBeenCalledWith(1);
      await flushMicrotasks();
    });

    it('false - does not focus item on hover and does not sync the active index', async () => {
      const spy = vi.fn();
      await render(<App onNavigate={spy} focusItemOnOpen={false} focusItemOnHover={false} />);
      await fireEvent.click(screen.getByRole('button'));
      await fireEvent.mouseMove(screen.getByTestId('item-1'), { movementX: 10, movementY: 10 });
      expect(screen.getByTestId('item-1')).not.toHaveFocus();
      expect(spy).toHaveBeenCalledTimes(0);
      await flushMicrotasks();
    });

    it('clears the active item when the pointer leaves a clipped container while still within the item bounds', async () => {
      const spy = vi.fn();
      await render(<App onNavigate={spy} />);

      await fireEvent.click(screen.getByRole('button'));

      const menu = screen.getByRole('menu');
      const item = screen.getByTestId('item-1');

      menu.style.overflow = 'auto';
      menu.style.maxHeight = '40px';

      vi.spyOn(menu, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        right: 100,
        bottom: 40,
        left: 0,
        width: 100,
        height: 40,
        toJSON() {
          return {};
        },
      });

      vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        right: 100,
        bottom: 80,
        left: 0,
        width: 100,
        height: 80,
        toJSON() {
          return {};
        },
      });

      await fireEvent.mouseMove(item, { movementX: 10, movementY: 10 });

      await waitFor(() => {
        expect(item).toHaveFocus();
      });

      await fireEvent.pointerLeave(item, {
        clientX: 50,
        clientY: 60,
        pointerType: 'mouse',
        relatedTarget: document.body,
      });

      await waitFor(() => {
        expect(item).toHaveAttribute('aria-selected', 'false');
      });
      expect(spy.mock.calls.at(-1)?.[0]).toBe(null);
    });
  });

  describe('grid navigation', () => {
    it('ArrowDown focuses first item', async () => {
      await render(<Grid />);

      await fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await fireEvent.keyDown(document, { key: 'ArrowDown' });
      await waitFor(() => {
        expect(screen.getAllByRole('option')[8]).toHaveFocus();
      });
    });

    it('focuses first non-disabled item in grid', async () => {
      await render(<Grid />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getAllByRole('option')[8]).toHaveFocus();
      });
    });

    it('focuses next item using ArrowRight key, skipping disabled items', async () => {
      await render(<Grid />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[9]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[11]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[14]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[16]).toHaveFocus();
      await flushMicrotasks();
    });

    it('focuses previous item using ArrowLeft key, skipping disabled items', async () => {
      await render(<Grid />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));

      screen.getAllByRole('option')[47].focus();
      await flushMicrotasks();

      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      expect(screen.getAllByRole('option')[46]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      expect(screen.getAllByRole('option')[44]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      expect(screen.getAllByRole('option')[41]).toHaveFocus();
      await flushMicrotasks();
    });

    it('skips row and remains on same column when pressing ArrowDown', async () => {
      await render(<Grid />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      expect(screen.getAllByRole('option')[13]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      expect(screen.getAllByRole('option')[18]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      expect(screen.getAllByRole('option')[23]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      expect(screen.getAllByRole('option')[28]).toHaveFocus();
      await flushMicrotasks();
    });

    it('skips row and remains on same column when pressing ArrowUp', async () => {
      await render(<Grid />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));

      screen.getAllByRole('option')[47].focus();
      await flushMicrotasks();

      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      expect(screen.getAllByRole('option')[42]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      expect(screen.getAllByRole('option')[37]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      expect(screen.getAllByRole('option')[32]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      expect(screen.getAllByRole('option')[27]).toHaveFocus();
      await flushMicrotasks();
    });

    it('loops on the same column with ArrowDown', async () => {
      await render(<Grid loopFocus />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));

      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });

      expect(screen.getAllByRole('option')[8]).toHaveFocus();
      await flushMicrotasks();
    });

    it('loops on the same column with ArrowUp', async () => {
      await render(<Grid loopFocus />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));

      screen.getAllByRole('option')[43].focus();
      await flushMicrotasks();

      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowUp' });

      expect(screen.getAllByRole('option')[43]).toHaveFocus();
      await flushMicrotasks();
    });

    it('does not leave row with "both" orientation while looping', async () => {
      await render(<Grid orientation="both" loopFocus />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));

      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[9]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[8]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      expect(screen.getAllByRole('option')[9]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      expect(screen.getAllByRole('option')[8]).toHaveFocus();

      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowDown' });
      expect(screen.getAllByRole('option')[13]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[14]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[11]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      expect(screen.getAllByRole('option')[14]).toHaveFocus();
      await flushMicrotasks();
    });

    it('looping works on last row', async () => {
      await render(<Grid orientation="both" loopFocus />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));

      screen.getAllByRole('option')[46].focus();
      await flushMicrotasks();

      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[47]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowRight' });
      expect(screen.getAllByRole('option')[46]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      expect(screen.getAllByRole('option')[47]).toHaveFocus();
      await fireEvent.keyDown(screen.getByTestId('floating'), { key: 'ArrowLeft' });
      expect(screen.getAllByRole('option')[46]).toHaveFocus();
      await flushMicrotasks();
    });

    it('wraps ArrowUp to the last row in the full list for virtualized rows', async () => {
      await render(<VirtualizedGridRows />);

      screen.getByTestId('virtual-grid-reference').focus();
      await flushMicrotasks();

      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '95',
        );
      });
    });

    it('clamps ArrowUp to the last item in a partial last row for virtualized rows', async () => {
      await render(<VirtualizedGridRows totalItems={98} initialActiveIndex={4} />);

      screen.getByTestId('virtual-grid-reference').focus();
      await flushMicrotasks();

      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '97',
        );
      });
    });

    it('clamps ArrowDown into a partial last row for virtualized rows', async () => {
      await render(<VirtualizedGridRows totalItems={98} initialActiveIndex={93} />);

      screen.getByTestId('virtual-grid-reference').focus();
      await flushMicrotasks();

      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '97',
        );
      });
    });

    it('does not wrap ArrowUp when loopFocus is false for virtualized rows', async () => {
      await render(
        <VirtualizedGridRows totalItems={98} initialActiveIndex={4} loopFocus={false} />,
      );

      screen.getByTestId('virtual-grid-reference').focus();
      await flushMicrotasks();

      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '4',
        );
      });
    });

    it('still clamps ArrowDown into a partial last row when loopFocus is false', async () => {
      await render(
        <VirtualizedGridRows totalItems={98} initialActiveIndex={93} loopFocus={false} />,
      );

      screen.getByTestId('virtual-grid-reference').focus();
      await flushMicrotasks();

      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '97',
        );
      });
    });

    it('falls back left in a partial last row when the preferred candidate is disabled', async () => {
      await render(
        <VirtualizedGridRows totalItems={98} initialActiveIndex={93} disabledIndices={[97]} />,
      );

      screen.getByTestId('virtual-grid-reference').focus();
      await flushMicrotasks();

      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '96',
        );
      });
    });

    it('falls back left when the preferred candidate is hidden', async () => {
      await render(<VirtualizedGridRows initialActiveIndex={9} hiddenIndices={[14]} />);

      screen.getByTestId('virtual-grid-reference').focus();
      await flushMicrotasks();

      await userEvent.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByTestId('virtual-grid-active-index')).toHaveAttribute(
          'data-active-index',
          '13',
        );
      });
    });
  });

  describe('grid navigation in a multi-column grid with disabled items', () => {
    it('focuses first non-disabled item in grid', async () => {
      await render(<ComplexGrid />);
      await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      await fireEvent.click(screen.getByRole('button'));
      await waitFor(() => {
        expect(screen.getAllByRole('option')[7]).toHaveFocus();
      });
    });

    describe.each([
      { rtl: false, arrowToStart: 'ArrowLeft', arrowToEnd: 'ArrowRight' },
      { rtl: true, arrowToStart: 'ArrowRight', arrowToEnd: 'ArrowLeft' },
    ])('with rtl $rtl', ({ rtl, arrowToStart, arrowToEnd }) => {
      it(`focuses next item using ${arrowToEnd} key, skipping disabled items`, async () => {
        await render(<ComplexGrid rtl={rtl} />);
        await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
        await fireEvent.click(screen.getByRole('button'));
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        expect(screen.getAllByRole('option')[8]).toHaveFocus();
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        expect(screen.getAllByRole('option')[10]).toHaveFocus();
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        expect(screen.getAllByRole('option')[13]).toHaveFocus();
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        expect(screen.getAllByRole('option')[15]).toHaveFocus();
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        expect(screen.getAllByRole('option')[20]).toHaveFocus();
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        expect(screen.getAllByRole('option')[24]).toHaveFocus();
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        expect(screen.getAllByRole('option')[34]).toHaveFocus();
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        expect(screen.getAllByRole('option')[36]).toHaveFocus();
        await flushMicrotasks();
      });

      it(`focuses previous item using ${arrowToStart} key, skipping disabled items`, async () => {
        await render(<ComplexGrid rtl={rtl} />);
        await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
        await fireEvent.click(screen.getByRole('button'));

        screen.getAllByRole('option')[36].focus();
        await flushMicrotasks();

        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await waitFor(() => {
          expect(screen.getAllByRole('option')[34]).toHaveFocus();
        });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await waitFor(() => {
          expect(screen.getAllByRole('option')[28]).toHaveFocus();
        });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await waitFor(() => {
          expect(screen.getAllByRole('option')[20]).toHaveFocus();
        });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToStart });
        await waitFor(() => {
          expect(screen.getAllByRole('option')[7]).toHaveFocus();
        });
      });

      it('looping works on last row', async () => {
        await render(<ComplexGrid rtl={rtl} orientation="both" loopFocus />);
        await fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
        await fireEvent.click(screen.getByRole('button'));

        screen.getAllByRole('option')[36].focus();
        await flushMicrotasks();

        await fireEvent.keyDown(screen.getByTestId('floating'), { key: arrowToEnd });
        expect(screen.getAllByRole('option')[36]).toHaveFocus();
        await flushMicrotasks();
      });
    });
  });

  it('grid navigation with changing list items', async () => {
    await render(<EmojiPicker />);

    await fireEvent.click(screen.getByRole('button'));

    await flushMicrotasks();

    const input = screen.getByRole('textbox');
    const activeIndicator = screen.getByTestId('emoji-picker-active-index');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await userEvent.keyboard('appl');
    const initialActiveIndex = activeIndicator.getAttribute('data-active-index');
    await userEvent.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(activeIndicator.getAttribute('data-active-index')).not.toBe(initialActiveIndex);
    });

    await userEvent.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(activeIndicator.getAttribute('data-active-index')).not.toBe(initialActiveIndex);
    });

    expect(activeIndicator.getAttribute('data-active-index')).not.toBeNull();
  });

  it('grid navigation with disabled list items', async () => {
    const { unmount } = await render(<EmojiPicker />);

    await fireEvent.click(screen.getByRole('button'));

    await flushMicrotasks();

    const input = screen.getByRole('textbox');
    const activeIndicator = screen.getByTestId('emoji-picker-active-index');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await userEvent.keyboard('o');
    const initialActiveIndex = activeIndicator.getAttribute('data-active-index');
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByLabelText('orange')).not.toHaveAttribute('data-active');
    await waitFor(() => {
      expect(activeIndicator.getAttribute('data-active-index')).not.toBe(initialActiveIndex);
    });

    await userEvent.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(activeIndicator.getAttribute('data-active-index')).not.toBe(initialActiveIndex);
    });

    expect(activeIndicator.getAttribute('data-active-index')).not.toBeNull();

    unmount();

    await render(<EmojiPicker />);

    await fireEvent.click(screen.getByRole('button'));

    await flushMicrotasks();

    const nextInput = screen.getByRole('textbox');
    const nextActiveIndicator = screen.getByTestId('emoji-picker-active-index');
    await waitFor(() => {
      expect(nextInput).toHaveFocus();
    });

    const nextInitialActiveIndex = nextActiveIndicator.getAttribute('data-active-index');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowUp}');

    await waitFor(() => {
      expect(nextActiveIndicator.getAttribute('data-active-index')).not.toBe(
        nextInitialActiveIndex,
      );
    });
    expect(screen.getByLabelText('cherry')).toHaveAttribute('data-active');
  });

  it('selectedIndex changing does not steal focus', async () => {
    await render(<ListboxFocus />);

    // TODO: This feels like a bug. It's the animation frame callback from `enqueueFocus` sometimes
    // kicking in after the click instead before, which causes flakeyness in this test as the wrong
    // element will be focused.
    await waitFor(() => {
      expect(document.activeElement).toHaveRole('option');
    });

    await userEvent.click(screen.getByTestId('reference'));

    await waitFor(() => {
      expect(screen.getByTestId('reference')).toHaveFocus();
    });
  });

  it('Home or End key press is ignored for typeable combobox reference', async () => {
    const ComboboxApp = defineComponent(() => {
      const open = shallowRef(false);
      const listRef = shallowRef<Array<HTMLLIElement | null>>([]);
      const activeIndex = shallowRef<null | number>(null);
      const { refs, context } = useFloating({
        open,
        onOpenChange(nextOpen) {
          open.value = nextOpen;
        },
      });
      const { getReferenceProps, getFloatingProps, getItemProps } = useTestInteractions([
        useClick(context.rootStore),
        useListNavigation(context.rootStore, {
          listRef,
          activeIndex,
          onNavigate(index) {
            activeIndex.value = index;
          },
        }),
      ]);

      return () => (
        <>
          <input role="combobox" {...getReferenceProps({ ref: refs.setReference })} />
          {open.value && (
            <div role="menu" {...getFloatingProps({ ref: refs.setFloating })}>
              <ul>
                {['one', 'two', 'three'].map((string, index) => (
                  <li
                    data-testid={`item-${index}`}
                    aria-selected={activeIndex.value === index}
                    key={string}
                    tabindex={-1}
                    {...getItemProps({
                      ref(node) {
                        listRef.value[index] = node as HTMLLIElement | null;
                      },
                    })}
                  >
                    {string}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      );
    });

    await render(<ComboboxApp />);

    screen.getByRole('combobox').focus();
    await flushMicrotasks();

    await userEvent.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(screen.getByTestId('item-0')).toHaveFocus();
    });

    await userEvent.keyboard('{End}');

    expect(screen.getByTestId('item-0')).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Home}');

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });
  });

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
        options: { enabled: false },
        items: [{ label: 'deep', items: ['x', 'y'] }],
      };
      await render(
        <Tree>
          <NestedList label="root" orientation="horizontal" items={['one', middle]} />
        </Tree>,
      );
      await fireEvent.click(part('trigger-root'), { detail: 1 });
      await fireEvent.click(part('trigger-more'), { detail: 1 });
      await fireEvent.click(part('trigger-deep'), { detail: 1 });
      expect(isOpen('deep')).toBe(true);

      // The list below does not use this key, and the list in the middle is not enabled.
      await keyDown(part('menu-deep'), 'ArrowRight');

      expect(activeIndexOf('root')).toBe('0');
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

  describe('KeepAlive', () => {
    it('gives the focus back to the active item at the activation', async () => {
      const page = shallowRef<'list' | 'other'>('list');
      const Other = defineComponent({ setup: () => () => <p>other</p> });
      await render(() => (
        <KeepAlive>{page.value === 'list' ? <List key="list" /> : <Other key="other" />}</KeepAlive>
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
      await keyDown(menu(), 'ArrowDown');
      expect(focused()).toBe('item-2');
    });
  });
});
