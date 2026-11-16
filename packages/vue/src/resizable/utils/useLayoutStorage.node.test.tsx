import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Resizable } from '@vase-ui/vue/resizable';
import type { ResizableLayoutStorageOptions } from '@vase-ui/vue/resizable';

function createLayout(options: ResizableLayoutStorageOptions) {
  return defineComponent(() => {
    const { layout, save } = Resizable.useLayoutStorage(options);
    return () => (
      <Resizable.Root layout={layout.value} onLayoutCommitted={save}>
        <Resizable.Panel id="a" defaultSize={30} />
        <Resizable.Handle />
        <Resizable.Panel id="b" />
      </Resizable.Root>
    );
  });
}

const growsIn = (html: string) =>
  [...html.matchAll(/flex:([\d.]+) 1 0px/g)].map((match) => Number(match[1]));

describe('Resizable.useLayoutStorage on a server', () => {
  it('reads no storage on a server', async () => {
    const storage = { getItem: vi.fn(() => '{"a":80,"b":20}'), setItem: vi.fn() };

    const html = await renderToString(createSSRApp(createLayout({ key: 'layout', storage })));

    expect(storage.getItem).not.toHaveBeenCalled();
    expect(growsIn(html)).toEqual([30, 70]);
  });

  // Node.js prints a warning one time for each process when a script reads `localStorage` with no
  // `--localstorage-file`, so the case watches the read itself.
  it('reads no localStorage on a server', async () => {
    const read = vi.spyOn(globalThis, 'localStorage', 'get');
    onTestFinished(() => {
      read.mockRestore();
    });

    const html = await renderToString(createSSRApp(createLayout({ key: 'layout' })));

    expect(read).not.toHaveBeenCalled();
    expect(growsIn(html)).toEqual([30, 70]);
  });
});
