import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  postAcademicCourseRosterApply,
  postAcademicCourseRosterDryRun,
} from './learningJourneyApi';

const fetchClient = vi.hoisted(() => vi.fn());

vi.mock('../utils/fetchClient', () => ({
  fetchClient: (...args) => fetchClient(...args),
}));

const DRY_RUN = '/api/admin/learning-journey/admin/academic-course-roster/dry-run';
const APPLY = '/api/admin/learning-journey/admin/academic-course-roster/apply';

describe('academic course roster client contract', () => {
  beforeEach(() => {
    fetchClient.mockReset();
    fetchClient.mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      json: async () => ({ success: true, data: { ok: true } }),
    });
  });

  test('T5-P1 posts dry-run and apply to the mounted admin paths', async () => {
    const file = new File(['roster'], 'roster.xlsx');
    await postAcademicCourseRosterDryRun('token-1', file, { semesterId: '114-1', syncClassRoster: true });
    await postAcademicCourseRosterApply('token-1', file, { semesterId: '114-1', syncClassRoster: false });

    expect(fetchClient.mock.calls[0][0]).toBe(DRY_RUN);
    expect(fetchClient.mock.calls[1][0]).toBe(APPLY);
    expect(fetchClient.mock.calls[0][1].method).toBe('POST');
  });

  test('T5-P4 the import section calls both roster functions', () => {
    const filePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../components/learningJourneyV3/LearningJourneyV3ImportSection.jsx'
    );
    const source = fs.readFileSync(filePath, 'utf8');
    expect(source).toMatch(/await postAcademicCourseRosterDryRun\s*\(/);
    expect(source).toMatch(/await postAcademicCourseRosterApply\s*\(/);
  });
});
