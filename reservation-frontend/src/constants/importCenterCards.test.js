import {
  IMPORT_CENTER_CARDS,
  IMPORT_CENTER_PRIMARY_HUBS,
  IMPORT_CENTER_ROSTER_GUIDE,
  IMPORT_CENTER_SECTION,
  IMPORT_CENTER_TASK_GUIDES,
  getImportCenterMoreSections,
  getPlannedImportCenterCards,
} from './importCenterCards';

function card(id) {
  return IMPORT_CENTER_CARDS.find((item) => item.id === id);
}

describe('import center live catalog', () => {
  it('keeps only live secondary cards and four primary hubs', () => {
    expect(IMPORT_CENTER_PRIMARY_HUBS.map((hub) => hub.id)).toEqual([
      'lj-data',
      'bestep-hub',
      'event-checkin',
      'ewl',
    ]);
    expect(IMPORT_CENTER_CARDS.map((item) => item.id)).toEqual(['class-roster', 'lj-operations']);
    expect(getPlannedImportCenterCards()).toEqual([]);

    const moreIds = getImportCenterMoreSections().flatMap((section) => section.cards.map((c) => c.id));
    expect(moreIds).toEqual(['class-roster', 'lj-operations']);
  });

  it('keeps class exception patch as the only roster exception card', () => {
    expect(card('class-roster').section).toBe(IMPORT_CENTER_SECTION.EXCEPTION);
    expect(card('class-roster').title).toMatch(/例外/);
    expect(card('class-roster').notFor).toMatch(/學期在學名冊/);
    expect(card('class-roster').importPath).toBe('/admin/classes');
  });

  it('documents the three roster types and bestep separation on hubs', () => {
    const ljHub = IMPORT_CENTER_PRIMARY_HUBS.find((hub) => hub.id === 'lj-data');
    const bestepHub = IMPORT_CENTER_PRIMARY_HUBS.find((hub) => hub.id === 'bestep-hub');
    expect(ljHub.includes.join(' ')).toMatch(/學期在學名冊/);
    expect(ljHub.includes.join(' ')).toMatch(/校外英檢/);
    expect(bestepHub.description).toMatch(/不是學期在學名冊/);
    expect(bestepHub.secondaryLinks?.[0]?.path).toBe('/admin/english-test?tab=roster');

    expect(IMPORT_CENTER_ROSTER_GUIDE.steps.join(' ')).toMatch(/學期在學名冊/);
    expect(IMPORT_CENTER_ROSTER_GUIDE.steps.join(' ')).toMatch(/報名核對名單/);
    expect(IMPORT_CENTER_TASK_GUIDES[0].steps.join(' ')).toMatch(/班級修課名冊/);
  });
});
