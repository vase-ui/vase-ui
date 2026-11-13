import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import FocusGuard from './FocusGuard.vue';

// Each flag is `true`. A guard that read the flags while it renders would get the role.
vi.mock('../../../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../../../common/platform')>(
    '../../../common/platform',
  );
  return {
    platform: {
      ...actual.platform,
      screenReader: { ...actual.platform.screenReader, voiceOver: true },
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

describe('FocusGuard on a server', () => {
  it('renders the hidden form, also where VoiceOver and WebKit are on', async () => {
    const html = await renderToString(<FocusGuard data-type="inside" />);

    expect(html).toBe(
      '<span tabindex="0" aria-hidden="true" style="clip-path:inset(50%);overflow:hidden;white-space:nowrap;border:0;padding:0;width:1px;height:1px;margin:0;position:fixed;top:-1px;left:0;" data-vase-ui-focus-guard data-type="inside"></span>',
    );
  });
});
