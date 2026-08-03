import { useEffect, useRef } from 'react';
import { getWeeklyVoterId, hasWeeklyRead, markWeeklyReadLocal } from '../utils/weeklyVoter';
import { recordWeeklyEngagement } from '../services/weeklyInteractionApi';

export default function useWeeklyReadProgress({ slug, enabled = true }) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (!enabled || !slug || sentRef.current || hasWeeklyRead(slug)) return undefined;

    const onScroll = () => {
      if (sentRef.current) return;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const ratio = window.scrollY / scrollable;
      if (ratio < 0.85) return;

      sentRef.current = true;
      markWeeklyReadLocal(slug);
      recordWeeklyEngagement({
        slug,
        eventType: 'read_complete',
        voterKey: getWeeklyVoterId(),
      }).catch(() => {});
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [slug, enabled]);
}

export function buildChallengeShareText({ issueKey, slug, solvedGroups = [], mistakes = 0, origin }) {
  const levelEmoji = {
    A1: '🟨',
    A2: '🟩',
    B1: '🟦',
    B2: '🟪',
    C1: '🟪',
  };
  const grid = solvedGroups.map((g) => levelEmoji[g.level] || '🟩').join('');
  const url = `${origin || ''}/weekly/${slug || issueKey}`;
  return `EEARS Weekly 第 ${issueKey} 期\n${grid || '🟩🟩🟩🟩'}\n錯誤 ${mistakes} 次\n${url}`;
}
