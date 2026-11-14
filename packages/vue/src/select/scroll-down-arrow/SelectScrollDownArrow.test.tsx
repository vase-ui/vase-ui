import { describe, expect, it } from 'vitest';
import { Select } from '@vase-ui/vue/select';
import { createRenderer, describeConformance, screen } from '#test-utils';

describe('<Select.ScrollDownArrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.ScrollDownArrow keepMounted />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Positioner>{node}</Select.Positioner>
        </Select.Root>,
      );
    },
  }));

  it('shows the down arrow when it has no slot', async () => {
    await render(
      <Select.Root open>
        <Select.Positioner>
          <Select.ScrollDownArrow keepMounted data-testid="arrow" />
        </Select.Positioner>
      </Select.Root>,
    );

    expect(screen.getByTestId('arrow')).toHaveTextContent('▼');
  });
});
