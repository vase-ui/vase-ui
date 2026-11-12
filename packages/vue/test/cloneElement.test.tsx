import { expect, describe, it } from 'vitest';
import { defineComponent } from 'vue';
import { cloneElement, createRenderer, screen } from '#test-utils';

describe('cloneElement', () => {
  const { render } = createRenderer();

  const Part = defineComponent({
    inheritAttrs: false,
    setup:
      (_props, { attrs, slots }) =>
      () => (
        <div data-testid="part" {...attrs}>
          {slots.default?.()}
          {slots.extra?.()}
        </div>
      ),
  });

  it('replaces a prop of the same key and does not merge it', async () => {
    await render(cloneElement(<Part class="first" data-first="a" />, { class: 'second' }));

    expect(screen.getByTestId('part')).toHaveAttribute('class', 'second');
    expect(screen.getByTestId('part')).toHaveAttribute('data-first', 'a');
  });

  it('keeps the slots of the element and adds the new slots', async () => {
    await render(cloneElement(<Part>content</Part>, {}, { extra: () => 'extra' }));

    expect(screen.getByTestId('part')).toHaveTextContent('contentextra');
  });
});
