import { closest } from '../../common/shadowDom';
import { menuPopups } from '../../utils/popups/registeredParts';

export function findRootOwnerId(node: Node): string | undefined {
  const popup = closest(node, (element) => element.isConnected && menuPopups.has(element));
  return popup ? menuPopups.get(popup)?.() : undefined;
}
