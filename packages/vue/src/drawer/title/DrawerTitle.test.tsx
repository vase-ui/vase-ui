import { describe, expect, it } from 'vitest';
import { createRenderer, screen } from '#test-utils';
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import * as Drawer from '../index.parts';

describe('<Drawer.Title />', () => {
  const { render } = createRenderer();

  it('renders a heading that names the popup of the drawer', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <DialogPopupPart>
          <Drawer.Title data-testid="title">Title</Drawer.Title>
        </DialogPopupPart>
      </Drawer.Root>,
    );

    const title = screen.getByTestId('title');
    expect(title.tagName).toBe('H2');
    expect(title.id).not.toBe('');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', title.id);
  });
});
