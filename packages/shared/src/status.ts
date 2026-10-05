/** Order lifecycle (agreed workflow). */
export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAYMENT_REVIEW',
  'NEW',
  'PURCHASING',
  'NEEDS_DECISION',
  'AT_CN_WAREHOUSE',
  'SHIPPED',
  'ARRIVED_BD',
  'DELIVERED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ROLES = ['OWNER', 'BD_ORDER', 'CN_PURCHASE', 'CN_WAREHOUSE', 'SHIPMENT', 'BD_DELIVERY', 'ACCOUNTS'] as const;
export type Role = (typeof ROLES)[number];

export const STATUS_LABEL_BN: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'পেমেন্ট বাকি',
  PAYMENT_REVIEW: 'পেমেন্ট যাচাই',
  NEW: 'নতুন অর্ডার',
  PURCHASING: 'কেনা হচ্ছে',
  NEEDS_DECISION: 'সিদ্ধান্ত দরকার',
  AT_CN_WAREHOUSE: 'চায়না গুদামে',
  SHIPPED: 'শিপমেন্টে',
  ARRIVED_BD: 'বাংলাদেশে পৌঁছেছে',
  DELIVERED: 'ডেলিভারড',
  CANCELLED: 'বাতিল',
};

/** Allowed transitions. Anything not listed is rejected by the API. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_REVIEW', 'NEW', 'CANCELLED'],
  PAYMENT_REVIEW: ['NEW', 'PENDING_PAYMENT', 'CANCELLED'],
  NEW: ['PURCHASING', 'CANCELLED'],
  PURCHASING: ['NEEDS_DECISION', 'AT_CN_WAREHOUSE', 'CANCELLED'],
  NEEDS_DECISION: ['PURCHASING', 'CANCELLED'],
  AT_CN_WAREHOUSE: ['SHIPPED'],
  SHIPPED: ['ARRIVED_BD'],
  ARRIVED_BD: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Which team may move an order OUT of a status. OWNER can do everything. */
export const STATUS_OWNER: Record<OrderStatus, Role[]> = {
  PENDING_PAYMENT: ['ACCOUNTS', 'BD_ORDER'],
  PAYMENT_REVIEW: ['ACCOUNTS'],
  NEW: ['BD_ORDER'],
  PURCHASING: ['CN_PURCHASE'],
  NEEDS_DECISION: ['BD_ORDER'],
  AT_CN_WAREHOUSE: ['CN_WAREHOUSE', 'SHIPMENT'],
  SHIPPED: ['SHIPMENT'],
  ARRIVED_BD: ['BD_DELIVERY'],
  DELIVERED: [],
  CANCELLED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus, role: Role): boolean =>
  TRANSITIONS[from].includes(to) && (role === 'OWNER' || STATUS_OWNER[from].includes(role));
