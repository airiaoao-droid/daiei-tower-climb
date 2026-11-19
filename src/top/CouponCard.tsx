export interface Coupon {
  id: string;
  /** Wide image (recommended 1200x675, 16:9). Put files in public/coupons/ */
  image: string;
  title: string;
  /** 特典内容 */
  benefit: string;
  /** 利用条件 */
  conditions: string[];
  /** 有効期限 e.g. "2026/12/31" */
  until: string;
  /** Optional code shown in the detail view */
  code?: string;
  /** true = placeholder. Shown with SAMPLE label and cannot be used */
  sample?: boolean;
}

export function CouponCard({ coupon, onOpen }: { coupon: Coupon; onOpen: (c: Coupon) => void }) {
  return (
    <button
      type="button"
      className="coupon-card"
      onClick={() => onOpen(coupon)}
      aria-label={`${coupon.title}の詳細`}
    >
      <img src={coupon.image} alt="" loading="lazy" width={1200} height={675} />
      {coupon.sample && <span className="tag tag--sample">SAMPLE</span>}
    </button>
  );
}
