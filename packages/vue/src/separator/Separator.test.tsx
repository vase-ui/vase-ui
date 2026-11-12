import { expect, describe, it } from 'vitest';
import { Separator } from '@vase-ui/vue/separator';
import {
  createRenderer,
  describeConformance,
  expectNoAxeViolations,
  hydrate,
  renderOnServer,
  screen,
  within,
} from '#test-utils';

describe('<Separator />', () => {
  const { render } = createRenderer();

  describeConformance(<Separator />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('renders a div with the `separator` role', async () => {
    await render(<Separator />);
    expect(screen.getByRole('separator')).toBeVisible();
  });

  describe('prop: orientation', () => {
    it.each([{ orientation: 'horizontal' }, { orientation: 'vertical' }] as const)(
      'sets aria-orientation="$orientation"',
      async ({ orientation }) => {
        await render(<Separator orientation={orientation} />);

        expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', orientation);
      },
    );
  });

  describe('accessibility', () => {
    it.each([{ orientation: 'horizontal' }, { orientation: 'vertical' }] as const)(
      'has no axe violation with orientation "$orientation"',
      async ({ orientation }) => {
        await render(<Separator orientation={orientation} />);

        await expectNoAxeViolations(screen.getByRole('separator'));
      },
    );
  });

  describe('hydration', () => {
    it('hydrates the server HTML with no warning and no DOM difference', async () => {
      const serverHtml = await renderOnServer('src/separator/Separator.vue', {
        orientation: 'vertical',
      });

      const { container } = await hydrate(Separator, {
        serverHtml,
        props: { orientation: 'vertical' },
      });

      expect(within(container).getByRole('separator')).toHaveAttribute(
        'aria-orientation',
        'vertical',
      );
    });
  });
});
