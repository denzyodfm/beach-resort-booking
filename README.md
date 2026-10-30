BOLIHON is a modern beach resort cottage booking app built with Next.js, React, Tailwind CSS, TypeScript, and MySQL.

## Features

- Public resort homepage with hero, gallery, amenities, testimonials, and CTAs
- Cottage listing plus dynamic detail pages for Cottage 1-45, Rock 1-6, RD 1-8, VGP Hall, and Pavillon
- Rates: Cottage Php700, Rock/RD Php800, VGP Hall Php4,500, Pavillon Php3,500
- Booking form with date, guest, room selection, total price, and availability checks
- Staff and admin sign-in (bcrypt passwords, signed session cookie)
- Guest dashboard with booking cards
- Admin dashboard for booking, cottage, image, rate, and payment status management
- Route handlers for availability, bookings, admin cottages, and admin bookings
- MySQL schema in `mysql/schema.sql`

## Database setup (MySQL / XAMPP)

1. Start MySQL (for example from the XAMPP control panel).
2. Create the database and tables: `mysql -u root < mysql/schema.sql`
   (XAMPP: `C:\xampp\mysql\bin\mysql.exe -u root < mysql/schema.sql`).
3. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL`, `AUTH_SECRET`, and `NEXT_PUBLIC_PERSISTENT_BACKEND=true`.
4. Set a staff password: `node --env-file=.env.local scripts/set-password.mjs admin@bolihon.com <password>`.
   More staff accounts can then be added from Admin > Users & settings.

`scripts/migrate-supabase-to-mysql.mjs` copies data from the old Supabase project (it needs the old Supabase keys in `.env.local`). Passwords cannot be copied, so every account needs a new one.

Without `DATABASE_URL`, the app runs in demo mode with local sample data.

## User manuals

Manual text lives in `src/lib/manuals.ts` (screenshots in `public/manual/`). Staff and admins read them in Admin > Manual; guests at `/help`. The downloadable PDFs in `manual-pdfs/` are generated from the same text. After editing a manual, start the app and run:

`node scripts/build-manual-pdfs.mjs <admin email> <admin password>`

This needs Microsoft Edge or Google Chrome installed.

## Demo mode

- Guest login: enter a name and cellphone number.
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
