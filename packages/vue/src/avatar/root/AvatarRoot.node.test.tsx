import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Avatar } from '@vase-ui/vue/avatar';

// 1x1 transparent PNG
const DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('<Avatar.Root /> on a server', () => {
  it('renders the fallback and no image', async () => {
    const html = await renderToString(
      <Avatar.Root>
        <Avatar.Image src={DATA_URI} alt="Jane Doe" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>,
    );

    expect(html).not.toContain('<img');
    expect(html).toContain('<span><!--[-->JD<!--]--></span>');
  });

  it('renders the image of a keepMounted part, hidden from assistive technology', async () => {
    const html = await renderToString(
      <Avatar.Root>
        <Avatar.Image keepMounted src={DATA_URI} alt="Jane Doe" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>,
    );

    expect(html).toContain(`<img aria-hidden="true" alt="Jane Doe" src="${DATA_URI}">`);
    expect(html).not.toContain('data-loading');
    expect(html).toContain('<span><!--[-->JD<!--]--></span>');
  });

  it('renders no fallback while a delay is set', async () => {
    const html = await renderToString(
      <Avatar.Root>
        <Avatar.Image />
        <Avatar.Fallback delay={600}>JD</Avatar.Fallback>
      </Avatar.Root>,
    );

    expect(html).not.toContain('JD');
  });
});
