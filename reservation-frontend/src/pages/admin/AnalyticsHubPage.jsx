import React, { useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { buildAccessProfile } from '../../utils/accessControl';
import { buildAnalyticsHub } from './analyticsHubModel';
import './AnalyticsHubPage.css';

function HubLinks({ links }) {
  return (
    <ul className="analytics-hub__links">
      {links.map((link) => (
        <li key={link.id}>
          {link.allowed ? (
            <Link to={link.to}>{link.label}</Link>
          ) : (
            <p className="analytics-hub__denied">{`${link.label}：沒有權限`}</p>
          )}
          <p className="analytics-hub__detail">{link.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export default function AnalyticsHubPage() {
  const { token } = useOutletContext() || {};
  const model = buildAnalyticsHub(buildAccessProfile(token));

  useEffect(() => {
    document.title = '成效分析中心 | EEARS';
  }, []);

  return (
    <main className="analytics-hub">
      <header className="analytics-hub__header">
        <h1>成效分析中心</h1>
        <p>
          依你的權限進入既有分析頁。這一頁不計算新的統計，也不把不同時間定義的數字合成一個成效。
        </p>
        <p>
          <Link to={model.homePath}>{model.homeLabel}</Link>
        </p>
      </header>
      <div className="analytics-hub__grid">
        {model.sections.map((section) => (
          <section key={section.id} className="analytics-hub__card" aria-labelledby={`analytics-hub-${section.id}`}>
            <h2 id={`analytics-hub-${section.id}`}>{section.title}</h2>
            <p>{section.summary}</p>
            {section.links.length > 0 ? <HubLinks links={section.links} /> : null}
            {section.notes ? (
              <ul className="analytics-hub__notes">
                {section.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      <section className="analytics-hub__usage" aria-labelledby="analytics-hub-usage">
        <h2 id="analytics-hub-usage">統計使用說明</h2>
        <ul>
          <li>活動日、報名學期與學習成效快照不是同一個時間。</li>
          <li>各頁的列數、人數與班級統計不能加總成全中心成效。</li>
          <li>尚未核定的通過率與成長敘述只供查看限制，不能當正式報告。</li>
        </ul>
      </section>
    </main>
  );
}
