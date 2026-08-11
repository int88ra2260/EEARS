// config/email.js
const nodemailer = require('nodemailer');
const { EVENT_TYPES } = require('../constants/eventTypes');
require('dotenv').config();

// 雙 Transporter 架構：分別處理活動預約和培力英檢郵件
let reservationTransporter = null;  // 活動預約相關郵件
let bestepTransporter = null;       // 培力英檢報名相關郵件

// 培力英檢相關郵件模板列表（審核中/請修正/報名成功/報名失敗/修改通知/學習有伴/團體推廣）
const BESTEP_EMAIL_TEMPLATES = [
  'englishTestRegistrationSuccess',
  'englishTestRegistrationRejected',
  'englishTestRegistrationUpdated',
  'englishTestRegistrationModificationComplete',
  'englishTestRegistrationFinalSuccess',
  'englishTestRegistrationFinalFailure',
  'englishTestRegistrationGroupPromo',
  'englishTestEmailVerification',
  'learningPartnerInvitation',
  'learningPartnerInvitationResend',
  'learningPartnerAllApproved',
  'learningPartnerCancelled',
  'learningPartnerExpired'
];

// 活動預約相關郵件配置
if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  // 移除密碼中的空格（應用程式密碼格式）
  const reservationPass = (process.env.GMAIL_PASS || '').replace(/\s+/g, '');
  reservationTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: reservationPass
    }
  });
  console.log('✅ 活動預約郵件服務已配置:', process.env.GMAIL_USER);
} else {
  console.warn('⚠️ 活動預約郵件認證資訊未設定');
  console.warn('請在 .env 檔案中設定 GMAIL_USER 和 GMAIL_PASS');
}

// 培力英檢相關郵件配置
if (process.env.BESTEP_GMAIL_USER && process.env.BESTEP_GMAIL_PASS) {
  // 移除密碼中的空格（應用程式密碼格式）
  const bestepPass = (process.env.BESTEP_GMAIL_PASS || '').replace(/\s+/g, '');
  bestepTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.BESTEP_GMAIL_USER,
      pass: bestepPass
    }
  });
  console.log('✅ 培力英檢郵件服務已配置:', process.env.BESTEP_GMAIL_USER);
} else {
  console.warn('⚠️ 培力英檢郵件認證資訊未設定');
  console.warn('請在 .env 檔案中設定 BESTEP_GMAIL_USER 和 BESTEP_GMAIL_PASS');
  // 如果未設定培力英檢專用帳號，回退使用活動預約帳號
  if (reservationTransporter) {
    bestepTransporter = reservationTransporter;
    console.log('⚠️ 培力英檢郵件將使用活動預約郵件帳號作為備用');
  }
}

// 向後兼容：保留舊的 transporter 變數（指向活動預約 transporter）
const transporter = reservationTransporter;

// 培力英檢報名狀態對應（統一使用）
const BESTEP_STATUS_MAP = {
  'pending': { zh: '審核中', en: 'Under Review' },
  'approved': { zh: '已通過', en: 'Approved' },
  'revision': { zh: '請修正', en: 'Revision Required' },
  'success': { zh: '報名成功', en: 'Registration Success' },
  'failed': { zh: '報名失敗', en: 'Registration Failed' }
};

// 培力英檢報考項目對應（統一使用）
const BESTEP_EXAM_TYPE_MAP = {
  'LRSW': { zh: '聽說讀寫', en: 'Listening, Reading, Speaking, Writing' },
  'LR': { zh: '聽讀', en: 'Listening, Reading' },
  'SW': { zh: '說寫', en: 'Speaking, Writing' },
  'NON': { zh: '不報考', en: 'Not Taking Exam' }
};

// 根據活動類型取得客製化內容
const getActivitySpecificContent = (eventType, startTime) => {
  // 計算報到時間（活動開始前十分鐘）
  const calculateCheckInTime = (startTime) => {
    if (!startTime) return '12:10'; // 預設值
    
    const [hours, minutes] = startTime.split(':').map(Number);
    let checkInMinutes = minutes - 10;
    let checkInHours = hours;
    
    if (checkInMinutes < 0) {
      checkInMinutes += 60;
      checkInHours -= 1;
    }
    
    return `${checkInHours.toString().padStart(2, '0')}:${checkInMinutes.toString().padStart(2, '0')}`;
  };

  const checkInTime = calculateCheckInTime(startTime);
  
  switch (eventType) {
    case EVENT_TYPES.ENGLISH_TABLE:
      return {
        subjectPrefix: '[English Table]',
        chineseDescription: 'English Table',
        englishDescription: 'English Table',
        checkInTime: checkInTime,
        chineseReminder: `提醒您：逾時參加(12:20以後)等同遲到，遲到視為違規行為;違規達兩次以上，系統會自動將學生列入黑名單，敬請留意。`,
        englishReminder: `Reminder: Attending after 12:20 will be regarded as being late, and lateness will be treated as a violation. Students with two or more violations in the same semester will automatically be placed on the blacklist by the system. Please take note.`,
        //chineseAdditionalInfo: '請準備好您的英語能力，與國際學生進行輕鬆的英語對話交流！',
        //englishAdditionalInfo: 'Please be ready to engage in casual English conversations with international students!'
      };
    case EVENT_TYPES.JOB_TALK:
      return {
        subjectPrefix: '[Job Talk]',
        chineseDescription: 'Job Talk',
        englishDescription: 'Job Talk',
        checkInTime: checkInTime,
        chineseReminder: `提醒您：逾時參加(活動開始5分鐘後)等同遲到，遲到視為違規行為;違規達兩次以上，系統會自動將學生列入黑名單，敬請留意。`,
        englishReminder: `Reminder: Reminder: 5 minutes after the start of any activities will be regarded as being late, and lateness will be treated as a violatiEMI Teaching Excellence.`,
        //chineseAdditionalInfo: '建議您準備相關問題，與講者進行互動交流，獲得寶貴的職涯建議！',
        //englishAdditionalInfo: 'We recommend preparing relevant questions to interact with the speaker and gain valuable career advice!'
      };
    case EVENT_TYPES.ENGLISH_CLUB:
      return {
        subjectPrefix: '[English Club]',
        chineseDescription: 'English Club',
        englishDescription: 'English Club',
        checkInTime: checkInTime,
        chineseReminder: `提醒您：逾時參加(活動開始5分鐘後)等同遲到，遲到視為違規行為;違規達兩次以上，系統會自動將學生列入黑名單，敬請留意。`,
        englishReminder: `Reminder: Reminder: 5 minutes after the start of any activities will be regarded as being late, and lateness will be treated as a violatiEMI Teaching Excellence.`,
        //chineseAdditionalInfo: '歡迎參與我們的英語俱樂部活動，享受輕鬆愉快的英語學習環境！',
        //englishAdditionalInfo: 'Welcome to our English Club activities and enjoy a relaxed English learning environment!'
      };
    case EVENT_TYPES.INTERNATIONAL_FORUM:
      return {
        subjectPrefix: '[International Forum]',
        chineseDescription: 'International Forum',
        englishDescription: 'International Forum',
        checkInTime: checkInTime,
        chineseReminder: `提醒您：逾時參加(活動開始5分鐘後)等同遲到，遲到視為違規行為;違規達兩次以上，系統會自動將學生列入黑名單，敬請留意。`,
        englishReminder: `Reminder: Reminder: 5 minutes after the start of any activities will be regarded as being late, and lateness will be treated as a violatiEMI Teaching Excellence.`,
        //chineseAdditionalInfo: '這是一個高層次的國際議題討論平台，請準備好您的觀點與國際學生進行深度交流！',
        //englishAdditionalInfo: 'This is a high-level international discussion platform. Please prepare your perspectives for in-depth exchanges with international students!'
      };
    default:
      return {
        subjectPrefix: '[活動]',
        chineseDescription: '活動',
        englishDescription: 'Activity',
        checkInTime: checkInTime,
        chineseReminder: `提醒您：逾時參加(活動開始5分鐘後)等同遲到，遲到視為違規行為;違規達兩次以上，系統會自動將學生列入黑名單，敬請留意。`,
        englishReminder: `Reminder: Reminder: 5 minutes after the start of any activities will be regarded as being late, and lateness will be treated as a violatiEMI Teaching Excellence.`,
        chineseAdditionalInfo: '感謝您的參與！',
        englishAdditionalInfo: 'Thank you for your participation!'
      };
  }
};

const getEventLocationForEmail = (data = {}) => {
  const location = typeof data.location === 'string' ? data.location.trim() : '';
  return {
    zh: location || '地點待公告',
    en: location || 'To be announced',
  };
};

// 郵件模板
const emailTemplates = {
  // 預約成功通知
  reservationSuccess: (data) => {
    const activityInfo = getActivitySpecificContent(data.eventType, data.startTime);
    const eventLocation = getEventLocationForEmail(data);
    return {
      from: process.env.GMAIL_USER || "siwansalon@gmail.com", // 活動預約郵件帳號
      to: data.studentEmail,
      subject: `${activityInfo.subjectPrefix} 活動預約成功通知`,
      text: `
親愛的 ${data.studentName} (${data.studentId}) 您好，

已成功預約${activityInfo.chineseDescription}：「${data.eventName}」
日期：${data.date}
時間：${data.startTime} - ${data.endTime}
地點：${eventLocation.zh}

【重要通知】活動規定修改：114-1學期起不再提供活動補蓋章服務，請同學們務必準時參加活動。

【取消預約驗證碼】
如需取消此預約，請使用以下驗證碼：
驗證碼：${data.cancellationCode || 'N/A'}

請妥善保管此驗證碼，取消預約時需要輸入此驗證碼才能完成取消。

${activityInfo.chineseReminder}

若有任何問題請聯繫:
全英語卓越教學中心 (Center for EMI Teaching Excellence)
Email: emicenter@mail.nsysu.edu.tw
電話: (07)5252000#5808

祝您有美好的一天！

Dear ${data.studentName} (${data.studentId}),

Your reservation for ${activityInfo.englishDescription} has been confirmed:
Activity: 「${data.eventName}」
Date: ${data.date}
Time: ${data.startTime} - ${data.endTime}
Location: ${eventLocation.en}

[Important Notice] Policy Update: Starting from Semester 114-1, make-up stamping services for activities will no longer be provided. Please ensure you attend activities on time.

[Cancellation Code]
If you need to cancel this reservation, please use the following verification code:
Verification Code: ${data.cancellationCode || 'N/A'}

Please keep this code safe. You will need to enter this code when canceling your reservation.

${activityInfo.englishReminder}

If you have any questions, please contact:
Center for EMI Teaching Excellence
Email: emicenter@mail.nsysu.edu.tw
Phone: (07) 525-2000 ext. 5808

Wishing you a wonderful day!
`
    };
  },

  // 預約取消通知
  reservationCancellation: (data) => {
  const activityInfo = getActivitySpecificContent(data.eventType, data.startTime);
  const eventLocation = getEventLocationForEmail(data);
  return {
    from: process.env.GMAIL_USER || "siwansalon@gmail.com", // 活動預約郵件帳號
    to: data.studentEmail,
    subject: `${activityInfo.subjectPrefix} 活動預約取消通知 / Reservation Cancellation Notice`,
    text: `
親愛的 ${data.studentName} (${data.studentId}) 您好，

您已成功取消下列${activityInfo.chineseDescription}預約：
活動名稱：「${data.eventName}」
日期：${data.date}
時間：${data.startTime} - ${data.endTime}
地點：${eventLocation.zh}

感謝您對本活動的支持，期待未來再次參與。

若有任何問題請聯繫:
全英語卓越教學中心 (Center for EMI Teaching Excellence)
Email: emicenter@mail.nsysu.edu.tw
電話: (07)5252000#5808

全英語卓越教學中心 敬上


Dear ${data.studentName} (${data.studentId}),

You have successfully canceled your reservation for the following ${activityInfo.englishDescription}:
Activity: 「${data.eventName}」
Date: ${data.date}
Time: ${data.startTime} - ${data.endTime}
Location: ${eventLocation.en}

Thank you for your interest in this activity. We hope you will participate in our future events.

If you have any questions, please contact:
Center for EMI Teaching Excellence
Email: emicenter@mail.nsysu.edu.tw
Phone: (07) 525-2000 ext. 5808

Center for EMI Teaching Excellence
`
  };
},

  waitlistJoined: (data) => {
    const activityInfo = getActivitySpecificContent(data.eventType, data.startTime);
    const eventLocation = getEventLocationForEmail(data);
    const pos = data.position != null ? String(data.position) : '—';
    return {
      from: process.env.GMAIL_USER || 'siwansalon@gmail.com',
      to: data.studentEmail,
      subject: `${activityInfo.subjectPrefix} 候補登記成功通知`,
      text: `
親愛的 ${data.studentName} (${data.studentId}) 您好，

您已加入候補名單，活動：「${data.eventName}」
日期：${data.date}
時間：${data.startTime} - ${data.endTime}
地點：${eventLocation.zh}

關於候補轉正說明：

   自動遞補： 若有名額釋出，系統將按候補順序自動轉為正式預約，並發信通知。

   確認時限： 請於活動前 2 小時留意信箱；若未收到通知信，則視為預約未成功。

   注意事項： 候補名單僅為系統內遞補依據，與活動現場的參與（入場）資格無關。

若有任何問題請聯繫:
全英語卓越教學中心 (Center for EMI Teaching Excellence)
Email: emicenter@mail.nsysu.edu.tw
電話: (07)5252000#5808

Dear ${data.studentName} (${data.studentId}),

You have been added to the waitlist for: 「${data.eventName}」
Date: ${data.date}
Time: ${data.startTime} - ${data.endTime}
Location: ${eventLocation.en}

   Auto-Promotion: Spots are filled automatically from the waitlist. You will receive an email if you are promoted.

   Final Confirmation: Please check your inbox up to 2 hours before the event starts. If you have not received a confirmation email by then, your booking was unsuccessful.

   Note: The waitlist serves solely as the basis for system substitutions and is unrelated to participation (entry) eligibility at the event venue.

Center for EMI Teaching Excellence
Email: emicenter@mail.nsysu.edu.tw
Phone: (07) 525-2000 ext. 5808
`,
    };
  },

  waitlistPromoted: (data) => {
    const activityInfo = getActivitySpecificContent(data.eventType, data.startTime);
    const eventLocation = getEventLocationForEmail(data);
    const locZh = eventLocation.zh;
    const locEn = eventLocation.en;
    return {
      from: process.env.GMAIL_USER || 'siwansalon@gmail.com',
      to: data.studentEmail,
      subject: `${activityInfo.subjectPrefix} 候補轉正／正式預約通知`,
      text: `
親愛的 ${data.studentName} (${data.studentId}) 您好，

您已由候補轉為正式預約，活動：「${data.eventName}」
日期：${data.date}
時間：${data.startTime} - ${data.endTime}
地點：${locZh}

【取消預約】須於活動開始前至少 2 小時完成；取消時需要您預約信上的驗證碼。

【取消預約驗證碼】
驗證碼：${data.cancellationCode || 'N/A'}

若有任何問題請聯繫:
全英語卓越教學中心 (Center for EMI Teaching Excellence)
Email: emicenter@mail.nsysu.edu.tw
電話: (07)5252000#5808

Dear ${data.studentName} (${data.studentId}),

Your waitlist spot has been promoted to a confirmed reservation for: 「${data.eventName}」
Date: ${data.date}
Time: ${data.startTime} - ${data.endTime}
Location: ${locEn}

[Cancellation] You must cancel at least 2 hours before the event start time, using the verification code below.

[Verification code for cancellation]
Code: ${data.cancellationCode || 'N/A'}

Center for EMI Teaching Excellence
Email: emicenter@mail.nsysu.edu.tw
Phone: (07) 525-2000 ext. 5808
`,
    };
  },

  // 黑名單通知
  blacklistNotification: (data) => {
    const activityInfo = getActivitySpecificContent(data.eventType, data.startTime);
    return {
      from: process.env.GMAIL_USER || "siwansalon@gmail.com", // 活動預約郵件帳號
      to: data.email,
      subject: `因違規取消${activityInfo.chineseDescription}預約通知`,
      text: `
親愛的 ${data.name} (${data.studentId}) 您好，

由於您已累計兩次違規紀錄，系統已自動將您列入黑名單，限制預約權限至 ${data.unlockDate}。

因此，您原本預約的以下活動已被取消：
• 活動名稱：${data.eventName}
• 日期：${data.date}
• 時間：${data.startTime} - ${data.endTime}

請您於解鎖時間後再行預約。若有任何疑問，歡迎聯繫全英語卓越教學中心：
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5808

感謝您的理解與配合。

Dear ${data.name} (${data.studentId}),

Due to two recorded violations, the system has automatically added you to the blacklist. Your reservation privileges have been suspended until ${data.unlockDate}.

As a result, the following reservation has been cancelled:
• Event: ${data.eventName}
• Event Type: ${data.eventType}
• Date: ${data.date}
• Time: ${data.startTime} - ${data.endTime}

Please make new reservations only after the suspension period has ended. If you have any questions, feel free to contact the Center for EMI Teaching Excellence:
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5808

Thank you for your understanding and cooperation.
`
    };
  },

  // 培力英檢報名信箱驗證碼
  englishTestEmailVerification: (data) => {
    const minutes = data.expiresInMinutes || 10;
    const code = data.code || '------';
    return {
      to: data.email,
      subject: '【培力英檢報名】信箱驗證碼 / BESTEP Email Verification Code',
      text: `
您好，

您正在進行培力英檢報名信箱驗證。請於報名表單輸入以下驗證碼：

驗證碼：${code}
有效時間：${minutes} 分鐘

若您未申請此驗證碼，請忽略本信件。請勿將驗證碼轉告知他人。

全英語卓越教學中心 敬上
📧 emicenter@mail.nsysu.edu.tw

---

Hello,

You are verifying your email for BESTEP registration. Please enter this code on the registration form:

Code: ${code}
Valid for: ${minutes} minutes

If you did not request this code, please ignore this email.

Center for EMI Teaching Excellence
`
    };
  },

  // 培力英檢報名完成通知
  englishTestRegistrationSuccess: (data) => {
    // 格式化報名日期
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    // 使用統一的狀態對應
    const statusText = BESTEP_STATUS_MAP[data.status]?.zh || '審核中';
    const statusTextEn = BESTEP_STATUS_MAP[data.status]?.en || 'Under Review';

    // 使用統一的報考項目對應
    const examTypeText = BESTEP_EXAM_TYPE_MAP[data.examType]?.zh || data.examType || '未指定';
    const examTypeTextEn = BESTEP_EXAM_TYPE_MAP[data.examType]?.en || data.examType || 'Not Specified';

    // 身分證字號部分遮罩（只顯示前3碼和後3碼）
    const maskIdNumber = (idNumber) => {
      if (!idNumber || idNumber.length < 6) return idNumber;
      return idNumber.substring(0, 3) + '***' + idNumber.substring(idNumber.length - 3);
    };

    // 組合英文姓名
    const studentName = data.lastNameEn && data.firstNameEn 
      ? `${data.lastNameEn} ${data.firstNameEn}`.trim()
      : data.studentNameZh || data.name || '';

    // 構建成績資訊（僅當 hasCEFRB2 === '是' 時顯示）
    const buildScoreInfo = () => {
      if (data.hasCEFRB2 !== '是') return '';
      
      let scoreInfo = '';
      if (data.listeningExamType && data.listeningScore) {
        scoreInfo += `• 聽力成績：${data.listeningScore} (${data.listeningExamType})\n`;
      }
      if (data.readingExamType && data.readingScore) {
        scoreInfo += `• 閱讀成績：${data.readingScore} (${data.readingExamType})\n`;
      }
      if (data.speakingExamType && data.speakingScore) {
        scoreInfo += `• 口說成績：${data.speakingScore} (${data.speakingExamType})\n`;
      }
      if (data.writingExamType && data.writingScore) {
        scoreInfo += `• 寫作成績：${data.writingScore} (${data.writingExamType})\n`;
      }
      return scoreInfo;
    };

    const buildScoreInfoEn = () => {
      if (data.hasCEFRB2 !== '是') return '';
      
      let scoreInfo = '';
      if (data.listeningExamType && data.listeningScore) {
        scoreInfo += `• Listening Score: ${data.listeningScore} (${data.listeningExamType})\n`;
      }
      if (data.readingExamType && data.readingScore) {
        scoreInfo += `• Reading Score: ${data.readingScore} (${data.readingExamType})\n`;
      }
      if (data.speakingExamType && data.speakingScore) {
        scoreInfo += `• Speaking Score: ${data.speakingScore} (${data.speakingExamType})\n`;
      }
      if (data.writingExamType && data.writingScore) {
        scoreInfo += `• Writing Score: ${data.writingScore} (${data.writingExamType})\n`;
      }
      return scoreInfo;
    };

    const scoreInfo = buildScoreInfo();
    const scoreInfoEn = buildScoreInfoEn();

    // 根據報考類型決定顯示內容
    const nonExamNotice = data.examType === 'NON' ? `
【重要提醒】
您已選擇不報考培力英檢。此報名記錄已歸類為「不報名」狀態。
` : `
【後續流程】

1. 審核階段：
   您的報名資料將由審核人員進行審核，審核結果將透過 Email 通知您。

2. 審核狀態：
   • 審核中：您的報名資料正在審核中
   • 請修正：請依說明修正後重新提交
   • 報名成功：您的報名已通過審核，請等待後續考試通知
   • 報名失敗：您的報名未通過審核，感謝您的報名   

3. 修改報名資料：
   如需修改報名資料，請使用「查看與編輯」功能，輸入您的學號、姓名和身分證字號進行修改。

4. 考試通知：
   考試相關資訊（時間、地點、注意事項等）將於審核通過後另行通知。
`;

    const nonExamNoticeEn = data.examType === 'NON' ? `
[Important Notice]
You have chosen not to take the BESTEP English Test. This registration has been classified as "Not Taking Exam".
` : `
[Next Steps]

1. Review Process:
   Your registration will be reviewed by our staff. You will be notified of the review result via email.

2. Review Status:
   • Pending – Your application is currently being processed.
   • Revision – Please revise and resubmit according to the instructions.
   • Success – Your application has been approved. Please wait for further examination notices.
   • Failed – Your application was not approved. Thank you for your Registration.

3. Modify Registration:
   If you need to modify your registration, please use the "View and Edit" function and enter your Student ID, Name, and National ID.

4. Exam Notification:
   Exam-related information (time, location, instructions, etc.) will be notified separately after approval.
`;

    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw", // 培力英檢郵件帳號
      to: data.email,
      subject: '[培力英檢] 報名完成確認通知 / BESTEP Registration Confirmation',
      text: `
親愛的 ${studentName} (${data.studentId}) 您好，

感謝您完成 BESTEP 培力英檢報名！

【報名資料確認】

報名編號：${data.registrationId}
報名日期：${formatDate(data.registrationDate)}
報名狀態：${statusText}

基本資料：
• 姓名：${data.studentNameZh || data.name}
• 學號：${data.studentId}
• 身分證字號：${maskIdNumber(data.idNumber || data.nationalId)}
• 電子郵件：${data.email}
• 聯絡電話：${data.phone || '未提供'}

報考資訊：
• 報考項目：${examTypeText}
• 是否曾取得 CEFR B2 以上成績：${data.hasCEFRB2 || '否'}
${scoreInfo}
${nonExamNotice}
【聯絡資訊】

如有任何問題，請聯繫：
全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5876

感謝您的報名，祝您考試順利！

全英語卓越教學中心 敬上

---

Dear ${studentName} (${data.studentId}),

Thank you for completing your BESTEP English Test registration!

[Registration Confirmation]

Registration ID: ${data.registrationId}
Registration Date: ${formatDate(data.registrationDate)}
Status: ${statusTextEn}

Personal Information:
• Name: ${data.studentNameZh || data.name}
• Student ID: ${data.studentId}
• National ID: ${maskIdNumber(data.idNumber || data.nationalId)}
• Email: ${data.email}
• Phone: ${data.phone || 'Not provided'}

Exam Information:
• Exam Type: ${examTypeTextEn}
• Have CEFR B2 or above: ${data.hasCEFRB2 === '是' ? 'Yes' : 'No'}
${scoreInfoEn}
${nonExamNoticeEn}
[Contact Information]

If you have any questions, please contact:
Center for EMI Teaching Excellence
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5876

Thank you for your registration. We wish you success in your exam!

Best regards,
Center for EMI Teaching Excellence
`
    };
  },


  // 培力英檢報名請修正通知（原「已拒絕」更名為「請修正」）
  englishTestRegistrationRejected: (data) => {
    // 格式化報名日期
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    // 使用統一的報考項目對應
    const examTypeText = BESTEP_EXAM_TYPE_MAP[data.examType]?.zh || data.examType || '未指定';
    const examTypeTextEn = BESTEP_EXAM_TYPE_MAP[data.examType]?.en || data.examType || 'Not Specified';

    // 組合英文姓名
    const studentName = data.lastNameEn && data.firstNameEn 
      ? `${data.lastNameEn} ${data.firstNameEn}`.trim()
      : data.studentNameZh || data.name || '';
      

    // 身分證字號部分遮罩
    const maskIdNumber = (idNumber) => {
      if (!idNumber || idNumber.length < 6) return idNumber;
      return idNumber.substring(0, 3) + '***' + idNumber.substring(idNumber.length - 3);
    };

    // 拒絕原因對應
    const rejectionReasonMap = {
      '1': '照片五官不夠清晰',
      '2': '照片上有鋼印、浮水印或反光遮住五官',
      '3': '照片背景非白色或淺色',
      '4': '臉部未正視鏡頭，不是證件照表情、或使用生活照',
      '5': '髮型遮住耳朵、瀏海蓋住眉毛、或頭髮碰到照片邊框',
      '6': '照片背景非白色、照片太暗或逆光',
      '7': '有閃光反射在眼睛上、配戴深色鏡片、鏡框遮蓋眼睛',
      '8': '非本人照片',
      '9': '檔案格式不是jpg檔或png檔',
      '10': '檔案小於100KB或大於5MB',
      '11': '基本聯絡資訊資料有誤',
      '12': '身分與學籍資料有誤',
      '13': '特殊身分與協助需求資料有誤',
      '14': '照片與同意事項資料有誤',
      '15': '資訊來源資料有誤',
      '16': '英語能力與培力資格相關資料有誤',
      '其他': '其他'
    };

    // 構建拒絕原因列表
    const buildRejectionReasons = () => {
      if (!data.rejectionReasons || !Array.isArray(data.rejectionReasons) || data.rejectionReasons.length === 0) {
        return '未提供';
      }
      
      let reasons = data.rejectionReasons.map(reason => {
        if (rejectionReasonMap[reason]) {
          return rejectionReasonMap[reason];
        }
        return reason;
      }).join('、');
      
      if (data.rejectionOther && data.rejectionOther.trim() !== '') {
        reasons += `、其他：${data.rejectionOther}`;
      }
      
      return reasons;
    };

    const buildRejectionReasonsEn = () => {
      if (!data.rejectionReasons || !Array.isArray(data.rejectionReasons) || data.rejectionReasons.length === 0) {
        return 'Not provided';
      }
      
      const reasonMapEn = {
        '1': 'Photo facial features not clear enough',
        '2': 'Photo has seal, watermark, or reflection covering facial features',
        '3': 'Photo background is not white or light-colored',
        '4': 'Face not facing camera, not ID photo expression, or using casual photo',
        '5': 'Hair covering ears, bangs covering eyebrows, or hair touching photo border',
        '6': 'Photo background not white, photo too dark or backlit',
        '7': 'Flash reflection in eyes, wearing dark lenses, or frames covering eyes',
        '8': 'Not a photo of the applicant',
        '9': 'File format is not jpg, gif, or png',
        '10': 'File size less than 100KB or greater than 5MB',
        '11': 'Data error in basic contact information',
        '12': 'Data error in identity or enrollment information',
        '13': 'Data error in special status or assistance needs information',
        '14': 'Data error in photo or consent information',
        '15': 'Data error in information source data',
        '16': 'Data error in English proficiency or eligibility information',
        '其他': 'Other'
      };
      
      let reasons = data.rejectionReasons.map(reason => {
        if (reasonMapEn[reason]) {
          return reasonMapEn[reason];
        }
        return reason;
      }).join(', ');
      
      if (data.rejectionOther && data.rejectionOther.trim() !== '') {
        reasons += `, Other: ${data.rejectionOther}`;
      }
      
      return reasons;
    };

    const rejectionReasonsText = buildRejectionReasons();
    const rejectionReasonsTextEn = buildRejectionReasonsEn();

    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw", // 培力英檢郵件帳號
      to: data.email,
      subject: '[培力英檢] 報名資料請修正通知 / BESTEP Registration Revision Required',
      text: `
親愛的 ${studentName} (${data.studentId}) 您好，

您的 BESTEP 培力英檢報名需請依下列說明修正後重新提交。

【報名資料確認】

報名編號：${data.registrationId}
報名日期：${formatDate(data.registrationDate)}
審核狀態：請修正

基本資料：
• 姓名：${data.studentNameZh || data.name}
• 學號：${data.studentId}
• 身分證字號：${maskIdNumber(data.idNumber || data.nationalId)}
• 電子郵件：${data.email}
• 聯絡電話：${data.phone || '未提供'}

報考資訊：
• 報考項目：${examTypeText}

【請修正原因】

${rejectionReasonsText}

【後續流程】

1. 修改報名資料：
   https://emieears-siwan.nsysu.edu.tw/register/english-test
   請根據上述原因修正您的報名資料，並使用「查看與編輯」功能重新提交。

2. 重新提交：
   修正完成後，請重新提交報名資料以供審核。

3. 如有疑問：
   如有任何問題，請隨時聯繫我們。

【聯絡資訊】

如有任何問題，請聯繫：
全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5876

感謝您的理解與配合。

全英語卓越教學中心 敬上

---

Dear ${studentName} (${data.studentId}),

We regret to inform you that your BESTEP English Test registration was not approved.

[Registration Confirmation]

Registration ID: ${data.registrationId}
Registration Date: ${formatDate(data.registrationDate)}
Status: Revision Required

Personal Information:
• Name: ${data.studentNameZh || data.name}
• Student ID: ${data.studentId}
• National ID: ${maskIdNumber(data.idNumber || data.nationalId)}
• Email: ${data.email}
• Phone: ${data.phone || 'Not provided'}

Exam Information:
• Exam Type: ${examTypeTextEn}

[Revision Reasons]

${rejectionReasonsTextEn}

[Next Steps]

1. Modify Registration:
   Please correct your registration information based on the reasons above and resubmit using the "View and Edit" function.

2. Resubmit:
   After making corrections, please resubmit your registration for review.

3. Questions:
   If you have any questions, please feel free to contact us.

[Contact Information]

If you have any questions, please contact:
Center for EMI Teaching Excellence
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5876

Thank you for your understanding and cooperation.

Best regards,
Center for EMI Teaching Excellence
`
    };
  },

  // 培力英檢報名成功通知（名單確認後由後台按鈕觸發）
  englishTestRegistrationFinalSuccess: (data) => {
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const studentName = data.lastNameEn && data.firstNameEn ? `${data.lastNameEn} ${data.firstNameEn}`.trim() : data.studentNameZh || data.name || '';
    const maskIdNumber = (id) => (!id || id.length < 6) ? id : id.substring(0, 3) + '***' + id.substring(id.length - 3);
    // 使用統一的報考項目對應
    const examTypeText = BESTEP_EXAM_TYPE_MAP[data.examType]?.zh || data.examType || '未指定';
    const examTypeTextEn = BESTEP_EXAM_TYPE_MAP[data.examType]?.en || data.examType || 'Not Specified';
    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw",
      to: data.email,
      subject: '[培力英檢] 報名成功通知 / BESTEP Registration Success',
      text: `
親愛的 ${studentName} (${data.studentId}) 您好，

恭喜！您的 BESTEP 培力英檢報名已確認成功。

【報名資料確認】
報名編號：${data.registrationId}
報名日期：${formatDate(data.registrationDate)}
狀態：報名成功

基本資料：姓名 ${data.studentNameZh || data.name}、學號 ${data.studentId}、身分證字號 ${maskIdNumber(data.idNumber || data.nationalId)}、電子郵件 ${data.email}、聯絡電話 ${data.phone || '未提供'}
報考項目：${examTypeText}

【後續流程】
考試相關資訊（時間、地點、注意事項等）將另行通知，請密切關注您的 Email。

【聯絡資訊】
全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw  📞 電話：(07) 525-2000 分機 5876

感謝您的報名，祝您考試順利！

---
Dear ${studentName} (${data.studentId}),

Congratulations! Your BESTEP English Test registration has been confirmed.

[Registration Confirmation]
Registration ID: ${data.registrationId}  Date: ${formatDate(data.registrationDate)}  Status: Registration Success

Exam Type: ${examTypeTextEn}

[Next Steps]
Exam-related information will be notified separately. Please check your email regularly.

[Contact] Center for EMI Teaching Excellence  📧 emicenter@mail.nsysu.edu.tw  📞 (07) 525-2000 ext. 5876

Best regards,
Center for EMI Teaching Excellence
`
    };
  },

  // 培力英檢團體推廣信（報名成功且四項皆報考者，一鍵發送推廣學習有伴團體報名）
  englishTestRegistrationGroupPromo: (data) => {
    const studentName = data.lastNameEn && data.firstNameEn ? `${data.lastNameEn} ${data.firstNameEn}`.trim() : data.studentNameZh || data.name || '';
    const registrationShortLink = data.registrationShortLink || 'http://emieears-siwan.nsysu.edu.tw/register/english-test/group';
    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw",
      to: data.email,
      subject: '找學伴一起考英檢｜組隊報名最高可拿 5,000 元',
      text: `
親愛的 ${studentName} 您好：

想準備英檢，卻總是少一點動力或沒人一起？
這學期，西灣學院全英中心 推出【學習有伴培力英檢獎勵專案】，邀請你和朋友組隊一起報考培力英檢，有人陪、一起準備，還有機會獲得獎勵金！

✨ 活動亮點一次看：
• 3–4 人自由組隊，找同學、找朋友都可以
• 全員應考聽說讀寫即可獲得基本獎勵金
• 表現優異的團隊或個人可獲得最高 5,000 元獎勵金
• 名額有限，額滿即止

如果你想提升英語實力、累積正式測驗經驗，或只是想和朋友一起努力，這個專案很適合你！

👉 專案說明與報名方式請見：
${registrationShortLink}

歡迎揪團報名，一起挑戰英檢、一起成長！期待你的參與 🌱

西灣學院
全英語卓越教學中心 EMI Center
`
    };
  },

  // 培力英檢報名失敗通知（名單確認後由後台按鈕觸發；含報名失敗原因）
  englishTestRegistrationFinalFailure: (data) => {
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const studentName = data.lastNameEn && data.firstNameEn ? `${data.lastNameEn} ${data.firstNameEn}`.trim() : data.studentNameZh || data.name || '';
    const maskIdNumber = (id) => (!id || id.length < 6) ? id : id.substring(0, 3) + '***' + id.substring(id.length - 3);
    const failureReasonMap = {
      '1': '照片五官不夠清晰',
      '2': '照片上有鋼印、浮水印或反光遮住五官',
      '3': '照片背景非白色或淺色',
      '4': '臉部未正視鏡頭，不是證件照表情、或使用生活照',
      '5': '髮型遮住耳朵、瀏海蓋住眉毛、或頭髮碰到照片邊框',
      '6': '照片背景非白色、照片太暗或逆光',
      '7': '有閃光反射在眼睛上、配戴深色鏡片、鏡框遮蓋眼睛',
      '8': '非本人照片',
      '9': '檔案格式不是jpg檔或png檔',
      '10': '檔案小於100KB或大於5MB',
      '11': '基本聯絡資訊資料有誤',
      '12': '身分與學籍資料有誤',
      '13': '特殊身分與協助需求資料有誤',
      '14': '照片與同意事項資料有誤',
      '15': '資訊來源資料有誤',
      '16': '英語能力與培力資格相關資料有誤',
      '其他': '其他'
    };
    const buildFailureReasons = () => {
      if (!data.rejectionReasons || !Array.isArray(data.rejectionReasons) || data.rejectionReasons.length === 0) {
        return '';
      }
      let reasons = data.rejectionReasons.map(r => failureReasonMap[r] || r).join('、');
      if (data.rejectionOther && data.rejectionOther.trim() !== '') {
        reasons += `、其他：${data.rejectionOther}`;
      }
      return reasons;
    };
    const failureReasonsText = buildFailureReasons();
    const failureReasonsBlock = failureReasonsText ? `
【報名失敗原因】
${failureReasonsText}
` : '';
    const failureReasonsBlockEn = failureReasonsText ? `
[Reason for Registration Not Approved]
${failureReasonsText}
` : '';
    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw",
      to: data.email,
      subject: '[培力英檢] 報名結果通知 / BESTEP Registration Result',
      text: `
親愛的 ${studentName} (${data.studentId}) 您好，

感謝您報名 BESTEP 培力英檢。經審核後，本次報名未通過。

【報名資料】
報名編號：${data.registrationId}
報名日期：${formatDate(data.registrationDate)}
狀態：報名失敗
${failureReasonsBlock}
如有疑問請聯繫：全英語卓越教學中心
📧 Email：emicenter@mail.nsysu.edu.tw  📞 電話：(07) 525-2000 分機 5876

---
Dear ${studentName} (${data.studentId}),

Thank you for registering for the BESTEP English Test. After review, this registration was not approved.

Registration ID: ${data.registrationId}  Date: ${formatDate(data.registrationDate)}  Status: Registration Failed
${failureReasonsBlockEn}
If you have any questions, please contact: Center for EMI Teaching Excellence
📧 emicenter@mail.nsysu.edu.tw  📞 (07) 525-2000 ext. 5876
`
    };
  },

  // 培力英檢報名資料修改通知（發送給中心）
  englishTestRegistrationUpdated: (data) => {
    // 格式化修改日期
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw", // 培力英檢郵件帳號
      to: 'emicenter@mail.nsysu.edu.tw',
      subject: '[培力英檢] 學生報名資料修改通知 / BESTEP Registration Update Notification',
      text: `
【培力英檢報名資料修改通知】

有學生已成功修改培力英檢報名資料，請行政端進行追蹤。

【學生資訊】
• 姓名：${data.studentName || data.name || 'N/A'}
• 學號：${data.studentId || 'N/A'}
• 報名編號：${data.registrationId || 'N/A'}
• 修改時間：${formatDate(data.updatedAt || new Date())}

【聯絡資訊】
• 學生 Email：${data.email || 'N/A'}
• 學生電話：${data.phone || '未提供'}

請至系統後台查看詳細修改內容。

---
全英語卓越教學中心 (Center for EMI Teaching Excellence)

---

[BESTEP Registration Update Notification]

A student has successfully updated their BESTEP English Test registration. Please track this update.

[Student Information]
• Name: ${data.studentName || data.name || 'N/A'}
• Student ID: ${data.studentId || 'N/A'}
• Registration ID: ${data.registrationId || 'N/A'}
• Update Time: ${formatDate(data.updatedAt || new Date())}

[Contact Information]
• Student Email: ${data.email || 'N/A'}
• Student Phone: ${data.phone || 'Not provided'}

Please check the admin panel for detailed update information.

---
Center for EMI Teaching Excellence
`
    };
  },

  // 培力英檢報名資料修改完成通知（發送給學生）
  englishTestRegistrationModificationComplete: (data) => {
    // 格式化修改日期
    const formatDate = (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    };

    // 使用統一的報考項目對應
    const examTypeText = BESTEP_EXAM_TYPE_MAP[data.examType]?.zh || data.examType || '未指定';
    const examTypeTextEn = BESTEP_EXAM_TYPE_MAP[data.examType]?.en || data.examType || 'Not Specified';

    // 組合英文姓名
    const studentName = data.lastNameEn && data.firstNameEn 
      ? `${data.lastNameEn} ${data.firstNameEn}`.trim()
      : data.studentNameZh || data.name || '';

    // 身分證字號部分遮罩
    const maskIdNumber = (idNumber) => {
      if (!idNumber || idNumber.length < 6) return idNumber;
      return idNumber.substring(0, 3) + '***' + idNumber.substring(idNumber.length - 3);
    };

    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw", // 培力英檢郵件帳號
      to: data.email,
      subject: '[培力英檢] 報名資料修改完成通知 / BESTEP Registration Modification Complete',
      text: `
親愛的 ${studentName} (${data.studentId}) 您好，

您的 BESTEP 培力英檢報名資料已成功修改完成。

【報名資料確認】

報名編號：${data.registrationId}
修改時間：${formatDate(data.updatedAt || new Date())}
審核狀態：審核中

基本資料：
• 姓名：${data.studentNameZh || data.name}
• 學號：${data.studentId}
• 身分證字號：${maskIdNumber(data.idNumber || data.nationalId)}
• 電子郵件：${data.email}
• 聯絡電話：${data.phone || '未提供'}

報考資訊：
• 報考項目：${examTypeText}

【後續流程】

1. 審核階段：
   您的修改後報名資料將由審核人員進行審核，審核結果將透過 Email 通知您。

2. 審核狀態：
   • 審核中：您的報名資料正在審核中
   • 請修正：請依說明修正後重新提交
   • 報名成功：您的報名已通過審核，請等待後續考試通知
   • 報名失敗：您的報名未通過審核，感謝您的報名  

3. 考試通知：
   考試相關資訊（時間、地點、注意事項等）將於審核通過後另行通知。

【聯絡資訊】

如有任何問題，請聯繫：
全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5876

感謝您的配合！

全英語卓越教學中心 敬上

---

Dear ${studentName} (${data.studentId}),

Your BESTEP English Test registration has been successfully modified.

[Registration Confirmation]

Registration ID: ${data.registrationId}
Modification Time: ${formatDate(data.updatedAt || new Date())}
Status: Under Review

Personal Information:
• Name: ${data.studentNameZh || data.name}
• Student ID: ${data.studentId}
• National ID: ${maskIdNumber(data.idNumber || data.nationalId)}
• Email: ${data.email}
• Phone: ${data.phone || 'Not provided'}

Exam Information:
• Exam Type: ${examTypeTextEn}

[Next Steps]

1. Review Process:
   Your modified registration will be reviewed by our staff. You will be notified of the review result via email.

2. Review Status:
   • Pending – Your application is currently being processed.
   • Revision – Please revise and resubmit according to the instructions.
   • Success – Your application has been approved. Please wait for further examination notices.
   • Failed – Your application was not approved. Thank you for your Registration.

3. Exam Notification:
   Exam-related information (time, location, instructions, etc.) will be notified separately after approval.

[Contact Information]

If you have any questions, please contact:
Center for EMI Teaching Excellence
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5876

Thank you for your cooperation!

Best regards,
Center for EMI Teaching Excellence
`
    };
  },

  // 學習有伴：邀請同意郵件
  learningPartnerInvitation: (data) => {
    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw",
      to: data.email,
      subject: '[培力英檢] 學習有伴團體報名確認通知 / BESTEP Team-Up  Program Team Registration Confirmation',
      text: `
親愛的 ${data.name} (${data.studentId}) 您好，

您已被加入培力英檢「學習有伴」團體報名，團體資訊如下：

【團體資訊】
團體編號：${data.teamId}
團體名稱：${data.teamName}
團體人數：${data.teamSize || '未知'} 人

【團體成員】
${data.memberList || '載入中...'}

【重要提醒】
請在 ${data.expiresAtHours || 24} 小時內（${data.expiresAt} 前）點擊以下連結完成同意：

${data.approvalLink}

若您未點擊連結，此團體報名將在 ${data.expiresAtHours || 24} 小時後自動失效。

【注意事項】
• 此連結為一次性使用，點擊後即完成同意
• 所有成員都需在期限內完成同意，團體報名才會生效
• 若您不是此團體的成員，請忽略此郵件

【聯絡資訊】
如有任何問題，請聯繫：
全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5876

感謝您的配合！

全英語卓越教學中心 敬上

---

Dear ${data.name} (${data.studentId}),

You have been added to a BESTEP English Test "BESTEP Team-Up  Program" team registration. Team information is as follows:

[Team Information]
Team ID: ${data.teamId}
Team Name: ${data.teamName}
Team Size: ${data.teamSize || 'Unknown'} members

[Team Members]
${data.memberList || 'Loading...'}

[Important Reminder]
Please click the following link to confirm your participation within ${data.expiresAtHours || 24} hours (before ${data.expiresAt}):

${data.approvalLink}

If you do not click the link, this team registration will automatically expire after ${data.expiresAtHours || 24} hours.

[Notes]
• This link is for one-time use only. Clicking it completes your confirmation.
• All members must complete confirmation within the deadline for the team registration to be valid.
• If you are not a member of this team, please ignore this email.

[Contact Information]
If you have any questions, please contact:
Center for EMI Teaching Excellence
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5876

Thank you for your cooperation!

Best regards,
Center for EMI Teaching Excellence
`
    };
  },

  // 學習有伴：重新寄送邀請郵件
  learningPartnerInvitationResend: (data) => {
    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw",
      to: data.email,
      subject: '[培力英檢] 學習有伴團體報名連結重新發送 / BESTEP Team-Up  Program Team Link Resent',
      text: `
親愛的 ${data.name} (${data.studentId}) 您好，

我們已為您重新發送培力英檢「學習有伴」團體報名的同意連結。

【團體資訊】
團體編號：${data.teamId}
團體名稱：${data.teamName}

【重要提醒】
舊的連結已失效，請使用以下新連結完成同意（${data.expiresAtHours || 24} 小時內有效）：

${data.approvalLink}

過期時間：${data.expiresAt}

【注意事項】
• 此連結為一次性使用，點擊後即完成同意
• 所有成員都需在期限內完成同意，團體報名才會生效

【聯絡資訊】
如有任何問題，請聯繫：
全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5876

感謝您的配合！

全英語卓越教學中心 敬上

---

Dear ${data.name} (${data.studentId}),

We have resent the confirmation link for your BESTEP English Test "BESTEP Team-Up  Program" team registration.

[Team Information]
Team ID: ${data.teamId}
Team Name: ${data.teamName}

[Important Reminder]
The old link has expired. Please use the following new link to confirm your participation (valid for ${data.expiresAtHours || 24} hours):

${data.approvalLink}

Expires at: ${data.expiresAt}

[Notes]
• This link is for one-time use only. Clicking it completes your confirmation.
• All members must complete confirmation within the deadline for the team registration to be valid.

[Contact Information]
If you have any questions, please contact:
Center for EMI Teaching Excellence
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5876

Thank you for your cooperation!

Best regards,
Center for EMI Teaching Excellence
`
    };
  },

  // 學習有伴：全員同意完成通知
  learningPartnerAllApproved: (data) => {
    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw",
      to: data.email,
      subject: '[培力英檢] 學習有伴團體報名完成通知 / BESTEP Team-Up  Program Team Registration Completed',
      text: `
親愛的 ${data.name} (${data.studentId}) 您好，

恭喜！您的培力英檢「學習有伴」團體報名已完成。

【團體資訊】
團體編號：${data.teamId}
團體名稱：${data.teamName}
完成時間：${data.approvedAt}

【後續流程】
團體報名已確認，請等待後續考試通知。考試相關資訊（時間、地點、注意事項等）將另行通知。

【聯絡資訊】
如有任何問題，請聯繫：
全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5876

感謝您的報名，祝您考試順利！

全英語卓越教學中心 敬上

---

Dear ${data.name} (${data.studentId}),

Congratulations! Your BESTEP English Test "BESTEP Team-Up  Program" team registration has been completed.

[Team Information]
Team ID: ${data.teamId}
Team Name: ${data.teamName}
Completed at: ${data.approvedAt}

[Next Steps]
The team registration has been confirmed. Please wait for further exam notifications. Exam-related information (time, location, instructions, etc.) will be notified separately.

[Contact Information]
If you have any questions, please contact:
Center for EMI Teaching Excellence
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5876

Thank you for your registration. We wish you success in your exam!

Best regards,
Center for EMI Teaching Excellence
`
    };
  },

  // 學習有伴：取消通知（可選）
  learningPartnerCancelled: (data) => {
    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw",
      to: data.email,
      subject: '[培力英檢] 學習有伴團體報名取消通知 / BESTEP Team-Up  Program Team Registration Cancelled',
      text: `
親愛的 ${data.name} (${data.studentId}) 您好，

您的培力英檢「學習有伴」團體報名已被取消。

【團體資訊】
團體編號：${data.teamId}
團體名稱：${data.teamName}
取消原因：${data.reason || '管理員取消'}

【後續說明】
此團體報名已失效，如需重新報名，請重新建立團體。

【聯絡資訊】
如有任何問題，請聯繫：
全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5876

感謝您的理解。

全英語卓越教學中心 敬上

---

Dear ${data.name} (${data.studentId}),

Your BESTEP English Test "BESTEP Team-Up  Program" team registration has been cancelled.

[Team Information]
Team ID: ${data.teamId}
Team Name: ${data.teamName}
Reason: ${data.reason || 'Cancelled by administrator'}

[Next Steps]
This team registration has been invalidated. If you need to re-register, please create a new team.

[Contact Information]
If you have any questions, please contact:
Center for EMI Teaching Excellence
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5876

Thank you for your understanding.

Best regards,
Center for EMI Teaching Excellence
`
    };
  },

  // 學習有伴：失效通知（可選）
  learningPartnerExpired: (data) => {
    return {
      from: process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw",
      to: data.email,
      subject: '[培力英檢] 學習有伴團體報名失效通知 / BESTEP Team-Up  Program Team Registration Expired',
      text: `
親愛的 ${data.name} (${data.studentId}) 您好，

您的培力英檢「學習有伴」團體報名已因超過 24 小時未完成全員同意而自動失效。

【團體資訊】
團體編號：${data.teamId}
團體名稱：${data.teamName}

【後續說明】
此團體報名已失效，如需重新報名，請重新建立團體。

【聯絡資訊】
如有任何問題，請聯繫：
全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5876

感謝您的理解。

全英語卓越教學中心 敬上

---

Dear ${data.name} (${data.studentId}),

Your BESTEP English Test "BESTEP Team-Up  Program" team registration has automatically expired because not all members completed confirmation within 24 hours.

[Team Information]
Team ID: ${data.teamId}
Team Name: ${data.teamName}

[Next Steps]
This team registration has been invalidated. If you need to re-register, please create a new team.

[Contact Information]
If you have any questions, please contact:
Center for EMI Teaching Excellence
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5876

Thank you for your understanding.

Best regards,
Center for EMI Teaching Excellence
`
    };
  }
};

// 根據模板類型選擇對應的 transporter 和發件人
const getTransporterAndSender = (template) => {
  if (BESTEP_EMAIL_TEMPLATES.includes(template)) {
    // 培力英檢相關郵件
    const sender = process.env.BESTEP_GMAIL_USER || process.env.GMAIL_USER || "emi.t.c@g-mail.nsysu.edu.tw";
    return {
      transporter: bestepTransporter || reservationTransporter,
      sender: sender
    };
  } else {
    // 活動預約相關郵件
    const sender = process.env.GMAIL_USER || "siwansalon@gmail.com";
    return {
      transporter: reservationTransporter,
      sender: sender
    };
  }
};

// 發送郵件的通用函數（套用後台覆寫）
const sendEmail = async (template, data) => {
  const { transporter: selectedTransporter, sender } = getTransporterAndSender(template);

  if (!selectedTransporter) {
    console.log(`📧 郵件功能未啟用，跳過發送: ${template}`);
    console.log(`   收件人: ${data.studentEmail || data.email}`);
    console.log(`   活動: ${data.eventName || '未知'}`);
    const err = new Error('EMAIL_TRANSPORT_NOT_CONFIGURED');
    err.template = template;
    throw err;
  }

  try {
    // eslint-disable-next-line global-require
    const { buildMailOptions } = require('../services/emailTemplateService');
    const mailOptions = await buildMailOptions(template, data);
    mailOptions.from = sender;
    await selectedTransporter.sendMail(mailOptions);
    const recipient = mailOptions.to || data.studentEmail || data.email || '未知';
    console.log(`📧 Email sent successfully: ${template} to ${recipient} (from: ${sender})`);
    return { ok: true, to: recipient, subject: mailOptions.subject };
  } catch (error) {
    if (error && error.code === 'EMAIL_TEMPLATE_DISABLED') {
      console.log(`📧 Email template disabled, skip: ${template}`);
      return { skipped: true, reason: 'disabled' };
    }
    console.error(`❌ Failed to send email: ${template}`, error);
    const recipient = data.studentEmail || data.email || '未知';
    console.error(`   收件人: ${recipient}`);
    console.error(`   發件人: ${sender}`);
    console.error(`   請檢查 Gmail 認證設定或網路連線`);
    throw error;
  }
};

/** 後台測試寄信：直接送出已組好的 mailOptions */
const sendRawMail = async (template, mailOptions) => {
  const { transporter: selectedTransporter, sender } = getTransporterAndSender(template);
  if (!selectedTransporter) {
    const err = new Error('EMAIL_TRANSPORT_NOT_CONFIGURED');
    err.template = template;
    throw err;
  }
  const payload = { ...mailOptions, from: sender };
  await selectedTransporter.sendMail(payload);
  return { ok: true, to: payload.to, subject: payload.subject };
};

module.exports = {
  transporter,
  emailTemplates,
  sendEmail,
  sendRawMail,
  getActivitySpecificContent,
  getEventLocationForEmail,
  BESTEP_STATUS_MAP,
  BESTEP_EXAM_TYPE_MAP,
};
