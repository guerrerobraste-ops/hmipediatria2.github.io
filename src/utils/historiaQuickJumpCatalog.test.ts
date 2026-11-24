import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORIA_QUICK_JUMP_GROUPS,
  filterQuickJumpGroups,
  getQuickJumpGroupsForScope,
} from './historiaQuickJumpCatalog';

test('HISTORIA_QUICK_JUMP_GROUPS covers all 8 pages with unique item IDs', () => {
  const pages = HISTORIA_QUICK_JUMP_GROUPS.map(g => g.page);
  assert.deepEqual(pages, [1, 2, 3, 4, 5, 6, 7, 8]);

  const seen = new Set<string>();
  for (const group of HISTORIA_QUICK_JUMP_GROUPS) {
    assert.ok(group.items.length > 0, `Page ${group.page} should have at least 1 quick-jump item`);
    for (const item of group.items) {
      assert.equal(item.page, group.page);
      assert.ok(!seen.has(item.id), `Duplicate quick-jump item ID: ${item.id}`);
      seen.add(item.id);
    }
  }
});

test('getQuickJumpGroupsForScope filters cleanly for Page 3, 4, and 5', () => {
  assert.equal(getQuickJumpGroupsForScope(3)[0].items.length, 8);
  assert.equal(getQuickJumpGroupsForScope(4)[0].items.length, 14);
  assert.equal(getQuickJumpGroupsForScope(5)[0].items.length, 20); // Signos Vitales + Antropometría + 18 physical items
});

test('filterQuickJumpGroups matches accent-insensitively across labels and keywords', () => {
  const toraxResults = filterQuickJumpGroups(HISTORIA_QUICK_JUMP_GROUPS, 'torax');
  assert.ok(toraxResults.some(g => g.page === 5 && g.items.some(i => i.id === 'sec-fisico-toraxPulmonesFisico')));

  const vacunasResults = filterQuickJumpGroups(HISTORIA_QUICK_JUMP_GROUPS, 'vacunas');
  assert.ok(vacunasResults.some(g => g.page === 3 && g.items.some(i => i.id === 'sec-interrogatorio-6-inmunizaciones')));

  const graffarResults = filterQuickJumpGroups(HISTORIA_QUICK_JUMP_GROUPS, 'graffar');
  assert.equal(graffarResults.length, 1);
  assert.equal(graffarResults[0].page, 6);
  assert.equal(graffarResults[0].items.length, 4);
});
