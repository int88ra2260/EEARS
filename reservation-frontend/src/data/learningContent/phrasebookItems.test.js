import { getPhrasebookItems, PHRASEBOOK_ITEMS } from './phrasebookItems';

describe('phrasebookItems', () => {
  test('has active items for each activity type', () => {
    const types = ['English Table', 'English Club', 'International Forum', 'Job Talk'];
    types.forEach((activityType) => {
      const items = getPhrasebookItems({ activityType });
      expect(items.length).toBeGreaterThanOrEqual(5);
      items.forEach((item) => {
        expect(item.phrases.length).toBeGreaterThanOrEqual(3);
        expect(item.responseDirectionZh).toBeTruthy();
        expect(item.responseDirectionEn).toBeTruthy();
      });
    });
  });

  test('all items have required bilingual fields', () => {
    PHRASEBOOK_ITEMS.forEach((item) => {
      expect(item.scenarioTitleZh).toBeTruthy();
      expect(item.scenarioTitleEn).toBeTruthy();
      expect(item.tips.zh).toBeTruthy();
      expect(item.avoid.en).toBeTruthy();
    });
  });
});
