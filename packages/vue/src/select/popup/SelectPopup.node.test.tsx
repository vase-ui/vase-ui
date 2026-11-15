import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Select } from '@vase-ui/vue/select';

// Vue writes a comment around each fragment and slot.
function withoutComments(html: string) {
  return html.replace(/<!--.*?-->/g, '');
}

describe('<Select.Popup /> on a server', () => {
  it('renders the style element in the positioner, before the popup', async () => {
    const html = await renderToString(
      <Select.Root defaultOpen>
        <Select.Trigger />
        <Select.Positioner data-testid="positioner">
          <Select.Popup data-testid="popup" />
        </Select.Positioner>
      </Select.Root>,
    );

    expect(withoutComments(html)).toMatch(
      /data-testid="positioner"[^>]*><style[^>]*>[^<]*<\/style><div[^>]*data-testid="popup"/,
    );
  });

  it('renders the style element before the element of a #render slot of the positioner', async () => {
    const html = await renderToString(
      <Select.Root defaultOpen>
        <Select.Trigger />
        <Select.Positioner
          v-slots={{
            render: ({ props }: { props: Record<string, unknown> }) => (
              <div {...props} data-testid="positioner">
                <Select.Popup data-testid="popup" />
              </div>
            ),
          }}
        />
      </Select.Root>,
    );

    expect(withoutComments(html)).toMatch(
      /<style[^>]*>[^<]*<\/style><div[^>]*data-testid="positioner"/,
    );
  });
});
