import { describe, expect, it } from 'vitest';
import { Select } from '@vase-ui/vue/select';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
} from '#test-utils';

describe('<Select.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Label />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root>
          {node}
          <Select.Trigger />
          <Select.Portal>
            <Select.Positioner />
          </Select.Portal>
        </Select.Root>,
      );
    },
  }));

  it('has the id of the root with the suffix `-label`, also with an `id` attribute', async () => {
    await render(
      <Select.Root id="font">
        <Select.Label data-testid="label" {...{ id: 'own' }}>
          Font
        </Select.Label>
        <Select.Trigger />
      </Select.Root>,
    );

    expect(screen.getByTestId('label')).toHaveAttribute('id', 'font-label');
  });

  it('focuses the trigger when it is clicked', async () => {
    await render(
      <Select.Root>
        <Select.Label data-testid="label">Font</Select.Label>
        <Select.Trigger data-testid="trigger" />
      </Select.Root>,
    );

    screen.getByTestId('label').click();
    await flushMicrotasks();

    expect(screen.getByTestId('trigger')).toHaveFocus();
  });

  it('does not name the trigger while KeepAlive holds a label that mounted in a held branch', async () => {
    const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
      <Select.Label key="label" data-testid="label">
        Font
      </Select.Label>
    ));
    await render(() => (
      <Select.Root>
        <HeldBranch />
        <Select.Trigger data-testid="trigger" />
      </Select.Root>
    ));
    const trigger = screen.getByTestId('trigger');

    await mountWhileHeld();
    expect(trigger).not.toHaveAttribute('aria-labelledby');

    await show();
    expect(trigger).toHaveAttribute('aria-labelledby', screen.getByTestId('label').id);
  });
});
