import { describe, expect, it } from 'vitest';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { createRenderer, fireEvent, screen } from '#test-utils';
import * as Dialog from '../../dialog/index.parts';
import type { HTMLProps } from '../../internals/types';

describe('<AlertDialog.Trigger />', () => {
  const { render } = createRenderer();

  it('renders the element of Dialog.Trigger, with the attributes and the listeners of the consumer', async () => {
    let clicks = 0;
    const { unmount } = await render(
      <Dialog.Root>
        <Dialog.Trigger id="trigger" class="trigger" data-kind="confirm">
          Delete
        </Dialog.Trigger>
      </Dialog.Root>,
    );
    const dialogTrigger = screen.getByRole('button', { name: 'Delete' }).outerHTML;
    unmount();

    await render(
      <AlertDialog.Root>
        <AlertDialog.Trigger
          id="trigger"
          class="trigger"
          data-kind="confirm"
          onClick={() => (clicks += 1)}
        >
          Delete
        </AlertDialog.Trigger>
      </AlertDialog.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Delete' });
    expect(trigger.outerHTML).toBe(dialogTrigger);

    await fireEvent.click(trigger);
    expect(clicks).toBe(1);
  });

  it('gives the #render slot to Dialog.Trigger, and exposes the element', async () => {
    let instance!: { element: HTMLElement | null };
    await render(() => (
      <AlertDialog.Root>
        <AlertDialog.Trigger
          ref={(value: unknown) => {
            instance = value as { element: HTMLElement | null };
          }}
          nativeButton={false}
          v-slots={{ render: ({ props }: { props: HTMLProps }) => <span {...props}>Delete</span> }}
        />
      </AlertDialog.Root>
    ));

    const trigger = screen.getByRole('button', { name: 'Delete' });
    expect(trigger.tagName).toBe('SPAN');
    expect(instance.element).toBe(trigger);
  });
});
