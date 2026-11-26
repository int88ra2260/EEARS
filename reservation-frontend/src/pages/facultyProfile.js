export function facultyProfilePath(memberId) {
  return `/about/faculty/${encodeURIComponent(memberId)}`;
}

export function facultyProfileSections(member, lang) {
  const sections = member?.profile?.sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section) => {
    const body = lang === 'en' && section.bodyEn
      ? section.bodyEn
      : (section.bodyZh || section.bodyEn || '');
    const label = lang === 'en' && section.labelEn
      ? section.labelEn
      : (section.labelZh || section.labelEn || '');
    const lines = String(body)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!label || !lines.length) return [];
    return [{ label, lines }];
  });
}

export function facultyRoleLines(role) {
  return String(role || '')
    .split(/\s*[/／]\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isProfileLinkLine(line) {
  return /^https?:\/\/\S+$/i.test(line);
}
