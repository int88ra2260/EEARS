/**
 * 與後端 semester 工具一致；請優先使用 semesterUtils。
 */
export {
  getCurrentSemester,
  getPreviousSemester,
  getDefaultLearningPartnerOpsSemester,
  isValidSemester,
  semesterIdFromDate,
  SEMESTER_RANGES,
  SEMESTER_ORDER,
} from './semesterUtils';
