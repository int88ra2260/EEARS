/**
 * @jest-environment node
 */
const { buildPartDiagnostics } = require('../services/bestepPartDiagnosticService');

function registration(overrides) {
  return {
    studentId: 'S1',
    semester: '114-2',
    status: 'success',
    examType: 'LRSW',
    ...overrides,
  };
}

function score(overrides) {
  return {
    studentId: 'S1',
    semester: '114-1',
    listeningScore: 84,
    listeningLevel: 'B1',
    listeningPart1Rate: 80,
    listeningPart2Rate: 60,
    listeningPart3Rate: 47,
    readingScore: null,
    readingLevel: null,
    speakingScore: 200,
    speakingLevel: 'B1',
    speakingPart1Rate: 70,
    speakingPart2Rate: 62,
    speakingPart3Rate: 48,
    writingScore: null,
    writingLevel: null,
    ...overrides,
  };
}

describe('buildPartDiagnostics', () => {
  it('compares part achievement across sittings and skips an unanswered zero', () => {
    const result = buildPartDiagnostics({
      semester: '114-2',
      registrations: [],
      scores: [
        score({ studentId: 'P1', semester: '113-2', speakingPart3Rate: 40 }),
        score({ studentId: 'P2', semester: '113-2', speakingPart3Rate: 50 }),
        score({ studentId: 'P1', semester: '114-1', speakingPart3Rate: 60 }),
        score({ studentId: 'P2', semester: '114-1', speakingPart3Rate: 70 }),
        score({
          studentId: 'MISS',
          semester: '114-1',
          speakingScore: 0,
          speakingLevel: '',
          speakingPart1Rate: 0,
          speakingPart2Rate: 0,
          speakingPart3Rate: 0,
        }),
      ],
    });
    const speakingPart2 = result.history.parts.find((part) => part.skill === 'speaking' && part.part === 2);
    const speakingPart3 = result.history.parts.find((part) => part.skill === 'speaking' && part.part === 3);

    expect(result.history.sumsPeople).toBe(false);
    expect(result.history.semesters).toEqual(['113-2', '114-1']);
    expect(speakingPart3.bySemester['113-2']).toEqual({ count: 2, meanRate: 45, weakest: true });
    expect(speakingPart3.bySemester['114-1']).toEqual({ count: 2, meanRate: 65, weakest: false });
    expect(speakingPart2.bySemester['114-1'].weakest).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/P1|P2|MISS/);
  });

  it('uses the latest earlier score for this registration batch, only on skills they will sit', () => {
    const result = buildPartDiagnostics({
      semester: '114-2',
      registrations: [
        registration({ studentId: 'S1', examType: 'SW' }),
        registration({ studentId: 'S2', examType: 'LR' }),
        registration({ studentId: 'S3', examType: 'LRSW' }),
      ],
      scores: [
        score({ studentId: 'S1', semester: '113-2', speakingPart3Rate: 40, listeningPart3Rate: 90 }),
        score({ studentId: 'S1', semester: '114-1', speakingPart3Rate: 55, listeningPart3Rate: 20 }),
        score({ studentId: 'S1', semester: '114-2', speakingPart3Rate: 99 }),
        score({ studentId: 'S2', semester: '114-1', listeningPart3Rate: 30, speakingPart3Rate: 10 }),
      ],
    });
    const speaking = result.preExam.parts.filter((part) => part.skill === 'speaking');
    const listening = result.preExam.parts.filter((part) => part.skill === 'listening');

    expect(result.preExam.status).toBe('ready');
    expect(result.preExam.registeredStudentCount).toBe(3);
    expect(result.preExam.withPriorParts).toBe(2);
    expect(result.preExam.withoutPriorParts).toBe(1);
    expect(speaking.find((part) => part.part === 3)).toMatchObject({ count: 1, meanRate: 55, weakest: true });
    expect(listening.find((part) => part.part === 3)).toMatchObject({ count: 1, meanRate: 30 });
    expect(JSON.stringify(result.preExam)).not.toMatch(/S1|S2|S3/);
  });

  it('separates B1 and B1+ and ignores B2 when looking for the weak part', () => {
    const result = buildPartDiagnostics({
      semester: '114-1',
      registrations: [],
      scores: [
        score({ studentId: 'B1S', speakingLevel: 'B1', speakingPart1Rate: 80, speakingPart2Rate: 70, speakingPart3Rate: 40 }),
        score({ studentId: 'PLUS', speakingLevel: 'B1+', speakingPart1Rate: 90, speakingPart2Rate: 75, speakingPart3Rate: 50 }),
        score({ studentId: 'B2S', speakingLevel: 'B2', speakingPart1Rate: 20, speakingPart2Rate: 20, speakingPart3Rate: 20 }),
      ],
    });
    const speaking = result.approachingB2.skills.find((skill) => skill.skill === 'speaking');
    const b1 = speaking.groups.find((group) => group.level === 'B1');
    const plus = speaking.groups.find((group) => group.level === 'B1+');
    const combined = speaking.groups.find((group) => group.level === 'B1與B1+');

    expect(result.approachingB2.status).toBe('ready');
    expect(b1.count).toBe(1);
    expect(b1.parts.find((part) => part.part === 3)).toMatchObject({ meanRate: 40, weakest: true });
    expect(plus.count).toBe(1);
    expect(plus.parts.find((part) => part.part === 3).meanRate).toBe(50);
    expect(combined.count).toBe(2);
    expect(combined.parts.find((part) => part.part === 3).meanRate).toBe(45);
  });

  it('asks for one semester before describing a registration batch or a B1 group', () => {
    const result = buildPartDiagnostics({
      semester: 'all',
      registrations: [registration()],
      scores: [score()],
    });

    expect(result.preExam.status).toBe('needs_single_semester');
    expect(result.approachingB2.status).toBe('needs_single_semester');
    expect(result.history.semesters).toEqual(['114-1']);
  });
});
