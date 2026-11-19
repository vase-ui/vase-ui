import { onMounted, shallowRef, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { REASONS } from '../../internals/reasons';
import type {
  ResizableRootCommitEventDetails,
  ResizableRootLayout,
  ResizableRootLayoutSnapshot,
} from '../root/ResizableRoot.vue';
import { isSize } from './layout';

/**
 * A storage that holds the layout, such as `localStorage` or `sessionStorage`.
 */
export type ResizableLayoutStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface ResizableLayoutStorageOptions {
  /**
   * The key of the item that holds the layout in the storage.
   * When the key changes, `layout` gets the item of the new key.
   */
  key: MaybeRefOrGetter<string>;
  /**
   * The storage that holds the layout.
   * The composable reads it only after the mount, so a getter can name `sessionStorage`.
   * When the storage changes, `layout` gets the item of the new storage.
   * @default localStorage
   */
  storage?: MaybeRefOrGetter<ResizableLayoutStorage | undefined>;
  /**
   * Whether `save` ignores a commit of a method of a panel or of the root: a commit with the
   * reason `'imperative-action'`.
   * @default false
   */
  userChangesOnly?: MaybeRefOrGetter<boolean | undefined>;
}

export interface ResizableLayoutStorageReturnValue {
  /**
   * The stored layout. Give it to `v-model:layout` of the root.
   * It is empty until the mount, so the server HTML and the first render of a client have the
   * default layout of the root. It is empty also when the storage has no valid item for the key.
   */
  layout: Ref<ResizableRootLayoutSnapshot>;
  /**
   * Writes the layout to the storage, under the key. Give it to `@layout-committed` of the root.
   * It writes the `snapshot` of the details when it gets them, so each fixed panel keeps its
   * pixels.
   */
  save: (layout: ResizableRootLayout, details?: ResizableRootCommitEventDetails) => void;
}

function isLayoutSnapshot(value: unknown): value is ResizableRootLayoutSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(isSize)
  );
}

/**
 * Keeps the layout of a `Resizable.Root` in a storage, so that the user gets the layout again at
 * the next visit. It reads the storage after the mount, and it ignores an item that is not a
 * layout and a storage that throws. Call it in `setup`.
 */
export function useLayoutStorage(
  options: ResizableLayoutStorageOptions,
): ResizableLayoutStorageReturnValue {
  const layout = shallowRef<ResizableRootLayoutSnapshot>({});

  // A browser that blocks the storage of the site throws when the page reads `localStorage`, and
  // `getItem` and `setItem` can throw too. Node.js prints a warning when a server reads
  // `localStorage`, so the read waits for the mount.
  function getStorage() {
    try {
      return toValue(options.storage) ?? localStorage;
    } catch {
      return undefined;
    }
  }

  function save(next: ResizableRootLayout, details?: ResizableRootCommitEventDetails) {
    if (toValue(options.userChangesOnly) && details?.reason === REASONS.imperativeAction) {
      return;
    }
    try {
      getStorage()?.setItem(toValue(options.key), JSON.stringify(details?.snapshot ?? next));
    } catch {
      // The layout stays as it is on the page. The next commit tries again.
    }
  }

  onMounted(() => {
    watch(
      [() => toValue(options.key), getStorage],
      ([key, storage]) => {
        try {
          const text = storage?.getItem(key);
          const stored: unknown = text == null ? undefined : JSON.parse(text);
          layout.value = isLayoutSnapshot(stored) ? stored : {};
        } catch {
          layout.value = {};
        }
      },
      { immediate: true },
    );
  });

  return { layout, save };
}
