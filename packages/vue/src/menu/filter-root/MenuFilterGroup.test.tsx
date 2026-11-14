import { describe, expect, it } from 'vitest';
import * as Menu from '../index.parts';
import { createRenderer, screen, waitFor } from '#test-utils';

describe('filtered menu groups', () => {
  const { render } = createRenderer();

  it('hides a radio group, label included, when the query filters out all of its items', async () => {
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
                  <Menu.RadioGroup data-testid="sort-group" defaultValue="date">
                    <Menu.GroupLabel>Sort by</Menu.GroupLabel>
                    <Menu.RadioItem value="date">Date modified</Menu.RadioItem>
                    <Menu.RadioItem value="size">Size</Menu.RadioItem>
                  </Menu.RadioGroup>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const group = screen.getByTestId('sort-group');
    expect(group).not.toHaveAttribute('hidden');
    await waitFor(() => expect(screen.getByText('Sort by')).toBeVisible());

    await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'rena');

    await waitFor(() => {
      expect(group).toHaveAttribute('hidden');
    });
    expect(screen.queryByText('Sort by')).not.toBeVisible();
  });
});
