import type { Tag } from '../types';

export function visibleTags(tags: Tag[], showNSFW: boolean, onlyNSFW = false): Tag[] {
  return tags.filter((t) => (onlyNSFW ? !!t.restricted : showNSFW || !t.restricted));
}

export function visibleTagIds(tags: Tag[], showNSFW: boolean, onlyNSFW = false): Set<string> {
  return new Set(visibleTags(tags, showNSFW, onlyNSFW).map((t) => t.id));
}
