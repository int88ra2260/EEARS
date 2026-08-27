import React from 'react';
import { Link } from 'react-router-dom';
import './home.css';

const CTA_ITEMS = [
  {
    icon: 'search',
    title: '查詢 / 取消我的預約',
    desc: '查詢或取消已預約的活動',
    link: '/my-reservations',
  },
  {
    icon: 'clipboard',
    title: '本學期問卷',
    desc: '查看本學期是否有需填問卷',
    link: '/survey/choice',
  },
  {
    icon: 'warning',
    title: '活動規則 / 違規說明',
    desc: '了解預約與違規規定',
    link: '/rules',
  },
];

const ICON_MAP = {
  search: '🔍',
  clipboard: '📝',
  warning: '⚠️',
};

function CTACard({ item }) {
  const iconChar = ICON_MAP[item.icon] || '•';
  return (
    <Link
      to={item.link}
      className="home-cta-card"
      aria-labelledby={`cta-title-${item.icon}`}
    >
      <div className="home-cta-card__icon" aria-hidden>
        {iconChar}
      </div>
      <h3 id={`cta-title-${item.icon}`} className="home-cta-card__title">
        {item.title}
      </h3>
      <p className="home-cta-card__desc">{item.desc}</p>
    </Link>
  );
}

export default function HomeCTASection() {
  return (
    <section className="home-section home-cta-section" aria-label="快速入口 CTA">
      <div className="home-cta-section__inner">
        <div className="home-cta-grid" role="list">
          {CTA_ITEMS.map((item, idx) => (
            <div key={idx} role="listitem">
              <CTACard item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
