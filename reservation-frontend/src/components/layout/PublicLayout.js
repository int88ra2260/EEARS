import React from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../Header';
import AnnouncementTicker from './AnnouncementTicker';
import HomeFooter from '../home/HomeFooter';
import '../../styles/public-ui.css';
import '../../styles/emi-brand.css';
import '../../styles/magic-ui.css';
import '../../styles/site-footer.css';

/**
 * 公開前台共用版面：Header + Main + HomeFooter
 * /about：正式公開頁，全寬版面但保留公告跑馬燈與頁尾。
 * /：桌面可蓋上 Scroll World 沉浸層（由 HomePage 控制）；手機維持一般首頁。
 * /hometest：A 方案首頁測試，全寬但保留跑馬燈（接近正式首頁行為）。
 */
export default function PublicLayout({ children, homeBanner = null }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isPublic = location.pathname !== '/login' && !isAdmin;
  const isHome = location.pathname === '/';
  const isHomeTest = location.pathname === '/hometest';
  const isAbout = location.pathname === '/about';
  const isFullBleed = isHome || isHomeTest || isAbout;

  if (!isPublic) {
    return (
      <main
        id="main-content"
        className={`app-main mt-3 mb-4${isAdmin ? ' app-main--admin' : ' container'}`}
        style={{ flex: '1 1 auto' }}
        tabIndex={-1}
      >
        {children}
      </main>
    );
  }

  return (
    <>
      <Header />
      <AnnouncementTicker />
      {homeBanner}
      <main
        id="main-content"
        className={`app-main public-site${
          isFullBleed
            ? isHome || isHomeTest
              ? isHomeTest
                ? ' public-site--home public-site--hometest'
                : ' public-site--home'
              : ' public-site--about'
            : ' container mt-3 mb-4'
        }`}
        style={{ flex: '1 1 auto' }}
        tabIndex={-1}
      >
        {children}
      </main>
      <HomeFooter />
    </>
  );
}
