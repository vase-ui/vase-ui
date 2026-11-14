import { describe, expect, it } from 'vitest';
import { createRenderer, screen } from '#test-utils';
import * as Drawer from '../index.parts';

describe('<Drawer.Title />', () => {
  const { render } = createRenderer();

  it('renders a heading that names the popup of the drawer', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Title data-testid="title">Title</Drawer.Title>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const title = screen.getByTestId('title');
    expect(title.tagName).toBe('H2');
    expect(title.id).not.toBe('');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', title.id);
  });
});
