import { describe, expect, it } from 'vitest';
import { Menu } from '@vase-ui/vue/menu';
import { createRenderer, describeConformance, screen } from '#test-utils';

describe('<Menu.Group />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Group />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('renders a div with the `group` role', async () => {
    await render(<Menu.Group />);
    expect(screen.getByRole('group')).toBeVisible();
  });
});
