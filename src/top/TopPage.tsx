import { useEffect, useState } from 'react';
import { CouponCard, type Coupon } from './CouponCard';

const OFFICIAL_URL = 'https://www.daiei-densetsu.jp/';

export default function TopPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  useEffect(() => {
    // Coupons are managed in public/coupons.json (edit the file to add/remove)
    fetch('/coupons.json', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : []))
      .then((data: Coupon[]) => setCoupons(Array.isArray(data) ? data : []))
      .catch(() => setCoupons([]));
  }, []);

  return (
    <main className="top">
      <section className="hero">
        <img
          className="hero__img"
          src="/assets/images/chr_01_climber_2048x2048.png"
          alt="大栄電設"
          width={220}
          height={220}
        />
        <a className="btn btn--primary" href="/game">
          ▶ 鉄塔クライムで遊ぶ
        </a>
      </section>

      {coupons.length > 0 && (
        <section className="section" aria-label="クーポン">
          <h2 className="section__title">COUPON</h2>
          <div className="coupons">
            {coupons.map(c => (
              <CouponCard key={c.id} coupon={c} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <a className="btn btn--outline" href={OFFICIAL_URL} target="_blank" rel="noopener noreferrer">
          大栄電設について ↗
        </a>
      </section>
    </main>
  );
}
