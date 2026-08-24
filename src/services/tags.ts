import type { Tag } from '../types';

export function visibleTags(tags: Tag[], showNSFW: boolean): Tag[] {
  return tags.filter((t) => showNSFW || !t.restricted);
}

export function visibleTagIds(tags: Tag[], showNSFW: boolean): Set<string> {
  return new Set(visibleTags(tags, showNSFW).map((t) => t.id));
}
