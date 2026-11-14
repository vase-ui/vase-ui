import { expect, describe, it } from 'vitest';
import * as Select from '../index.parts';
import { createRenderer, describeConformance, takeReportedMessages } from '#test-utils';

describe('<Select.ItemText />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.ItemText />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Positioner>
            <Select.Item value="">{node}</Select.Item>
          </Select.Positioner>
        </Select.Root>,
      );
    },
  }));

  it('throws a descriptive error when rendered outside <Select.Item>', async () => {
    await expect(
      render(
        <Select.Root open>
          <Select.Positioner>
            <Select.ItemText />
          </Select.Positioner>
        </Select.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A text or an indicator of a Select item must be inside <Select.Item>.',
    );
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
