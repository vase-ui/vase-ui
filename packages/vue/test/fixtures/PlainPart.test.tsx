import { expect, describe, it, vi } from 'vitest';
import { createRenderer, describeConformance } from '#test-utils';
import type { HTMLProps } from '../../src/internals/types';
import PlainPart from './PlainPart.vue';

describe('<PlainPart />', () => {
  const { render } = createRenderer();

  describeConformance(<PlainPart />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('renders its own props and the state attributes', async () => {
    const { container } = await render(<PlainPart active orientation="vertical" />);

    const element = container.firstElementChild as HTMLElement;
    expect(element).toHaveClass('plain-part');
    expect(element.style.color).toBe('red');
    expect(element).toHaveAttribute('aria-orientation', 'vertical');
    expect(element).toHaveAttribute('data-active', '');
    expect(element).toHaveAttribute('data-orientation', 'vertical');
  });

  describe('attributes that come after a first render with no attribute', () => {
    it.each([
      { name: 'the `as` prop', createNode: () => <PlainPart as="a" /> },
      {
        name: 'the `#render` slot',
        createNode: () => (
          <PlainPart
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => <a {...props} />,
            }}
          />
        ),
      },
    ])('reach the same element with $name', async ({ createNode }) => {
      const handleClick = vi.fn();
      const { container, setProps } = await render(createNode());
      const element = container.firstElementChild as HTMLElement;

      expect(element).not.toHaveAttribute('lang');
      expect(element).not.toHaveClass('late');

      await setProps({ lang: 'fr', class: 'late', onClick: handleClick });

      expect(container.firstElementChild).toBe(element);
      expect(element).toHaveAttribute('lang', 'fr');
      expect(element).toHaveClass('late');
      element.click();
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
