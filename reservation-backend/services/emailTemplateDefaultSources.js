'use strict';

/**
 * 後台編輯器用：系統預設主旨／正文（動態處一律 {{var}}）。
 * 實際未覆寫時仍走 config/email.js；有覆寫時由 emailTemplateService 插值寄出。
 */
const EMAIL_TEMPLATE_DEFAULT_SOURCES = {
  reservationSuccess: {
    subject: '{{subjectPrefix}} 活動預約成功通知',
    body: `親愛的 {{studentName}} ({{studentId}}) 您好，

已成功預約{{chineseDescription}}：「{{eventName}}」
日期：{{date}}
時間：{{startTime}} - {{endTime}}
地點：{{locationZh}}

【重要通知】活動規定修改：114-1學期起不再提供活動補蓋章服務，請同學們務必準時參加活動。

【取消預約驗證碼】
如需取消此預約，請使用以下驗證碼：
驗證碼：{{cancellationCode}}

請妥善保管此驗證碼，取消預約時需要輸入此驗證碼才能完成取消。

{{chineseReminder}}

若有任何問題請聯繫:
全英語卓越教學中心 (Center for EMI Teaching Excellence)
Email: emicenter@mail.nsysu.edu.tw
電話: (07)5252000#5808

祝您有美好的一天！

Dear {{studentName}} ({{studentId}}),

Your reservation for {{englishDescription}} has been confirmed:
Activity: 「{{eventName}}」
Date: {{date}}
Time: {{startTime}} - {{endTime}}
Location: {{locationEn}}

[Important Notice] Policy Update: Starting from Semester 114-1, make-up stamping services for activities will no longer be provided. Please ensure you attend activities on time.

[Cancellation Code]
If you need to cancel this reservation, please use the following verification code:
Verification Code: {{cancellationCode}}

Please keep this code safe. You will need to enter this code when canceling your reservation.

{{englishReminder}}

If you have any questions, please contact:
Center for EMI Teaching Excellence
Email: emicenter@mail.nsysu.edu.tw
Phone: (07) 525-2000 ext. 5808

Wishing you a wonderful day!
`,
  },

  reservationCancellation: {
    subject: '{{subjectPrefix}} 活動預約取消通知 / Reservation Cancellation Notice',
    body: `親愛的 {{studentName}} ({{studentId}}) 您好，

您已成功取消下列{{chineseDescription}}預約：
活動名稱：「{{eventName}}」
日期：{{date}}
時間：{{startTime}} - {{endTime}}
地點：{{locationZh}}

感謝您對本活動的支持，期待未來再次參與。

若有任何問題請聯繫:
全英語卓越教學中心 (Center for EMI Teaching Excellence)
Email: emicenter@mail.nsysu.edu.tw
電話: (07)5252000#5808

全英語卓越教學中心 敬上


Dear {{studentName}} ({{studentId}}),

You have successfully canceled your reservation for the following {{englishDescription}}:
Activity: 「{{eventName}}」
Date: {{date}}
Time: {{startTime}} - {{endTime}}
Location: {{locationEn}}

Thank you for your interest in this activity. We hope you will participate in our future events.

If you have any questions, please contact:
Center for EMI Teaching Excellence
Email: emicenter@mail.nsysu.edu.tw
Phone: (07) 525-2000 ext. 5808

Center for EMI Teaching Excellence
`,
  },

  waitlistJoined: {
    subject: '{{subjectPrefix}} 候補登記成功通知',
    body: `親愛的 {{studentName}} ({{studentId}}) 您好，

您已加入候補名單，活動：「{{eventName}}」
日期：{{date}}
時間：{{startTime}} - {{endTime}}
地點：{{locationZh}}

關於候補轉正說明：

   自動遞補： 若有名額釋出，系統將按候補順序自動轉為正式預約，並發信通知。

   確認時限： 請於活動前 2 小時留意信箱；若未收到通知信，則視為預約未成功。

   注意事項： 候補名單僅為系統內遞補依據，與活動現場的參與（入場）資格無關。

若有任何問題請聯繫:
全英語卓越教學中心 (Center for EMI Teaching Excellence)
Email: emicenter@mail.nsysu.edu.tw
電話: (07)5252000#5808

Dear {{studentName}} ({{studentId}}),

You have been added to the waitlist for: 「{{eventName}}」
Date: {{date}}
Time: {{startTime}} - {{endTime}}
Location: {{locationEn}}

   Auto-Promotion: Spots are filled automatically from the waitlist. You will receive an email if you are promoted.

   Final Confirmation: Please check your inbox up to 2 hours before the event starts. If you have not received a confirmation email by then, your booking was unsuccessful.

   Note: The waitlist serves solely as the basis for system substitutions and is unrelated to participation (entry) eligibility at the event venue.

Center for EMI Teaching Excellence
Email: emicenter@mail.nsysu.edu.tw
Phone: (07) 525-2000 ext. 5808
`,
  },

  waitlistPromoted: {
    subject: '{{subjectPrefix}} 候補轉正／正式預約通知',
    body: `親愛的 {{studentName}} ({{studentId}}) 您好，

您已由候補轉為正式預約，活動：「{{eventName}}」
日期：{{date}}
時間：{{startTime}} - {{endTime}}
地點：{{locationZh}}

【取消預約】須於活動開始前至少 2 小時完成；取消時需要您預約信上的驗證碼。

【取消預約驗證碼】
驗證碼：{{cancellationCode}}

若有任何問題請聯繫:
全英語卓越教學中心 (Center for EMI Teaching Excellence)
Email: emicenter@mail.nsysu.edu.tw
電話: (07)5252000#5808

Dear {{studentName}} ({{studentId}}),

Your waitlist spot has been promoted to a confirmed reservation for: 「{{eventName}}」
Date: {{date}}
Time: {{startTime}} - {{endTime}}
Location: {{locationEn}}

[Cancellation] You must cancel at least 2 hours before the event start time, using the verification code below.

[Verification code for cancellation]
Code: {{cancellationCode}}

Center for EMI Teaching Excellence
Email: emicenter@mail.nsysu.edu.tw
Phone: (07) 525-2000 ext. 5808
`,
  },

  blacklistNotification: {
    subject: '因違規取消{{chineseDescription}}預約通知',
    body: `親愛的 {{name}} ({{studentId}}) 您好，

由於您已累計兩次違規紀錄，系統已自動將您列入黑名單，限制預約權限至 {{unlockDate}}。

因此，您原本預約的以下活動已被取消：
• 活動名稱：{{eventName}}
• 日期：{{date}}
• 時間：{{startTime}} - {{endTime}}

請您於解鎖時間後再行預約。若有任何疑問，歡迎聯繫全英語卓越教學中心：
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5808

感謝您的理解與配合。

Dear {{name}} ({{studentId}}),

Due to two recorded violations, the system has automatically added you to the blacklist. Your reservation privileges have been suspended until {{unlockDate}}.

As a result, the following reservation has been cancelled:
• Event: {{eventName}}
• Event Type: {{eventType}}
• Date: {{date}}
• Time: {{startTime}} - {{endTime}}

Please make new reservations only after the suspension period has ended. If you have any questions, feel free to contact the Center for EMI Teaching Excellence:
📧 Email: emicenter@mail.nsysu.edu.tw
📞 Phone: (07) 525-2000 ext. 5808

Thank you for your understanding and cooperation.
`,
  },

  englishTestEmailVerification: {
    subject: '【培力英檢報名】信箱驗證碼 / BESTEP Email Verification Code',
    body: `您好，

您正在進行培力英檢報名信箱驗證。請於報名表單輸入以下驗證碼：

驗證碼：{{code}}
有效時間：{{expiresInMinutes}} 分鐘

若您未申請此驗證碼，請忽略本信件。請勿將驗證碼轉告知他人。

全英語卓越教學中心 敬上
📧 emicenter@mail.nsysu.edu.tw

---

Hello,

You are verifying your email for BESTEP registration. Please enter this code on the registration form:

Code: {{code}}
Valid for: {{expiresInMinutes}} minutes

If you did not request this code, please ignore this email.

Center for EMI Teaching Excellence
`,
  },

  englishLearningPassportEmailVerification: {
    subject: '【英語實踐歷程護照】信箱驗證碼 / ELP Email Verification Code',
    body: `您好，

您正在申請英語實踐歷程護照，請於頁面輸入以下驗證碼：

驗證碼：{{code}}
有效時間：{{expiresInMinutes}} 分鐘
學號：{{studentId}}

若您未申請此驗證碼，請忽略本信件。請勿將驗證碼轉告知他人。

全英語卓越教學中心 敬上
📧 emicenter@mail.nsysu.edu.tw

---

Hello,

You are verifying your email for the English Learning Passport application. Please enter this code on the page:

Code: {{code}}
Valid for: {{expiresInMinutes}} minutes
Student ID: {{studentId}}

If you did not request this code, please ignore this email.

Center for EMI Teaching Excellence
`,
  },

  englishTestRegistrationSuccess: {
    subject: '[培力英檢] 報名完成確認通知 / BESTEP Registration Confirmation',
    body: `親愛的 {{studentDisplayName}} ({{studentId}}) 您好，

我們已收到您的培力英檢報名資料，目前狀態為：{{statusZh}}。

【報名資料】
報名編號：{{registrationId}}
報名日期：{{registrationDateFormatted}}
報考項目：{{examTypeZh}}
電子郵件：{{email}}
聯絡電話：{{phone}}

審核結果將另行以 Email 通知，請留意信箱。

全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw
📞 電話：(07) 525-2000 分機 5876

---

Dear {{studentDisplayName}} ({{studentId}}),

We have received your BESTEP registration. Current status: {{statusEn}}.

[Registration]
ID: {{registrationId}}
Date: {{registrationDateFormatted}}
Exam type: {{examTypeEn}}
Email: {{email}}
Phone: {{phone}}

Center for EMI Teaching Excellence
`,
  },

  englishTestRegistrationRejected: {
    subject: '[培力英檢] 報名資料請修正通知 / BESTEP Registration Revision Required',
    body: `親愛的 {{studentDisplayName}} ({{studentId}}) 您好，

您的培力英檢報名資料需要修正，請依下列原因更新後再次送出。

【修正原因】
{{rejectionReasonsText}}

報名編號：{{registrationId}}
報考項目：{{examTypeZh}}

請登入報名系統完成修正。

全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw

---

Dear {{studentDisplayName}} ({{studentId}}),

Your BESTEP registration requires revision.

[Reason]
{{rejectionReasonsTextEn}}

Registration ID: {{registrationId}}
Exam type: {{examTypeEn}}

Center for EMI Teaching Excellence
`,
  },

  englishTestRegistrationFinalSuccess: {
    subject: '[培力英檢] 報名成功通知 / BESTEP Registration Success',
    body: `親愛的 {{studentDisplayName}} ({{studentId}}) 您好，

恭喜！您的 BESTEP 培力英檢報名已確認成功。

【報名資料確認】
報名編號：{{registrationId}}
報名日期：{{registrationDateFormatted}}
狀態：報名成功
報考項目：{{examTypeZh}}
電子郵件：{{email}}
聯絡電話：{{phone}}

考試相關資訊（時間、地點、注意事項等）將另行通知，請密切關注您的 Email。

全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw  📞 電話：(07) 525-2000 分機 5876

---

Dear {{studentDisplayName}} ({{studentId}}),

Congratulations! Your BESTEP registration has been confirmed.

Registration ID: {{registrationId}}
Exam type: {{examTypeEn}}

Center for EMI Teaching Excellence
`,
  },

  englishTestRegistrationFinalFailure: {
    subject: '[培力英檢] 報名結果通知 / BESTEP Registration Result',
    body: `親愛的 {{studentDisplayName}} ({{studentId}}) 您好，

很抱歉，您的培力英檢報名未能完成（報名失敗）。

【說明】
{{rejectionReasonsText}}

報名編號：{{registrationId}}
報考項目：{{examTypeZh}}

如有疑問請聯繫全英語卓越教學中心。
📧 Email：emicenter@mail.nsysu.edu.tw

---

Dear {{studentDisplayName}} ({{studentId}}),

We regret to inform you that your BESTEP registration was not successful.

[Details]
{{rejectionReasonsTextEn}}

Center for EMI Teaching Excellence
`,
  },

  englishTestRegistrationGroupPromo: {
    subject: '找學伴一起考英檢｜組隊報名最高可拿 5,000 元',
    body: `親愛的 {{studentDisplayName}} 您好：

想準備英檢，卻總是少一點動力或沒人一起？
這學期，西灣學院全英中心 推出【學習有伴培力英檢獎勵專案】，邀請你和朋友組隊一起報考培力英檢，有人陪、一起準備，還有機會獲得獎勵金！

✨ 活動亮點一次看：
• 3–4 人自由組隊，找同學、找朋友都可以
• 全員應考聽說讀寫即可獲得基本獎勵金
• 表現優異的團隊或個人可獲得最高 5,000 元獎勵金
• 名額有限，額滿即止

如果你想提升英語實力、累積正式測驗經驗，或只是想和朋友一起努力，這個專案很適合你！

👉 專案說明與報名方式請見：
{{registrationShortLink}}

歡迎揪團報名，一起挑戰英檢、一起成長！期待你的參與 🌱

西灣學院
全英語卓越教學中心 EMI Center
`,
  },

  englishTestRegistrationUpdated: {
    subject: '[培力英檢] 學生報名資料修改通知 / BESTEP Registration Update Notification',
    body: `【培力英檢報名資料修改通知】

有學生已成功修改培力英檢報名資料，請行政端進行追蹤。

【學生資訊】
• 姓名：{{studentDisplayName}}
• 學號：{{studentId}}
• 報名編號：{{registrationId}}
• 修改時間：{{updatedAtFormatted}}

【聯絡資訊】
• 學生 Email：{{email}}
• 學生電話：{{phone}}

請至系統後台查看詳細修改內容。

---
全英語卓越教學中心 (Center for EMI Teaching Excellence)
`,
  },

  englishTestRegistrationModificationComplete: {
    subject: '[培力英檢] 報名資料修改完成通知 / BESTEP Registration Update Complete',
    body: `親愛的 {{studentDisplayName}} ({{studentId}}) 您好，

您已成功修改培力英檢報名資料，我們已重新進入審核流程。

報名編號：{{registrationId}}
報考項目：{{examTypeZh}}
修改時間：{{updatedAtFormatted}}

審核結果將另行通知，請留意信箱。

全英語卓越教學中心 (Center for EMI Teaching Excellence)
📧 Email：emicenter@mail.nsysu.edu.tw

---

Dear {{studentDisplayName}} ({{studentId}}),

Your BESTEP registration update has been received and is under review again.

Registration ID: {{registrationId}}
Exam type: {{examTypeEn}}

Center for EMI Teaching Excellence
`,
  },

  learningPartnerInvitation: {
    subject: '[培力英檢] 學習有伴團體報名確認通知 / BESTEP Team-Up  Program Team Registration Confirmation',
    body: `親愛的 {{name}} ({{studentId}}) 您好，

您已被加入培力英檢「學習有伴」團體報名，團體資訊如下：

【團體資訊】
團體編號：{{teamId}}
團體名稱：{{teamName}}
團體人數：{{teamSize}} 人

【團體成員】
{{memberList}}

【重要提醒】
請在 {{expiresAtHours}} 小時內（{{expiresAt}} 前）點擊以下連結完成同意：

{{approvalLink}}

若您未點擊連結，此團體報名將在 {{expiresAtHours}} 小時後自動失效。

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
`,
  },

  learningPartnerInvitationResend: {
    subject: '[培力英檢] 學習有伴團體報名連結重新發送 / BESTEP Team-Up Program Invitation Resent',
    body: `親愛的 {{name}} ({{studentId}}) 您好，

此為學習有伴團體報名同意連結重新發送。

【團體資訊】
團體編號：{{teamId}}
團體名稱：{{teamName}}
團體人數：{{teamSize}} 人

【團體成員】
{{memberList}}

請在 {{expiresAtHours}} 小時內（{{expiresAt}} 前）點擊以下連結完成同意：

{{approvalLink}}

全英語卓越教學中心 敬上
`,
  },

  learningPartnerAllApproved: {
    subject: '[培力英檢] 學習有伴團體報名完成通知 / BESTEP Team-Up Program Team Confirmed',
    body: `親愛的 {{name}} ({{studentId}}) 您好，

您的學習有伴團體報名已全員同意完成。

【團體資訊】
團體編號：{{teamId}}
團體名稱：{{teamName}}

【團體成員】
{{memberList}}

後續流程請留意中心通知。

全英語卓越教學中心 敬上
`,
  },

  learningPartnerCancelled: {
    subject: '[培力英檢] 學習有伴團體報名取消通知 / BESTEP Team-Up Program Team Cancelled',
    body: `親愛的 {{name}} ({{studentId}}) 您好，

您的學習有伴團體報名已被取消。

【團體資訊】
團體編號：{{teamId}}
團體名稱：{{teamName}}
取消原因：{{reason}}

如需重新報名，請重新建立團體。

全英語卓越教學中心 敬上
`,
  },

  learningPartnerExpired: {
    subject: '[培力英檢] 學習有伴團體報名失效通知 / BESTEP Team-Up  Program Team Registration Expired',
    body: `親愛的 {{name}} ({{studentId}}) 您好，

您的培力英檢「學習有伴」團體報名已因超過期限未完成全員同意而自動失效。

【團體資訊】
團體編號：{{teamId}}
團體名稱：{{teamName}}

【後續說明】
此團體報名已失效，如需重新報名，請重新建立團體。

全英語卓越教學中心 敬上
`,
  },
};

function getEmailTemplateDefaultSource(key) {
  return EMAIL_TEMPLATE_DEFAULT_SOURCES[key] || null;
}

module.exports = {
  EMAIL_TEMPLATE_DEFAULT_SOURCES,
  getEmailTemplateDefaultSource,
};
