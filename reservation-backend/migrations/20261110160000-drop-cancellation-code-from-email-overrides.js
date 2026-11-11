'use strict';

/**
 * 已儲存的郵件覆寫若仍寫著取消驗證碼，改成登入後自行取消。
 * 沒有覆寫列時不動作；程式預設模板已另行更新。
 */

const REPLACEMENTS = [
  [
    `【取消預約驗證碼】
如需取消此預約，請使用以下驗證碼：
驗證碼：{{cancellationCode}}

請妥善保管此驗證碼，取消預約時需要輸入此驗證碼才能完成取消。`,
    `【取消預約】
如需取消，請登入學生帳號，到「我的預約」自行取消。請在該活動的取消期限內完成，期限依活動類型而定。`,
  ],
  [
    `[Cancellation Code]
If you need to cancel this reservation, please use the following verification code:
Verification Code: {{cancellationCode}}

Please keep this code safe. You will need to enter this code when canceling your reservation.`,
    `[Cancellation]
To cancel, sign in and open My Reservations. Cancel before that activity’s deadline. The deadline depends on the activity type.`,
  ],
  [
    `【取消預約】須於活動開始前至少 2 小時完成；取消時需要您預約信上的驗證碼。

【取消預約驗證碼】
驗證碼：{{cancellationCode}}`,
    '【取消預約】請登入學生帳號，到「我的預約」自行取消。請在該活動的取消期限內完成，期限依活動類型而定。',
  ],
  [
    `[Cancellation] You must cancel at least 2 hours before the event start time, using the verification code below.

[Verification code for cancellation]
Code: {{cancellationCode}}`,
    '[Cancellation] Sign in and open My Reservations. Cancel before that activity’s deadline. The deadline depends on the activity type.',
  ],
];

async function rewriteOverrides(queryInterface, direction) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id, bodyTemplate FROM email_template_overrides
     WHERE templateKey IN ('reservationSuccess', 'waitlistPromoted')
       AND bodyTemplate IS NOT NULL`
  );
  const pairs = direction === 'up' ? REPLACEMENTS : REPLACEMENTS.map(([from, to]) => [to, from]);
  await Promise.all(rows.map(async (row) => {
    let next = row.bodyTemplate;
    pairs.forEach(([from, to]) => {
      next = String(next).split(from).join(to);
    });
    if (next === row.bodyTemplate) return;
    await queryInterface.bulkUpdate(
      'email_template_overrides',
      { bodyTemplate: next },
      { id: row.id }
    );
  }));
}

module.exports = {
  async up(queryInterface) {
    await rewriteOverrides(queryInterface, 'up');
  },

  async down(queryInterface) {
    await rewriteOverrides(queryInterface, 'down');
  },

};
