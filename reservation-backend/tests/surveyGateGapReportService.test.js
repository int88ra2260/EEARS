jest.mock('../services/surveyGateService', () => ({
  EVENT_TYPE_TO_SURVEY_KEY: {
    'English Table': 'english_table_feedback_114_1',
    'English Club': 'english_club_feedback_114_1',
  },
  resolveGateContext: jest.fn(),
  hasCompletedForGateWithSemester: jest.fn(),
  ruleTimeAllows: jest.fn(() => ({ ok: true })),
}));

jest.mock('../models', () => ({
  Reservation: { findAll: jest.fn() },
  Event: { count: jest.fn() },
  Semester: { findByPk: jest.fn() },
  SurveySettings: { findAll: jest.fn() },
}));

const surveyGateService = require('../services/surveyGateService');
const { Reservation, Event, Semester } = require('../models');
const { listSurveyGateGaps } = require('../services/surveyGateGapReportService');

const productRule = {
  isEnabled: true,
  isRequired: true,
  retakePolicy: 'once_ever',
  startDate: null,
  endDate: null,
};

const productCtx = {
  mode: 'product',
  survey: { id: 1, surveyKey: 'english_table_feedback_114_1' },
  rule: productRule,
  surveyKey: 'english_table_feedback_114_1',
};

function reservationRow({ studentId, name, email, eventId, eventType, eventName }) {
  return {
    id: Math.random(),
    studentId,
    studentName: name,
    studentEmail: email,
    timestamp: new Date('2026-05-01T10:00:00Z'),
    eventId,
    Event: {
      id: eventId,
      name: eventName || 'ET Session',
      date: '2026-05-10',
      eventType,
      semesterId: 3,
    },
  };
}

describe('surveyGateGapReportService.listSurveyGateGaps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Semester.findByPk.mockResolvedValue({ id: 3, code: '114-2' });
    Event.count.mockResolvedValue(0);
    surveyGateService.resolveGateContext.mockResolvedValue(productCtx);
  });

  it('未完成問卷者出現在 gaps', async () => {
    surveyGateService.hasCompletedForGateWithSemester.mockResolvedValue(false);
    Reservation.findAll.mockResolvedValue([
      reservationRow({
        studentId: 'B111111111',
        name: '未填',
        email: 'gap@nsysu.edu.tw',
        eventId: 10,
        eventType: 'English Table',
      }),
    ]);

    const data = await listSurveyGateGaps({
      semesterId: 3,
      activityType: 'ET',
    });

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].studentId).toBe('B111111111');
    expect(data.meta.gateActive).toBe(true);
  });

  it('已完成問卷者不出現', async () => {
    surveyGateService.hasCompletedForGateWithSemester.mockResolvedValue(true);
    Reservation.findAll.mockResolvedValue([
      reservationRow({
        studentId: 'B222222222',
        name: '已填',
        email: 'done@nsysu.edu.tw',
        eventId: 11,
        eventType: 'English Table',
      }),
    ]);

    const data = await listSurveyGateGaps({ semesterId: 3, activityType: 'ET' });
    expect(data.rows).toHaveLength(0);
    expect(data.summary.gapCount).toBe(0);
  });

  it('rule disabled 時回傳空 rows 與 reason', async () => {
    surveyGateService.resolveGateContext.mockResolvedValue({
      ...productCtx,
      rule: { ...productRule, isEnabled: false },
    });

    const data = await listSurveyGateGaps({ semesterId: 3, activityType: 'ET' });
    expect(data.rows).toHaveLength(0);
    expect(data.meta.reason).toBe('rule_disabled');
    expect(data.meta.gateActive).toBe(false);
    expect(Reservation.findAll).not.toHaveBeenCalled();
  });

  it('rule not required 時回傳空 rows', async () => {
    surveyGateService.resolveGateContext.mockResolvedValue({
      ...productCtx,
      rule: { ...productRule, isRequired: false },
    });

    const data = await listSurveyGateGaps({ semesterId: 3, activityType: 'ET' });
    expect(data.rows).toHaveLength(0);
    expect(data.meta.reason).toBe('rule_not_required');
  });

  it('activityType=ET 只查 English Table', async () => {
    surveyGateService.hasCompletedForGateWithSemester.mockResolvedValue(false);
    Reservation.findAll.mockResolvedValue([]);

    await listSurveyGateGaps({ semesterId: 3, activityType: 'ET' });

    expect(surveyGateService.resolveGateContext).toHaveBeenCalledWith('English Table');
    expect(Reservation.findAll).toHaveBeenCalled();
    const eventWhere = Reservation.findAll.mock.calls[0][0].include[0].where;
    expect(eventWhere.eventType).toBe('English Table');
  });

  it('activityType=EC 只查 English Club', async () => {
    surveyGateService.resolveGateContext.mockResolvedValue({
      mode: 'product',
      survey: { id: 2, surveyKey: 'english_club_feedback_114_1' },
      rule: productRule,
      surveyKey: 'english_club_feedback_114_1',
    });
    Reservation.findAll.mockResolvedValue([]);

    await listSurveyGateGaps({ semesterId: 3, activityType: 'EC' });

    expect(surveyGateService.resolveGateContext).toHaveBeenCalledWith('English Club');
    const eventWhere = Reservation.findAll.mock.calls[0][0].include[0].where;
    expect(eventWhere.eventType).toBe('English Club');
  });

  it('列表 Email 遮罩', async () => {
    surveyGateService.hasCompletedForGateWithSemester.mockResolvedValue(false);
    Reservation.findAll.mockResolvedValue([
      reservationRow({
        studentId: 'B333333333',
        name: '測試',
        email: 'alice@student.nsysu.edu.tw',
        eventId: 12,
        eventType: 'English Table',
      }),
    ]);

    const data = await listSurveyGateGaps({ semesterId: 3, activityType: 'ET' });
    expect(data.rows[0].studentEmail).toMatch(/\*\*\*/);
    expect(data.rows[0].studentEmail).not.toBe('alice@student.nsysu.edu.tw');
    expect(data.rows[0].studentEmailMasked).toBe(true);
  });

  it('匯出模式 Email 完整', async () => {
    surveyGateService.hasCompletedForGateWithSemester.mockResolvedValue(false);
    Reservation.findAll.mockResolvedValue([
      reservationRow({
        studentId: 'B444444444',
        name: '匯出',
        email: 'export@student.nsysu.edu.tw',
        eventId: 13,
        eventType: 'English Table',
      }),
    ]);

    const data = await listSurveyGateGaps({
      semesterId: 3,
      activityType: 'ET',
      __forExport: true,
    });
    expect(data.rows[0].studentEmail).toBe('export@student.nsysu.edu.tw');
    expect(data.rows[0].studentEmailMasked).toBe(false);
  });

  it('semesterId 為 null 的活動計入 meta.warnings', async () => {
    Event.count.mockResolvedValue(2);
    Reservation.findAll.mockResolvedValue([]);

    const data = await listSurveyGateGaps({ semesterId: 3, activityType: 'ET' });
    expect(data.meta.warnings.some((w) => w.includes('semesterId 為 null'))).toBe(true);
    expect(Event.count).toHaveBeenCalledWith({
      where: { eventType: 'English Table', semesterId: null },
    });
  });
});
