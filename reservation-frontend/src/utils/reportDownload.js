/**
 * 從 Content-Disposition 解析檔名（優先 ASCII filename=）
 */
export function parseFilenameFromContentDisposition(header) {
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(';').map((s) => s.trim());
  for (const p of parts) {
    if (p.toLowerCase().startsWith('filename*=')) {
      const v = p.slice(p.indexOf('=') + 1).trim();
      const decoded = v.replace(/^UTF-8''/i, '');
      try {
        return decodeURIComponent(decoded.replace(/\+/g, ' '));
      } catch {
        return decoded;
      }
    }
  }
  for (const p of parts) {
    if (p.toLowerCase().startsWith('filename=')) {
      let v = p.slice('filename='.length).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      return v;
    }
  }
  return null;
}
