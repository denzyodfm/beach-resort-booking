-- BOLIHON Beach Resort cottage booking schema for MySQL 8 / MariaDB 10.4+.
-- Ported from supabase/schema.sql. Timestamps are stored in UTC; the app sets
-- time_zone = '+00:00' on every connection.
--
-- Fresh install:   mysql -u root < mysql/schema.sql
-- Copy old data:   node --env-file=.env.local scripts/migrate-supabase-to-mysql.mjs
-- Upgrade an older database: node --env-file=.env.local scripts/migrate-online-booking.mjs

create database if not exists bolihon_booking character set utf8mb4 collate utf8mb4_unicode_ci;
use bolihon_booking;

create table if not exists users (
  id char(36) primary key,
  email varchar(255) not null unique,
  full_name varchar(255),
  phone varchar(50),
  role enum('guest', 'staff', 'admin') not null default 'guest',
  avatar_url text,
  password_hash varchar(255),
  disabled tinyint(1) not null default 0,
  last_sign_in_at datetime(3),
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3)
);

create table if not exists room_categories (
  id varchar(100) primary key,
  name varchar(255) not null unique,
  description text,
  sort_order int not null default 0,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3)
);

create table if not exists rooms (
  id varchar(100) primary key,
  slug varchar(255) not null unique,
  name varchar(255) not null,
  type varchar(100) not null,
  category_id varchar(100),
  description text not null,
  long_description text,
  -- JSON array of strings. Also carries the reservation-hold and fee settings
  -- as prefixed entries (see resort-data.ts).
  booking_includes longtext not null,
  price_per_night decimal(10, 2) not null check (price_per_night > 0),
  max_guests int not null check (max_guests > 0),
  bedrooms int not null default 1 check (bedrooms >= 0),
  bathrooms decimal(3, 1) not null default 1 check (bathrooms >= 0),
  size_sq_ft int,
  is_active tinyint(1) not null default 1,
  is_featured tinyint(1) not null default 0,
  sort_order int not null default 0,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  index rooms_active_featured_idx (is_active, is_featured, sort_order),
  constraint rooms_category_fk foreign key (category_id) references room_categories(id) on delete set null
);

create table if not exists room_images (
  id char(36) primary key,
  room_id varchar(100) not null,
  -- Admin uploads can be stored as data URLs, so this must hold large values.
  image_url longtext not null,
  alt_text varchar(255),
  is_primary tinyint(1) not null default 0,
  sort_order int not null default 0,
  created_at datetime(3) not null default current_timestamp(3),
  index room_images_room_sort_idx (room_id, sort_order),
  constraint room_images_room_fk foreign key (room_id) references rooms(id) on delete cascade
);

create table if not exists amenities (
  id char(36) primary key,
  name varchar(255) not null unique,
  icon varchar(100),
  category varchar(100),
  description text,
  created_at datetime(3) not null default current_timestamp(3)
);

create table if not exists room_amenities (
  room_id varchar(100) not null,
  amenity_id char(36) not null,
  primary key (room_id, amenity_id),
  constraint room_amenities_room_fk foreign key (room_id) references rooms(id) on delete cascade,
  constraint room_amenities_amenity_fk foreign key (amenity_id) references amenities(id) on delete cascade
);

create table if not exists promos (
  id char(36) primary key,
  code varchar(100) not null unique,
  name varchar(255) not null,
  description text,
  type enum('percentage', 'fixed_amount') not null,
  value decimal(10, 2) not null check (value > 0),
  starts_at datetime(3) not null default current_timestamp(3),
  ends_at datetime(3),
  max_redemptions int,
  redeemed_count int not null default 0,
  minimum_nights int not null default 1,
  is_active tinyint(1) not null default 1,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  index promos_code_active_idx (code, is_active)
);

-- MySQL has no exclusion constraints, so overlapping-stay protection lives in
-- the app: bookings are inserted inside a transaction that locks the room row.
create table if not exists bookings (
  id char(36) primary key,
  booking_number varchar(20) not null unique,
  user_id char(36),
  room_id varchar(100) not null,
  promo_id char(36),
  guest_name varchar(255) not null,
  guest_email varchar(255),
  guest_phone varchar(50),
  check_in date not null,
  check_out date not null,
  guest_count int not null check (guest_count > 0),
  nightly_rate decimal(10, 2) not null,
  subtotal_amount decimal(10, 2) not null,
  discount_amount decimal(10, 2) not null default 0,
  tax_amount decimal(10, 2) not null default 0,
  total_amount decimal(10, 2) not null,
  status enum('draft', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show') not null default 'pending',
  payment_status enum('unpaid', 'authorized', 'deposit_paid', 'paid', 'partially_refunded', 'refunded', 'failed') not null default 'unpaid',
  -- Unpaid bookings are cancelled once this passes. 'authorized' means the
  -- guest submitted a payment reference that staff have not verified yet.
  payment_deadline datetime(3),
  payment_reference varchar(100),
  -- Sales invoice issued at the front desk, e.g. SI-2026-000001.
  invoice_number varchar(30) unique,
  checked_in_at datetime(3),
  -- JSON payment details, including payment-proof data URLs.
  special_requests longtext,
  cancelled_at datetime(3),
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  index bookings_user_idx (user_id),
  index bookings_room_dates_idx (room_id, check_in, check_out),
  index bookings_status_idx (status, payment_status),
  index bookings_payment_reference_idx (payment_reference),
  constraint valid_booking_dates check (check_out >= check_in),
  constraint bookings_user_fk foreign key (user_id) references users(id) on delete set null,
  constraint bookings_room_fk foreign key (room_id) references rooms(id) on delete restrict,
  constraint bookings_promo_fk foreign key (promo_id) references promos(id) on delete set null
);

create table if not exists booking_blackout_dates (
  id char(36) primary key,
  blocked_date date not null unique,
  label varchar(255) not null default 'Philippine holiday',
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3)
);

create table if not exists payments (
  id char(36) primary key,
  booking_id char(36) not null,
  amount decimal(10, 2) not null check (amount > 0),
  currency char(3) not null default 'PHP',
  method enum('card', 'bank_transfer', 'cash', 'paypal', 'stripe'),
  status enum('unpaid', 'authorized', 'deposit_paid', 'paid', 'partially_refunded', 'refunded', 'failed') not null default 'unpaid',
  provider varchar(100),
  provider_payment_id varchar(255),
  paid_at datetime(3),
  refunded_at datetime(3),
  metadata longtext,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  index payments_booking_idx (booking_id),
  constraint payments_booking_fk foreign key (booking_id) references bookings(id) on delete cascade
);

create table if not exists reviews (
  id char(36) primary key,
  user_id char(36),
  room_id varchar(100) not null,
  booking_id char(36),
  guest_name varchar(255),
  guest_email varchar(255),
  rating int not null check (rating between 1 and 5),
  title varchar(255),
  body text not null,
  is_published tinyint(1) not null default 0,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  index reviews_room_published_idx (room_id, is_published),
  constraint reviews_user_fk foreign key (user_id) references users(id) on delete set null,
  constraint reviews_room_fk foreign key (room_id) references rooms(id) on delete cascade,
  constraint reviews_booking_fk foreign key (booking_id) references bookings(id) on delete set null
);

create table if not exists resort_settings (
  id tinyint(1) primary key default 1,
  resort_name varchar(255) not null default 'BOLIHON Beach Resort',
  contact_email varchar(255) not null,
  contact_phone varchar(50),
  address text,
  check_in_time time not null default '15:00',
  check_out_time time not null default '11:00',
  tax_rate decimal(5, 4) not null default 0.1200,
  currency char(3) not null default 'PHP',
  minimum_booking_nights int not null default 1,
  cancellation_policy text,
  -- Online booking charges, applied once per booking. A cottage's own fee
  -- overrides the reservation and premium amounts. 0 turns a charge off.
  reservation_fee_amount decimal(10, 2) not null default 0,
  premium_fee_amount decimal(10, 2) not null default 0,
  internet_fee_amount decimal(10, 2) not null default 0,
  payment_instructions text,
  -- Per guest, on every booking (walk-in and online).
  entrance_fee_amount decimal(10, 2) not null default 0,
  -- Children and senior citizen / PWD rates; null = same as the regular rate.
  entrance_fee_child_amount decimal(10, 2),
  entrance_fee_senior_amount decimal(10, 2),
  entrance_fee_note varchar(300),
  -- Last sales invoice number issued; incremented inside a transaction.
  last_invoice_number int not null default 0,
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  constraint one_resort_settings_row check (id = 1)
);

create table if not exists auto_reply_knowledge (
  id varchar(100) primary key,
  title varchar(255) not null,
  -- JSON array of strings.
  keywords longtext not null,
  response text not null,
  sort_order int not null default 100,
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3),
  index auto_reply_knowledge_sort_idx (sort_order, created_at)
);

create table if not exists site_footer_settings (
  id varchar(50) primary key,
  powered_by_label varchar(255) not null default 'Powered by',
  company_initial varchar(2) not null default 'V',
  company_name varchar(255) not null default 'VALDEMEER RESOURCES, INC',
  team_label varchar(255) not null default 'IT TEAM - KAMARU',
  created_at datetime(3) not null default current_timestamp(3),
  updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3)
);

-- Seed rows that every install needs. The data-copy script overwrites these
-- with the Supabase values where they exist.
insert ignore into resort_settings (id, contact_email, contact_phone, address, cancellation_policy) values (
  1,
  'reservations@bolihon.test',
  '+1 808 555 0188',
  'BOLIHON Beach Resort',
  'Free cancellation until 7 days before check-in. One-day deposit retained after that window.'
);

insert ignore into site_footer_settings (id) values ('footer');

insert ignore into auto_reply_knowledge (id, title, keywords, response, sort_order) values
  ('default-availability', 'Availability and reservations',
   '["available","availability","vacant","date","book","reserve","reservation"]',
   'For availability, please choose your cottage and dates on the booking page so we can check the calendar right away. If you already sent your dates, admin will review this chat and confirm the next step.',
   10),
  ('default-rates', 'Cottage rates',
   '["rate","rates","price","cost","how much","fee"]',
   'Current daily rates start at Php700 for Cottages 1 to 45, Php800 for Rock and RD cottages, Php4,500 for VGP Hall, and Php3,500 for the Pavillon. Final totals depend on cottage and dates.',
   20),
  ('default-payment', 'Payment verification',
   '["pay","payment","deposit","gcash","paid","proof","receipt"]',
   'Please keep your payment proof ready. Admin will verify the payment status and update your booking once the proof has been checked.',
   30),
  ('default-changes', 'Cancellations and date changes',
   '["cancel","refund","reschedule","move","change date"]',
   'For cancellations or date changes, please include your booking ID, contact number, and preferred new date if rescheduling. Admin will check the policy and availability.',
   40),
  ('default-location', 'Location and directions',
   '["where","location","address","directions","map"]',
   'Please send your preferred travel date and contact number here. Admin can share the latest directions and arrival details for your visit.',
   50);
