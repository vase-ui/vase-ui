import { describe, expect, it } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import {
  createHeldBranch,
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  withoutVaporAnchors,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import DialogTrigger from '../dialog/trigger/DialogTrigger.vue';
import * as Drawer from '../index.parts';

describe('<Drawer.Trigger />', () => {
  const { render } = createRenderer();

  it('renders the element of Dialog.Trigger, with the attributes and the listeners of the consumer', async () => {
    let clicks = 0;
    const { unmount } = await render(
      <Drawer.Root>
        <DialogTrigger id="trigger" class="trigger" data-kind="menu">
          Open
        </DialogTrigger>
      </Drawer.Root>,
    );
    const dialogTrigger = withoutVaporAnchors(
      screen.getByRole('button', { name: 'Open' }),
    ).outerHTML;
    unmount();

    await render(
      <Drawer.Root>
        <Drawer.Trigger id="trigger" class="trigger" data-kind="menu" onClick={() => (clicks += 1)}>
          Open
        </Drawer.Trigger>
      </Drawer.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(withoutVaporAnchors(trigger).outerHTML).toBe(dialogTrigger);

    await fireEvent.click(trigger);
    expect(clicks).toBe(1);
  });

  it('gives the state to the default slot', async () => {
    await render(
      <Drawer.Root defaultOpen defaultTriggerId="trigger">
        <Drawer.Trigger
          id="trigger"
          disabled
          v-slots={{
            default: ({ state }: { state: Drawer.Trigger.State }) => JSON.stringify(state),
          }}
        />
      </Drawer.Root>,
    );

    expect(screen.getByRole('button').textContent).toBe('{"disabled":true,"open":true}');
  });

  it('gives the #render slot to Dialog.Trigger, and exposes the element', async () => {
    let instance!: { element: HTMLElement | null };
    await render(() => (
      <Drawer.Root>
        <Drawer.Trigger
          ref={(value: unknown) => {
            instance = value as { element: HTMLElement | null };
          }}
          nativeButton={false}
          v-slots={{ render: ({ props }: { props: HTMLProps }) => <span {...props}>Open</span> }}
        />
      </Drawer.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger.tagName).toBe('SPAN');
    expect(instance.element).toBe(trigger);
  });

  describe('VUE-73: aria-controls names only an element in the document', () => {
    it('has no aria-controls while KeepAlive holds the popup', async () => {
      const Popup = defineComponent({
        setup: () => () => (
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>popup</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        ),
      });
      const Other = defineComponent({ setup: () => () => <span /> });
      const visible = shallowRef(true);
      await render(() => (
        <Drawer.Root defaultOpen modal={false}>
          <Drawer.Trigger>Open</Drawer.Trigger>
          <KeepAlive>{visible.value ? <Popup key="popup" /> : <Other key="other" />}</KeepAlive>
        </Drawer.Root>
      ));
      await flushMicrotasks();
      const trigger = screen.getByRole('button', { name: 'Open' });
      const popup = screen.getByRole('dialog');
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);

      visible.value = false;
      await flushMicrotasks();

      expect(popup.isConnected).toBe(false);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).not.toHaveAttribute('aria-controls');

      visible.value = true;
      await flushMicrotasks();

      expect(popup.isConnected).toBe(true);
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });

    it('has no aria-controls while the popup mounts in a branch that KeepAlive holds', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
        () => <Drawer.Popup>popup</Drawer.Popup>,
        { renderBranch: (part) => part },
      );
      await render(() => (
        <Drawer.Root defaultOpen modal={false}>
          <Drawer.Trigger>Open</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <HeldBranch />
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      ));

      await mountWhileHeld();

      const trigger = screen.getByRole('button', { name: 'Open' });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).not.toHaveAttribute('aria-controls');

      await show();

      const popup = screen.getByRole('dialog');
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });
  });
});
