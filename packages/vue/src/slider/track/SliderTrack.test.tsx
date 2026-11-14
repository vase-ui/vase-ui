import { describe, expect, it } from 'vitest';
import { Slider } from '@vase-ui/vue/slider';
import { createRenderer, describeConformance, screen } from '#test-utils';

describe('<Slider.Track />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Track />, () => ({
    render: (node) => {
      return render(<Slider.Root>{node}</Slider.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  it('positions its element relative to itself, so that the indicator is placed in the track', async () => {
    await render(
      <Slider.Root>
        <Slider.Track data-testid="track" />
      </Slider.Root>,
    );

    expect(screen.getByTestId('track')).toHaveStyle({ position: 'relative' });
  });
});
