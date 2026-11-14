import { describe, expect, it } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import * as Drawer from '../index.parts';

describe('<Drawer.Content />', () => {
  const { render } = createRenderer();

  describe('with a test popup', () => {
    describeConformance(<Drawer.Content />, () => ({
      refInstanceof: window.HTMLDivElement,
      render: (node) => {
        return render(
          <Drawer.Root open modal={false}>
            <DialogPopupPart>{node}</DialogPopupPart>
          </Drawer.Root>,
        );
      },
    }));
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
