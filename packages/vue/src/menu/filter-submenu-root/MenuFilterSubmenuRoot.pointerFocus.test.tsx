import { describe, expect, it } from 'vitest';
import * as Menu from '../index.parts';
import {
  createRenderer,
  fireEvent,
  firePointer,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';

function Test(props: { filteredParent: boolean; openOnHover?: boolean }) {
  const menu = (
    <Menu.Root defaultOpen modal={false}>
      <Menu.Trigger>Actions</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            {props.filteredParent && <Menu.Input aria-label="Filter actions" />}
            <Menu.List data-testid="parent-list">
              <Menu.FilterProvider>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger openOnHover={props.openOnHover} delay={0}>
                    More
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Input aria-label="Filter more actions" />
                        <Menu.List>
                          <Menu.Item>Share</Menu.Item>
                        </Menu.List>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.FilterProvider>
            </Menu.List>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
  return props.filteredParent ? <Menu.FilterProvider>{menu}</Menu.FilterProvider> : menu;
}

async function waitForParentFocus(filteredParent: boolean) {
  const owner = filteredParent
    ? screen.getByRole('searchbox', { name: 'Filter actions' })
    : screen.getByTestId('parent-list');
  await waitFor(() => expect(owner).toHaveFocus());
}

async function press(trigger: HTMLElement, pointerType: string) {
  await firePointer.down(trigger, {
    pointerType,
    timeStamp: 10,
    width: 10,
    height: 10,
    pressure: 0.5,
  });
  await fireEvent.mouseDown(trigger, { detail: 1 });
  await waitSingleFrame();
  await firePointer.up(trigger, { pointerType, timeStamp: 20 });
  await fireEvent.mouseUp(trigger, { detail: 1 });
  await fireEvent.click(trigger, { detail: 1 });
}

describe.each([false, true])('submenu pointer focus with filteredParent=%s', (filteredParent) => {
  const { render } = createRenderer();

  it.each(['mouse', 'touch', 'pen'])(
    'does not focus a hover-opened input on a %s press',
    async (pointerType) => {
      const { user } = await render(<Test filteredParent={filteredParent} />);
      await waitForParentFocus(filteredParent);
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      await user.hover(trigger);
      const input = await screen.findByRole('searchbox', { name: 'Filter more actions' });
      await waitSingleFrame();
      expect(input).not.toHaveFocus();
      await press(trigger, pointerType);
      await waitSingleFrame();
      expect(input).not.toHaveFocus();
    },
  );

  it('lets keyboard activation enter a hover-opened submenu', async () => {
    const { user } = await render(<Test filteredParent={filteredParent} />);
    await waitForParentFocus(filteredParent);
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    await user.hover(trigger);
    const input = await screen.findByRole('searchbox', { name: 'Filter more actions' });
    await waitSingleFrame();
    expect(input).not.toHaveFocus();
    await fireEvent.click(trigger, { detail: 0 });
    await waitFor(() => expect(input).toHaveFocus());
  });
});
