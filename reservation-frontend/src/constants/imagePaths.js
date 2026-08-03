/**
 * 首頁與全站圖片路徑集中管理
 * 實際檔案請放在 public/images/ 下，引用時為 /images/xxx
 */
const BASE = '/images';

export const IMAGES = {
  hero: `${BASE}/hero-visual.png`,
  heroFallback: `${BASE}/home-photo-1.jpg`,
  home1: `${BASE}/home-photo-1.jpg`,
  home2: `${BASE}/home-photo-2.jpg`,
  home3: `${BASE}/home-photo-3.jpg`,
  home4: `${BASE}/home-photo-4.jpg`,
  ogHome: `${BASE}/og-home.jpg`,
  bgPattern: `${BASE}/bg-pattern2.png`,
  englishTable: `${BASE}/english_table.jpg`,
  englishClub: `${BASE}/english_club.jpg`,
  internationalForum: `${BASE}/international_forum.jpg`,
  placeholder: `${BASE}/placeholder.jpg`,
  jobTalk: [
    `${BASE}/job_talk_1.jpg`,
    `${BASE}/job_talk_2.jpg`,
    `${BASE}/job_talk_3.jpg`,
    `${BASE}/job_talk_4.jpg`,
    `${BASE}/job_talk_5.jpg`,
    `${BASE}/job_talk_6.jpg`,
  ],
  writingWorkshop: `${BASE}/Leap Write In.jpg`,
};

/** 取得 Hero 主視覺圖 */
export function getHeroImageUrl() {
  return IMAGES.hero;
}

export default IMAGES;
