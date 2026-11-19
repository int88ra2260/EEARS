import { IMPORT_CENTER_CARDS, IMPORT_CENTER_TASK_GUIDES, IMPORT_CENTER_SECTION } from './importCenterCards';

function card(id) {
  return IMPORT_CENTER_CARDS.find((item) => item.id === id);
}

describe('import center roster distinctions', () => {
  it('keeps semester roster, class exception patch, and registration matching as separate cards', () => {
    expect(card('lj-enrollment').title).toBe('學期在學名冊');
    expect(card('lj-enrollment').notFor).toMatch(/報名核對名單/);
    expect(card('class-roster').section).toBe(IMPORT_CENTER_SECTION.EXCEPTION);
    expect(card('class-roster').title).toMatch(/例外/);
    expect(card('english-test-roster')).toMatchObject({
      title: '報名核對名單',
      statusTier: 'enabled',
      importPath: '/admin/english-test?tab=roster',
      routeAccess: '/admin/english-test',
    });
    expect(card('english-test-roster').notFor).toMatch(/學期在學名冊/);
  });

  it('tells operators not to import BESTEP scores through the learning-journey exam card', () => {
    expect(card('bestep').description).toMatch(/不必再匯/);
    expect(card('lj-exam').title).toBe('校外英檢成績');
    expect(card('lj-exam').notFor).toMatch(/BESTEP/);
  });

  it('includes a task guide for choosing a roster', () => {
    const guide = IMPORT_CENTER_TASK_GUIDES.find((item) => item.id === 'which-roster');
    expect(guide.steps.join(' ')).toMatch(/學期在學名冊/);
    expect(guide.steps.join(' ')).toMatch(/報名核對名單/);
  });
});
