import { IMPORT_CENTER_CARDS, IMPORT_CENTER_TASK_GUIDES } from './importCenterCards';

function card(id) {
  return IMPORT_CENTER_CARDS.find((item) => item.id === id);
}

describe('import center roster distinctions', () => {
  it('keeps semester population, class roster, and registration matching as separate cards', () => {
    expect(card('lj-enrollment').notFor).toMatch(/英檢報名在學名單/);
    expect(card('class-roster').notFor).toMatch(/學期人口/);
    expect(card('english-test-roster')).toMatchObject({
      statusTier: 'enabled',
      importPath: '/admin/english-test?tab=roster',
      routeAccess: '/admin/english-test',
    });
    expect(card('english-test-roster').notFor).toMatch(/不是學期人口/);
  });

  it('tells operators not to import BESTEP scores through the learning-journey exam card', () => {
    expect(card('bestep').description).toMatch(/不必再匯/);
    expect(card('lj-exam').dataToImport).toMatch(/不要從這裡再傳一次/);
  });

  it('includes a task guide for choosing a roster', () => {
    const guide = IMPORT_CENTER_TASK_GUIDES.find((item) => item.id === 'which-roster');
    expect(guide.steps.join(' ')).toMatch(/學習歷程名冊/);
    expect(guide.steps.join(' ')).toMatch(/英檢報名在學名單/);
  });
});
