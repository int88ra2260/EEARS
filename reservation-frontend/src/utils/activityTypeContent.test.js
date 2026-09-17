import {
  activityTypeContentKey,
  buildActivityTypeContentSeedItems,
  getActivityTypeContentKeys,
  pairSecondaryCtaUrlKey,
  parseActivityTypeContentKey,
  resolveActivityImageSrc,
  resolveActivitySecondaryCta,
  resolveActivityTypeContentFallback,
  usesLegacyActivityPresentation,
} from './activityTypeContent';
import { buildBookableActivityCards } from '../constants/activityCatalog';
import { mergeTextCatalog } from './siteContentCatalog';

describe('activityTypeContent', () => {
  test('builds stable keys for a custom type', () => {
    const keys = getActivityTypeContentKeys('writing_lab');
    expect(keys.titleKey).toBe('activities.type.writing_lab.title');
    expect(keys.imageKey).toBe('activities.type.writing_lab.imageUrl');
    expect(keys.secondaryCtaLabelKey).toBe('activities.type.writing_lab.secondaryCtaLabel');
    expect(keys.secondaryCtaUrlKey).toBe('activities.type.writing_lab.secondaryCtaUrl');
    expect(keys.visualKeys).toHaveLength(3);
    expect(parseActivityTypeContentKey(keys.introKey)).toEqual({
      code: 'writing_lab',
      field: 'intro',
    });
  });

  test('legacy codes keep presentation outside dynamic keys', () => {
    expect(usesLegacyActivityPresentation('english_table')).toBe(true);
    expect(usesLegacyActivityPresentation('writing_lab')).toBe(false);
    expect(buildActivityTypeContentSeedItems([
      { code: 'english_table', displayName: 'English Table' },
      { code: 'writing_lab', displayName: 'Writing Lab', abbreviation: 'WL' },
    ]).every((row) => row.contentKey.startsWith('activities.type.writing_lab.'))).toBe(true);
  });

  test('fallback resolves zh/en defaults', () => {
    expect(resolveActivityTypeContentFallback('activities.type.demo_talk.title', 'zh')).toContain('Demo');
    expect(resolveActivityTypeContentFallback('activities.type.demo_talk.intro', 'en')).toMatch(/calendar/i);
    expect(resolveActivityTypeContentFallback('activities.etDesc', 'zh')).toBeNull();
    expect(resolveActivityTypeContentFallback('activities.type.demo_talk.secondaryCtaLabel', 'zh')).toBe('');
  });

  test('resolveActivityImageSrc prefers custom url and falls back', () => {
    const t = (key) => (key === 'activities.englishTableImageUrl' ? '/uploads/media/et.jpg' : key);
    expect(resolveActivityImageSrc(t, 'activities.englishTableImageUrl', '/images/english_table.jpg'))
      .toBe('/uploads/media/et.jpg');
    expect(resolveActivityImageSrc(() => '', 'activities.englishTableImageUrl', '/images/english_table.jpg'))
      .toBe('/images/english_table.jpg');
  });

  test('pairSecondaryCtaUrlKey maps label key to url key', () => {
    expect(pairSecondaryCtaUrlKey('activities.englishTableSecondaryCtaLabel'))
      .toBe('activities.englishTableSecondaryCtaUrl');
    expect(pairSecondaryCtaUrlKey('activities.type.cafe_chat.secondaryCtaLabel'))
      .toBe('activities.type.cafe_chat.secondaryCtaUrl');
    expect(pairSecondaryCtaUrlKey('activities.etDesc')).toBeNull();
  });

  test('resolveActivitySecondaryCta requires label + valid href', () => {
    const card = {
      secondaryCtaLabelKey: 'activities.englishTableSecondaryCtaLabel',
      secondaryCtaUrlKey: 'activities.englishTableSecondaryCtaUrl',
    };
    expect(resolveActivitySecondaryCta(card, () => '')).toBeNull();
    expect(resolveActivitySecondaryCta(card, (k) => (
      k.endsWith('Label') ? '了解更多' : ''
    ))).toBeNull();
    expect(resolveActivitySecondaryCta(card, (k) => (
      k.endsWith('Label') ? '了解更多' : '/events'
    ))).toEqual({
      label: '了解更多',
      href: '/events',
      labelKey: card.secondaryCtaLabelKey,
      urlKey: card.secondaryCtaUrlKey,
      external: false,
    });
    expect(resolveActivitySecondaryCta(card, (k) => (
      k.endsWith('Label') ? 'Official site' : 'https://example.com'
    )).external).toBe(true);
  });
});

describe('buildBookableActivityCards + mergeTextCatalog', () => {
  const customType = {
    code: 'cafe_chat',
    slug: 'cafe-chat',
    displayName: 'Cafe Chat',
    abbreviation: 'CC',
    sortOrder: 50,
    isActive: true,
  };

  test('custom type cards include full content keys and imageKey', () => {
    const cards = buildBookableActivityCards([customType]);
    expect(cards).toHaveLength(1);
    expect(cards[0].titleKey).toBe(activityTypeContentKey('cafe_chat', 'title'));
    expect(cards[0].introKey).toBe(activityTypeContentKey('cafe_chat', 'intro'));
    expect(cards[0].imageKey).toBe(activityTypeContentKey('cafe_chat', 'imageUrl'));
    expect(cards[0].secondaryCtaLabelKey).toBe(activityTypeContentKey('cafe_chat', 'secondaryCtaLabel'));
    expect(cards[0].secondaryCtaUrlKey).toBe(activityTypeContentKey('cafe_chat', 'secondaryCtaUrl'));
    expect(cards[0].fitKey).toBeTruthy();
    expect(cards[0].formatKey).toBeTruthy();
    expect(cards[0].durationKey).toBeTruthy();
    expect(cards[0].visualKeys).toHaveLength(3);
  });

  test('activities catalog merge includes custom type fields and fixed image/CTA keys', () => {
    const rows = mergeTextCatalog('activities', [], { eventTypes: [customType] });
    const keys = rows.map((r) => r.contentKey);
    expect(keys).toContain('activities.type.cafe_chat.intro');
    expect(keys).toContain('activities.type.cafe_chat.imageUrl');
    expect(keys).toContain('activities.type.cafe_chat.secondaryCtaLabel');
    expect(keys).toContain('activities.type.cafe_chat.secondaryCtaUrl');
    expect(keys).toContain('activities.englishTableImageUrl');
    expect(keys).toContain('activities.englishTableSecondaryCtaLabel');
    expect(keys).toContain('activities.writingWorkshopImageUrl');
    const intro = rows.find((r) => r.contentKey === 'activities.type.cafe_chat.intro');
    expect(intro.status).toBe('default');
    expect(intro.valueZh).toMatch(/Cafe Chat/);
  });
});
