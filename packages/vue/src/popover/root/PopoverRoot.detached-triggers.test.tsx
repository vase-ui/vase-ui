import { describe, expect, it, vi } from 'vitest';
import { defineComponent, onMounted } from 'vue';
import { createRenderer, screen } from '#test-utils';
import * as Popover from '../index.parts';

const DETACHED_WARNING = 'no root that uses this handle is mounted';

describe('<Popover.Root />', () => {
  const { render } = createRenderer();

  it('opens by trigger from a descendant layout effect on initial mount', async () => {
    const handle = Popover.createHandle();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const OpenOnMount = defineComponent({
      setup() {
        onMounted(() => {
          handle.open('trigger');
        });
        return () => null;
      },
    });

    await render(() => (
      <Popover.Root handle={handle}>
        <Popover.Trigger id="trigger">Trigger</Popover.Trigger>
        <OpenOnMount />
      </Popover.Root>
    ));

    const detachedWarned = consoleWarn.mock.calls.some(
      ([message]) => typeof message === 'string' && message.includes(DETACHED_WARNING),
    );
    consoleWarn.mockRestore();

    expect(detachedWarned).toBe(false);
    expect(handle.isOpen).toBe(true);
    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});
