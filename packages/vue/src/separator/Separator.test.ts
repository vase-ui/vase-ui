import axe from 'axe-core';
import { describe, expect, test, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import type { SeparatorProps } from '@vase-ui/vue/separator';
import SeparatorParts from '../../test/fixtures/SeparatorParts.vue';
import Separators from '../../test/fixtures/Separators.vue';
import { mount } from '../../test/render';
import { screen } from '../../test/queries';

// @ts-expect-error `orientation` is 'horizontal' or 'vertical'.
export const wrongOrientation: SeparatorProps = { orientation: 'diagonal' };

async function mountSeparators(separators: Record<string, unknown>[]) {
  const { root, exposed } = mount(Separators, { separators });
  await nextTick();
  return { root, exposed, elements: [...root.children] };
}

describe('<Separator />', () => {
  test('renders a div with the `separator` role', async () => {
    const { elements } = await mountSeparators([{}]);
    expect(elements).toHaveLength(1);
    expect(elements[0]!.tagName).toBe('DIV');
    expect(screen.getByRole('separator')).toBe(elements[0]);
  });

  describe('prop: orientation', () => {
    test.each([{ orientation: 'horizontal' }, { orientation: 'vertical' }] as const)(
      'sets aria-orientation="$orientation"',
      async ({ orientation }) => {
        const attrs = reactive<Record<string, unknown>>({ orientation });
        const { elements } = await mountSeparators([attrs, {}]);
        expect(elements[0]).toHaveAttribute('aria-orientation', orientation);
        expect(elements[1]).toHaveAttribute('aria-orientation', 'horizontal');
        const other = orientation === 'vertical' ? 'horizontal' : 'vertical';
        attrs.orientation = other;
        await nextTick();
        expect(elements[0]).toHaveAttribute('aria-orientation', other);
      },
    );
  });

  test('the element has the role, the orientation and the attributes of the developer, whose values win; a template ref gives it', async () => {
    const onClick = vi.fn();
    const { exposed, elements } = await mountSeparators([
      {
        'aria-label': 'Sections',
        lang: 'fr',
        class: 'Line',
        style: { color: 'rgb(255, 0, 0)' },
        'data-index': '1',
        onClick,
      },
      { role: 'presentation', 'aria-orientation': 'vertical' },
    ]);
    const [element, other] = elements;
    expect(element!.getAttributeNames().sort()).toEqual([
      'aria-label',
      'aria-orientation',
      'class',
      'data-index',
      'lang',
      'role',
      'style',
    ]);
    expect(element).toHaveClass('Line');
    expect(element).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    (element as HTMLElement).click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(other).toHaveAttribute('role', 'presentation');
    expect(other).toHaveAttribute('aria-orientation', 'vertical');
    const parts = exposed.parts as { element: Element | null }[];
    expect(new Set(parts.map((part) => part.element))).toEqual(new Set(elements));
  });

  test('the default slot is the content and gets the state', async () => {
    const { exposed } = mount(SeparatorParts);
    await nextTick();
    expect(exposed.withContent.element).toHaveTextContent('vertical');
  });

  test('the element slot renders the element of the developer with the role, the orientation and the state; a template ref gives that element', async () => {
    const { root, exposed } = mount(SeparatorParts);
    await nextTick();
    const span = root.querySelector('span')!;
    expect(span).toHaveAttribute('role', 'separator');
    expect(span).toHaveAttribute('aria-orientation', 'vertical');
    expect(span).toHaveAttribute('aria-label', 'Span');
    expect(span).toHaveAttribute('data-state', 'vertical');
    expect(exposed.span.element).toBe(span);
    const styled = root.querySelector('.StyledDiv')!;
    expect(styled).toHaveAttribute('role', 'separator');
    expect(styled).toHaveAttribute('aria-orientation', 'horizontal');
    expect(exposed.styled.element).toBe(styled);
  });

  test('the element is the root: Transition puts its classes on it, and a scoped style matches it', async () => {
    const scene = reactive({ shown: false });
    const { root } = mount(SeparatorParts, { scene });
    await nextTick();
    scene.shown = true;
    await nextTick();
    const shown = root.querySelector('[aria-label=Shown]')!;
    expect(shown).toHaveClass('v-enter-from', 'v-enter-active');
    expect(getComputedStyle(shown).color).toBe('rgb(0, 128, 0)');
  });

  test.each(['horizontal', 'vertical'])(
    'has no accessibility violation (orientation: %s)',
    async (orientation) => {
      const { root } = await mountSeparators([{ orientation }]);
      const results = await axe.run(root);
      expect(results.violations).toEqual([]);
    },
  );
});
