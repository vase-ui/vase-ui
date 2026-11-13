import { expect, vi, describe, beforeEach, afterEach, it, onTestFinished } from 'vitest';
import { createSSRApp, defineComponent, nextTick, shallowRef } from 'vue';
import { Avatar } from '@vase-ui/vue/avatar';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import AvatarImageHydration from './AvatarImageHydration.test.vue';

type MockImage = {
  complete: boolean;
  naturalWidth: number;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  referrerPolicy: string;
  crossOrigin: string | null;
  sizes: string;
  src: string;
  srcset: string;
};

// 1x1 transparent PNG
const TRANSPARENT_IMAGE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * When `completeOnSet` is true, simulates cached-image behavior: setting a
 * source immediately marks the image as complete before an async load event.
 */
function mockImageLoading({ completeOnSet = false, naturalWidth = 100 } = {}) {
  const OriginalImage = window.Image;
  const images: MockImage[] = [];

  window.Image = function MockImage() {
    let srcValue = '';
    let srcSetValue = '';
    const obj: MockImage = {
      complete: false,
      naturalWidth: 0,
      onload: null,
      onerror: null,
      referrerPolicy: '',
      crossOrigin: null,
      sizes: '',
      get src() {
        return srcValue;
      },
      set src(value: string) {
        srcValue = value;
        if (completeOnSet) {
          obj.complete = true;
          obj.naturalWidth = naturalWidth;
        }
      },
      get srcset() {
        return srcSetValue;
      },
      set srcset(value: string) {
        srcSetValue = value;
        if (completeOnSet) {
          obj.complete = true;
          obj.naturalWidth = naturalWidth;
        }
      },
    };
    images.push(obj);
    return obj;
  } as unknown as typeof window.Image;

  return {
    images,
    restore() {
      window.Image = OriginalImage;
    },
  };
}

// A browser loads the source of a rendered `<img>`, and its own `load` or `error` event then
// changes the status. The cases that call this function fire the events themselves, so only an
// event that the test fires may reach the element. An event that the test fires is not trusted.
function holdBrowserImageEvents() {
  const holdEvent = (event: Event) => {
    if (event.isTrusted) {
      event.stopPropagation();
    }
  };
  document.addEventListener('load', holdEvent, true);
  document.addEventListener('error', holdEvent, true);
  onTestFinished(() => {
    document.removeEventListener('load', holdEvent, true);
    document.removeEventListener('error', holdEvent, true);
  });
}

describe('<Avatar.Image />', () => {
  const { render } = createRenderer();

  let restoreImage: () => void;

  function installImageMock(options?: Parameters<typeof mockImageLoading>[0]) {
    restoreImage();
    const imageMock = mockImageLoading(options);
    restoreImage = imageMock.restore;
    return imageMock;
  }

  beforeEach(() => {
    restoreImage = mockImageLoading({ completeOnSet: true }).restore;
  });

  afterEach(() => {
    restoreImage();
  });

  describeConformance(<Avatar.Image src="test.png" />, () => ({
    render: (node) => {
      return render(<Avatar.Root>{node}</Avatar.Root>);
    },
    refInstanceof: window.HTMLImageElement,
  }));

  it('passes native image props to the rendered image', async () => {
    await render(
      <Avatar.Root>
        <Avatar.Image
          crossorigin="anonymous"
          data-testid="image"
          referrerpolicy="no-referrer"
          sizes="48px"
          src="avatar.png"
          srcset="avatar.png 1x, avatar@2x.png 2x"
        />
      </Avatar.Root>,
    );

    const image = screen.getByTestId('image');
    expect(image).toHaveAttribute('crossorigin', 'anonymous');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(image).toHaveAttribute('sizes', '48px');
    expect(image).toHaveAttribute('srcset', 'avatar.png 1x, avatar@2x.png 2x');
  });

  it('shows the image when only srcSet is provided', async () => {
    await render(
      <Avatar.Root>
        <Avatar.Image data-testid="image" sizes="48px" srcset="avatar.png 1x" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>,
    );

    expect(screen.getByTestId('image')).toHaveAttribute('srcset', 'avatar.png 1x');
    expect(screen.queryByText('JD')).toBe(null);
  });

  it('passes responsive image props to the loading probe', async () => {
    const imageMock = installImageMock();

    await render(
      <Avatar.Root>
        <Avatar.Image sizes="48px" src="fallback.png" srcset="avatar.png 1x, avatar@2x.png 2x" />
      </Avatar.Root>,
    );

    expect(imageMock.images[0].sizes).toBe('48px');
    expect(imageMock.images[0].srcset).toBe('avatar.png 1x, avatar@2x.png 2x');
    expect(imageMock.images[0].src).toBe('fallback.png');
  });

  describe('prop: onLoadingStatusChange', () => {
    it('fires when the image loads', async () => {
      const imageMock = installImageMock();
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image src="avatar.png" onLoadingStatusChange={onLoadingStatusChange} />
        </Avatar.Root>,
      );

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('loading');
      });

      imageMock.images.at(-1)?.onload?.();
      await flushMicrotasks();

      await waitFor(() => {
        expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
          'loading',
          'loaded',
        ]);
      });
    });

    it('fires when the image errors', async () => {
      const imageMock = installImageMock();
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image src="avatar.png" onLoadingStatusChange={onLoadingStatusChange} />
        </Avatar.Root>,
      );

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('loading');
      });

      imageMock.images.at(-1)?.onerror?.();
      await flushMicrotasks();

      await waitFor(() => {
        expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
          'loading',
          'error',
        ]);
      });
    });

    it('fires for cached image errors without emitting idle', async () => {
      installImageMock({ completeOnSet: true, naturalWidth: 0 });
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image src="avatar.png" onLoadingStatusChange={onLoadingStatusChange} />
        </Avatar.Root>,
      );

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('error');
      });

      expect(onLoadingStatusChange).not.toHaveBeenCalledWith('idle');
    });
  });

  describe('prop: keepMounted', () => {
    it('mounts the image while loading without preloading it', async () => {
      holdBrowserImageEvents();
      const imageMock = installImageMock();

      await render(
        <Avatar.Root>
          <Avatar.Image data-testid="image" keepMounted src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      expect(screen.getByTestId('image')).toHaveAttribute('src', 'avatar.png');
      expect(screen.getByText('JD')).not.toBe(null);
      expect(imageMock.images.length).toBe(0);
    });

    it('derives the status from the rendered element load event', async () => {
      holdBrowserImageEvents();
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            keepMounted
            src="avatar.png"
            onLoadingStatusChange={onLoadingStatusChange}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      await fireEvent.load(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
        'loading',
        'loaded',
      ]);
    });

    it('keeps the image mounted when it fails to load', async () => {
      holdBrowserImageEvents();
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            keepMounted
            src="avatar.png"
            onLoadingStatusChange={onLoadingStatusChange}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      await fireEvent.error(screen.getByTestId('image'));

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('error');
      });
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
        'loading',
        'error',
      ]);
      expect(screen.getByTestId('image')).not.toBe(null);
      expect(screen.getByText('JD')).not.toBe(null);
    });

    it('calls the user onError handler', async () => {
      holdBrowserImageEvents();
      const onError = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image data-testid="image" keepMounted src="avatar.png" onError={onError} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      await fireEvent.error(screen.getByTestId('image'));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByText('JD')).not.toBe(null);
    });

    it('calls the user onLoad handler', async () => {
      holdBrowserImageEvents();
      const onLoad = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image data-testid="image" keepMounted src="avatar.png" onLoad={onLoad} />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      await fireEvent.load(screen.getByTestId('image'));

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
    });

    it('lets a user handler prevent the status update', async () => {
      holdBrowserImageEvents();
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            keepMounted
            onLoad={(event) => event.preventVaseUIHandler()}
            onLoadingStatusChange={onLoadingStatusChange}
            src="avatar.png"
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      await fireEvent.load(screen.getByTestId('image'));

      expect(screen.getByTestId('image')).toHaveAttribute('data-loading');
      expect(screen.getByText('JD')).not.toBe(null);
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual(['loading']);
    });

    it('resets the status when a rendered image changes source', async () => {
      holdBrowserImageEvents();
      const onLoadingStatusChange = vi.fn();

      function Test({ src }: { src: string }) {
        return (
          <Avatar.Root>
            <Avatar.Image
              keepMounted
              onLoadingStatusChange={onLoadingStatusChange}
              v-slots={{
                render: ({ props }: { props: HTMLProps }) => (
                  <img {...props} alt="" data-testid="image" src={src} />
                ),
              }}
            />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar.Root>
        );
      }

      const { rerender } = await render(<Test src="avatar-1.png" />);

      await fireEvent.load(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      onLoadingStatusChange.mockClear();

      await rerender(<Test src="avatar-2.png" />);

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('loading');
      });
      expect(screen.getByText('JD')).not.toBe(null);

      // The reset status must be able to resolve again from the new load.
      await fireEvent.load(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
        'loading',
        'loaded',
      ]);
    });

    it('resets the status when the src prop changes', async () => {
      holdBrowserImageEvents();
      const onLoadingStatusChange = vi.fn();

      function Test({ src }: { src: string }) {
        return (
          <Avatar.Root>
            <Avatar.Image
              data-testid="image"
              keepMounted
              src={src}
              onLoadingStatusChange={onLoadingStatusChange}
            />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar.Root>
        );
      }

      const { rerender } = await render(<Test src="avatar-1.png" />);

      await fireEvent.load(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      onLoadingStatusChange.mockClear();

      await rerender(<Test src="avatar-2.png" />);

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('loading');
      });
      expect(screen.getByText('JD')).not.toBe(null);
    });

    it.skipIf(isJSDOM)(
      'renders the image in the server HTML and resolves cached images on hydration',
      async () => {
        // Restore real Image so this test exercises actual browser caching
        restoreImage();
        restoreImage = () => {};

        // Pre-load so the browser cache has the decoded image
        await new Promise<void>((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to preload test image'));
          img.src = TRANSPARENT_IMAGE_DATA_URI;
        });

        const props = { src: TRANSPARENT_IMAGE_DATA_URI, alt: 'Jane Doe', keepMounted: true };
        const serverHtml = await renderOnServer(
          'src/avatar/image/AvatarImageHydration.test.vue',
          props,
        );
        const container = document.createElement('div');
        document.body.append(container);
        container.innerHTML = serverHtml;

        // Unlike the default mode, the image is part of the server HTML, so the
        // browser loads it before hydration. Until hydration resolves the status,
        // the fallback owns the accessible name and the image is aria-hidden.
        expect(screen.getByTestId('image')).toHaveAttribute('src', TRANSPARENT_IMAGE_DATA_URI);
        expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.queryByRole('img')).toBe(null);
        expect(screen.getByText('JD')).toBeVisible();
        await waitFor(() => {
          expect((screen.getByTestId('image') as HTMLImageElement).complete).toBe(true);
        });

        const app = createSSRApp(AvatarImageHydration, props);
        onTestFinished(() => {
          app.unmount();
          container.remove();
        });
        app.mount(container);
        await nextTick();

        // The hydration reads `image.complete` and resolves the
        // status before paint, so the fallback is removed without a flash.
        expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveAttribute(
          'src',
          TRANSPARENT_IMAGE_DATA_URI,
        );
        expect(screen.getByTestId('image')).not.toHaveAttribute('aria-hidden');
        expect(screen.queryByText('JD')).toBe(null);
        expect(takeReportedMessages()).toEqual([]);
      },
    );

    it.skipIf(isJSDOM)('loads the image without a detached preload', async () => {
      // Fail the test if the detached preload is used
      restoreImage();
      const OriginalImage = window.Image;
      const constructed: unknown[] = [];
      class TrackedImage extends OriginalImage {
        constructor(...args: []) {
          super(...args);
          constructed.push(this);
        }
      }
      window.Image = TrackedImage as typeof window.Image;
      restoreImage = () => {
        window.Image = OriginalImage;
      };

      await render(
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            keepMounted
            src={TRANSPARENT_IMAGE_DATA_URI}
            alt="Jane Doe"
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      expect(screen.getByTestId('image')).toHaveAttribute('src', TRANSPARENT_IMAGE_DATA_URI);
      expect(constructed.length).toBe(0);
    });

    it.skipIf(isJSDOM)('reports an error when there is no source', async () => {
      restoreImage();
      restoreImage = () => {};
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image
            data-testid="image"
            keepMounted
            onLoadingStatusChange={onLoadingStatusChange}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      // A source-less image is `complete` with `naturalWidth === 0`, which the
      // read of the rendered image resolves to `error` without waiting for an event.
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual(['error']);
      expect(screen.getByText('JD')).not.toBe(null);
    });

    it.skipIf(isJSDOM)('preserves loaded status when the render element changes', async () => {
      restoreImage();
      restoreImage = () => {};
      const onLoadingStatusChange = vi.fn();

      function Test({ className }: { className: string }) {
        return (
          <Avatar.Root>
            <Avatar.Image
              keepMounted
              onLoadingStatusChange={onLoadingStatusChange}
              v-slots={{
                render: ({ props }: { props: HTMLProps }) => (
                  <img
                    {...props}
                    alt=""
                    class={className}
                    data-testid="image"
                    src={TRANSPARENT_IMAGE_DATA_URI}
                  />
                ),
              }}
            />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar.Root>
        );
      }

      const { rerender } = await render(<Test className="initial" />);

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      onLoadingStatusChange.mockClear();

      await rerender(<Test className="updated" />);

      expect(screen.getByTestId('image')).toHaveClass('updated');
      expect(onLoadingStatusChange).not.toHaveBeenCalled();
    });

    it('hides the image from assistive technology until it loads', async () => {
      holdBrowserImageEvents();

      await render(
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" keepMounted src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      // Only the fallback names the avatar while both are in the DOM.
      expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('img')).toBe(null);

      await fireEvent.load(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.getByTestId('image')).not.toHaveAttribute('aria-hidden');
      });
      expect(screen.getByRole('img', { name: 'Jane Doe' })).not.toBe(null);
    });

    it('keeps the image hidden from assistive technology after an error', async () => {
      holdBrowserImageEvents();

      await render(
        <Avatar.Root>
          <Avatar.Image alt="Jane Doe" data-testid="image" keepMounted src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      await fireEvent.error(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.getByTestId('image')).toHaveAttribute('data-error');
      });
      expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByText('JD')).not.toBe(null);
    });

    it('hides the image from assistive technology again when the source changes', async () => {
      holdBrowserImageEvents();

      function Test({ src }: { src: string }) {
        return (
          <Avatar.Root>
            <Avatar.Image alt="Jane Doe" data-testid="image" keepMounted src={src} />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar.Root>
        );
      }

      const { rerender } = await render(<Test src="avatar-1.png" />);

      await fireEvent.load(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.getByTestId('image')).not.toHaveAttribute('aria-hidden');
      });

      await rerender(<Test src="avatar-2.png" />);

      await waitFor(() => {
        expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('preserves an explicitly provided aria-hidden value', async () => {
      holdBrowserImageEvents();

      await render(
        <Avatar.Root>
          <Avatar.Image
            alt="Jane Doe"
            aria-hidden={false}
            data-testid="image"
            keepMounted
            src="avatar.png"
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'false');

      await fireEvent.load(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      expect(screen.getByTestId('image')).toHaveAttribute('aria-hidden', 'false');
    });

    it('marks the not-loaded states with data attributes', async () => {
      holdBrowserImageEvents();

      await render(
        <Avatar.Root>
          <Avatar.Image data-testid="image" keepMounted src="avatar.png" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      expect(screen.getByTestId('image')).toHaveAttribute('data-loading');

      await fireEvent.load(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.getByTestId('image')).not.toHaveAttribute('data-loading');
      });
      expect(screen.getByTestId('image')).not.toHaveAttribute('data-error');

      await fireEvent.error(screen.getByTestId('image'));

      await waitFor(() => {
        expect(screen.getByTestId('image')).toHaveAttribute('data-error');
      });
    });

    it('does not override source props in a render callback', async () => {
      holdBrowserImageEvents();

      await render(
        <Avatar.Root>
          <Avatar.Image
            keepMounted
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => (
                <img
                  alt=""
                  data-testid="image"
                  sizes="48px"
                  src="avatar.png"
                  srcset="avatar.png 1x"
                  {...props}
                />
              ),
            }}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      const image = screen.getByTestId('image');
      expect(image).toHaveAttribute('sizes', '48px');
      expect(image).toHaveAttribute('src', 'avatar.png');
      expect(image).toHaveAttribute('srcset', 'avatar.png 1x');
    });

    it('applies the source props after the ones configuring the request', async () => {
      holdBrowserImageEvents();
      let keys: string[] = [];

      await render(
        <Avatar.Root>
          <Avatar.Image
            keepMounted
            src="avatar.png"
            loading="lazy"
            sizes="48px"
            srcset="avatar.png 1x, avatar@2x.png 2x"
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => {
                keys = Object.keys(props);
                return <img alt="" {...props} />;
              },
            }}
          />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      // Safari and Firefox start fetching as soon as `src` lands. Anything configuring that
      // request has to be applied before it.
      expect(keys.indexOf('src')).toBeGreaterThan(keys.indexOf('loading'));
      expect(keys.indexOf('src')).toBeGreaterThan(keys.indexOf('sizes'));
      expect(keys.indexOf('src')).toBeGreaterThan(keys.indexOf('srcset'));
    });

    it.skipIf(isJSDOM)(
      'keeps the status reported by an element that does not forward a ref',
      async () => {
        restoreImage();
        restoreImage = () => {};
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const onLoadingStatusChange = vi.fn();

        function Test({ className }: { className: string }) {
          return (
            <Avatar.Root>
              <Avatar.Image
                keepMounted
                onLoadingStatusChange={onLoadingStatusChange}
                v-slots={{
                  // The ref is deliberately dropped: some image wrappers keep it for themselves.
                  render: ({ props: { ref: _ref, ...props } }: { props: HTMLProps }) => (
                    <img
                      {...props}
                      alt=""
                      class={className}
                      data-testid="image"
                      src={TRANSPARENT_IMAGE_DATA_URI}
                    />
                  ),
                }}
              />
              <Avatar.Fallback>JD</Avatar.Fallback>
            </Avatar.Root>
          );
        }

        const { rerender } = await render(<Test className="initial" />);

        await waitFor(() => {
          expect(screen.queryByText('JD')).toBe(null);
        });

        // Without an element to read, the read must not overwrite the status the `load` event
        // already reported, or the fallback reappears over a loaded image.
        await rerender(<Test className="updated" />);

        expect(screen.queryByText('JD')).toBe(null);
        // No element to read means no `loading` is reported, but nothing overwrites `loaded`.
        expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual(['loaded']);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('The `#render` slot gave no element');
      },
    );

    it.skipIf(isJSDOM)('resets the status when the source changes to an unloaded one', async () => {
      restoreImage();
      restoreImage = () => {};
      const onLoadingStatusChange = vi.fn();

      function Test({ src }: { src: string }) {
        return (
          <Avatar.Root>
            <Avatar.Image
              data-testid="image"
              keepMounted
              src={src}
              onLoadingStatusChange={onLoadingStatusChange}
            />
            <Avatar.Fallback>JD</Avatar.Fallback>
          </Avatar.Root>
        );
      }

      const { rerender } = await render(<Test src={TRANSPARENT_IMAGE_DATA_URI} />);

      // A cached image fires its `load` event in a later task. Firefox does not cancel that event
      // when the source changes, so the new image would get it. Wait for the event first.
      const firstLoad = new Promise<void>((resolve) => {
        screen.getByTestId('image').addEventListener('load', () => resolve(), { once: true });
      });

      await waitFor(() => {
        expect(screen.queryByText('JD')).toBe(null);
      });
      await firstLoad;

      // The browser reports `complete === false` synchronously after the source changes, which
      // is what the reset relies on.
      await rerender(<Test src="/missing-avatar.png" />);

      expect(screen.getByTestId('image')).toHaveAttribute('data-loading');

      await waitFor(() => {
        expect(screen.getByTestId('image')).toHaveAttribute('data-error');
      });
      // The cached first source resolves in the first read, so it never reports
      // `loading`; the swap to an unloaded source does.
      expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
        'loaded',
        'loading',
        'error',
      ]);
    });
  });

  describe.skipIf(isJSDOM)('animations', () => {
    afterEach(() => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      let transitionFinished = false;
      // The image does not exist when a ref callback of the part runs, so the spy is on the
      // prototype.
      const getAnimations = vi.spyOn(Element.prototype, 'getAnimations').mockReturnValue([]);
      onTestFinished(() => {
        getAnimations.mockRestore();
      });

      function notifyTransitionFinished() {
        transitionFinished = true;
      }

      const style = `
        .animation-test-image {
          transition: opacity 1ms;
        }

        .animation-test-image[data-starting-style],
        .animation-test-image[data-ending-style] {
          opacity: 0;
        }
      `;

      const Test = defineComponent(() => {
        const showImage = shallowRef(false);

        return () => (
          <div>
            <style>{style}</style>
            <button
              type="button"
              onClick={() => {
                showImage.value = true;
              }}
            >
              Show image
            </button>
            <Avatar.Root>
              <Avatar.Image
                class="animation-test-image"
                data-testid="image"
                onTransitionend={notifyTransitionFinished}
                src={showImage.value ? 'avatar.png' : undefined}
              />
            </Avatar.Root>
          </div>
        );
      });

      const { user } = await render(<Test />);
      expect(screen.queryByTestId('image')).toBe(null);

      await user.click(screen.getByText('Show image'));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('image')).not.toBe(null);
      expect(getAnimations).not.toHaveBeenCalled();
    });

    it('applies data-ending-style before unmount', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-image[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      const Test = defineComponent(() => {
        const showImage = shallowRef(true);

        return () => (
          <div>
            <style>{style}</style>
            <button
              type="button"
              onClick={() => {
                showImage.value = false;
              }}
            >
              Hide image
            </button>
            <Avatar.Root>
              <Avatar.Image
                class="animation-test-image"
                data-testid="image"
                src={showImage.value ? 'avatar.png' : undefined}
              />
            </Avatar.Root>
          </div>
        );
      });

      await render(<Test />);
      expect(screen.getByTestId('image')).not.toBe(null);

      // `user.click` can yield a frame, which is long enough for the 1ms animation to finish.
      await fireEvent.click(screen.getByText('Hide image'));

      expect(screen.getByTestId('image')).toHaveAttribute('data-ending-style');

      await waitFor(() => {
        expect(screen.queryByTestId('image')).toBe(null);
      });
    });

    it('does not apply the not-loaded state attributes without keepMounted', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-image[data-ending-style] {
          animation: test-anim 200ms;
        }
      `;

      const Test = defineComponent(() => {
        const showImage = shallowRef(true);

        return () => (
          <div>
            <style>{style}</style>
            <button
              type="button"
              onClick={() => {
                showImage.value = false;
              }}
            >
              Hide image
            </button>
            <Avatar.Root>
              <Avatar.Image
                class="animation-test-image"
                data-testid="image"
                src={showImage.value ? 'avatar.png' : undefined}
              />
            </Avatar.Root>
          </div>
        );
      });

      const { user } = await render(<Test />);

      await user.click(screen.getByText('Hide image'));

      await waitFor(() => {
        expect(screen.getByTestId('image')).toHaveAttribute('data-ending-style');
      });

      // The status attributes belong to `keepMounted`. In the default mode the element only
      // exists once the image loaded, so it must not pick them up while it animates out.
      expect(screen.getByTestId('image')).not.toHaveAttribute('data-error');
      expect(screen.getByTestId('image')).not.toHaveAttribute('data-loading');
    });

    it('does not apply data-ending-style with keepMounted', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      restoreImage();
      restoreImage = () => {};

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-image[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      function Test({ src }: { src: string }) {
        return (
          <div>
            <style>{style}</style>
            <Avatar.Root>
              <Avatar.Image
                class="animation-test-image"
                data-testid="image"
                keepMounted
                src={src}
              />
            </Avatar.Root>
          </div>
        );
      }

      const { rerender } = await render(<Test src={TRANSPARENT_IMAGE_DATA_URI} />);

      await waitFor(() => {
        expect(screen.getByTestId('image')).not.toHaveAttribute('data-loading');
      });

      // The element never unmounts, so an exit animation would run and then reverse itself.
      // `data-loading` carries the state instead.
      await rerender(<Test src="/missing-avatar.png" />);

      expect(screen.getByTestId('image')).not.toHaveAttribute('data-ending-style');
      expect(screen.getByTestId('image')).toHaveAttribute('data-loading');
    });

    it('does not replay the enter animation for a cached image on hydration', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      restoreImage();
      restoreImage = () => {};

      await new Promise<void>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to preload test image'));
        img.src = TRANSPARENT_IMAGE_DATA_URI;
      });

      const props = { src: TRANSPARENT_IMAGE_DATA_URI, alt: '', keepMounted: true };
      const serverHtml = await renderOnServer(
        'src/avatar/image/AvatarImageHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;

      await waitFor(() => {
        expect((screen.getByTestId('image') as HTMLImageElement).complete).toBe(true);
      });

      const app = createSSRApp(AvatarImageHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await nextTick();

      // The browser painted the image before hydration, so animating it in would flash.
      expect(screen.getByTestId('image')).not.toHaveAttribute('data-starting-style');
      expect(takeReportedMessages()).toEqual([]);
    });
  });

  describe.skipIf(isJSDOM)('cached images', () => {
    // 1x1 transparent PNG
    const DATA_URI =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('does not flash fallback for a cached image during SSR hydration', async () => {
      // Restore real Image so this test exercises actual browser caching
      restoreImage();

      // Pre-load so the browser cache has the decoded image
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to preload test image'));
        img.src = DATA_URI;
      });

      // Server render: `onMounted` does not run, so the fallback is in the HTML
      const props = { src: DATA_URI, alt: 'Jane Doe' };
      const serverHtml = await renderOnServer(
        'src/avatar/image/AvatarImageHydration.test.vue',
        props,
      );
      const container = document.createElement('div');
      document.body.append(container);
      container.innerHTML = serverHtml;

      expect(screen.getByText('JD')).toBeVisible();
      expect(screen.queryByRole('img')).toBe(null);

      // After hydration, `onMounted` runs before the paint. For cached images, image.complete
      // is true so status resolves to 'loaded' immediately — no fallback flash.
      //
      // Assert after one tick (no waitFor) to verify the image is available on
      // the first post-hydration render, not after a delayed onload callback.
      const app = createSSRApp(AvatarImageHydration, props);
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);
      await nextTick();

      expect(screen.getByRole('img')).toHaveAttribute('src', DATA_URI);
      expect(screen.queryByText('JD')).toBe(null);
      expect(takeReportedMessages()).toEqual([]);
    });
  });

  it('shows the image immediately for a cached src', async () => {
    await render(
      <Avatar.Root>
        <Avatar.Image src="https://example.com/cached-avatar.png" alt="Jane Doe" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>,
    );

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/cached-avatar.png');
    expect(screen.queryByText('JD')).toBe(null);
  });

  it('does not apply data-ending-style or report a status when a loaded image changes to a cached source', async () => {
    const onLoadingStatusChange = vi.fn();

    function Test({ src }: { src: string }) {
      return (
        <Avatar.Root>
          <Avatar.Image
            alt=""
            data-testid="image"
            src={src}
            onLoadingStatusChange={onLoadingStatusChange}
          />
        </Avatar.Root>
      );
    }

    const { rerender } = await render(<Test src="avatar-1.png" />);

    expect(screen.getByTestId('image')).toHaveAttribute('src', 'avatar-1.png');
    expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual(['loaded']);
    onLoadingStatusChange.mockClear();

    await rerender(<Test src="avatar-2.png" />);

    expect(screen.getByTestId('image')).toHaveAttribute('src', 'avatar-2.png');
    expect(screen.getByTestId('image')).not.toHaveAttribute('data-ending-style');
    expect(onLoadingStatusChange).not.toHaveBeenCalled();
  });

  describe('hydration', () => {
    beforeEach(async () => {
      // The real `Image` keeps the decoded image of the data URI in the cache of the browser.
      restoreImage();
      restoreImage = () => {};
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to preload test image'));
        img.src = TRANSPARENT_IMAGE_DATA_URI;
      });
    });

    it.each([
      { name: 'an image with no source', props: {} },
      {
        name: 'a keepMounted image that is cached',
        props: { src: TRANSPARENT_IMAGE_DATA_URI, alt: 'Jane Doe', keepMounted: true },
      },
      { name: 'a fallback with a delay', props: { delay: 600 } },
    ])('hydrates $name with no warning and no DOM difference', async ({ props }) => {
      const serverHtml = await renderOnServer(
        'src/avatar/image/AvatarImageHydration.test.vue',
        props,
      );

      await hydrate(AvatarImageHydration, { serverHtml, props });
    });
  });
});
