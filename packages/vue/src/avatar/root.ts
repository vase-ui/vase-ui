import { inject, type InjectionKey } from 'vue';
import type { AvatarRootState, ImageLoadingStatus } from './types';

/** What `Avatar.Root` gives to its parts. The properties are reactive. */
export interface AvatarForParts {
  readonly state: AvatarRootState;
  setStatus(status: ImageLoadingStatus): void;
}

export const avatarKey: InjectionKey<AvatarForParts> = Symbol('avatar');

export function injectAvatarRoot(part: string) {
  const root = inject(avatarKey, null);
  if (!root) throw new Error(`Vase UI Avatar: <Avatar.${part}> must be inside <Avatar.Root>.`);
  return root;
}
