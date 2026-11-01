import React, { useEffect } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { buildAccessProfile } from '../../utils/accessControl';
import { buildAnalyticsHub } from './analyticsHubModel';
import './AnalyticsHubPage.css';

function HubLink({ link, primary = false }) {
  return (
    <li className={primary ? 'analytics-hub__primary' : undefined}>
      {link.allowed ? (
        <Link to={link.to}>{link.label}</Link>
      ) : (
        <p className="analytics-hub__denied">{`${link.label}：沒有權限`}</p>
      )}
      <p className="analytics-hub__detail">{link.detail}</p>
    </li>
  );
}

function HubLinks({ links }) {
  const primary = links.filter((link) => link.primary);
  const secondary = links.filter((link) => !link.primary);
  return (
    <>
      {primary.length > 0 ? (
        <>
          <p className="analytics-hub__entry-label">主要入口</p>
          <ul className="analytics-hub__links">
            {primary.map((link) => <HubLink key={link.id} link={link} primary />)}
          </ul>
        </>
      ) : null}
      {secondary.length > 0 ? (
        <>
          <p className="analytics-hub__entry-label">其他入口</p>
          <ul className="analytics-hub__links">
            {secondary.map((link) => <HubLink key={link.id} link={link} />)}
          </ul>
        </>
      ) : null}
    </>
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
            {section.scope ? <p className="analytics-hub__scope">{section.scope}</p> : null}
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
          <li>中心營運的預約筆數與不重複學生數不同，不能互相當成同一件事。</li>
          <li>BESTEP 畫面上的既有通過率尚未核准，不是官方達標率。</li>
          <li>學習參與的資源接觸、參與事件與能力變化，都不是已確認的因果效果。</li>
          <li>這三個領域的比例分母不同，也不能把活動日、班級學期與分析快照合成一個篩選。</li>
        </ul>
      </section>
    </main>
  );
}
