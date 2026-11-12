import { expect, describe, it } from 'vitest';
import { Progress } from '@vase-ui/vue/progress';
import { createRenderer, describeConformance, isJSDOM, screen } from '#test-utils';

describe('<Progress.Indicator />', () => {
  const { render } = createRenderer();

  describeConformance(<Progress.Indicator />, () => ({
    render: (node) => {
      return render(<Progress.Root value={40}>{node}</Progress.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  describe.skipIf(isJSDOM)('internal styles', () => {
    it('determinate', async () => {
      await render(
        <Progress.Root value={33}>
          <Progress.Track>
            <Progress.Indicator data-testid="indicator" as="span" />
          </Progress.Track>
        </Progress.Root>,
      );

      const indicator = screen.getByTestId('indicator');

      expect(indicator).toHaveStyle({
        insetInlineStart: '0px',
        width: '33%',
      });
    });

    it('sets zero width when value is 0', async () => {
      await render(
        <Progress.Root value={0}>
          <Progress.Track>
            <Progress.Indicator data-testid="indicator" />
          </Progress.Track>
        </Progress.Root>,
      );

      const indicator = screen.getByTestId('indicator');

      expect(indicator).toHaveStyle({
        insetInlineStart: '0px',
        width: '0px',
      });
    });

    it('indeterminate', async () => {
      await render(
        <Progress.Root value={null}>
          <Progress.Track>
            <Progress.Indicator data-testid="indicator" />
          </Progress.Track>
        </Progress.Root>,
      );

      const indicator = screen.getByTestId('indicator');

      expect(indicator).not.toHaveAttribute('style');
    });
  });
});
