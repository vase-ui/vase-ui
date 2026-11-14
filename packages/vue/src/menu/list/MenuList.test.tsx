import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import type { PropType } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, describeConformance, screen } from '#test-utils';

// A menu that is open on the first render, with its trigger as the active trigger.
const PlainMenu = defineComponent({
  props: {
    listId: { type: String, default: undefined },
    showList: { type: Boolean, default: true },
    orientation: { type: String as PropType<Menu.Root.Orientation>, default: undefined },
  },
  setup(props) {
    return () => (
      <Menu.Root defaultOpen defaultTriggerId="first" orientation={props.orientation}>
        <Menu.Trigger id="first">Actions</Menu.Trigger>
        <Menu.Trigger id="second">More</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              {props.showList ? (
                <Menu.List data-testid="list" id={props.listId}>
                  <Menu.Item>Rename</Menu.Item>
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

  it('takes the menu role and the label of the trigger from the popup', async () => {
    await render(<PlainMenu />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    const list = screen.getByTestId('list');
    expect(list).toHaveAttribute('role', 'menu');
    expect(list).toHaveAttribute('aria-labelledby', trigger.id);
    expect(screen.getByTestId('popup')).toHaveAttribute('role', 'presentation');
    expect(screen.getByTestId('popup')).not.toHaveAttribute('aria-labelledby');
    expect(trigger).toHaveAttribute('aria-controls', list.id);
  });

  it('gives the menu role back to the popup when the list unmounts', async () => {
    const { setProps } = await render(() => <PlainMenu />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    await setProps({ showList: false });

    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('role', 'menu');
    expect(popup).toHaveAttribute('aria-labelledby', trigger.id);
    expect(trigger).toHaveAttribute('aria-controls', popup.id);
  });

  it('gives a new id of the list to aria-controls of the trigger', async () => {
    const { setProps } = await render(() => <PlainMenu listId="old-list" />);
    const trigger = screen.getByRole('button', { name: 'Actions' });

    expect(trigger).toHaveAttribute('aria-controls', 'old-list');

    await setProps({ listId: 'new-list' });

    expect(trigger).toHaveAttribute('aria-controls', 'new-list');
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

  it('puts aria-orientation on the list and not on the popup', async () => {
    await render(<PlainMenu orientation="horizontal" />);

    expect(screen.getByTestId('list')).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByTestId('popup')).not.toHaveAttribute('aria-orientation');
  });

  it('points only the active trigger at the list', async () => {
    await render(<PlainMenu />);

    const list = screen.getByTestId('list');
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
      'aria-controls',
      list.id,
    );
    expect(screen.getByRole('button', { name: 'More' })).not.toHaveAttribute('aria-controls');
  });
});
