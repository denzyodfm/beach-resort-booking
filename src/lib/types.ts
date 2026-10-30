export type RoomType = string;

export type CottageCategory = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
};

export type Room = {
  id: string;
  slug: string;
  name: string;
  type: RoomType;
  categoryId: string;
  categoryName: string;
  description: string;
  longDescription: string;
  pricePerNight: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  size: string;
  image: string;
  gallery: string[];
  amenities: string[];
  bookingIncludes: string[];
  reservationHoldHours: number;
  premiumFeeEnabled?: boolean;
  premiumFeeAmount?: number;
  reservationFeeEnabled?: boolean;
  reservationFeeAmount?: number;
  onlineReservable?: boolean;
  featured?: boolean;
  available?: boolean;
};

export type BookingStatus = "pending" | "confirmed" | "checked_in" | "cancelled";
export type PaymentStatus =
  | "unpaid"
  | "authorized"
  | "deposit_paid"
  | "paid"
  | "refunded";

export type Booking = {
  id: string;
  /** Guest-facing number, e.g. BK-2C5FA11D. */
  bookingNumber?: string;
  roomId: string;
  roomName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
  cottageSubtotal?: number;
  premiumFeeAmount?: number;
  reservationFeeAmount?: number;
  internetFeeAmount?: number;
  entranceFeeAmount?: number;
  /** Regular / children / senior-PWD guests, when the booking recorded them. */
  party?: { regular: number; child: number; senior: number };
  entranceRates?: { regular: number; child: number; senior: number };
  /** "standard" = cottage assigned by the resort, "premium" = guest picked it. */
  bookingType?: "standard" | "premium";
  channel?: "online" | "walk_in";
  /** ISO time after which an unpaid booking is cancelled automatically. */
  paymentDeadline?: string;
  /** GCash/bank reference number the guest submitted for verification. */
  paymentReference?: string;
  /** Sales invoice number issued at the front desk, e.g. SI-2026-000001. */
  invoiceNumber?: string;
  /** ISO time the guest was checked in at the front desk. */
  checkedInAt?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentNote?: string;
  paymentAmountPaid?: number;
  paymentProofUrl?: string;
  paymentProofName?: string;
  paymentHistory?: PaymentLog[];
  refundAmount?: number;
  refundReason?: string;
  createdAt: string;
};

export type PaymentLog = {
  id: string;
  type: "payment" | "refund";
  amount: number;
  note: string;
  proofName?: string;
  paidBy?: string;
  actorName: string;
  actorRole: string;
  createdAt: string;
  balanceAfter?: number;
};

export type ReviewStatus = "pending" | "published";

export type Review = {
  id: string;
  roomId: string;
  roomName: string;
  guestName: string;
  guestEmail: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  createdAt: string;
};
