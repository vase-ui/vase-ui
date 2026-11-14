import { describe, expect, it } from 'vitest';
import { createRenderer, screen } from '#test-utils';
import * as Drawer from '../index.parts';

describe('<Drawer.Content />', () => {
  const { render } = createRenderer();

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
