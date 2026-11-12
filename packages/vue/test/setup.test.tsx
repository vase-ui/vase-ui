import { describe, expect, it } from 'vitest';
import { createRenderer, screen } from '#test-utils';

describe('test setup', () => {
  const { render } = createRenderer();

  it('gives toBeVisible the meaning of @testing-library/jest-dom: an empty element in the document is visible', async () => {
    await render(<div data-testid="empty" />);

    expect(screen.getByTestId('empty')).toBeVisible();
  });
});
