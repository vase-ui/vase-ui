import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { DirectionProvider, useDirection } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import { createRenderer, screen } from '#test-utils';

const DirectionProbe = defineComponent(() => {
  const direction = useDirection();
  return () => <span data-testid="direction">{direction.value}</span>;
});

function DirectionProviderTest(props: { direction?: TextDirection }) {
  return (
    <DirectionProvider direction={props.direction}>
      <DirectionProbe />
    </DirectionProvider>
  );
}

describe('<DirectionProvider />', () => {
  const { render } = createRenderer();

  it('defaults useDirection to ltr outside a provider', async () => {
    await render(<DirectionProbe />);

    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
  });

  it('provides the configured direction to descendants', async () => {
    const { setProps } = await render(<DirectionProviderTest direction="rtl" />);

    expect(screen.getByTestId('direction')).toHaveTextContent('rtl');

    await setProps({ direction: 'ltr' });

    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
  });
});
