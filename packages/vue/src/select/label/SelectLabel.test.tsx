import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, flushMicrotasks, screen } from '#test-utils';
import * as Select from '../index.parts';

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
});
