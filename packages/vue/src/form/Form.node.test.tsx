import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Form } from '@vase-ui/vue/form';
import FormHydration from './FormHydration.test.vue';

// The attribute order in the HTML is not part of the test.
function readTag(html: string, testId: string) {
  return html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0];
}

describe('<Form /> on a server', () => {
  it('renders a form with novalidate and its content with no DOM', async () => {
    expect(typeof document).toBe('undefined');

    const html = await renderToString(
      <Form>
        <input name="email" />
      </Form>,
    );

    expect(html).toBe('<form novalidate><!--[--><input name="email"><!--]--></form>');
  });

  it('renders no novalidate attribute when novalidate is false', async () => {
    const html = await renderToString(<Form novalidate={false} />);

    expect(html).toBe('<form><!--[--><!--]--></form>');
  });

  it('renders the invalid state of a field that has the name on its root when errors names it', async () => {
    const html = await renderToString(<FormHydration errors={{ second: 'Second error' }} />);

    expect(readTag(html, 'form')).toContain(' novalidate');
    expect(readTag(html, 'second-field')).toContain(' data-invalid');
    expect(readTag(html, 'first-field')).not.toContain(' data-invalid');
  });
});
