import React from 'react';

export default function ClassBestepDataReading({ statistics }) {
  const hasRate = statistics && statistics.passRate != null && statistics.passRate !== '';
  return (
    <section className="mb-3" aria-labelledby="bestep-reading" data-testid="bestep-reading">
      <h3 id="bestep-reading" className="h6">資料怎麼讀</h3>
      <ul className="small mb-2">
        <li>個人報名看這一列的報名狀態。未報名不是缺考。</li>
        <li>出席用文字區分：出席、缺席、未確認、未匯入。未確認與未匯入不同，都不能當成缺考。</li>
        <li>抵免寫在抵免欄，不是到考，也不改寫出席。</li>
        <li>沒有成績列是未匯入，不是未到考。總分或四技能分數 0 是已記錄的分數；沒有欄位、空白是缺值。</li>
        <li>CEFR 級別用已儲存的值。B2 不能還原成 B2+。</li>
        <li>這裡的學期是班級頁帶入的學期，不是各科考試日期。</li>
        <li>匯出仍是既有 Excel。畫面中的未確認出席，在既有匯出格式可能以空白呈現。這次沒有修改匯出檔。</li>
      </ul>
      {statistics ? (
        <p className="small mb-0">
          既有統計口徑是 {hasRate ? `${statistics.passRate}%` : '—'}
          ，通過人數 {statistics.passedCount ?? '—'}。
          分子是有成績且標記通過的人數，分母是匯出摘要的成功報名人數，兩者不是同一母體。
          此值尚未核准為官方達標率，不用來下成效結論。
          超過 100 的數值照 API 顯示；分母為 0 時 API 回傳的 0 也照顯示。
        </p>
      ) : (
        <p className="small text-muted mb-0">統計尚未載入，這裡不另算通過比例。</p>
      )}
    </section>
  );
}
