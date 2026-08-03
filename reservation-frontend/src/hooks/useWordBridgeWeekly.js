import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_MISTAKES,
  buildWeeklyRound,
  getRoundSecondsForLevel,
  resolveGroupQuartet,
} from '../data/wordBridgePuzzles';

const PHASE = {
  INTRO: 'intro',
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
};

export default function useWordBridgeWeekly({ level, themeIds }) {
  const [phase, setPhase] = useState(PHASE.INTRO);
  const [tiles, setTiles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [solvedGroups, setSolvedGroups] = useState([]);
  const [mistakes, setMistakes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(() => getRoundSecondsForLevel(level || 'A2'));
  const [shake, setShake] = useState(false);

  const roundIdRef = useRef('');
  const usedQuartetIdsRef = useRef([]);
  const tilesRef = useRef(tiles);
  const solvedGroupsRef = useRef(solvedGroups);

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  useEffect(() => {
    solvedGroupsRef.current = solvedGroups;
  }, [solvedGroups]);

  const groupsRequired = 4;
  const remainingTiles = tiles.filter(
    (tile) => !solvedGroups.some((group) => group.tileIds.includes(tile.id))
  );
  const selectedTiles = remainingTiles.filter((tile) => selectedIds.includes(tile.id));
  const mistakesLeft = MAX_MISTAKES - mistakes;
  const isRoundComplete = solvedGroups.length >= groupsRequired;
  const isGameOver = mistakes >= MAX_MISTAKES;
  const roundSeconds = getRoundSecondsForLevel(level || 'A2');

  const loadRound = useCallback(() => {
    if (!level || !themeIds?.length) return;
    const round = buildWeeklyRound(level, themeIds);
    roundIdRef.current = round.id;
    usedQuartetIdsRef.current = [...round.quartetIds];
    setTiles(round.tiles);
    setSelectedIds([]);
    setSolvedGroups([]);
    setMistakes(0);
    setSecondsLeft(getRoundSecondsForLevel(level));
    setPhase(PHASE.PLAYING);
  }, [level, themeIds]);

  const toggleTile = useCallback((tileId) => {
    setSelectedIds((prev) => {
      if (prev.includes(tileId)) return prev.filter((id) => id !== tileId);
      if (prev.length >= 4) return prev;
      return [...prev, tileId];
    });
  }, []);

  const submitSelection = useCallback(() => {
    if (selectedTiles.length !== 4) return;
    const quartetId = resolveGroupQuartet(selectedTiles);
    if (quartetId) {
      const group = {
        quartetId,
        level,
        theme: selectedTiles[0].theme,
        words: selectedTiles.map((t) => t.word),
        tileIds: selectedTiles.map((t) => t.id),
      };
      setSolvedGroups((prev) => [...prev, group]);
      setSelectedIds([]);
      return;
    }

    setMistakes((m) => m + 1);
    setShake(true);
    setTimeout(() => setShake(false), 450);
    setSelectedIds([]);

    const solvedQuartetIds = solvedGroupsRef.current.map((g) => g.quartetId);
    setTiles((prev) => {
      const locked = prev.filter((tile) => solvedQuartetIds.includes(tile.quartetId));
      const pool = prev.filter((tile) => !solvedQuartetIds.includes(tile.quartetId));
      for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return [...locked, ...pool];
    });
  }, [level, selectedTiles]);

  useEffect(() => {
    if (phase !== PHASE.PLAYING) return undefined;
    if (isRoundComplete) {
      setPhase(PHASE.WON);
      return undefined;
    }
    if (isGameOver) {
      setPhase(PHASE.LOST);
      return undefined;
    }
    return undefined;
  }, [phase, isRoundComplete, isGameOver]);

  useEffect(() => {
    if (phase !== PHASE.PLAYING || secondsLeft <= 0) return undefined;
    const timer = setInterval(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, secondsLeft]);

  useEffect(() => {
    if (phase === PHASE.PLAYING && secondsLeft <= 0 && !isRoundComplete) {
      setPhase(PHASE.LOST);
    }
  }, [phase, secondsLeft, isRoundComplete]);

  const canSubmit = selectedIds.length === 4;

  const stats = useMemo(
    () => ({
      solved: solvedGroups.length,
      total: groupsRequired,
      mistakes,
      mistakesLeft,
    }),
    [solvedGroups.length, mistakes, mistakesLeft]
  );

  return {
    phase,
    PHASE,
    level,
    tiles: remainingTiles,
    selectedIds,
    solvedGroups,
    mistakes,
    mistakesLeft,
    maxMistakes: MAX_MISTAKES,
    secondsLeft,
    roundSeconds,
    shake,
    canSubmit,
    stats,
    start: loadRound,
    toggleTile,
    submitSelection,
    retry: loadRound,
  };
}
