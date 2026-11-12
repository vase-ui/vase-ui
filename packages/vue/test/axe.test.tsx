import { expect, describe, it } from 'vitest';
import { createRenderer, expectNoAxeViolations, screen } from '#test-utils';

describe('expectNoAxeViolations', () => {
  const { render } = createRenderer();

  it('passes for an element with no violation', async () => {
    await render(<button type="button">Press</button>);

    await expectNoAxeViolations(screen.getByRole('button'));
  });

  it('fails for an element with a violation', async () => {
    await render(<button type="button" />);

    await expect(expectNoAxeViolations(screen.getByRole('button'))).rejects.toThrow(/button-name/);
  });
});
