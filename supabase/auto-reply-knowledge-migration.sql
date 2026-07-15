create table if not exists public.auto_reply_knowledge (
  id text primary key,
  title text not null,
  keywords text[] not null default '{}',
  response text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auto_reply_knowledge_sort_idx
  on public.auto_reply_knowledge (sort_order, created_at);

drop trigger if exists set_auto_reply_knowledge_updated_at on public.auto_reply_knowledge;
create trigger set_auto_reply_knowledge_updated_at before update on public.auto_reply_knowledge
  for each row execute function public.set_updated_at();

insert into public.auto_reply_knowledge (id, title, keywords, response, sort_order)
values
  (
    'default-availability',
    'Availability and reservations',
    array['available', 'availability', 'vacant', 'date', 'book', 'reserve', 'reservation'],
    'For availability, please choose your cottage and dates on the booking page so we can check the calendar right away. If you already sent your dates, admin will review this chat and confirm the next step.',
    10
  ),
  (
    'default-rates',
    'Cottage rates',
    array['rate', 'rates', 'price', 'cost', 'how much', 'fee'],
    'Current daily rates start at Php700 for Cove cottages, Php800 for Rock and RD cottages, Php4,500 for VGP Hall, and Php3,500 for the Pavillon. Final totals depend on cottage and dates.',
    20
  ),
  (
    'default-payment',
    'Payment verification',
    array['pay', 'payment', 'deposit', 'gcash', 'paid', 'proof', 'receipt'],
    'Please keep your payment proof ready. Admin will verify the payment status and update your booking once the proof has been checked.',
    30
  ),
  (
    'default-changes',
    'Cancellations and date changes',
    array['cancel', 'refund', 'reschedule', 'move', 'change date'],
    'For cancellations or date changes, please include your booking ID, contact number, and preferred new date if rescheduling. Admin will check the policy and availability.',
    40
  ),
  (
    'default-location',
    'Location and directions',
    array['where', 'location', 'address', 'directions', 'map'],
    'Please send your preferred travel date and contact number here. Admin can share the latest directions and arrival details for your visit.',
    50
  )
on conflict (id) do nothing;
