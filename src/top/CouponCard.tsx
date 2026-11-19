export interface Coupon {
  id: string;
  title: string;
  /** e.g. "10%OFF", "¥500" */
  value: string;
  /** e.g. "〜2026/12/31" (optional) */
  until?: string;
  /** optional code to show at the counter */
  code?: string;
}

export function CouponCard({ coupon }: { coupon: Coupon }) {
  return (
    <article className="coupon">
      <strong className="coupon__value">{coupon.value}</strong>
      <div className="coupon__body">
        <p className="coupon__title">{coupon.title}</p>
        {(coupon.until || coupon.code) && (
          <p className="coupon__meta">
            {coupon.until}
            {coupon.code && <code>{coupon.code}</code>}
          </p>
        )}
      </div>
    </article>
  );
}
