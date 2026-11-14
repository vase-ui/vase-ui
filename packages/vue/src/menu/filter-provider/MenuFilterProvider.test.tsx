import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';

describe('<Menu.FilterProvider />', () => {
  const { render } = createRenderer();

  function renderMenu(providerProps: Record<string, unknown>) {
    return render(
      <Menu.FilterProvider {...providerProps}>
        <Menu.Root open>
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
  }

  it('emits valueChange and then update:value with the new query', async () => {
    const calls: string[] = [];
    const { user } = await renderMenu({
      onValueChange: (value: string, details: Menu.FilterProvider.ChangeEventDetails) =>
        calls.push(`valueChange ${value} ${details.reason}`),
      'onUpdate:value': (value: string) => calls.push(`update:value ${value}`),
    });

    await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'r');

    expect(calls).toEqual(['valueChange r input-change', 'update:value r']);
  });

  it('follows a query that the consumer holds with v-model:value', async () => {
    const query = shallowRef('');
    const Test = defineComponent(() => () => (
      <Menu.FilterProvider
        value={query.value}
        onUpdate:value={(value: string) => {
          query.value = value;
        }}
      >
        <Menu.Root open>
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
      </Menu.FilterProvider>
    ));
    const { user } = await render(<Test />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });

    await user.type(input, 'del');

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
    });
    expect(query.value).toBe('del');

    query.value = 'ren';
    await flushMicrotasks();

    expect(input).toHaveValue('ren');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
    });
  });

  it('keeps the query and emits no update:value when valueChange is canceled', async () => {
    const onUpdate = vi.fn();
    const { user } = await renderMenu({
      onValueChange: (_value: string, details: Menu.FilterProvider.ChangeEventDetails) =>
        details.cancel(),
      'onUpdate:value': onUpdate,
    });
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });

    await user.type(input, 'r');
    await flushMicrotasks();

    expect(onUpdate).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('keeps a menu in the popup of a filterable menu plain', async () => {
    await render(
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter files" />
                <Menu.Root>
                  <Menu.Trigger>More</Menu.Trigger>
                </Menu.Root>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('starts with the default query', async () => {
    await renderMenu({ defaultValue: 'ren' });

    expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveValue('ren');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
    });
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeInTheDocument();
  });
});
