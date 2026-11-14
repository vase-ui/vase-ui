import { describe, expect, it } from 'vitest';
import { createRenderer, screen } from '#test-utils';
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import * as Drawer from '../index.parts';

describe('<Drawer.Description />', () => {
  const { render } = createRenderer();

  it('renders a paragraph that describes the popup of the drawer', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <DialogPopupPart>
          <Drawer.Description data-testid="description">Description</Drawer.Description>
        </DialogPopupPart>
      </Drawer.Root>,
    );

    const description = screen.getByTestId('description');
    expect(description.tagName).toBe('P');
    expect(description.id).not.toBe('');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', description.id);
  });
});
