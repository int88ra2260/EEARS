import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CEFR_LEVELS,
  MAX_MISTAKES,
  getRoundSecondsForLevel,
  buildLevelRound,
  computeWordBridgeResult,
  getQuartetCountForLevel,
  refreshUnsolvedQuartets,
  resolveGroupQuartet,
} from '../data/wordBridgePuzzles';

const PHASE = {
  INTRO: 'intro',
  PLAYING: 'playing',
  RESULTS: 'results',
};

export default function useWordBridgeGame() {
  const [phase, setPhase] = useState(PHASE.INTRO);
  const [currentLevel, setCurrentLevel] = useState('A1');
  const [tiles, setTiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [solvedGroups, setSolvedGroups] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(() => getRoundSecondsForLevel('A1'));
  const [shake, setShake] = useState(false);
  const [passedLevels, setPassedLevels] = useState([]);
  const [gameSummary, setGameSummary] = useState(null);
  const [levelNotice, setLevelNotice] = useState(null);
  const [mistakeLog, setMistakeLog] = useState([]);
  const [swapUsed, setSwapUsed] = useState(false);

  const usedQuartetIdsRef = useRef([]);
  const roundIdRef = useRef('');
  const advancingRef = useRef(false);
  const endingRef = useRef(false);
  const timeoutHandledRef = useRef(false);
  const gameStartedAtRef = useRef(null);
  const tilesRef = useRef(tiles);
  const solvedGroupsRef = useRef(solvedGroups);
  const mistakeLogRef = useRef(mistakeLog);

  useEffect(() => {
    mistakeLogRef.current = mistakeLog;
  }, [mistakeLog]);

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  useEffect(() => {
    solvedGroupsRef.current = solvedGroups;
  }, [solvedGroups]);

  const groupsRequired = getQuartetCountForLevel(currentLevel);
  const remainingTiles = tiles.filter(
    (tile) => !solvedGroups.some((group) => group.tileIds.includes(tile.id)),
  );
  const selectedTiles = remainingTiles.filter((tile) => selectedIds.includes(tile.id));
  const mistakesLeft = MAX_MISTAKES - mistakes;
  const isRoundComplete = solvedGroups.length >= groupsRequired && groupsRequired > 0;
  const isGameOver = mistakes >= MAX_MISTAKES;

  const result = useMemo(
    () => (phase === PHASE.RESULTS && gameSummary ? computeWordBridgeResult(gameSummary) : null),
    [phase, gameSummary],
  );

  const endGame = useCallback((endReason, overrides = {}) => {
    if (endingRef.current) return;
    endingRef.current = true;
    setGameSummary({
      endReason,
      failLevel: currentLevel,
      passedLevels,
      totalMistakes: mistakes,
      mistakeLog: mistakeLogRef.current,
      durationMs: gameStartedAtRef.current ? Date.now() - gameStartedAtRef.current : 0,
      ...overrides,
    });
    setPhase(PHASE.RESULTS);
  }, [currentLevel, passedLevels, mistakes]);

  const loadRoundAtLevel = useCallback((level) => {
    const round = buildLevelRound(level, usedQuartetIdsRef.current);
    usedQuartetIdsRef.current = [...usedQuartetIdsRef.current, ...round.quartetIds];
    roundIdRef.current = round.id;
    advancingRef.current = false;
    timeoutHandledRef.current = false;
    setTiles(round.tiles);
    setSelectedIds([]);
    setSolvedGroups([]);
    setSecondsLeft(getRoundSecondsForLevel(level));
  }, []);

  const refreshAfterMistake = useCallback(() => {
    const solvedQuartetIds = solvedGroupsRef.current.map((group) => group.quartetId);
    const lockedTiles = tilesRef.current.filter((tile) => solvedQuartetIds.includes(tile.quartetId));
    const refreshed = refreshUnsolvedQuartets({
      level: currentLevel,
      roundId: roundIdRef.current,
      usedQuartetIds: usedQuartetIdsRef.current,
      solvedQuartetIds,
      lockedTiles,
    });
    usedQuartetIdsRef.current = [...usedQuartetIdsRef.current, ...refreshed.newQuartetIds];
    setTiles(refreshed.tiles);
    setSelectedIds([]);
    setSecondsLeft(getRoundSecondsForLevel(currentLevel));
    timeoutHandledRef.current = false;
  }, [currentLevel]);

  const swapQuestions = useCallback(() => {
    if (phase !== PHASE.PLAYING || swapUsed || isGameOver || advancingRef.current) return;
    refreshAfterMistake();
    setSwapUsed(true);
  }, [phase, swapUsed, isGameOver, refreshAfterMistake]);

  const startGame = useCallback((startLevel = 'A1') => {
    const level = CEFR_LEVELS.includes(startLevel) ? startLevel : 'A1';
    usedQuartetIdsRef.current = [];
    endingRef.current = false;
    advancingRef.current = false;
    setCurrentLevel(level);
    setPassedLevels([]);
    setMistakes(0);
    setMistakeLog([]);
    setGameSummary(null);
    setLevelNotice(null);
    setSwapUsed(false);
    gameStartedAtRef.current = Date.now();
    loadRoundAtLevel(level);
    setPhase(PHASE.PLAYING);
  }, [loadRoundAtLevel]);

  const registerMistake = useCallback((detail = {}) => {
    const { words = [], reason = 'wrong_group', level = currentLevel } = detail;
    setMistakeLog((prev) => {
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          level,
          reason,
          words: reason === 'wrong_group' ? [...words] : [],
        },
      ];
      mistakeLogRef.current = next;
      return next;
    });
    setShake(true);
    setTimeout(() => setShake(false), 420);
    setSelectedIds([]);

    if (reason === 'timeout') {
      setSecondsLeft(getRoundSecondsForLevel(level));
      timeoutHandledRef.current = false;
    }

    setMistakes((prev) => prev + 1);
  }, [currentLevel]);

  const toggleTile = useCallback((tileId) => {
    if (phase !== PHASE.PLAYING || isGameOver || advancingRef.current) return;
    setSelectedIds((prev) => {
      if (prev.includes(tileId)) return prev.filter((id) => id !== tileId);
      if (prev.length >= 4) return prev;
      return [...prev, tileId];
    });
  }, [phase, isGameOver]);

  const shuffleRemaining = useCallback(() => {
    if (phase !== PHASE.PLAYING || advancingRef.current) return;
    setTiles((prev) => {
      const locked = new Set(solvedGroups.flatMap((group) => group.tileIds));
      const open = prev.filter((tile) => !locked.has(tile.id));
      const lockedTiles = prev.filter((tile) => locked.has(tile.id));
      return [...lockedTiles, ...shuffleInPlace(open)];
    });
    setSelectedIds([]);
  }, [phase, solvedGroups]);

  const submitSelection = useCallback(() => {
    if (selectedTiles.length !== 4 || phase !== PHASE.PLAYING || advancingRef.current) return;

    const quartetId = resolveGroupQuartet(selectedTiles);
    if (quartetId) {
      const theme = selectedTiles[0].theme;
      setSolvedGroups((prev) => [
        ...prev,
        {
          quartetId,
          level: currentLevel,
          theme,
          words: selectedTiles.map((tile) => tile.word),
          tileIds: selectedTiles.map((tile) => tile.id),
        },
      ]);
      setSelectedIds([]);
      return;
    }

    registerMistake({
      words: selectedTiles.map((tile) => tile.word),
      reason: 'wrong_group',
      level: currentLevel,
    });
  }, [phase, selectedTiles, currentLevel, registerMistake]);

  const advanceToNextLevel = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    if (currentLevel === 'C2') {
      setPassedLevels((prev) => {
        const updated = [...prev, 'C2'];
        endGame('cleared_c2', { passedLevels: updated, failLevel: 'C2' });
        return updated;
      });
      return;
    }

    const nextIndex = CEFR_LEVELS.indexOf(currentLevel) + 1;
    const nextLevel = CEFR_LEVELS[nextIndex];
    if (!nextLevel) {
      endGame('cleared_c2');
      return;
    }

    setPassedLevels((prev) => [...prev, currentLevel]);
    setLevelNotice(nextLevel);
    setCurrentLevel(nextLevel);
    loadRoundAtLevel(nextLevel);
  }, [currentLevel, endGame, loadRoundAtLevel]);

  useEffect(() => {
    if (phase !== PHASE.PLAYING) return undefined;
    if (isGameOver) {
      endGame('mistakes', { totalMistakes: MAX_MISTAKES });
      return undefined;
    }
    return undefined;
  }, [phase, isGameOver, endGame]);

  useEffect(() => {
    if (phase !== PHASE.PLAYING || !isRoundComplete || advancingRef.current) return undefined;
    const timer = setTimeout(() => advanceToNextLevel(), 700);
    return () => clearTimeout(timer);
  }, [phase, isRoundComplete, advanceToNextLevel]);

  useEffect(() => {
    if (phase !== PHASE.PLAYING || isGameOver || advancingRef.current) return undefined;
    if (secondsLeft <= 0) {
      if (!timeoutHandledRef.current) {
        timeoutHandledRef.current = true;
        registerMistake({ reason: 'timeout', level: currentLevel });
      }
      return undefined;
    }
    timeoutHandledRef.current = false;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, secondsLeft, isGameOver, registerMistake, currentLevel]);

  const resetGame = useCallback(() => {
    usedQuartetIdsRef.current = [];
    endingRef.current = false;
    advancingRef.current = false;
    roundIdRef.current = '';
    setPhase(PHASE.INTRO);
    setCurrentLevel('A1');
    setPassedLevels([]);
    setGameSummary(null);
    setTiles([]);
    setSelectedIds([]);
    setSolvedGroups([]);
    setMistakes(0);
    setMistakeLog([]);
    setSecondsLeft(getRoundSecondsForLevel('A1'));
    setLevelNotice(null);
    setSwapUsed(false);
    gameStartedAtRef.current = null;
  }, []);

  return {
    phase,
    currentLevel,
    passedLevels,
    levelNotice,
    groupsRequired,
    tiles: remainingTiles,
    selectedIds,
    selectedTiles,
    solvedGroups,
    mistakes,
    mistakesLeft,
    maxMistakes: MAX_MISTAKES,
    secondsLeft,
    roundSeconds: getRoundSecondsForLevel(currentLevel),
    shake,
    isRoundComplete,
    isGameOver,
    result,
    mistakeLog,
    swapAvailable: !swapUsed,
    levels: CEFR_LEVELS,
    gameSummary: phase === PHASE.RESULTS ? gameSummary : null,
    startGame,
    toggleTile,
    shuffleRemaining,
    swapQuestions,
    submitSelection,
    resetGame,
  };
}

function shuffleInPlace(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
