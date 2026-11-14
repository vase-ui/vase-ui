import { expect, describe, it } from 'vitest';
import * as Tooltip from '../index.parts';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';

describe('<Tooltip.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Tooltip.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Positioner>{node}</Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('should render the children', async () => {
    await render(
      <Tooltip.Root open>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );
    await flushMicrotasks();

    expect(screen.getByText('Content')).not.toBe(null);
  });

  it('throws a descriptive error when rendered outside <Tooltip.Positioner>', async () => {
    await expect(
      render(
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Popup />
          </Tooltip.Portal>
        </Tooltip.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: A popup or an arrow of Tooltip must be inside <Tooltip.Positioner>.',
    );
    // The portal renders its content in an update after the mount, so Vue also warns about it.
    expect(takeReportedMessages()).toHaveLength(2);
  });
});
