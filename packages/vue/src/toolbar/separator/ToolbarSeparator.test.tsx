import { expect, describe, it } from 'vitest';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createRenderer,
  describeConformance,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  within,
} from '#test-utils';
import ToolbarSeparatorHydration from './ToolbarSeparatorHydration.test.vue';

describe('<Toolbar.Separator />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Separator />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<Toolbar.Root>{node}</Toolbar.Root>),
  }));

  it.each([
    ['horizontal', 'vertical'],
    ['vertical', 'horizontal'],
  ] as const)(
    'uses a %s separator in a %s toolbar',
    async (separatorOrientation, toolbarOrientation) => {
      await render(
        <Toolbar.Root orientation={toolbarOrientation}>
          <Toolbar.Separator />
        </Toolbar.Root>,
      );

      expect(screen.getByRole('separator')).toHaveAttribute(
        'aria-orientation',
        separatorOrientation,
      );
    },
  );

  it('allows its orientation to be overridden', async () => {
    await render(
      <Toolbar.Root orientation="horizontal">
        <Toolbar.Separator orientation="horizontal" />
      </Toolbar.Root>,
    );

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('gives the state of the separator to the default slot', async () => {
    await render(
      <Toolbar.Root orientation="vertical">
        <Toolbar.Separator
          v-slots={{
            default: ({ state }: { state: Toolbar.Separator.State }) => state.orientation,
          }}
        />
      </Toolbar.Root>,
    );

    expect(screen.getByRole('separator')).toHaveTextContent('horizontal');
  });

  describe('hydration', () => {
    it('hydrates a separator in a toolbar', async () => {
      const serverHtml = await renderOnServer(
        'src/toolbar/separator/ToolbarSeparatorHydration.test.vue',
      );

      const { container } = await hydrate(ToolbarSeparatorHydration, { serverHtml });

      expect(within(container).getByRole('separator')).toHaveAttribute(
        'aria-orientation',
        'vertical',
      );
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when rendered outside Toolbar.Root', async () => {
    await expect(render(<Toolbar.Separator />)).rejects.toThrow(
      'Vase UI: A part of Toolbar must be inside <Toolbar.Root>. Without a root the part has no orientation and no disabled state. Put the part inside <Toolbar.Root>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
