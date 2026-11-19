import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import SeparatorParts from '../../test/fixtures/SeparatorParts.vue';
import { hydrate, renderOnServer } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML has the role, the orientation and the content, also in the element slot; the hydration keeps the elements', async () => {
    const root = await renderOnServer('SeparatorParts');
    const [withContent, span] = root.querySelectorAll('[aria-orientation=vertical]');
    expect(withContent!.tagName).toBe('DIV');
    expect(withContent).toHaveAttribute('role', 'separator');
    expect(withContent).not.toHaveAttribute('data-orientation');
    expect(withContent).toHaveTextContent('vertical');
    expect(span!.tagName).toBe('SPAN');
    expect(span).toHaveAttribute('role', 'separator');
    const exposed = hydrate(SeparatorParts, {}, root);
    await nextTick();
    expect(exposed.withContent.element).toBe(withContent);
    expect(exposed.span.element).toBe(span);
  });
});
