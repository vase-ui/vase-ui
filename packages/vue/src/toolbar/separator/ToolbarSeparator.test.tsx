import { expect, describe, it } from 'vitest';
import { Toolbar } from '@vase-ui/vue/toolbar';
import {
  createRenderer,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  within,
} from '#test-utils';
import ToolbarSeparatorHydration from './ToolbarSeparatorHydration.test.vue';

describe('<Toolbar.Separator />', () => {
  const { render } = createRenderer();

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

  it('renders the tag of `as`', async () => {
    await render(
      <Toolbar.Root>
        <Toolbar.Separator as="li" />
      </Toolbar.Root>,
    );

    expect(screen.getByRole('separator').tagName).toBe('LI');
  });

  it('allows its orientation to be overridden', async () => {
    await render(
      <Toolbar.Root orientation="horizontal">
        <Toolbar.Separator orientation="horizontal" />
      </Toolbar.Root>,
    );

    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('gives the attributes and the template ref to the separator, also in the element slot', async () => {
    type Exposed = { element: Element | null } | null;
    type ElementScope = { props: Record<string, unknown>; elementRef: (target: unknown) => void };
    let plain: Exposed = null;
    let replaced: Exposed = null;
    await render(() => (
      <Toolbar.Root>
        <Toolbar.Separator
          ref={(value) => {
            plain = value as Exposed;
          }}
          class="line"
          style={{ color: 'rgb(255, 0, 0)' }}
          data-index="1"
        />
        <Toolbar.Separator
          ref={(value) => {
            replaced = value as Exposed;
          }}
          v-slots={{
            element: ({ props, elementRef }: ElementScope) => <span {...props} ref={elementRef} />,
          }}
        />
      </Toolbar.Root>
    ));

    const [div, span] = screen.getAllByRole('separator');
    expect(div!.tagName).toBe('DIV');
    expect(div).toHaveClass('line');
    expect(div).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    expect(div).toHaveAttribute('data-index', '1');
    expect(plain!.element).toBe(div);
    expect(span!.tagName).toBe('SPAN');
    expect(span).toHaveAttribute('aria-orientation', 'vertical');
    expect(replaced!.element).toBe(span);
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

    it('hydrates a separator in an <hr>, which has no content', async () => {
      const props = { as: 'hr' };
      const serverHtml = await renderOnServer(
        'src/toolbar/separator/ToolbarSeparatorHydration.test.vue',
        props,
      );

      const { container } = await hydrate(ToolbarSeparatorHydration, { serverHtml, props });

      expect(within(container).getByRole('separator').tagName).toBe('HR');
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
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
