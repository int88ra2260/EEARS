import React from 'react';
import Header from '../Header';
import AnnouncementTicker from './AnnouncementTicker';
import HomeFooter from '../home/HomeFooter';
import '../../styles/public-ui.css';
import '../../styles/emi-brand.css';
import '../../styles/magic-ui.css';
import '../../styles/site-footer.css';

/**
 * 後台文案視覺預覽用：永遠顯示學生端 Header／頁尾（不受 /admin 路徑影響）。
 */
export default function PublicPreviewChrome({ variant = 'public', children }) {
  const isHome = variant === 'home';
  const isAbout = variant === 'about';
  const isFullBleed = isHome || isAbout;

  return (
    <div className="scm-visual-public-root">
      <Header />
      {!isAbout ? <AnnouncementTicker /> : null}
      <main
        className={`app-main public-site${
          isFullBleed
            ? isHome
              ? ' public-site--home'
              : ' public-site--about'
            : ' container mt-3 mb-4'
        }`}
        style={{ flex: '1 1 auto' }}
      >
        {children}
      </main>
      <HomeFooter />
    </div>
  );
}
