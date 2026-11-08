import { describe, expect, test } from 'vitest';
import {
  LEADERS_TEAM,
  leaderFieldRows,
  leaderMonogram,
  youtubeEmbedUrl,
} from './leadersTeam';

describe('leadersTeam', () => {
  test('publishes display names only', () => {
    const ids = LEADERS_TEAM.map((leader) => leader.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LEADERS_TEAM.length).toBeGreaterThan(0);
    LEADERS_TEAM.forEach((leader) => {
      expect(leader.name).toMatch(/\p{Script=Han}/u);
      expect(leader.name).toMatch(/[A-Za-z]/);
      expect(leader).not.toHaveProperty('studentId');
      expect(leader).not.toHaveProperty('email');
      expect(leader).not.toHaveProperty('hourlyRate');
    });
  });

  test('skips empty profile rows and only embeds a youtube id', () => {
    expect(leaderFieldRows({ name: '測試 Ada', degree: '  ', focus: '課堂討論' })).toEqual([
      { key: 'focus', value: '課堂討論' },
    ]);
    expect(leaderMonogram('謝宗叡 Udon')).toBe('U');
    expect(youtubeEmbedUrl('abc_12-XY')).toBe('https://www.youtube-nocookie.com/embed/abc_12-XY');
    expect(youtubeEmbedUrl('https://youtu.be/abc')).toBe('');
    expect(youtubeEmbedUrl('../etc')).toBe('');
  });
});
