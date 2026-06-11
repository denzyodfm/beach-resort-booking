export type RoomType = "cove" | "rock" | "rd" | "hall" | "pavillon";

export type Room = {
  id: string;
  slug: string;
  name: string;
  type: RoomType;
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
  featured?: boolean;
  available?: boolean;
};

export type BookingStatus = "pending" | "confirmed" | "cancelled";
export type PaymentStatus =
  | "unpaid"
  | "authorized"
  | "deposit_paid"
  | "paid"
  | "refunded";

export type Booking = {
  id: string;
  roomId: string;
  roomName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
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
