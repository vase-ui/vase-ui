import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as Menu from '../index.parts';

describe('<Menu.SubmenuTrigger /> on a server', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders the trigger of a closed submenu', async () => {
    const html = await renderToString(
      <Menu.Root defaultOpen>
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger id="more">More</Menu.SubmenuTrigger>
        </Menu.SubmenuRoot>
      </Menu.Root>,
    );

    expect(html).toBe(
      '<!--[--><!--[--><div role="menuitem" id="more" tabindex="-1" aria-haspopup="menu" aria-expanded="false"><!--[-->More<!--]--></div><!--]--><!--]-->',
    );
  });

  it('gives no warning for a disabled element in a production build', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await renderToString(
      <Menu.Root defaultOpen>
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger
            nativeButton
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => (
                <button {...props} type="button" disabled={true}>
                  More
                </button>
              ),
            }}
          />
        </Menu.SubmenuRoot>
      </Menu.Root>,
    );

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
