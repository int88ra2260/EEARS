// models/index.js

const sequelize = require('../db');
const User = require('./User');
const Event = require('./Event');
const Reservation = require('./Reservation');
const BlackListRecord = require('./BlackListRecord');
const Settings = require('./Settings');
const SystemSettings = require('./SystemSettings');
const EventViolation = require('./EventViolation');
const EnglishTableSurveyResponse = require('./EnglishTableSurvey');
const EnglishClubSurveyResponse = require('./EnglishClubSurveyResponse');
const SurveySettings = require('./SurveySettings');
const Class = require('./Class');
const ClassMembership = require('./ClassMembership');
const Teacher = require('./Teacher');
const ClassTeacher = require('./ClassTeacher');
const EnglishTestRegistration = require('./EnglishTestRegistration');
const EnglishTestEmailVerification = require('./EnglishTestEmailVerification');
const EnglishTestFormSchema = require('./EnglishTestFormSchema');
const EnglishTestStudentIdCardRosterUpload = require('./EnglishTestStudentIdCardRosterUpload');
const EnglishTestStudentIdCardRosterEntry = require('./EnglishTestStudentIdCardRosterEntry');
const LearningPartnerTeam = require('./LearningPartnerTeam');
const LearningPartnerTeamMember = require('./LearningPartnerTeamMember');
const BestepAttendance = require('./BestepAttendance');
const BestepExamScore = require('./BestepExamScore');
const BestepExamSession = require('./BestepExamSession');
const BestepTeamRanking = require('./BestepTeamRanking');
// 英語學習歷程中心 legacy 英檢資料（Learning Journey legacy）
const EtSemester = require('./EtSemester');
const EtStudentMaster = require('./EtStudentMaster');
const EtCefrLevel = require('./EtCefrLevel');
const EtEnrollmentSnapshot = require('./EtEnrollmentSnapshot');
const EtExamAttempt = require('./EtExamAttempt');
const EtExamAttemptScore = require('./EtExamAttemptScore');
const EtExamAttemptSkillScore = require('./EtExamAttemptSkillScore');
const EtSemesterStudentBestSkill = require('./EtSemesterStudentBestSkill');
const EtAttemptImportHistory = require('./EtAttemptImportHistory');
const Announcement = require('./Announcement');
const AnnouncementRevision = require('./AnnouncementRevision');
const WeeklyReport = require('./WeeklyReport');
const WeeklyMedia = require('./WeeklyMedia');
const WeeklyInteractionEvent = require('./WeeklyInteractionEvent');
const SiteContentEntry = require('./SiteContentEntry');
const LearningResourceSite = require('./LearningResourceSite');
const LearningResourceMiniGame = require('./LearningResourceMiniGame');
const LearningResourceGuide = require('./LearningResourceGuide');
const RegulationsFormsGroup = require('./RegulationsFormsGroup');
const RegulationsFormsItem = require('./RegulationsFormsItem');
const ScrollWorldTestSegment = require('./ScrollWorldTestSegment');
const CourseGuideSection = require('./CourseGuideSection');
const CourseGuideTopic = require('./CourseGuideTopic');
const MediaAsset = require('./MediaAsset');
const AuditLog = require('./AuditLog');
const EmailLog = require('./EmailLog');
const EmailTemplateOverride = require('./EmailTemplateOverride');
const SystemLog = require('./SystemLog');
const Notification = require('./Notification');
const RolePermission = require('./RolePermission');
const UserPermissionOverride = require('./UserPermissionOverride');
const UserScope = require('./UserScope');
const Survey = require('./Survey');
const SurveyVersion = require('./SurveyVersion');
const SurveyRule = require('./SurveyRule');
const SurveyModuleResponse = require('./SurveyModuleResponse');
const SurveyResponse = require('./SurveyResponse');
const SurveyAdminAuditLog = require('./SurveyAdminAuditLog');
const Semester = require('./Semester');
const SurveyResponseAnswer = require('./SurveyResponseAnswer');
const SurveyRepairRun = require('./SurveyRepairRun');
const SurveyRepairRunItem = require('./SurveyRepairRunItem');
const SurveyAnswerMapping = require('./SurveyAnswerMapping');
const Student = require('./Student');
const StudentSemesterProfile = require('./StudentSemesterProfile');
const ExamRegistration = require('./ExamRegistration');
const ExamAttempt = require('./ExamAttempt');
const ExamAttemptSkillScore = require('./ExamAttemptSkillScore');
const ActivityParticipation = require('./ActivityParticipation');
const Course = require('./Course');
const CourseEnrollment = require('./CourseEnrollment');
const CourseOutcomeMapping = require('./CourseOutcomeMapping');
const MigrationBatch = require('./MigrationBatch');
const MigrationCheckpoint = require('./MigrationCheckpoint');
const MigrationQuarantine = require('./MigrationQuarantine');
const LearningJourneyImportHistory = require('./LearningJourneyImportHistory');
const LearningJourneyOperationRun = require('./LearningJourneyOperationRun');
const LearningTraceEvent = require('./LearningTraceEvent');
const LjStudentEvent = require('./LjStudentEvent');
const LjAnalyticStudent = require('./LjAnalyticStudent');
const LjAnalyticExam = require('./LjAnalyticExam');
const AnalyticsModelRun = require('./AnalyticsModelRun');
const ResourceEffectEstimate = require('./ResourceEffectEstimate');
const LearningGrowthEpisode = require('./LearningGrowthEpisode');
const StudentResourceExposure = require('./StudentResourceExposure');
const ResourceSkillProfile = require('./ResourceSkillProfile');
const LearningAnalyticsFilterReference = require('./LearningAnalyticsFilterReference');
const LearningAnalyticsLvaConfig = require('./LearningAnalyticsLvaConfig');
const JobRun = require('./JobRun');
const ImportRollbackManifest = require('./ImportRollbackManifest');
const EventWaitlistEntry = require('./EventWaitlistEntry');
const EnglishLearningPassport = require('./EnglishLearningPassport');
const EnglishLearningPointRule = require('./EnglishLearningPointRule');
const EnglishLearningSubmission = require('./EnglishLearningSubmission');
const EnglishLearningAttachment = require('./EnglishLearningAttachment');
const EnglishLearningAuditLog = require('./EnglishLearningAuditLog');
const EtGroupBandConfig = require('./EtGroupBandConfig');
const EtEventGroupPlan = require('./EtEventGroupPlan');
const EtEventGroupAssignment = require('./EtEventGroupAssignment');
const EtTaskTemplate = require('./EtTaskTemplate');
const EtTaskTemplateItem = require('./EtTaskTemplateItem');
const EtEventGroupLeader = require('./EtEventGroupLeader');
const EtLeaderPreference = require('./EtLeaderPreference');
const EtSessionTaskMark = require('./EtSessionTaskMark');

EnglishLearningPassport.hasMany(EnglishLearningSubmission, {
  foreignKey: 'passportId',
  onDelete: 'CASCADE',
  as: 'submissions',
});
EnglishLearningSubmission.belongsTo(EnglishLearningPassport, {
  foreignKey: 'passportId',
  as: 'passport',
});
EnglishLearningSubmission.hasMany(EnglishLearningAttachment, {
  foreignKey: 'submissionId',
  onDelete: 'CASCADE',
  as: 'attachments',
});
EnglishLearningAttachment.belongsTo(EnglishLearningSubmission, {
  foreignKey: 'submissionId',
  as: 'submission',
});

Survey.hasMany(SurveyVersion, { foreignKey: 'surveyId', onDelete: 'CASCADE' });
SurveyVersion.belongsTo(Survey, { foreignKey: 'surveyId' });
Survey.hasOne(SurveyRule, { foreignKey: 'surveyId', onDelete: 'CASCADE' });
SurveyRule.belongsTo(Survey, { foreignKey: 'surveyId' });
SurveyRule.belongsTo(Semester, { foreignKey: 'semesterId' });
SurveyRule.belongsTo(SurveyVersion, { foreignKey: 'surveyVersionId' });
SurveyModuleResponse.belongsTo(Survey, { foreignKey: 'surveyId', onDelete: 'CASCADE' });
SurveyModuleResponse.belongsTo(SurveyVersion, { foreignKey: 'surveyVersionId' });
SurveyModuleResponse.belongsTo(SurveyRule, { foreignKey: 'ruleId' });
SurveyModuleResponse.belongsTo(Semester, { foreignKey: 'semesterId' });
// 既有 DB 在不同環境可能有 signed/unsigned 差異，避免 sync 階段自動建立 FK 失敗
SurveyResponseAnswer.belongsTo(SurveyModuleResponse, { foreignKey: 'responseId', onDelete: 'CASCADE', constraints: false });
SurveyModuleResponse.hasMany(SurveyResponseAnswer, { foreignKey: 'responseId', onDelete: 'CASCADE', constraints: false });
SurveyRepairRun.hasMany(SurveyRepairRunItem, { foreignKey: 'runId', onDelete: 'CASCADE' });
SurveyRepairRunItem.belongsTo(SurveyRepairRun, { foreignKey: 'runId' });
SurveyAnswerMapping.belongsTo(Survey, { foreignKey: 'surveyId' });
SurveyAnswerMapping.belongsTo(SurveyVersion, { foreignKey: 'surveyVersionId' });

// 一個活動 (Event) 有多個預約 (Reservation)
// 明確指定表名，確保外鍵約束指向正確的表
Event.hasMany(Reservation, { 
  foreignKey: 'eventId', 
  onDelete: 'CASCADE',
  sourceKey: 'id'
});
Reservation.belongsTo(Event, { 
  foreignKey: 'eventId',
  targetKey: 'id'
});

Event.hasMany(EventWaitlistEntry, {
  foreignKey: 'eventId',
  onDelete: 'CASCADE',
  sourceKey: 'id',
});
EventWaitlistEntry.belongsTo(Event, { foreignKey: 'eventId', targetKey: 'id' });
EventWaitlistEntry.belongsTo(Reservation, {
  foreignKey: 'promotedReservationId',
  targetKey: 'id',
  as: 'promotedReservation',
});
Reservation.hasMany(EventWaitlistEntry, {
  foreignKey: 'promotedReservationId',
  sourceKey: 'id',
  as: 'promotedWaitlistEntries',
});

Event.hasOne(EtEventGroupPlan, { foreignKey: 'eventId', as: 'groupPlan', onDelete: 'CASCADE' });
EtEventGroupPlan.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });

Event.hasMany(EtEventGroupAssignment, { foreignKey: 'eventId', as: 'groupAssignments', onDelete: 'CASCADE' });
EtEventGroupAssignment.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
EtEventGroupAssignment.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });
Reservation.hasOne(EtEventGroupAssignment, { foreignKey: 'reservationId', as: 'groupAssignment' });
EtEventGroupAssignment.belongsTo(Teacher, { foreignKey: 'leaderTeacherId', as: 'leader' });

EtTaskTemplate.hasMany(EtTaskTemplateItem, { foreignKey: 'templateId', as: 'items', onDelete: 'CASCADE' });
EtTaskTemplateItem.belongsTo(EtTaskTemplate, { foreignKey: 'templateId', as: 'template' });

Event.hasMany(EtEventGroupLeader, { foreignKey: 'eventId', as: 'groupLeaders', onDelete: 'CASCADE' });
EtEventGroupLeader.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
EtEventGroupLeader.belongsTo(Teacher, { foreignKey: 'leaderTeacherId', as: 'leader' });

EtLeaderPreference.belongsTo(Teacher, { foreignKey: 'leaderTeacherId', as: 'leader' });
Teacher.hasMany(EtLeaderPreference, { foreignKey: 'leaderTeacherId', as: 'leaderPreferences' });

Event.hasMany(EtSessionTaskMark, { foreignKey: 'eventId', as: 'sessionTaskMarks', onDelete: 'CASCADE' });
EtSessionTaskMark.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
EtSessionTaskMark.belongsTo(Reservation, { foreignKey: 'reservationId', as: 'reservation' });
EtSessionTaskMark.belongsTo(EtTaskTemplateItem, { foreignKey: 'taskItemId', as: 'taskItem' });
EtSessionTaskMark.belongsTo(Teacher, { foreignKey: 'markedBy', as: 'marker' });

// 一個使用者 (User) 可能有多個預約(若有此需求)
User.hasMany(Reservation, { foreignKey: 'userId' });
Reservation.belongsTo(User, { foreignKey: 'userId' });

// 通知：一個使用者有多筆通知
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });

// BlackListRecord 與 User 的關聯(在 BlackListRecord.js 寫了)

// Class 與 ClassMembership 的關聯
Class.hasMany(ClassMembership, { foreignKey: 'classId', onDelete: 'CASCADE' });
ClassMembership.belongsTo(Class, { foreignKey: 'classId' });

// Teacher 與 Class 的關聯（多對多）
Teacher.belongsToMany(Class, { through: ClassTeacher, foreignKey: 'teacherId' });
Class.belongsToMany(Teacher, { through: ClassTeacher, foreignKey: 'classId' });

Teacher.hasMany(UserPermissionOverride, { foreignKey: 'userId', as: 'permissionOverrides', onDelete: 'CASCADE' });
UserPermissionOverride.belongsTo(Teacher, { foreignKey: 'userId', as: 'teacher' });

Teacher.hasMany(UserScope, { foreignKey: 'userId', as: 'scopeOverrides', onDelete: 'CASCADE' });
UserScope.belongsTo(Teacher, { foreignKey: 'userId', as: 'teacher' });

// LearningPartnerTeam 與 LearningPartnerTeamMember 的關聯
LearningPartnerTeam.hasMany(LearningPartnerTeamMember, { 
  foreignKey: 'teamId', 
  onDelete: 'CASCADE',
  as: 'members'
});
LearningPartnerTeamMember.belongsTo(LearningPartnerTeam, { 
  foreignKey: 'teamId',
  as: 'team'
});

// LearningPartnerTeamMember 與 EnglishTestRegistration 的關聯
LearningPartnerTeamMember.belongsTo(EnglishTestRegistration, {
  foreignKey: 'personalRegistrationId',
  as: 'personalRegistration'
});
EnglishTestRegistration.hasMany(LearningPartnerTeamMember, {
  foreignKey: 'personalRegistrationId',
  as: 'teamMemberships'
});

// BestepTeamRanking 與 LearningPartnerTeam 的關聯
BestepTeamRanking.belongsTo(LearningPartnerTeam, {
  foreignKey: 'teamId',
  as: 'team'
});
LearningPartnerTeam.hasMany(BestepTeamRanking, {
  foreignKey: 'teamId',
  as: 'rankings'
});

// 英語學習歷程中心 legacy 英檢資料關聯
EtSemester.hasMany(EtEnrollmentSnapshot, { foreignKey: 'semesterId' });
EtEnrollmentSnapshot.belongsTo(EtSemester, { foreignKey: 'semesterId' });
EtSemester.hasMany(EtSemesterStudentBestSkill, { foreignKey: 'semesterId' });
EtSemesterStudentBestSkill.belongsTo(EtSemester, { foreignKey: 'semesterId' });
EtExamAttempt.hasMany(EtExamAttemptScore, { foreignKey: 'attemptId', onDelete: 'CASCADE', as: 'scores' });
EtExamAttemptScore.belongsTo(EtExamAttempt, { foreignKey: 'attemptId', as: 'attempt' });
EtExamAttempt.hasMany(EtExamAttemptSkillScore, { foreignKey: 'attemptId', onDelete: 'CASCADE', as: 'skillScores' });
EtExamAttemptSkillScore.belongsTo(EtExamAttempt, { foreignKey: 'attemptId', as: 'attempt' });
EtExamAttempt.hasMany(EtSemesterStudentBestSkill, { foreignKey: 'attemptId' });
EtSemesterStudentBestSkill.belongsTo(EtExamAttempt, { foreignKey: 'attemptId', as: 'bestAttempt' });
EtSemester.hasMany(EtAttemptImportHistory, { foreignKey: 'semesterId' });
EtAttemptImportHistory.belongsTo(EtSemester, { foreignKey: 'semesterId' });

// Learning Journey System (LJS)
Student.hasMany(StudentSemesterProfile, { foreignKey: 'studentPk', as: 'semesterProfiles' });
StudentSemesterProfile.belongsTo(Student, { foreignKey: 'studentPk', as: 'student' });
Student.hasMany(ExamRegistration, { foreignKey: 'studentPk', as: 'examRegistrations' });
ExamRegistration.belongsTo(Student, { foreignKey: 'studentPk', as: 'student' });
Student.hasMany(ExamAttempt, { foreignKey: 'studentPk', as: 'examAttempts' });
ExamAttempt.belongsTo(Student, { foreignKey: 'studentPk', as: 'student' });
ExamRegistration.hasMany(ExamAttempt, { foreignKey: 'registrationId', as: 'attempts' });
ExamAttempt.belongsTo(ExamRegistration, { foreignKey: 'registrationId', as: 'registration' });
ExamAttempt.hasMany(ExamAttemptSkillScore, { foreignKey: 'attemptId', onDelete: 'CASCADE', as: 'skillScores' });
ExamAttemptSkillScore.belongsTo(ExamAttempt, { foreignKey: 'attemptId', as: 'attempt' });
Student.hasMany(ActivityParticipation, { foreignKey: 'studentPk', as: 'activityParticipations' });
ActivityParticipation.belongsTo(Student, { foreignKey: 'studentPk', as: 'student' });
Student.hasMany(CourseEnrollment, { foreignKey: 'studentPk', as: 'courseEnrollments' });
CourseEnrollment.belongsTo(Student, { foreignKey: 'studentPk', as: 'student' });
Course.hasMany(CourseEnrollment, { foreignKey: 'courseId', as: 'enrollments', onDelete: 'CASCADE' });
CourseEnrollment.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Course.hasMany(CourseOutcomeMapping, { foreignKey: 'courseId', as: 'outcomeMappings', onDelete: 'CASCADE' });
CourseOutcomeMapping.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
MigrationBatch.hasMany(MigrationCheckpoint, { foreignKey: 'batchId', as: 'checkpoints' });
MigrationCheckpoint.belongsTo(MigrationBatch, { foreignKey: 'batchId', as: 'batch' });
MigrationBatch.hasMany(MigrationQuarantine, { foreignKey: 'batchId', as: 'quarantinedRecords' });
MigrationQuarantine.belongsTo(MigrationBatch, { foreignKey: 'batchId', as: 'batch' });

Announcement.hasMany(AnnouncementRevision, {
  foreignKey: 'announcementId',
  as: 'revisions',
  onDelete: 'CASCADE',
});
AnnouncementRevision.belongsTo(Announcement, { foreignKey: 'announcementId' });

CourseGuideSection.hasMany(CourseGuideTopic, {
  foreignKey: 'sectionId',
  as: 'topics',
  onDelete: 'CASCADE',
});
CourseGuideTopic.belongsTo(CourseGuideSection, {
  foreignKey: 'sectionId',
  as: 'section',
});

module.exports = {
  sequelize,
  User,
  Event,
  Reservation,
  BlackListRecord,
  Settings,
  SystemSettings,
  EventViolation,
  EnglishTableSurveyResponse,
  EnglishClubSurveyResponse,
  SurveySettings,
  Class,
  ClassMembership,
  Teacher,
  ClassTeacher,
  EnglishTestRegistration,
  EnglishTestEmailVerification,
  EnglishTestFormSchema,
  EnglishTestStudentIdCardRosterUpload,
  EnglishTestStudentIdCardRosterEntry,
  LearningPartnerTeam,
  LearningPartnerTeamMember,
  BestepAttendance,
  BestepExamScore,
  BestepExamSession,
  BestepTeamRanking,
  EtSemester,
  EtStudentMaster,
  EtCefrLevel,
  EtEnrollmentSnapshot,
  EtExamAttempt,
  EtExamAttemptScore,
  EtExamAttemptSkillScore,
  EtSemesterStudentBestSkill,
  EtAttemptImportHistory,
  Announcement,
  AnnouncementRevision,
  WeeklyReport,
  WeeklyMedia,
  WeeklyInteractionEvent,
  SiteContentEntry,
  LearningResourceSite,
  LearningResourceMiniGame,
  LearningResourceGuide,
  RegulationsFormsGroup,
  RegulationsFormsItem,
  ScrollWorldTestSegment,
  CourseGuideSection,
  CourseGuideTopic,
  MediaAsset,
  AuditLog,
  EmailLog,
  EmailTemplateOverride,
  SystemLog,
  Notification,
  RolePermission,
  UserPermissionOverride,
  UserScope,
  Survey,
  SurveyVersion,
  SurveyRule,
  SurveyModuleResponse,
  SurveyResponse,
  SurveyAdminAuditLog,
  Semester,
  SurveyResponseAnswer,
  SurveyRepairRun,
  SurveyRepairRunItem,
  SurveyAnswerMapping,
  Student,
  StudentSemesterProfile,
  ExamRegistration,
  ExamAttempt,
  ExamAttemptSkillScore,
  ActivityParticipation,
  Course,
  CourseEnrollment,
  CourseOutcomeMapping,
  MigrationBatch,
  MigrationCheckpoint,
  MigrationQuarantine,
  LearningJourneyImportHistory,
  LearningJourneyOperationRun,
  LearningTraceEvent,
  LjStudentEvent,
  LjAnalyticStudent,
  LjAnalyticExam,
  AnalyticsModelRun,
  ResourceEffectEstimate,
  LearningGrowthEpisode,
  StudentResourceExposure,
  ResourceSkillProfile,
  LearningAnalyticsFilterReference,
  LearningAnalyticsLvaConfig,
  JobRun,
  ImportRollbackManifest,
  EventWaitlistEntry,
  EnglishLearningPassport,
  EnglishLearningPointRule,
  EnglishLearningSubmission,
  EnglishLearningAttachment,
  EnglishLearningAuditLog,
  EtGroupBandConfig,
  EtEventGroupPlan,
  EtEventGroupAssignment,
  EtTaskTemplate,
  EtTaskTemplateItem,
  EtEventGroupLeader,
  EtLeaderPreference,
  EtSessionTaskMark,
};
