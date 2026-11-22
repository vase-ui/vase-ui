import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { CollapsibleRootChangeEventReason } from './types';

/** A panel of a root or an item, from its `setup` to its unmount. The properties are reactive. */
export interface CollapsiblePanelEntry {
  readonly id: string;
}

/**
 * What a `Collapsible.Root` or an `Accordion.Item` gives to its trigger and its panel. The
 * properties are reactive.
 */
export interface CollapsiblePart {
  readonly open: boolean;
  /** Disabled by the root, or by the item and its root. */
  readonly disabled: boolean;
  /** The id of the first panel. */
  readonly panelId: string | undefined;
  /** Emits the change events, and opens or closes the panel unless a listener cancels. */
  request(open: boolean, reason: CollapsibleRootChangeEventReason, event: Event): void;
  /** Adds a panel. Returns the function that removes it. */
  addPanel(panel: CollapsiblePanelEntry): () => void;
}

export const collapsibleKey: InjectionKey<CollapsiblePart> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'collapsible' : undefined,
);

export function injectCollapsible() {
  const collapsible = inject(collapsibleKey, null);
  if (!collapsible) {
    throw createError(10);
  }
  return collapsible;
}
