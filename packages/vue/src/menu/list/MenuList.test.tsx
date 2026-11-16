import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { PropType } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';

// Each render of the list reads the id of the trigger, and the list renders again after the open. A
// case that changes the id of the trigger waits for these renders first. Only the change of the id
// can then give the list its new name.
async function waitForRendersOfOpen() {
  await waitSingleFrame();
  await waitSingleFrame();
  await flushMicrotasks();
}

const PlainMenu = defineComponent({
  props: {
    orientation: { type: String as PropType<Menu.Root.Orientation>, default: undefined },
    listId: { type: String, default: undefined },
    // The cases of Vase UI's own render the menu open, with its trigger as the active trigger.
    defaultOpen: { type: Boolean, default: false },
    showList: { type: Boolean, default: true },
  },
  setup(props) {
    return () => (
      <Menu.Root
        orientation={props.orientation}
        defaultOpen={props.defaultOpen}
        defaultTriggerId={props.defaultOpen ? 'actions' : null}
      >
        <Menu.Trigger id="actions">Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <div>Header</div>
              {props.showList ? (
                <Menu.List data-testid="list" id={props.listId}>
                  <Menu.Item data-testid="item-1">Rename</Menu.Item>
                  <Menu.Item data-testid="item-2">Delete</Menu.Item>
                </Menu.List>
              ) : (
                <Menu.Item>Rename</Menu.Item>
              )}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    );
  },
});

describe('<Menu.List />', () => {
  const { render } = createRenderer();

  it('replays keys from an item that holds real focus and activates on Enter', async () => {
    const onClick = vi.fn();
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item onClick={onClick}>Delete</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await user.keyboard('[ArrowDown]');
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    const del = screen.getByRole('menuitem', { name: 'Delete' });
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);

    // A screen reader following `aria-activedescendant` moves real focus onto the item.
    rename.focus();
    await flushMicrotasks();
    await user.keyboard('[ArrowDown]');

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', del.id);
    });
    expect(input).toHaveFocus();

    del.focus();
    await flushMicrotasks();
    await user.keyboard('[Enter]');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
  });

  it('clears the highlight when focus returns to the input from an item', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item>Delete</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await user.keyboard('[ArrowDown]');
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);

    // A screen reader parks real focus on the item, then the user moves back to the input.
    rename.focus();
    await flushMicrotasks();
    input.focus();
    await flushMicrotasks();

    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(rename).not.toHaveAttribute('data-highlighted');
  });

  it('keeps the highlight when focus returns to the input with autoHighlight="always"', async () => {
    await render(
      <Menu.FilterProvider autoHighlight="always">
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item>Delete</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', rename.id);
    });

    rename.focus();
    await flushMicrotasks();
    input.focus();
    await flushMicrotasks();

    expect(input).toHaveAttribute('aria-activedescendant', rename.id);
  });

  it('keeps virtual focus on the input without making the list tabbable', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Trigger>Fruit</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter fruit" />
                <Menu.List data-testid="list">
                  <Menu.Item>Apple</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
    const list = screen.getByTestId('list');
    const apple = screen.getByRole('menuitem', { name: 'Apple' });

    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    expect(list).not.toHaveAttribute('aria-hidden');
    expect(list).toHaveAttribute('tabindex', '-1');
    expect(apple).toHaveAttribute('tabindex', '-1');
    expect(apple).not.toHaveAttribute('aria-expanded');

    await user.keyboard('[ArrowDown]');
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', apple.id);
    });
    expect(input).toHaveFocus();
  });

  describe('keys on a focused list', () => {
    const App = defineComponent({
      props: { onPress: { type: Function as PropType<() => void>, default: undefined } },
      setup: (props) => () => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Fruit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter fruit" />
                  <Menu.List data-testid="list">
                    <Menu.Item onClick={props.onPress}>Apple</Menu.Item>
                    <Menu.Item>Banana</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
    });

    // Focus the list takes from the input goes straight back to it, so start from focus that
    // reached the list another way, such as a screen reader or a touch press.
    async function focusList(list: HTMLElement) {
      screen.getByRole('searchbox', { name: 'Filter fruit' }).blur();
      list.focus();
      await flushMicrotasks();
    }

    it('replays navigation keys on the input instead of scrolling', async () => {
      await render(<App />);

      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
      const list = screen.getByTestId('list');
      const apple = screen.getByRole('menuitem', { name: 'Apple' });

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await focusList(list);
      expect(list).toHaveFocus();

      const scrolls = await fireEvent.keyDown(list, { key: 'ArrowDown' });

      expect(scrolls).toBe(false);
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      });
      expect(input).toHaveFocus();
    });

    it('commits the highlighted item when Enter lands on the list', async () => {
      const onPress = vi.fn();
      const { user } = await render(<App onPress={onPress} />);

      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
      const list = screen.getByTestId('list');
      const apple = screen.getByRole('menuitem', { name: 'Apple' });

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', apple.id);
      });

      await focusList(list);
      await fireEvent.keyDown(list, { key: 'Enter' });

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('still closes the menu with Escape', async () => {
      await render(<App />);

      const list = screen.getByTestId('list');

      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter fruit' })).toHaveFocus();
      });
      await focusList(list);
      await fireEvent.keyDown(list, { key: 'Escape' });

      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('hands typing keys back to the input', async () => {
      await render(<App />);

      const input = screen.getByRole('searchbox', { name: 'Filter fruit' });
      const list = screen.getByTestId('list');

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await focusList(list);

      const types = await fireEvent.keyDown(list, { key: 'z' });

      // Not canceled, so the native default action types into the refocused input.
      expect(types).toBe(true);
      expect(input).toHaveFocus();
    });
  });
});

describe('filterable menu list semantics', () => {
  const { render } = createRenderer();

  const TestMenu = defineComponent({
    props: {
      secondId: { type: String, default: undefined },
      orientation: { type: String as PropType<Menu.Root.Orientation>, default: undefined },
    },
    setup: (props) => () => (
      <Menu.FilterProvider autoHighlight="always">
        <Menu.Root defaultOpen orientation={props.orientation}>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item id="first-item">First</Menu.Item>
                  <Menu.Item id={props.secondId}>Second</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ),
  });

  it('VUE-109: follows a new id of the trigger', async () => {
    const id = shallowRef('first');
    // Only this component reads the id, as in a compiled template. Vue then renders the trigger
    // again and no other part.
    const Trigger = defineComponent(() => () => <Menu.Trigger id={id.value}>Actions</Menu.Trigger>);
    await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Trigger />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List data-testid="list">
                  <Menu.Item>First</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );
    await waitForRendersOfOpen();
    const list = screen.getByTestId('list');
    expect(list).toHaveAttribute('aria-labelledby', 'first');

    id.value = 'second';

    await waitFor(() => {
      expect(list).toHaveAttribute('aria-labelledby', 'second');
    });
    expect(screen.getByRole('menu', { name: 'Actions' })).toBe(list);
  });

  it('reads an item id when navigating to it', async () => {
    const { user, setProps } = await render(<TestMenu secondId="old-id" />);
    const input = screen.getByRole('searchbox');
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', 'first-item'));
    await waitFor(() => expect(input).toHaveFocus());
    await setProps({ secondId: 'new-id' });
    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', 'new-id'));
  });

  it('exposes horizontal navigation on the menu instead of the dialog', async () => {
    const { user } = await render(<TestMenu orientation="horizontal" secondId="second-item" />);
    const input = screen.getByRole('searchbox');
    expect(screen.getByRole('menu')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-orientation');
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', 'first-item'));
    await waitFor(() => expect(input).toHaveFocus());
    await user.keyboard('[ArrowRight]');
    expect(input).toHaveAttribute('aria-activedescendant', 'second-item');
  });

  describe('horizontal list without autoHighlight', () => {
    const HorizontalMenu = defineComponent({
      props: { defaultOpen: { type: Boolean, default: undefined } },
      setup: (props) => () => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen={props.defaultOpen} orientation="horizontal">
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item id="alpha">Alpha</Menu.Item>
                    <Menu.Item id="apple">Apple</Menu.Item>
                    <Menu.Item id="beta">Beta</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
    });

    it('enters the results with the vertical arrows after typing', async () => {
      const { user } = await render(<HorizontalMenu defaultOpen />);
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => expect(input).toHaveFocus());

      await user.type(input, 'p');
      expect(screen.queryByText('Beta')).toBe(null);

      // Left and Right keep moving the caret while nothing is highlighted.
      await user.keyboard('[ArrowLeft]');
      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('[ArrowDown]');
      expect(input).toHaveAttribute('aria-activedescendant', 'alpha');
      await user.keyboard('[ArrowRight]');
      expect(input).toHaveAttribute('aria-activedescendant', 'apple');
      await user.keyboard('[ArrowLeft]');
      expect(input).toHaveAttribute('aria-activedescendant', 'alpha');
    });

    it('enters the results from the end with ArrowUp', async () => {
      const { user } = await render(<HorizontalMenu defaultOpen />);
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => expect(input).toHaveFocus());

      await user.keyboard('[ArrowUp]');
      expect(input).toHaveAttribute('aria-activedescendant', 'beta');
    });

    it('highlights the first item when opened from the trigger with ArrowDown', async () => {
      const { user } = await render(<HorizontalMenu />);
      const trigger = screen.getByRole('button', { name: 'Actions' });
      trigger.focus();
      await flushMicrotasks();

      await user.keyboard('[ArrowDown]');

      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', 'alpha'));
    });
  });
});

describe('<Menu.List /> in a plain menu', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.List />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) =>
      render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>{node}</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      ),
  }));

  it('takes the menu role and label from the popup', async () => {
    const { user } = await render(<PlainMenu />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);

    const list = await screen.findByTestId('list');
    expect(list).toHaveAttribute('role', 'menu');
    expect(list).toHaveAttribute('aria-labelledby', trigger.id);
    expect(screen.getByTestId('popup')).toHaveAttribute('role', 'presentation');
    expect(screen.getByTestId('popup')).not.toHaveAttribute('aria-labelledby');
    expect(trigger).toHaveAttribute('aria-controls', list.id);
  });

  it('VUE-109: follows a new id that the #render slot gives the trigger', async () => {
    const id = shallowRef('first');
    await render(
      <Menu.Root defaultOpen>
        <Menu.Trigger
          v-slots={{
            render: ({ props }: { props: Record<string, unknown> }) => (
              <button type="button" {...props} id={id.value}>
                Actions
              </button>
            ),
          }}
        />
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.List data-testid="list">
                <Menu.Item>Rename</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
    await waitForRendersOfOpen();
    const list = screen.getByTestId('list');
    expect(list).toHaveAttribute('aria-labelledby', 'first');

    id.value = 'second';

    await waitFor(() => {
      expect(list).toHaveAttribute('aria-labelledby', 'second');
    });
    expect(screen.getByRole('menu', { name: 'Actions' })).toBe(list);
  });

  it('updates the trigger when the open list changes its id', async () => {
    const { user, setProps } = await render(() => <PlainMenu listId="old-list" />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await user.click(trigger);
    await screen.findByTestId('list');
    expect(trigger).toHaveAttribute('aria-controls', 'old-list');

    await setProps({ listId: 'new-list' });
    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-controls', 'new-list');
    });
  });

  it('VUE-117: follows the id that the #render slot gives the list', async () => {
    const id = shallowRef('slot-list');
    await render(() => (
      <Menu.Root defaultOpen defaultTriggerId="actions">
        <Menu.Trigger id="actions">Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <Menu.List
                v-slots={{
                  // The slot writes the id after the props of the part, so the element has this id.
                  render: ({ props }: { props: HTMLProps }) => (
                    <div {...props} id={id.value} data-testid="list">
                      <Menu.Item>Rename</Menu.Item>
                    </div>
                  ),
                }}
              />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await screen.findByTestId('list');
    expect(trigger).toHaveAttribute('aria-controls', 'slot-list');

    id.value = 'second-list';
    await flushMicrotasks();
    expect(screen.getByTestId('list').id).toBe('second-list');
    expect(trigger).toHaveAttribute('aria-controls', 'second-list');

    // A list with an empty id cannot take a reference, so the trigger names the popup.
    id.value = '';
    await flushMicrotasks();
    expect(screen.getByTestId('list').id).toBe('');
    expect(trigger).toHaveAttribute('aria-controls', screen.getByTestId('popup').id);
  });

  it('renders the orientation on the list', async () => {
    const { user } = await render(<PlainMenu orientation="horizontal" />);

    await user.click(screen.getByRole('button', { name: 'Actions' }));

    const list = await screen.findByTestId('list');
    expect(list).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByTestId('popup')).not.toHaveAttribute('aria-orientation');
  });

  it('navigates the items with the keyboard', async () => {
    const { user } = await render(<PlainMenu />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    trigger.focus();
    await flushMicrotasks();
    await waitForLaterMillisecond(() => user.keyboard('[Enter]'));

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');

    await waitFor(() => {
      expect(screen.getByTestId('item-2')).toHaveFocus();
    });
  });

  it('focuses the list rather than the presentational popup on a pointer open', async () => {
    const { user } = await render(<PlainMenu />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await fireEvent.mouseDown(trigger, { detail: 1 });
    await fireEvent.click(trigger, { detail: 1 });

    const list = await screen.findByTestId('list');
    await waitFor(() => {
      expect(list).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toHaveFocus();
    });
  });

  it('does not point an inactive trigger at the list', async () => {
    const TwoTriggers = defineComponent(() => {
      const handle = Menu.createHandle();
      return () => (
        <>
          <Menu.Trigger handle={handle}>First</Menu.Trigger>
          <Menu.Trigger handle={handle}>Second</Menu.Trigger>
          <Menu.Root handle={handle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.List data-testid="list">
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </>
      );
    });

    const { user } = await render(<TwoTriggers />);
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });

    await user.click(first);

    const list = await screen.findByTestId('list');
    expect(first).toHaveAttribute('aria-controls', list.id);
    expect(second).not.toHaveAttribute('aria-controls');
  });

  it('does not re-render an inactive trigger when the list mounts', async () => {
    let secondTriggerPasses = 0;
    const TwoTriggers = defineComponent(() => {
      const handle = Menu.createHandle();
      return () => (
        <>
          <Menu.Trigger handle={handle}>First</Menu.Trigger>
          <Menu.Trigger
            handle={handle}
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => {
                secondTriggerPasses += 1;
                return <button {...props}>Second</button>;
              },
            }}
          />
          <Menu.Root handle={handle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.List data-testid="list">
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </>
      );
    });

    const { user } = await render(<TwoTriggers />);
    const first = screen.getByRole('button', { name: 'First' });
    const passesBeforeOpen = secondTriggerPasses;

    await user.click(first);
    const list = await screen.findByTestId('list');
    await waitFor(() => {
      expect(first).toHaveAttribute('aria-controls', list.id);
    });

    expect(secondTriggerPasses).toBe(passesBeforeOpen);
  });

  it('enters the list from the end with ArrowUp after a pointer open without looping', async () => {
    const { user } = await render(
      <Menu.Root loopFocus={false}>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.List data-testid="list">
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Duplicate</Menu.Item>
                <Menu.Item>Delete</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    const list = await screen.findByTestId('list');
    await waitFor(() => {
      expect(list).toHaveFocus();
    });

    await user.keyboard('[ArrowUp]');

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
    });
  });

  it('gives the menu role back to the popup when the list unmounts', async () => {
    const { setProps } = await render(() => <PlainMenu defaultOpen />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await setProps({ showList: false });

    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('role', 'menu');
    expect(popup).toHaveAttribute('aria-labelledby', trigger.id);
    expect(trigger).toHaveAttribute('aria-controls', popup.id);
  });

  it('keeps the element of a newer list when an older list unmounts', async () => {
    const Test = defineComponent({
      props: { lists: { type: String as PropType<'old' | 'both' | 'new'>, required: true } },
      setup(props) {
        return () => (
          <Menu.Root defaultOpen defaultTriggerId="first">
            <Menu.Trigger id="first">Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  {props.lists !== 'new' && <Menu.List key="old" id="old-list" />}
                  {props.lists !== 'old' && <Menu.List key="new" id="new-list" />}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      },
    });

    const { setProps } = await render(() => <Test lists="old" />);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    expect(trigger).toHaveAttribute('aria-controls', 'old-list');

    await setProps({ lists: 'both' });
    expect(trigger).toHaveAttribute('aria-controls', 'new-list');

    await setProps({ lists: 'new' });
    expect(trigger).toHaveAttribute('aria-controls', 'new-list');
    expect(screen.getByTestId('popup')).toHaveAttribute('role', 'presentation');
  });
});
