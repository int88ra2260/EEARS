/**
 * Learning Guides 目錄卡片
 */
import { LEARNING_GUIDE_IDS } from './learningContentTypes';

/** @type {import('./miniGamesCatalog').MiniGameCatalogCard[]} */
export const LEARNING_GUIDES_CATALOG = [
  {
    id: LEARNING_GUIDE_IDS.ACTIVITY_PHRASEBOOK,
    path: '/guides/activity-phrasebook',
    titleKey: 'phrasebook.title',
    introKey: 'phrasebook.catalogIntro',
    tag: 'Guide',
    tone: 'warm',
    available: true,
  },
];
