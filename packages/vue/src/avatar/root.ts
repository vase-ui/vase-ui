import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { AvatarRootState, ImageLoadingStatus } from './types';

/** What `Avatar.Root` gives to its parts. The properties are reactive. */
export interface AvatarForParts {
  readonly state: AvatarRootState;
  setStatus(status: ImageLoadingStatus): void;
}

export const avatarKey: InjectionKey<AvatarForParts> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'avatar' : undefined,
);

export function injectAvatarRoot(part: string) {
  const root = inject(avatarKey, null);
  if (!root) throw createError(3, part);
  return root;
}
