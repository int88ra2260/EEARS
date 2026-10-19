import Alert from 'react-bootstrap/Alert';

const GUIDE = [
  '場次成效是 Leader 勾選的任務完成率，只計已簽到學生；全員同一套任務，分母是這份清單。核薪只看標成必選的題目。',
  '能力快照是分組當下的 CEFR · GSE，不是官方英檢成績。',
  '英檢變化沿用學習成效分析：只配對同一測驗，以原始分差為主、GSE 為輔。',
  '三者並列觀察，不解釋成參加 English Table 造成進步，也不用來排名 Leader。',
];

export default function EtOutcomeReadingGuide({ items }) {
  const lines = Array.isArray(items) && items.length ? items : GUIDE;
  return (
    <Alert variant="light" className="border small mb-3">
      <div className="fw-semibold mb-1">這頁怎麼讀</div>
      <ul className="mb-0 ps-3">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Alert>
  );
}
