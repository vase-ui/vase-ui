import { describe, expect, it } from 'vitest';
import * as Menu from '../index.parts';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import { DirectionProvider } from '../../direction-provider';

describe('<Menu.Popup /> filter input focus', () => {
  const { render } = createRenderer();

  function renderFilterMenu() {
    return render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Group>
                    <Menu.GroupLabel>Edit</Menu.GroupLabel>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.Group>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );
  }

  it('returns focus to the input when the list takes it from the input', async () => {
    await renderFilterMenu();

    const input = screen.getByRole('searchbox');
    await waitFor(() => expect(input).toHaveFocus());
    // A press on a group or its label focuses the list, the nearest focusable ancestor.
    screen.getByRole('menu').focus();
    await flushMicrotasks();

    expect(input).toHaveFocus();
  });

  it('leaves focus on the list when the input did not have it', async () => {
    await renderFilterMenu();

    const list = screen.getByRole('menu');
    const input = screen.getByRole('searchbox');
    // The focus manager moves the focus to the input in the frame after the open.
    await waitFor(() => expect(input).toHaveFocus());
    // A touch open leaves the input unfocused so the on-screen keyboard stays closed.
    input.blur();
    await flushMicrotasks();
    list.focus();
    await flushMicrotasks();

    expect(list).toHaveFocus();
  });

  it.each([
    { orientation: 'vertical', direction: 'ltr', key: 'ArrowLeft' },
    { orientation: 'vertical', direction: 'rtl', key: 'ArrowRight' },
    { orientation: 'horizontal', direction: 'ltr', key: 'ArrowUp' },
    { orientation: 'horizontal', direction: 'rtl', key: 'ArrowUp' },
  ] as const)(
    'returns focus with the $orientation $direction close key',
    async ({ orientation, direction, key }) => {
      await render(
        <DirectionProvider direction={direction}>
          <Menu.FilterProvider>
            <Menu.Root defaultOpen orientation={orientation}>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <button type="button">Extra action</button>
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        </DirectionProvider>,
      );

      const action = screen.getByRole('button', { name: 'Extra action' });
      action.focus();
      await flushMicrotasks();
      expect(action).toHaveFocus();
      await fireEvent.keyDown(action, { key });
      expect(screen.getByRole('searchbox')).toHaveFocus();
    },
  );
});
