import {
  MAX_MISTAKES,
  QUARTETS_PER_LEVEL,
  ROUND_SECONDS_BY_LEVEL,
  THEME_BANK_LEVELS,
  getRoundSecondsForLevel,
  WORD_LEVEL_BANKS,
  buildLevelRound,
  buildWeeklyRound,
  computeWordBridgeResult,
  getEstimatedLevelOnFailure,
  getQuartetCountForLevel,
  refreshUnsolvedQuartets,
  resolveGroupQuartet,
  validateThemeBanks,
} from '../data/wordBridgePuzzles';
import { THEMES_PER_LEVEL, WORD_BRIDGE_THEME_BANKS } from '../data/wordBridgeThemes';

describe('wordBridgePuzzles', () => {
  test('theme banks have 25 distinct themes per level', () => {
    expect(validateThemeBanks()).toEqual([]);
    expect(WORD_LEVEL_BANKS.A1).toHaveLength(THEMES_PER_LEVEL);
    expect(WORD_LEVEL_BANKS.C1).toHaveLength(THEMES_PER_LEVEL);
    expect(WORD_BRIDGE_THEME_BANKS.C2).toHaveLength(THEMES_PER_LEVEL);
    expect(THEME_BANK_LEVELS).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  });

  test('quartet counts per level match game design', () => {
    expect(QUARTETS_PER_LEVEL).toEqual({ A1: 2, A2: 3, B1: 4, B2: 4, C1: 4, C2: 4 });
    expect(getQuartetCountForLevel('A1')).toBe(2);
    expect(getQuartetCountForLevel('A2')).toBe(3);
    expect(getQuartetCountForLevel('B1')).toBe(4);
  });

  test('buildLevelRound respects per-level word counts', () => {
    expect(buildLevelRound('A1', []).tiles).toHaveLength(8);
    expect(buildLevelRound('A2', []).tiles).toHaveLength(12);
    expect(buildLevelRound('B1', []).tiles).toHaveLength(16);
    expect(buildLevelRound('C2', []).tiles).toHaveLength(16);
  });

  test('buildWeeklyRound uses fixed theme ids', () => {
    const themeIds = ['a2-campus', 'a2-homework', 'a2-weekend', 'a2-shopping'];
    const round = buildWeeklyRound('A2', themeIds);
    expect(round.tiles).toHaveLength(16);
    expect(round.quartetIds).toEqual(themeIds);
  });

  test('resolveGroupQuartet accepts same theme quartet only', () => {
    const round = buildLevelRound('B1', []);
    const quartetId = round.quartetIds[0];
    const groupTiles = round.tiles.filter((tile) => tile.quartetId === quartetId);
    expect(resolveGroupQuartet(groupTiles)).toBe(quartetId);

    const mixed = [
      groupTiles[0],
      groupTiles[1],
      groupTiles[2],
      round.tiles.find((tile) => tile.quartetId !== quartetId),
    ];
    expect(resolveGroupQuartet(mixed)).toBeNull();
  });

  test('refreshUnsolvedQuartets keeps solved tiles and replaces only unsolved groups', () => {
    const round = buildLevelRound('B1', []);
    const solvedId = round.quartetIds[0];
    const solvedTiles = round.tiles.filter((tile) => tile.quartetId === solvedId);

    const refreshed = refreshUnsolvedQuartets({
      level: 'B1',
      roundId: round.id,
      usedQuartetIds: round.quartetIds,
      solvedQuartetIds: [solvedId],
      lockedTiles: solvedTiles,
    });

    expect(refreshed.tiles).toHaveLength(16);
    expect(refreshed.tiles.filter((tile) => tile.quartetId === solvedId)).toHaveLength(4);
    expect(refreshed.newQuartetIds).toHaveLength(3);
    expect(refreshed.newQuartetIds).not.toContain(solvedId);
  });

  test('getEstimatedLevelOnFailure drops one band', () => {
    expect(getEstimatedLevelOnFailure('B1')).toBe('A2');
    expect(getEstimatedLevelOnFailure('B2')).toBe('B1');
    expect(getEstimatedLevelOnFailure('C1')).toBe('B2');
    expect(getEstimatedLevelOnFailure('C2')).toBe('C1');
  });

  test('computeWordBridgeResult maps failure and clear outcomes', () => {
    expect(computeWordBridgeResult({
      endReason: 'mistakes',
      failLevel: 'B1',
      passedLevels: ['A1', 'A2'],
      totalMistakes: MAX_MISTAKES,
    }).estimatedLevel).toBe('A2');

    expect(computeWordBridgeResult({
      endReason: 'cleared_c1',
      failLevel: 'C1',
      passedLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
      totalMistakes: 1,
    }).estimatedLevel).toBe('C1');

    expect(computeWordBridgeResult({
      endReason: 'cleared_c2',
      failLevel: 'C2',
      passedLevels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      totalMistakes: 0,
    }).estimatedLevel).toBe('C2');
  });

  test('round seconds per level', () => {
    expect(ROUND_SECONDS_BY_LEVEL).toEqual({
      A1: 40,
      A2: 60,
      B1: 80,
      B2: 90,
      C1: 100,
      C2: 110,
    });
    expect(getRoundSecondsForLevel('B1')).toBe(80);
    expect(getRoundSecondsForLevel('C1')).toBe(100);
    expect(getRoundSecondsForLevel('C2')).toBe(110);
  });
});
