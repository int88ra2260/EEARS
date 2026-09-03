/**
 * EMI 中心師資與行政團隊（站內預設名單；後台 Site Content 可覆寫）
 */

export const EMI_CENTER_TEAM_URL = 'https://emicenter.siwan.nsysu.edu.tw/about/team';
export const EMI_CENTER_ADMIN_URL = 'https://emicenter.siwan.nsysu.edu.tw/about/admin';

/** @typedef {{ zh: string, en: string }} BilingualText */

/**
 * @typedef {Object} StaffMember
 * @property {string} id
 * @property {BilingualText} name
 * @property {BilingualText} role
 * @property {string} [email]
 * @property {string} [extension] 分機號碼（不含總機）
 */

/** @type {StaffMember[]} */
export const EMI_FACULTY = [
  {
    id: 'huang-shuping',
    name: { zh: '黃舒屏', en: 'Shu-Ping Huang' },
    role: {
      zh: '西灣學院副院長兼全英語卓越教學中心執行長',
      en: 'Associate Dean, Siwan College & Director, EMI Center',
    },
    email: 'sphuang@mail.nsysu.edu.tw',
    extension: '5808 / 3170',
  },
  {
    id: 'chen-juihua',
    name: { zh: '陳瑞華', en: 'Jui-Hua Chen' },
    role: {
      zh: '約聘助理教授／英文寫作工坊召集人',
      en: 'Adjunct Assistant Professor / English Writing Workshop Coordinator',
    },
    email: 'juihua@mail.nsysu.edu.tw',
    extension: '5809',
  },
  {
    id: 'chuang-chiahsiung',
    name: { zh: '莊家雄', en: 'Chia-Hsiung Chuang' },
    role: {
      zh: '約聘助理教授／西灣國際沙龍召集人',
      en: 'Adjunct Assistant Professor / Siwan International Salon Coordinator',
    },
    email: 'charlie1212@mail.nsysu.edu.tw',
    extension: '5807',
  },
  {
    id: 'dai-tengmao',
    name: { zh: '戴藤懋', en: 'Teng-Mao Dai' },
    role: {
      zh: '約聘助理教授／國際論壇指導老師',
      en: 'Adjunct Assistant Professor / International Forum Instructor',
    },
    email: 'hayward@mail.nsysu.edu.tw',
    extension: '5807',
  },
  {
    id: 'wang-pinhuey',
    name: { zh: '王品惠', en: 'Pin-Huey Wang' },
    role: { zh: '約聘助理教授', en: 'Adjunct Assistant Professor' },
    email: 'pinhuey@mail.nsysu.edu.tw',
    extension: '5871',
  },
  {
    id: 'liu-jijen',
    name: { zh: '劉季貞', en: 'Ji-Jen Liu' },
    role: { zh: '兼任助理教授', en: 'Part-time Assistant Professor' },
    email: 'grace@nkust.edu.tw',
  },
  {
    id: 'chen-meishu',
    name: { zh: '陳美淑', en: 'Mei-Shu Chen' },
    role: { zh: '兼任助理教授', en: 'Part-time Assistant Professor' },
    email: 'gmsc1976@outlook.com',
  },
  {
    id: 'wen-huichen',
    name: { zh: '溫惠珍', en: 'Hui-Chen Wen' },
    role: { zh: '兼任助理教授', en: 'Part-time Assistant Professor' },
    email: 'wenhc@mail.nsysu.edu.tw',
  },
  {
    id: 'tseng-chienwen',
    name: { zh: '曾千紋', en: 'Chien-Wen Tseng' },
    role: { zh: '兼任講師', en: 'Part-time Lecturer' },
    email: 'ctseng@mail.nsysu.edu.tw',
  },
  {
    id: 'pruett-andrew',
    name: { zh: '傅安德', en: 'Andrew Martin Pruett' },
    role: { zh: '兼任講師', en: 'Part-time Lecturer' },
    email: 'andrewmartinpruett@gmail.com',
  },
  {
    id: 'tseng-tsaimei',
    name: { zh: '曾彩楣', en: 'Tsai-Mei Tseng' },
    role: { zh: '兼任講師', en: 'Part-time Lecturer' },
    email: 'tseng48@yahoo.com.tw',
  },
  {
    id: 'elayna-ahpuck',
    name: { zh: '歐伊蘭', en: 'Elayna Ah Puck' },
    role: { zh: 'EMI 顧問', en: 'EMI Consultant' },
  },
  {
    id: 'matt-travers',
    name: { zh: '查丹虎', en: 'Matt Travers' },
    role: { zh: '英語協同教學人員', en: 'English Co-teaching Staff' },
  },
  {
    id: 'savannah-ealy',
    name: { zh: '葉思娜', en: 'Savannah Ealy' },
    role: { zh: '英語協同教學人員', en: 'English Co-teaching Staff' },
  },
];

/** @type {StaffMember[]} */
export const EMI_ADMIN_STAFF = [
  {
    id: 'lin-weixiu',
    name: { zh: '林韋秀', en: 'Wei-Hsiu Lin' },
    role: { zh: '專員', en: 'Specialist' },
    email: 'whlin@mail.nsysu.edu.tw',
    extension: '5876',
  },
  {
    id: 'hsia-yishan',
    name: { zh: '夏伊姍', en: 'Yi-Shan Hsia' },
    role: { zh: '專業副理', en: 'Senior Associate' },
    email: 'hys5876@mail.nsysu.edu.tw',
    extension: '5876',
  },
  {
    id: 'kao-hsueshao',
    name: { zh: '高學紹', en: 'Hsueh-Shao Kao' },
    role: { zh: '專案行政一級組員', en: 'Project Admin Officer (Grade I)' },
    email: 'hsuehshao347@mail.nsysu.edu.tw',
    extension: '5808',
  },
  {
    id: 'tu-shihao',
    name: { zh: '屠士豪', en: 'Shi-Hao Tu' },
    role: { zh: '專案行政二級組員', en: 'Project Admin Officer (Grade II)' },
    email: 'bdntsh830614@mail.nsysu.edu.tw',
    extension: '5808',
  },
];

export const EMI_MAIN_PHONE = '07-5252000';
