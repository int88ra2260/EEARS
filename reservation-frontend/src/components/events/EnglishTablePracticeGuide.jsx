import React from 'react';

const COPY = {
  'before-booking': {
    title: '這場可以先練口說',
    steps: [
      '預約完成後，在成功畫面選一題按「會前練習」。',
      '請先登入。系統用登入學號留下你說的句子，和一句現場可以接的話。',
      '該組 Leader 用這句開場。這不是分數，也不會變成檢定等級。',
      '活動結束後，到「我的預約」同一題按「活動後複習」，才會和會前比較。',
    ],
  },
  'after-booking': {
    title: '下一步：先練今晚的題目',
    steps: [
      '下面每一題都有「會前練習」。選一題，用登入帳號錄一段。',
      '錄完會看到系統聽到的句子，以及一句現場可以接的話。',
      '你的組 Leader 會看到這一句，用來開場。這不是分數。',
      '活動結束後，打開「我的預約」，同一題按「活動後複習」。句子也會留在「我的進度」。',
    ],
  },
  reservation: {
    title: '這場的口說練習',
    steps: [
      '會前練習：錄完看到自己的句子和一句接話。Leader 用這句開場，不是分數。',
      '活動後複習：同一題再錄一次，系統和會前比較。',
      '句子留在「我的進度」，換裝置還在。請用登入帳號練習。',
    ],
  },
};

export default function EnglishTablePracticeGuide({ variant = 'after-booking' }) {
  const copy = COPY[variant] || COPY['after-booking'];
  return (
    <section className="et-practice-guide" aria-label={copy.title}>
      <h3 className="et-practice-guide__title">{copy.title}</h3>
      <ol className="et-practice-guide__steps">
        {copy.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </section>
  );
}
