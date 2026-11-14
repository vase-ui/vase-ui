import { describe, expect, it } from 'vitest';
import { createRenderer, fireEvent, screen } from '#test-utils';
import * as Dialog from '../../dialog/index.parts';
import type { HTMLProps } from '../../internals/types';
import * as Drawer from '../index.parts';

describe('<Drawer.Trigger />', () => {
  const { render } = createRenderer();

  it('renders the element of Dialog.Trigger, with the attributes and the listeners of the consumer', async () => {
    let clicks = 0;
    const { unmount } = await render(
      <Dialog.Root>
        <Dialog.Trigger id="trigger" class="trigger" data-kind="menu">
          Open
        </Dialog.Trigger>
      </Dialog.Root>,
    );
    const dialogTrigger = screen.getByRole('button', { name: 'Open' }).outerHTML;
    unmount();

    await render(
      <Drawer.Root>
        <Drawer.Trigger id="trigger" class="trigger" data-kind="menu" onClick={() => (clicks += 1)}>
          Open
        </Drawer.Trigger>
      </Drawer.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger.outerHTML).toBe(dialogTrigger);

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
});
