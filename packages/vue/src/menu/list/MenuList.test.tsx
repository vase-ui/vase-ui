import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import type { PropType } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';

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
    await user.keyboard('[Enter]');

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
