import { expect, describe, it, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';
import * as Select from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';

describe('<Select.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner>{node}</Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('has aria attributes when no Select.List is present', async () => {
    const { user } = await render(
      <Select.Root multiple>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">Popup</Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByRole('combobox');

    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    const popup = await screen.findByTestId('popup');
    const listbox = await screen.findByRole('listbox');

    expect(popup).toBe(listbox);
    expect(popup.id).not.toBe('');
    expect(popup).toHaveAttribute('aria-multiselectable', 'true');
    expect(trigger).toHaveAttribute('aria-controls', popup.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('places aria attributes on Select.List instead if it is present', async () => {
    const { user } = await render(
      <Select.Root multiple>
        <Select.Trigger>Trigger</Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup data-testid="popup">
              <Select.List data-testid="list">
                <Select.Item value="1">Item 1</Select.Item>
                <Select.Item value="2">Item 2</Select.Item>
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByRole('combobox');

    expect(trigger).not.toHaveAttribute('aria-controls');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');

    await user.click(trigger);

    const popup = await screen.findByTestId('popup');
    const list = await screen.findByTestId('list');
    const listbox = await screen.findByRole('listbox');

    expect(list).toBe(listbox);
    expect(list).toHaveAttribute('aria-multiselectable');
    expect(popup).toHaveAttribute('role', 'presentation');
    expect(popup).not.toHaveAttribute('aria-multiselectable');
    expect(list.id).not.toBe('');
    expect(trigger).toHaveAttribute('aria-controls', list.id);
    expect(trigger).not.toHaveAttribute('aria-controls', popup.id);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('stops the arrow keys of the popup at the popup when the select is in a toolbar', async () => {
    const onToolbarKeydown = vi.fn();
    await render(
      <Toolbar.Root onKeydown={onToolbarKeydown}>
        <Select.Root defaultOpen>
          <Select.Trigger>Trigger</Select.Trigger>
          <Select.Positioner>
            <Select.Popup data-testid="popup">
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Root>
      </Toolbar.Root>,
    );
    const popup = screen.getByTestId('popup');

    await fireEvent.keyDown(popup, { key: 'ArrowRight' });
    expect(onToolbarKeydown).not.toHaveBeenCalled();

    await fireEvent.keyDown(popup, { key: 'Enter' });
    expect(onToolbarKeydown).toHaveBeenCalledOnce();
  });

  it('VUE-5: keeps its open state under KeepAlive and hears no Escape while deactivated', async () => {
    const changes: [boolean, string][] = [];
    const Page = defineComponent({
      name: 'Page',
      setup() {
        return () => (
          <Select.Root
            defaultOpen
            onOpenChange={(open: boolean, details: Select.Root.OpenChangeEventDetails) => {
              changes.push([open, details.reason]);
            }}
          >
            <Select.Trigger data-testid="trigger">Trigger</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup data-testid="popup">
                  <Select.Item value="a">a</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      },
    });
    const visible = shallowRef(true);
    const { user } = await render(() => (
      <KeepAlive>{visible.value ? <Page key="page" /> : <p key="other">other</p>}</KeepAlive>
    ));
    await flushMicrotasks();
    const popup = screen.getByTestId('popup');

    visible.value = false;
    await flushMicrotasks();
    expect(popup.isConnected).toBe(false);
    await user.keyboard('[Escape]');
    expect(changes).toEqual([]);

    visible.value = true;
    await flushMicrotasks();
    expect(screen.getByTestId('popup')).toBe(popup);
    expect(popup).toHaveAttribute('data-open');

    await user.keyboard('[Escape]');
    expect(changes).toEqual([[false, 'escape-key']]);
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  // In Vue 3.5.12, a `setup` that throws leaves the current instance set, and a later slot then
  // gives a warning. The case that throws thus comes last.
  it('throws a descriptive error when rendered outside <Select.Positioner>', async () => {
    await expect(
      render(
        <Select.Root open>
          <Select.Popup />
        </Select.Root>,
      ),
    ).rejects.toThrow('Vase UI: A popup or an arrow of Select must be inside <Select.Positioner>.');
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
