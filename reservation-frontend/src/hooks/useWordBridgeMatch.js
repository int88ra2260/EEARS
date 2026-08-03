import { useCallback, useMemo, useState } from 'react';
import {
  pairsToMatchCards,
  pickMatchRoundPairs,
} from '../data/wordBridgeMatch';

export default function useWordBridgeMatch(poolWords) {
  const [active, setActive] = useState(false);
  const [mastered, setMastered] = useState(() => new Set());
  const [cards, setCards] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [shake, setShake] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);

  const totalCount = poolWords.length;
  const masteredCount = mastered.size;

  const loadRound = useCallback((masteredSet, incrementRound = true) => {
    const { pairs, complete } = pickMatchRoundPairs(poolWords, masteredSet);
    if (complete || pairs.length === 0) {
      setCards([]);
      setSessionComplete(true);
      return;
    }
    setCards(pairsToMatchCards(pairs));
    setSelectedId(null);
    if (incrementRound) {
      setRoundIndex((prev) => prev + 1);
    }
  }, [poolWords]);

  const startMatch = useCallback(() => {
    const empty = new Set();
    setActive(true);
    setMastered(empty);
    setSessionComplete(false);
    setRoundIndex(1);
    loadRound(empty, false);
  }, [loadRound]);

  const exitMatch = useCallback(() => {
    setActive(false);
    setCards([]);
    setSelectedId(null);
    setShake(false);
    setSessionComplete(false);
    setRoundIndex(0);
    setMastered(new Set());
  }, []);

  const onCardClick = useCallback((card) => {
    if (sessionComplete) return;

    if (!selectedId) {
      setSelectedId(card.id);
      return;
    }

    if (selectedId === card.id) {
      setSelectedId(null);
      return;
    }

    const firstCard = cards.find((item) => item.id === selectedId);
    if (!firstCard) {
      setSelectedId(null);
      return;
    }

    const isMatch = firstCard.pairKey === card.pairKey && firstCard.side !== card.side;
    if (!isMatch) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
      setSelectedId(null);
      return;
    }

    const nextMastered = new Set(mastered);
    if (!nextMastered.has(firstCard.pairKey)) {
      nextMastered.add(firstCard.pairKey);
      setMastered(nextMastered);
    }
    setSelectedId(null);
    setCards((prev) => {
      const next = prev.map((item) => (
        item.pairKey === firstCard.pairKey ? { ...item, isMatched: true } : item
      ));
      const activeLeft = next.filter((item) => !item.isMatched).length;
      if (activeLeft === 0) {
        setTimeout(() => loadRound(nextMastered), 320);
      }
      return next;
    });
  }, [selectedId, cards, mastered, sessionComplete, loadRound]);

  const progressLabel = useMemo(() => ({
    mastered: masteredCount,
    total: totalCount,
    round: roundIndex,
  }), [masteredCount, totalCount, roundIndex]);

  return {
    active,
    cards,
    selectedId,
    shake,
    sessionComplete,
    masteredCount,
    totalCount,
    progressLabel,
    startMatch,
    exitMatch,
    onCardClick,
  };
}
