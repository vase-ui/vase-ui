import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Drawer from '../index.parts';

describe('<Drawer.Content />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.Content />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>{node}</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );
    },
  }));

  it('does not add public swipe-ignore attributes', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content data-testid="content">Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    expect(screen.getByTestId('content')).not.toHaveAttribute('data-swipe-ignore');
    expect(screen.getByTestId('content')).not.toHaveAttribute('data-vase-ui-swipe-ignore');
  });

  it('marks its element as the content of the drawer', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Content data-testid="content">Content</Drawer.Content>
      </Drawer.Root>,
    );

    const content = screen.getByTestId('content');
    expect(content.tagName).toBe('DIV');
    expect(content).toHaveAttribute('data-drawer-content', '');
  });
});
