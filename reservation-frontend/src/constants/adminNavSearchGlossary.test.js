import { ADMIN_NAV_SECTIONS } from './adminNavigation';
import {
  ADMIN_NAV_SEARCH_GLOSSARY,
  getAdminNavSearchTerms,
} from './adminNavSearchGlossary';

function collectAdminNavIds(sections = ADMIN_NAV_SECTIONS) {
  const ids = [];
  function walk(nodes) {
    for (const node of nodes || []) {
      ids.push(node.id);
      if (node.children?.length) walk(node.children);
    }
  }
  walk(sections);
  return ids;
}

describe('ADMIN_NAV_SEARCH_GLOSSARY', () => {
  const navIds = new Set(collectAdminNavIds());

  it('only uses ids that exist in admin navigation', () => {
    const unknown = Object.keys(ADMIN_NAV_SEARCH_GLOSSARY).filter((id) => !navIds.has(id));
    expect(unknown).toEqual([]);
  });

  it('covers all visible nav ids', () => {
    const missing = collectAdminNavIds().filter((id) => getAdminNavSearchTerms(id).length === 0);
    expect(missing).toEqual([]);
  });

  it('keeps each term list non-empty and unique per id', () => {
    Object.entries(ADMIN_NAV_SEARCH_GLOSSARY).forEach(([id, terms]) => {
      expect(Array.isArray(terms)).toBe(true);
      expect(terms.length).toBeGreaterThan(0);
      const normalized = terms.map((term) => String(term).trim().toLowerCase()).filter(Boolean);
      expect(new Set(normalized).size).toBe(normalized.length);
    });
  });
});
