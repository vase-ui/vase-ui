import { describe, expect, it } from 'vitest';
import { createRenderer, screen } from '#test-utils';
import * as Drawer from '../index.parts';

describe('<Drawer.Description />', () => {
  const { render } = createRenderer();

  it('renders a paragraph that describes the popup of the drawer', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Description data-testid="description">Description</Drawer.Description>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const description = screen.getByTestId('description');
    expect(description.tagName).toBe('P');
    expect(description.id).not.toBe('');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', description.id);
  });
});
