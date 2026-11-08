/**
 * English Table LEADERS 公開團隊頁。
 * 只放可公開的顯示名與選填介紹。不要加入學號、帳號、信箱、電話或時薪。
 * 選填：photo、videoId、degree、experience、languages、focus。
 */

export const LEADERS_TEAM = [
  { id: 'udon', name: '謝宗叡 Udon' },
  { id: 'audrey', name: '吳采嫣 Audrey' },
  { id: 'angela', name: '蔡郁萱 Angela' },
  { id: 'andrew', name: '吳昱熲 Andrew' },
  { id: 'angelique', name: '葉安雅 Angelique' },
  { id: 'sherina', name: '林美玲 Sherina' },
  { id: 'nat', name: '席娜婷 Nat' },
  { id: 'lance', name: '黃冠勛 Lance' },
  { id: 'louise', name: '阮氏文莊 Louise' },
  { id: 'alison', name: '鄧瓊安 Alison' },
  { id: 'satyam', name: '司塔揚 Satyam' },
  { id: 'ara', name: '艾若文 Ara' },
  { id: 'portia', name: '黎阮紅明 Portia' },
  { id: 'summer', name: '焦澄 Summer' },
  { id: 'uswa', name: '巫珊娜 Uswa' },
  { id: 'elvina', name: '林意甜 Elvina' },
  { id: 'alexx', name: '古清越 Alexx' },
  { id: 'michael', name: '阮珍元 Michael' },
];

const PROFILE_FIELDS = ['degree', 'experience', 'languages', 'focus'];

export function listLeaders() {
  return LEADERS_TEAM;
}

export function leaderMonogram(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const latin = [...parts].reverse().find((part) => /[A-Za-z]/.test(part));
  const source = latin || parts[0] || '?';
  return source.slice(0, 1).toUpperCase();
}

export function leaderFieldRows(leader) {
  if (!leader) return [];
  return PROFILE_FIELDS.flatMap((key) => {
    const value = String(leader[key] || '').trim();
    return value ? [{ key, value }] : [];
  });
}

export function youtubeEmbedUrl(videoId) {
  const id = String(videoId || '').trim();
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return '';
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
