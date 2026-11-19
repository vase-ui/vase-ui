import {
  dismissPopupBindings,
  dismissTriggerBindings,
  useDismissLayer,
} from '../../src/utils/popups/interactions/useDismissLayer';

export function useTestDismiss(...options: Parameters<typeof useDismissLayer>) {
  const layer = useDismissLayer(...options);
  const reference = dismissTriggerBindings(layer);
  return { reference, trigger: reference, floating: dismissPopupBindings(layer) };
}
