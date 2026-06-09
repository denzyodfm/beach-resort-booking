BOLIHON is a modern beach resort cottage booking app built with Next.js, React, Tailwind CSS, TypeScript, and Supabase-ready auth/database APIs.

## Features

- Public resort homepage with hero, gallery, amenities, testimonials, and CTAs
- Cottage listing plus dynamic detail pages for Cove 1-45, Rock 1-6, RD 1-8, VGP Hall, and Pavillon
- Rates: Cove Php700, Rock/RD Php800, VGP Hall Php4,500, Pavillon Php3,500
- Booking form with date, guest, room selection, total price, and availability checks
- Supabase Auth login and registration
- Guest dashboard with booking cards
- Admin dashboard for booking, cottage, image, rate, and payment status management
- Route handlers for availability, bookings, admin cottages, and admin bookings
- Supabase schema in `supabase/schema.sql`

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

Without environment variables, the app runs in demo mode with local sample data.

## Demo login

- Guest login: enter a name and cellphone number.
- Admin login: use admin code `BOLIHON-ADMIN`.
- Demo chat, pending bookings, and admin replies are stored in browser local storage.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
