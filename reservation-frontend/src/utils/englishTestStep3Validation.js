// 步驟三表單驗證：成績格式、B2 等級、整體表單

export function validateScoreFormat(examType, score, skill) {
  if (!examType || !score) return { isValid: true, error: null };

  const scoreStr = String(score).trim();
  const scoreStrUpper = scoreStr.toUpperCase();

  switch (examType) {
    case 'TOEIC Listening & Reading':
      if (skill === 'listening' || skill === 'reading') {
        const numScore = parseFloat(score);
        if (isNaN(numScore)) {
          return { isValid: false, error: '請輸入有效的數字' };
        }
        if (!Number.isInteger(numScore)) {
          return { isValid: false, error: '多益聽讀成績必須為整數' };
        }
        if (numScore < 10 || numScore > 495) {
          return { isValid: false, error: '多益聽讀成績範圍為 10-495 分' };
        }
      }
      return { isValid: true, error: null };

    case 'TOEIC Speaking & Writing':
      if (skill === 'speaking' || skill === 'writing') {
        const numScore = parseFloat(score);
        if (isNaN(numScore)) {
          return { isValid: false, error: '請輸入有效的數字' };
        }
        if (!Number.isInteger(numScore)) {
          return { isValid: false, error: '多益說寫成績必須為整數' };
        }
        if (numScore < 0 || numScore > 200) {
          return { isValid: false, error: '多益說寫成績範圍為 0-200 分' };
        }
      }
      return { isValid: true, error: null };

    case 'IELTS': {
      const ieltsScore = parseFloat(score);
      if (isNaN(ieltsScore)) {
        return { isValid: false, error: '請輸入有效的數字' };
      }
      if (ieltsScore < 0 || ieltsScore > 9) {
        return { isValid: false, error: 'IELTS 成績範圍為 0-9 分' };
      }
      const decimalPart = ieltsScore % 1;
      if (decimalPart !== 0 && decimalPart !== 0.5) {
        return { isValid: false, error: 'IELTS 成績必須為整數或半數（如 5.0, 5.5, 6.0, 6.5）' };
      }
      return { isValid: true, error: null };
    }

    case 'TOEFL': {
      const toeflScore = parseFloat(score);
      if (isNaN(toeflScore)) {
        return { isValid: false, error: '請輸入有效的數字' };
      }
      if (!Number.isInteger(toeflScore)) {
        return { isValid: false, error: 'TOEFL 成績必須為整數' };
      }
      if (toeflScore < 0 || toeflScore > 30) {
        return { isValid: false, error: 'TOEFL 成績範圍為 0-30 分' };
      }
      return { isValid: true, error: null };
    }

    case 'GEPT': {
      const validGeptLevels = ['中高級', '高級', '優級'];
      if (validGeptLevels.includes(scoreStr)) {
        return { isValid: true, error: null };
      }
      return { isValid: false, error: 'GEPT 成績格式僅接受「中高級」、「高級」、「優級」，不接受數字格式' };
    }

    case 'BESTEP': {
      const bestepScore = parseFloat(score);
      if (isNaN(bestepScore)) {
        return { isValid: false, error: '請輸入有效的數字' };
      }
      if (!Number.isInteger(bestepScore)) {
        return { isValid: false, error: 'BESTEP 成績必須為整數' };
      }
      if (skill === 'listening' || skill === 'reading') {
        if (bestepScore < 100) {
          return { isValid: false, error: 'BESTEP 聽力/閱讀成績範圍為 0-140 分' };
        }
      } else if (skill === 'speaking' || skill === 'writing') {
        if (bestepScore < 0 || bestepScore > 360) {
          return { isValid: false, error: 'BESTEP 口說/寫作成績範圍為 280-360 分' };
        }
      }
      return { isValid: true, error: null };
    }

    case 'FLPT':
      if (skill === 'listening' || skill === 'reading') {
        const flptScore = parseFloat(score);
        if (isNaN(flptScore)) {
          return { isValid: false, error: '請輸入有效的數字' };
        }
        if (!Number.isInteger(flptScore)) {
          return { isValid: false, error: 'FLPT 聽力/閱讀成績必須為整數' };
        }
        if (flptScore < 195 || flptScore > 300) {
          return { isValid: false, error: 'FLPT 聽力/閱讀成績範圍為 195-300 分' };
        }
      } else if (skill === 'speaking') {
        const validLevels = ['S-2+', 'S-3', 'S-3+', 'S-4', 'S-4+', 'S-5'];
        if (!validLevels.includes(scoreStrUpper)) {
          return { isValid: false, error: 'FLPT 口說成績格式為：S-2+, S-3, S-3+, S-4, S-4+, S-5' };
        }
      } else if (skill === 'writing') {
        if (scoreStrUpper !== 'B+' && scoreStrUpper !== 'A') {
          return { isValid: false, error: 'FLPT 寫作成績格式為：B+ 或 A' };
        }
      }
      return { isValid: true, error: null };

    case 'Cambridge Assessment English': {
      const cambridgeScore = parseFloat(score);
      if (isNaN(cambridgeScore)) {
        return { isValid: false, error: '請輸入有效的數字' };
      }
      if (!Number.isInteger(cambridgeScore)) {
        return { isValid: false, error: 'Cambridge 成績必須為整數' };
      }
      if (cambridgeScore < 160 || cambridgeScore > 230) {
        return { isValid: false, error: 'Cambridge 成績範圍為 160-230 分' };
      }
      return { isValid: true, error: null };
    }

    default:
      return { isValid: true, error: null };
  }
}

export function checkB2Level(examType, score, skill) {
  if (!examType || !score) return null;

  const scoreStr = String(score).trim().toUpperCase();

  switch (examType) {
    case 'TOEIC Listening & Reading':
      if (skill === 'listening') {
        const numScore = parseFloat(score);
        return !isNaN(numScore) && numScore >= 400;
      }
      if (skill === 'reading') {
        const numScore = parseFloat(score);
        return !isNaN(numScore) && numScore >= 385;
      }
      return null;

    case 'TOEIC Speaking & Writing':
      if (skill === 'speaking') {
        const numScore = parseFloat(score);
        return !isNaN(numScore) && numScore >= 160;
      }
      if (skill === 'writing') {
        const numScore = parseFloat(score);
        return !isNaN(numScore) && numScore >= 150;
      }
      return null;

    case 'IELTS': {
      const ieltsScore = parseFloat(score);
      return !isNaN(ieltsScore) && ieltsScore >= 5.5;
    }

    case 'TOEFL': {
      const toeflScore = parseFloat(score);
      if (isNaN(toeflScore)) return null;
      if (skill === 'listening') return toeflScore >= 17;
      if (skill === 'reading') return toeflScore >= 18;
      if (skill === 'speaking') return toeflScore >= 20;
      if (skill === 'writing') return toeflScore >= 17;
      return null;
    }

    case 'GEPT': {
      const geptLevels = ['中高級', '高級', '優級'];
      return geptLevels.includes(scoreStr);
    }

    case 'BESTEP': {
      const bestepScore = parseFloat(score);
      if (isNaN(bestepScore)) return null;
      if (skill === 'listening' || skill === 'reading') {
        return bestepScore >= 100;
      }
      if (skill === 'speaking' || skill === 'writing') {
        return bestepScore >= 280;
      }
      return null;
    }

    case 'FLPT':
      if (skill === 'listening' || skill === 'reading') {
        const flptScore = parseFloat(score);
        return !isNaN(flptScore) && flptScore >= 195;
      }
      if (skill === 'speaking') {
        const validLevels = ['S-2+', 'S-3', 'S-3+', 'S-4', 'S-4+', 'S-5'];
        if (validLevels.includes(scoreStr)) {
          return true;
        }
        if (scoreStr.includes('S-2+') || scoreStr.includes('S-3+') || scoreStr.includes('S-4+')) {
          return true;
        }
        if ((scoreStr.includes('S-3') && !scoreStr.includes('S-3+')) ||
            (scoreStr.includes('S-4') && !scoreStr.includes('S-4+')) ||
            scoreStr.includes('S-5')) {
          return true;
        }
        return false;
      }
      if (skill === 'writing') {
        return scoreStr === 'B+' || scoreStr === 'A';
      }
      return null;

    case 'Cambridge Assessment English': {
      const cambridgeScore = parseFloat(score);
      return !isNaN(cambridgeScore) && cambridgeScore >= 160;
    }

    default:
      return null;
  }
}

export function validateEnglishTestStep3Form(formData) {
  const newErrors = {};
  const errorOrder = [];

  if (!formData.examType) {
    newErrors.examType = '請選擇報考項目';
    errorOrder.push('examType');
  }

  if (formData.hasCEFRB2 === '') {
    newErrors.hasCEFRB2 = '請選擇是否曾取得 CEFR B2 以上成績';
    errorOrder.push('hasCEFRB2');
  }

  if (formData.examType === 'NON' && formData.hasCEFRB2 === '否') {
    return {
      isValid: Object.keys(newErrors).length === 0,
      firstErrorField: errorOrder.length > 0 ? errorOrder[0] : null,
      shouldExit: true,
      errors: newErrors,
    };
  }

  if (formData.hasCEFRB2 === '是') {
    const hasAnyScore = formData.listeningExamType || formData.readingExamType ||
                        formData.speakingExamType || formData.writingExamType;

    if (!hasAnyScore) {
      newErrors.listeningExamType = '請至少填寫一項成績';
      errorOrder.push('listeningExamType');
    } else {
      if (formData.listeningExamType && !formData.listeningScore) {
        newErrors.listeningScore = '請填寫聽力成績';
        if (!errorOrder.includes('listeningScore')) errorOrder.push('listeningScore');
      } else if (formData.listeningExamType && formData.listeningScore) {
        const formatCheck = validateScoreFormat(formData.listeningExamType, formData.listeningScore, 'listening');
        if (!formatCheck.isValid) {
          newErrors.listeningScore = formatCheck.error;
          if (!errorOrder.includes('listeningScore')) errorOrder.push('listeningScore');
        }
      }

      if (formData.readingExamType && !formData.readingScore) {
        newErrors.readingScore = '請填寫閱讀成績';
        if (!errorOrder.includes('readingScore')) errorOrder.push('readingScore');
      } else if (formData.readingExamType && formData.readingScore) {
        const formatCheck = validateScoreFormat(formData.readingExamType, formData.readingScore, 'reading');
        if (!formatCheck.isValid) {
          newErrors.readingScore = formatCheck.error;
          if (!errorOrder.includes('readingScore')) errorOrder.push('readingScore');
        }
      }

      if (formData.speakingExamType && !formData.speakingScore) {
        newErrors.speakingScore = '請填寫口說成績';
        if (!errorOrder.includes('speakingScore')) errorOrder.push('speakingScore');
      } else if (formData.speakingExamType && formData.speakingScore) {
        const formatCheck = validateScoreFormat(formData.speakingExamType, formData.speakingScore, 'speaking');
        if (!formatCheck.isValid) {
          newErrors.speakingScore = formatCheck.error;
          if (!errorOrder.includes('speakingScore')) errorOrder.push('speakingScore');
        }
      }

      if (formData.writingExamType && !formData.writingScore) {
        newErrors.writingScore = '請填寫寫作成績';
        if (!errorOrder.includes('writingScore')) errorOrder.push('writingScore');
      } else if (formData.writingExamType && formData.writingScore) {
        const formatCheck = validateScoreFormat(formData.writingExamType, formData.writingScore, 'writing');
        if (!formatCheck.isValid) {
          newErrors.writingScore = formatCheck.error;
          if (!errorOrder.includes('writingScore')) errorOrder.push('writingScore');
        }
      }
    }
  }

  if (formData.hasCEFRB2 === '是' && (!formData.b2CertificateFiles || formData.b2CertificateFiles.length === 0)) {
    newErrors.b2CertificateFiles = '請上傳 B2 成績證明';
    errorOrder.push('b2CertificateFiles');
  }

  return {
    isValid: Object.keys(newErrors).length === 0,
    firstErrorField: errorOrder.length > 0 ? errorOrder[0] : null,
    shouldExit: false,
    errors: newErrors,
  };
}
