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

  it('ignores the report of a rule for an element that `accept` accepts', async () => {
    const { container } = await render(
      <div>
        <button type="button" data-testid="accepted" />
      </div>,
    );

    await expectNoAxeViolations(container, {
      accept: (rule, element) => rule === 'button-name' && element.matches('[data-testid]'),
    });
  });

  it('fails for another element of a rule that `accept` accepts for one element', async () => {
    const { container } = await render(
      <div>
        <button type="button" data-testid="accepted" />
        <button type="button" class="other" />
      </div>,
    );

    await expect(
      expectNoAxeViolations(container, {
        accept: (rule, element) => rule === 'button-name' && element.matches('[data-testid]'),
      }),
    ).rejects.toThrow(
      /^axe found 1 violation\(s\):\n\nbutton-name: [^\n]+\n<button type="button" class="other"><\/button>$/,
    );
  });
});
