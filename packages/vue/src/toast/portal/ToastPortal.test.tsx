import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import { Toast } from '@vase-ui/vue/toast';

describe('<Toast.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(node);
    },
  }));

  it('renders its children in a portal element of the body', async () => {
    await render(
      <Toast.Provider>
        <Toast.Portal data-testid="portal">
          <Toast.Viewport data-testid="viewport" />
        </Toast.Portal>
      </Toast.Provider>,
    );

    expect(screen.getByTestId('portal').parentElement).toBe(document.body);
    expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('viewport'));
  });
});
