import { useEffect } from 'react';
import type { Coupon } from './CouponCard';

export function CouponDetail({ coupon, onClose }: { coupon: Coupon; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={coupon.title}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" className="sheet__close" onClick={onClose} aria-label="閉じる">
          ✕
        </button>

        <img className="sheet__img" src={coupon.image} alt="" width={1200} height={675} />

        {coupon.sample && <p className="notice">サンプル表示です。現在ご利用いただけません。</p>}

        <h2 className="sheet__title">{coupon.title}</h2>

        <dl className="detail">
          <dt>特典</dt>
          <dd className="detail__benefit">{coupon.benefit}</dd>
          <dt>有効期限</dt>
          <dd>{coupon.until}</dd>
          <dt>利用条件</dt>
          <dd>
            <ul>
              {coupon.conditions.map(c => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </dd>
        </dl>

        {!coupon.sample && coupon.code && <p className="code">{coupon.code}</p>}
      </section>
    </div>
  );
}
