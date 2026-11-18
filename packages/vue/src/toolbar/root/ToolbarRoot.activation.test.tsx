import { describe, expect, it, vi } from 'vitest';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import { createRenderer, screen } from '#test-utils';

describe('toolbar activation', () => {
  const { render } = createRenderer();

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
});
