import { describe, expect, it, vi } from 'vitest';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import type { HTMLProps } from '@vase-ui/vue/types';
import { createHeldBranch, createRenderer, screen } from '#test-utils';

describe('toolbar activation', () => {
  const { render } = createRenderer();

  it('keeps a disabled custom button focusable after render', async () => {
    await render(
      <Toolbar.Root>
        <Toolbar.Button
          disabled
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => <button {...props} disabled />,
          }}
        />
      </Toolbar.Root>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveProperty('disabled', false);
    button.focus();
    expect(button).toHaveFocus();
  });

  it('submits once when a listener vetoes the native Space release', async () => {
    const submit = vi.fn((event: Event) => event.preventDefault());
    const release = vi.fn();

    await render(
      <form onSubmit={submit}>
        <Toolbar.Root>
          <Toolbar.Button
            type="submit"
            onKeyup={(event) => {
              release(event.defaultPrevented);
              event.preventVaseUIHandler();
            }}
          >
            Save
          </Toolbar.Button>
        </Toolbar.Root>
      </form>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    button.focus();
    button.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
    const keyup = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
    button.dispatchEvent(keyup);

    expect(release).toHaveBeenCalledExactlyOnceWith(false);
    expect(keyup.defaultPrevented).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('keeps focus and pressed state when a group refuses keyboard activation', async () => {
    const events: string[] = [];
    const { user } = await render(
      <Toolbar.Root>
        <Toolbar.Button>First</Toolbar.Button>
        <ToggleGroup
          onValueChange={(_, details) => {
            events.push('group');
            details.cancel();
          }}
          onUpdate:modelValue={() => events.push('group update')}
        >
          <Toggle
            as="span"
            nativeButton={false}
            value="bold"
            onPressedChange={() => events.push('item')}
            onUpdate:modelValue={() => events.push('item update')}
          >
            Bold
          </Toggle>
        </ToggleGroup>
      </Toolbar.Root>,
    );

    await user.tab();
    await user.keyboard('[ArrowRight][Space]');
    const toggle = screen.getByRole('button', { name: 'Bold' });

    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAttribute('tabindex', '0');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(events).toEqual(['item', 'group']);
  });

  it('restores toolbar arrow order after a group mounts while held', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Toolbar.Group>
        <ToggleGroup>
          <Toggle value="bold">Bold</Toggle>
        </ToggleGroup>
        <Toolbar.Link href="#help">Help</Toolbar.Link>
        <Toolbar.Input aria-label="Filter" />
      </Toolbar.Group>
    ));
    const { user } = await render(
      <Toolbar.Root>
        <Toolbar.Button>First</Toolbar.Button>
        <HeldBranch />
        <Toolbar.Button>Last</Toolbar.Button>
      </Toolbar.Root>,
    );

    await mountWhileHeld();
    await user.tab();
    await user.keyboard('[ArrowRight]');
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    await show();
    await user.keyboard('[ArrowRight][ArrowRight]');
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveFocus();
    await user.keyboard('[ArrowRight]');
    expect(screen.getByRole('link', { name: 'Help' })).toHaveFocus();
    await user.keyboard('[ArrowRight]');
    expect(screen.getByRole('textbox', { name: 'Filter' })).toHaveFocus();
  });

  it('restores one tab stop and the pressed value after a standalone group returns', async () => {
    const { HeldBranch, mountWhileHeld, show, hide } = createHeldBranch(() => (
      <ToggleGroup>
        <Toggle value="bold">Bold</Toggle>
        <Toggle value="italic">Italic</Toggle>
      </ToggleGroup>
    ));
    const { user } = await render(<HeldBranch />);
    await mountWhileHeld();
    await show();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveFocus();
    await user.keyboard('[ArrowRight][Space]');
    await hide();
    await show();
    const bold = screen.getByRole('button', { name: 'Bold' });
    const italic = screen.getByRole('button', { name: 'Italic' });
    expect(bold).toHaveAttribute('tabindex', '-1');
    expect(italic).toHaveAttribute('tabindex', '0');
    expect(italic).toHaveAttribute('aria-pressed', 'true');
    await user.tab();
    expect(italic).toHaveFocus();
  });
});
