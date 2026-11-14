import type { HTMLProps } from '../../../internals/types';
import { ValuePopupFixtureStore } from '../../../../test/fixtures/ValuePopupFixture';
import { useSingleAnchorPopupRoot } from '../popupRoot';
import { usePopupInteractionProps } from '../popupStoreUtils';

function useTypeTests(props: HTMLProps) {
  const { store } = useSingleAnchorPopupRoot(
    {},
    (initialState, defaultPopupId) => new ValuePopupFixtureStore(initialState, defaultPopupId),
    {
      name: 'TypeTest',
      onOpenChange(open, details) {
        // The details have the type of the store, and not `never`.
        const reason: 'trigger-press' | 'item-press' | 'escape-key' | 'imperative-action' | 'none' =
          details.reason;
        details.preventUnmountOnClose();
        // @ts-expect-error The store never gives this reason.
        const missing: 'outside-press' = details.reason;
        return [open, reason, missing];
      },
      onOpenChangeComplete() {},
    },
  );

  usePopupInteractionProps(store, () => ({
    activeTriggerProps: props,
    inactiveTriggerProps: props,
    popupProps: props,
    id: 'id',
    modal: true,
    selectedValue: 'a',
  }));

  usePopupInteractionProps(store, () => ({
    activeTriggerProps: props,
    inactiveTriggerProps: props,
    popupProps: props,
    // @ts-expect-error A key of the family must have its declared value type.
    modal: 'invalid',
  }));
}

void useTypeTests;
