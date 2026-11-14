import { vi, describe, it, expect } from 'vitest';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  screen,
  takeReportedMessages,
} from '#test-utils';
import * as NavigationMenu from '../index.parts';

describe('<NavigationMenu.List />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.List />, () => ({
    refInstanceof: window.HTMLUListElement,
    render(node) {
      return render(<NavigationMenu.Root>{node}</NavigationMenu.Root>);
    },
  }));

  describe('arrow keys', () => {
    it('moves the focus between the links with ArrowRight and ArrowLeft, and does not loop', async () => {
      const { user } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#one">One</NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#two">Two</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      const one = screen.getByRole('link', { name: 'One' });
      const two = screen.getByRole('link', { name: 'Two' });

      one.focus();
      await user.keyboard('[ArrowLeft]');
      expect(one).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(two).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(two).toHaveFocus();

      await user.keyboard('[ArrowLeft]');
      expect(one).toHaveFocus();
    });

    it('moves the focus with ArrowDown and ArrowUp when the orientation is vertical', async () => {
      const { user } = await render(
        <NavigationMenu.Root orientation="vertical">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#one">One</NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#two">Two</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      const one = screen.getByRole('link', { name: 'One' });
      const two = screen.getByRole('link', { name: 'Two' });

      one.focus();
      await user.keyboard('[ArrowRight]');
      expect(one).toHaveFocus();

      await user.keyboard('[ArrowDown]');
      expect(two).toHaveFocus();

      await user.keyboard('[ArrowUp]');
      expect(one).toHaveFocus();
    });

    it.each([
      { name: 'ArrowRight', orientation: 'horizontal', key: 'ArrowRight' },
      { name: 'ArrowLeft', orientation: 'horizontal', key: 'ArrowLeft' },
      { name: 'ArrowDown', orientation: 'vertical', key: 'ArrowDown' },
      { name: 'ArrowUp', orientation: 'vertical', key: 'ArrowUp' },
    ] as const)(
      'stops $name at the list when the orientation is $orientation, also at the end of the list',
      async ({ orientation, key }) => {
        const handleKeyDown = vi.fn();

        await render(
          <div onKeydown={handleKeyDown}>
            <NavigationMenu.Root orientation={orientation}>
              <NavigationMenu.List>
                <NavigationMenu.Item>
                  <NavigationMenu.Link href="#one">One</NavigationMenu.Link>
                </NavigationMenu.Item>
              </NavigationMenu.List>
            </NavigationMenu.Root>
          </div>,
        );
        const link = screen.getByRole('link', { name: 'One' });

        link.focus();
        await fireEvent.keyDown(link, { key });
        expect(handleKeyDown).not.toHaveBeenCalled();

        await fireEvent.keyDown(link, { key: 'PageDown' });
        expect(handleKeyDown).toHaveBeenCalledTimes(1);
      },
    );

    it('lets the links of a nested list use the composite of the list above', async () => {
      const { user } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#before">Before</NavigationMenu.Link>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Root>
                <NavigationMenu.List>
                  <NavigationMenu.Item>
                    <NavigationMenu.Link href="#nested-one">Nested one</NavigationMenu.Link>
                  </NavigationMenu.Item>
                  <NavigationMenu.Item>
                    <NavigationMenu.Link href="#nested-two">Nested two</NavigationMenu.Link>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
              </NavigationMenu.Root>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#after">After</NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      screen.getByRole('link', { name: 'Before' }).focus();
      await user.keyboard('[ArrowRight]');
      expect(screen.getByRole('link', { name: 'Nested one' })).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByRole('link', { name: 'Nested two' })).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(screen.getByRole('link', { name: 'After' })).toHaveFocus();
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <NavigationMenu.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(render(<NavigationMenu.List />)).rejects.toThrow(
        'Vase UI: <NavigationMenu.Root> is missing. A Navigation Menu part reads the open item from its root. Put the part inside <NavigationMenu.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
