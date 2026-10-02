/**
 * 寄信前顯示收件對象與信件內容。確認鈕由外層對話框提供。
 */
export default function EnglishTestOutgoingMailPreview({ preview, loading = false, error = '' }) {
  if (!preview && !loading && !error) return null;

  return (
    <div className="english-test-mail-preview">
      <div className="mb-3">
        <div className="fw-semibold mb-1">寄給誰</div>
        {loading ? (
          <p className="mb-0 text-muted">正在計算收件人數…</p>
        ) : (
          <ul className="mb-0 ps-3">
            {(preview?.audience || []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {error ? <p className="text-danger small mb-0 mt-2">{error}</p> : null}
      </div>
      {preview ? (
        <>
          <div className="mb-3">
            <div className="fw-semibold mb-1">主旨</div>
            <div>{preview.subject}</div>
          </div>
          <div className="mb-2">
            <div className="fw-semibold mb-1">信件內容</div>
            <pre
              className="border rounded bg-light p-2 mb-2 small"
              style={{ whiteSpace: 'pre-wrap', maxHeight: '240px', overflow: 'auto' }}
            >
              {preview.body}
            </pre>
            {preview.personalNote ? (
              <p className="small text-muted mb-0">{preview.personalNote}</p>
            ) : null}
          </div>
          <p className="small mb-0">請核對收件對象與內容後，再按「確認並寄出」。寄出後無法撤回。</p>
        </>
      ) : null}
    </div>
  );
}
