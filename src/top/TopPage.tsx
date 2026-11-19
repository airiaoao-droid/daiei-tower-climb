import { useCallback, useEffect, useState } from 'react';
import { CouponCard, type Coupon } from './CouponCard';
import { CouponDetail } from './CouponDetail';

const OFFICIAL_URL = 'https://www.daiei-densetsu.jp/';
const CHARACTER = '/assets/images/chr_01_climber_2048x2048.png';

export default function TopPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [active, setActive] = useState<Coupon | null>(null);
  const close = useCallback(() => setActive(null), []);

  useEffect(() => {
    // Managed in public/coupons.json
    fetch('/coupons.json', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : []))
      .then((data: Coupon[]) => setCoupons(Array.isArray(data) ? data : []))
      .catch(() => setCoupons([]));
  }, []);

  return (
    <div className="home">
      {/* 1. Logo */}
      <header className="header">
        <span className="logo">
          <i className="logo__mark">⚡</i>
          大栄電設
        </span>
      </header>

      <main className="main">
        {/* 1. Main visual */}
        <section className="hero">
          <div className="hero__text">
            <p className="hero__en">DAIEI DENSETSU</p>
            <h1 className="hero__title">
              地域の暮らしを
              <br />
              電気で支える。
            </h1>
          </div>
          <img className="hero__img" src={CHARACTER} alt="" width={220} height={220} />
        </section>

        {/* 2. Menu */}
        <nav className="menu" aria-label="メニュー">
          <a className="menu__item" href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
            <span className="menu__icon">🏢</span>
            企業紹介
          </a>
          <a className="menu__item" href="#coupons">
            <span className="menu__icon">🎫</span>
            クーポン
          </a>
          <a className="menu__item" href="/game">
            <span className="menu__icon">🎮</span>
            ゲーム
          </a>
        </nav>

        {/* 3. Coupons */}
        <section id="coupons" className="section">
          <h2 className="section__title">COUPON</h2>
          {coupons.length > 0 ? (
            <div className="coupon-scroll">
              {coupons.map(c => (
                <CouponCard key={c.id} coupon={c} onOpen={setActive} />
              ))}
            </div>
          ) : (
            <p className="empty">準備中</p>
          )}
        </section>

        {/* 4. Game banner */}
        <section className="section">
          <a className="banner" href="/game">
            <div className="banner__text">
              <p className="banner__en">TOWER CLIMB</p>
              <p className="banner__title">鉄塔クライム</p>
              <span className="banner__cta">遊ぶ ▶</span>
            </div>
            <img className="banner__img" src={CHARACTER} alt="" width={120} height={120} loading="lazy" />
          </a>
        </section>
      </main>

      <footer className="footer">© DAIEI DENSETSU</footer>

      {active && <CouponDetail coupon={active} onClose={close} />}
    </div>
  );
}
