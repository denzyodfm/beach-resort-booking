/**
 * In-app user manuals, one per role. Text may use **bold** for button and
 * field names. Screenshots live in public/manual and must not show real guest
 * names, phone numbers, or emails.
 */

export type ManualRole = "guest" | "staff" | "admin";

export type ManualSection = {
  id: string;
  title: string;
  intro?: string;
  steps?: string[];
  bullets?: string[];
  table?: { headers: [string, string]; rows: Array<[string, string]> };
  images?: Array<{ src: string; alt: string }>;
  /** Reference files to open or download, e.g. the signed front-desk procedures PDF. */
  links?: Array<{ href: string; label: string }>;
  note?: string;
};

export type Manual = {
  role: ManualRole;
  label: string;
  title: string;
  summary: string;
  sections: ManualSection[];
};

const guestManual: Manual = {
  role: "guest",
  label: "Guest manual",
  title: "Guest manual",
  summary:
    "Book a BOLIHON cottage without an account: choose Standard or Premium booking, pay online before the payment deadline, and submit your payment reference number.",
  sections: [
    {
      id: "online-rules",
      title: "Online booking rules (read first)",
      intro: "These rules are also shown in a box at the top of every booking page.",
      table: {
        headers: ["Rule", "What it means for you"],
        rows: [
          ["Payment deadline", "Every online booking shows a deadline (usually 24 hours after booking). If the resort has not received your payment reference by then, the booking is cancelled automatically and the cottage is released"],
          ["Online payment only", "Online bookings are paid online by GCash or bank transfer. You then enter the payment reference number so the resort can verify it. Cash is for walk-in guests"],
          ["Online vs walk-in cottages", "Only cottages marked **Online booking** can be booked on the website. Cottages marked **Walk-in only** are kept for guests who come to the resort"],
          ["Reservation fee", "A reservation fee is added once to every online booking"],
          ["Standard or Premium", "**Standard**: you choose the category and date and the resort assigns an available cottage. **Premium**: you choose your exact cottage and pay a premium fee"],
          ["Internet access", "If the resort offers it, you can tick **Add internet access (Wi-Fi)** for an extra fee"],
        ],
      },
    },
    {
      id: "browse",
      title: "Browse cottages",
      bullets: [
        "**Home page**: a rotating showcase of cottages with **Book this cottage** and **View details**, plus amenities, photos and approved reviews.",
        "**Cottages** (top menu): one card per category with its starting rate. Tap a category to filter, or search by name, for example \"Cottage 12\", \"Rock\" or \"VGP Hall\".",
        "**Cottage details**: photos, what the booking includes, amenities, daily rate, guest capacity and a **Book this cottage** button.",
        "Each cottage shows a green **Online booking** or a dark **Walk-in only** label. Walk-in cottages have no Book button; they can only be booked at the resort.",
      ],
      images: [
        { src: "/manual/cottages.jpg", alt: "Cottages page with category cards and search" },
        { src: "/manual/cottage-detail.jpg", alt: "Cottage details page" },
      ],
    },
    {
      id: "book-by-date",
      title: "Book one day (Book Here)",
      intro: "The quickest way to book a single day.",
      steps: [
        "Tap **Book Here** in the top menu and read the **Online booking rules** box.",
        "Under **How do you want to book?** choose **Standard booking** (the resort assigns a cottage, no extra fee) or **★ Premium booking** (you pick the exact cottage, premium fee shown on the button).",
        "Choose the **Booking month** and a **Category**.",
        "**Standard**: one row shows each day with the number of cottages still free. **Premium**: one row per cottage. Green = available, amber = booked, grey = past, blocked or full. Saturday and Sunday columns are red and cannot be booked.",
        "Tap a green cell. The window shows the cottage fee, reservation fee, any premium fee and the total, plus a reminder of the payment deadline.",
        "Optionally tick **Add internet access (Wi-Fi)** if it is offered.",
        "Enter **Guest name**, **Cellphone no.**, optional **Email** and the number of **Guests**.",
        "Tap **Book now**. The same window changes to the payment step (see \"Pay online and submit your reference number\").",
      ],
      images: [
        { src: "/manual/book-by-date.jpg", alt: "Book Here grid with available days in green" },
        { src: "/manual/booking-dialog.jpg", alt: "Booking details window" },
      ],
    },
    {
      id: "book-range",
      title: "Book several days",
      steps: [
        "Tap **Reserve stay** in the page footer, or **Book** on a cottage (this starts a Premium booking for that cottage).",
        "Choose **Standard booking** or **★ Premium booking**, then a **Category**. For Premium, pick **Your preferred cottage**.",
        "Set **Check-in** and **Check-out**. Past dates, weekends and holidays are refused with a red message.",
        "Check the cottage's **Unavailable dates**, then enter the number of **Guests** (the maximum is shown).",
        "Optionally tick **Add internet access (Wi-Fi)**. The charges box lists the cottage fee for all days, the reservation fee, any premium fee and the total.",
        "Enter **Guest name**, **Cellphone no.** and optional **Email**.",
        "Optionally tap **Check availability**, then tap **Book now**. The form changes to the payment step.",
      ],
      images: [{ src: "/manual/booking-form.jpg", alt: "Booking form with the Total box" }],
    },
    {
      id: "pay-online",
      title: "Pay online and submit your reference number",
      intro: "Right after booking you see the payment step. You can also open it later from **Pay / Track Booking** in the top menu.",
      steps: [
        "Write down your **Booking number** (for example BK-2C5FA11D) and the cottage you were given.",
        "Check the orange **Payment deadline** box: it shows the exact date and time and how much time is left. It turns red in the last 3 hours.",
        "**Step 1 · Pay online**: send the **Amount to pay** to the GCash or bank account shown.",
        "**Step 2 · Enter your payment reference no.**: copy the reference number from your GCash or bank receipt into the box and tap **Submit reference**.",
        "You see **Payment reference received**. Your booking is no longer cancelled automatically while the resort checks the reference.",
        "When the resort verifies it, the page shows **Payment verified**, and then the booking is confirmed.",
      ],
      bullets: [
        "**Come back later**: tap **Pay / Track Booking**, enter the booking number and the cellphone number you booked with, then tap **Find booking**.",
        "Each reference number can be used for one booking only.",
        "If the resort cannot find your payment, they reject the reference and your original deadline applies again. If it has already passed, the booking is cancelled.",
        "If the deadline passes before you submit a reference, the page shows **This reservation was cancelled**. Make a new booking.",
        "To cancel, contact the resort with your booking number and the cellphone number you used. Free cancellation ends 7 days before check-in.",
      ],
    },
    {
      id: "arriving",
      title: "Arriving at the resort",
      intro: "You will be welcomed at the main entrance with our Mabuhay Greeting.",
      bullets: [
        "**Booked online?** Tell the front desk your booking number (BK-…) and show your proof of payment: your GCash or bank receipt, or the **Payment verified** screen on **Pay / Track Booking**. Staff will radio a Beach/Cottage Attendant to guide you to your cottage.",
        "**No booking?** Tell the front desk which cottage or setup you prefer. Staff check what is free today, explain the charges, take payment and give you an Official Sales Invoice.",
        "The per-person entrance fee is included in your booking total, so online guests have nothing more to pay at the gate. Children and senior citizens / PWD may have a discounted rate: count them with the **−/+** buttons when booking. Seniors and PWD must show a valid ID at the gate.",
      ],
    },
    {
      id: "chat",
      title: "Chat with the resort",
      steps: [
        "Tap **Chat with us** at the bottom of any page.",
        "Enter **Guest name** and **Cellphone no.**, then tap **Start chat**.",
        "Type your question and tap **Send**. An automatic reply answers common questions about rates, availability, payment, cancellations and directions. Resort staff reply in the same chat.",
      ],
      images: [{ src: "/manual/chat.jpg", alt: "Chat start screen" }],
    },
    {
      id: "review",
      title: "Leave a review",
      steps: [
        "Tap **Reviews** in the top menu.",
        "Choose the **Cottage**, enter **Your name**, optional email, a **Rating** and **Your experience**.",
        "Tap **Submit review**. It appears on the site once the resort approves it.",
      ],
      images: [{ src: "/manual/reviews.jpg", alt: "Reviews page and review form" }],
    },
    {
      id: "rules",
      title: "Booking rules",
      table: {
        headers: ["Rule", "Detail"],
        rows: [
          ["Weekdays only", "Stays that include a Saturday or Sunday cannot be booked"],
          ["Holidays", "Dates the resort has blocked cannot be booked"],
          ["Day count", "The first and last day both count: one date = 1 day"],
          ["Price", "Daily rate × days, plus the entrance fee for each guest (regular, children or senior citizen / PWD rate), the reservation fee, the premium fee (Premium bookings only) and internet access (if ticked), each once per booking"],
          ["Payment deadline", "Unpaid bookings are cancelled automatically at the deadline shown after booking"],
          ["Payment", "Online bookings are paid online; submit the reference number before the deadline"],
          ["Walk-in cottages", "Cannot be booked online"],
          ["Cancellation", "Free until 7 days before check-in"],
        ],
      },
    },
  ],
};

const staffManual: Manual = {
  role: "staff",
  label: "Staff manual",
  title: "Staff manual",
  summary:
    "Run daily operations: verify online payment references, approve bookings, record payments and refunds, book walk-ins, keep cottages up to date, moderate reviews and answer guest chats.",
  sections: [
    {
      id: "sign-in",
      title: "Sign in and out",
      steps: [
        "Open the **Login** page.",
        "Enter your **Username or email** and **Password**. Your full name works as the username.",
        "Tap **Sign in**. You stay signed in for 7 days on that device.",
        "Tap **Logout** when you finish, especially on a shared computer.",
      ],
      note: "Forgot your password? Ask an admin to set a new one.",
      images: [{ src: "/manual/login.jpg", alt: "Staff sign-in page" }],
    },
    {
      id: "front-desk-sop",
      title: "Front desk procedures (SOP)",
      intro:
        "The resort's official guest entrance and accommodation procedures for Guest Services Attendants at the main entrance: **20261001 Walk-in** and **20261002 Online Reservation**. Start every arrival with the **Mabuhay Greeting**: right palm flat over the left side of the chest (over the heart), a smile and a slight, respectful head nod. Then ask: is the guest reserved?",
      images: [{ src: "/manual/front-desk-flowchart.jpg", alt: "Process flow chart: reserved guests go to Verify Reservation, walk-in guests go to Confirm Accommodation Rental" }],
      links: [{ href: "/manual/bolihon-front-desk-procedures.pdf", label: "Open the signed procedures (PDF, 3 pages)" }],
    },
    {
      id: "front-desk-walk-in",
      title: "Walk-in guests (SOP 20261001)",
      intro: "For guests who arrive without a booking. Does not cover pre-booked corporate events or private function halls.",
      table: {
        headers: ["Step · who · time", "What to do (and where in the app)"],
        rows: [
          ["1 · Guest Services Attendant · 15 sec", "Greet the guest with the Mabuhay Greeting"],
          ["2 · Guest Services Attendant · 1 min", "In **Monitoring Station → Front desk**, tap **Walk-in guest**. Ask which Accommodation Rental they prefer (cottage, tent or beach chairs) and check availability: green = available today"],
          ["3 · Guest Services Attendant · 1 min", "Tap the green card and use the **−/+** buttons for **Regular**, **Children** and **Senior citizen / PWD** guests. The window calculates the total: rental + each guest's **Entrance fee** (+ internet access if ticked). Check senior/PWD IDs"],
          ["4 · Guest Services Attendant · 30 sec", "Break down the costs and tell the guest the total amount due"],
          ["5 · Guest Services Attendant · 30 sec", "Receive the cash and check the amount. Tap **Hold this cottage**, then tap the booked (amber) card and **Record cottage payment**"],
          ["6 · Guest Services Attendant · 1 min", "Go back to **Front desk**, find the booking under **Today's arrivals** and tap **Issue sales invoice**. The invoice opens with the next number (SI-2026-000001…); tap **Print invoice** and give it to the guest. Then tap **Check in**"],
          ["7 · Guest Services Attendant · 30 sec", "Radio the assigned Beach/Cottage Attendant to guide the guest to their spot. Tell them the cottage name shown in the Monitoring Station"],
          ["8 · Guest Services Attendant · 15 sec", "Thank the guest and wish them an enjoyable stay"],
        ],
      },
      note: "Sales Invoice: the document given to the guest confirming payment of admission and rental fees. Entrance Fee: the standard per-person admission charge (set in Admin → Users & settings). Accommodation Rentals: the spot, beach chair setup, tent or cottage allocated to the guest.",
    },
    {
      id: "front-desk-online",
      title: "Guests with an online reservation (SOP 20261002)",
      intro: "For pre-booked guests. The goal is a warm, quick hand-over from the front desk to their reserved spot.",
      table: {
        headers: ["Step · who · time", "What to do (and where in the app)"],
        rows: [
          ["1 · Guest Services Attendant · 15 sec", "Greet the guest with the Mabuhay Greeting"],
          ["2 · Guest Services Attendant · 30 sec", "Ask for their booked Accommodation Rental and their **booking number** (BK-…)"],
          ["3 · Guest Services Attendant · 30 sec", "Verify the reservation: in **Monitoring Station → Front desk**, type the booking number (or name / cellphone) and tap **Find**. Today's arrivals are listed automatically. Check the cottage, date, guest name and number of guests"],
          ["4 · Guest Services Attendant · 30 sec", "Check the proof of payment on the card. Green **Proof of payment: Paid** means verified. **Reference submitted**: verify it in **Admin → Payments** first. **Unpaid**: collect payment before letting the guest in. Tap **Check in** (only possible once paid), and **Issue sales invoice** if the guest needs one"],
          ["5 · Guest Services Attendant · 30 sec", "Radio the assigned Beach/Cottage Attendant with the cottage name"],
          ["6 · Beach/Cottage Attendant · 1 min", "Guide the guest to their assigned spot"],
          ["7 · Guest Services Attendant · 30 sec", "Thank the guest and wish them an enjoyable stay"],
        ],
      },
      note: "Standard bookings are assigned a cottage by the system. The assigned cottage is the one shown on the booking, not necessarily the guest's first choice.",
    },
    {
      id: "overview",
      title: "Admin → Overview",
      intro:
        "Four counters: **Total bookings**, **Pending bookings** (need approval), **Confirmed bookings** (arrivals scheduled) and **Total revenue** (paid bookings and deposits).",
      bullets: [
        "Bookings, Payments, Cottages, Reviews and Users & settings each have sub-tabs, for example **Booking approvals**, **Occupancy calendar** and **No-booking dates**. Numbers on a tab show what is waiting.",
        "Drag any tab or sub-tab (grip ⋮⋮ on its left) to put it in the order you prefer, or click it and press **Alt + ←/→**. The admin page opens on your first tab. **Reset order** restores the default. The order is remembered per browser.",
        "A blue **payment references to verify** banner appears on every admin tab when guests have submitted references. Tap it to open the Payments tab.",
        "A red **unpaid bookings auto-cancel within 6 hours** banner lists bookings close to their payment deadline. Tap it to open the Bookings tab.",
      ],
      images: [{ src: "/manual/admin-overview.jpg", alt: "Admin dashboard Overview tab" }],
    },
    {
      id: "bookings",
      title: "Admin → Bookings",
      intro: "Approve bookings, block holidays and check occupancy.",
      steps: [
        "Under **Booking approvals**, find the pending booking.",
        "Read the line under the booking: an amber or red **Unpaid · auto-cancels …** line shows the payment deadline and time left; a blue line shows the guest's submitted reference number.",
        "Verify the guest's payment first (Payments tab). **Confirm after payment** stays disabled until the booking is Paid or Deposit paid.",
        "Tap **Confirm after payment**, or **Decline** to cancel the booking.",
      ],
      bullets: [
        "Each booking shows **Online** or **Walk-in**, and **Standard** (cottage assigned by the system) or **Premium** (guest chose the cottage).",
        "**Block a holiday**: under **No-booking dates**, pick the **Holiday date**, type the **Holiday name** and tap **Add no-booking date**. Weekends are blocked automatically. Tap **Delete** next to a date to reopen it.",
        "**Occupancy calendar**: use **Previous** / **Next** or the month and year lists. Hover over a day to see which cottages are booked.",
      ],
    },
    {
      id: "payments",
      title: "Admin → Payments",
      intro:
        "**Payment references to verify** (top) lists every online booking whose guest submitted a reference number. **Upcoming check-ins** lists the next confirmed arrivals. **Recent payments** shows the five newest bookings with amount paid, balance, reference, proof and payment log.",
      steps: [
        "Under **Payment references to verify**, open the resort's GCash or bank account and find the reference number shown in large type.",
        "Found, and the amount is right: tap **Verify**. Not found: tap **Reject reference** (see below).",
        "In the dialog, the **Payment reference no.** is already filled in from the guest. It is required for online bookings and optional for walk-ins. A reference already used on another booking is refused.",
        "Enter **Payment details** if needed, **Paid by** and **Amount to apply**. The amount cannot exceed the balance.",
        "Add the **Proof of payment image**: upload a photo under 750 KB, or tap **Use camera** then **Capture photo**.",
        "Tap **Save and mark paid**. The booking becomes Paid, or Deposit paid if part paid. Your name is saved in the payment log.",
      ],
      bullets: [
        "**Reject reference**: puts the booking back to Unpaid and removes the reference. The original payment deadline applies again, so a booking past its deadline is cancelled straight away. Tell the guest through chat or SMS.",
        "To record a payment for a booking that is not in the queue, tap **Verify** under **Recent payments**, or open the booked cell in the Monitoring Station.",
        "**Refund**: tap **Refund** on a paid booking, enter **Amount refunded** and **Reason for refund**, then **Save refund**. This marks the payment Refunded but does not cancel the booking.",
      ],
    },
    {
      id: "cottages",
      title: "Admin → Cottages",
      intro: "Pick a cottage in **Select cottage**, change what you need, then tap **Save cottage**.",
      table: {
        headers: ["Field", "What it does"],
        rows: [
          ["Daily rate / Max guests", "Price per day and the most guests per booking"],
          ["Reservation hold (hours)", "The payment deadline: how long an unpaid booking is kept before it is cancelled automatically (default 24)"],
          ["Designated for online reservations", "Ticked: bookable online, labelled Online booking. Unticked: walk-in only, hidden from online booking. Saves immediately"],
          ["Use a different premium charge / reservation fee", "Optional override for this cottage. Unticked: the resort-wide fees from Users & settings apply. Online cottages only"],
          ["Available for booking", "Unticked: the cottage is hidden from guests"],
          ["Booking includes / Amenities", "What guests see on the cottage page"],
        ],
      },
      bullets: [
        "**Add cottage** creates a draft; it is only kept after **Save cottage**.",
        "**Delete cottage** and **Delete category** ask you to type DELETE.",
        "**Categories**: add one with a name and description. A category must be empty before it can be deleted.",
        "**Tents** and **Beach chairs** categories are ready for the SOP's Accommodation Rentals. Tap **Add cottage**, choose the category, name the unit (for example Tent 1), set its daily rate and save. Empty categories are hidden from guests.",
      ],
      images: [{ src: "/manual/admin-cottages.jpg", alt: "Cottage details editor" }],
    },
    {
      id: "reviews",
      title: "Admin → Reviews",
      bullets: [
        "**Pending approval**: **Approve** publishes a review; **Delete** removes it.",
        "**Published**: **Unpublish** hides a review again.",
      ],
    },
    {
      id: "monitoring",
      title: "Monitoring Station (walk-ins and front desk)",
      bullets: [
        "**Walk-in** tab: today's walk-in cottages. Tap a green **Available — Book walk-in** card, enter the guest's details and tap **Hold this cottage**.",
        "**Online Booking** tab: the month grid for online cottages.",
        "Tap a booked (amber) card or cell to open **Cottage payment**. It shows the guest's reference number and payment deadline if any. Enter **Payment reference no.** (required for online bookings), **Payment amount**, **Paid by** and **Payment note**, then **Record cottage payment**.",
        "Walk-in bookings never pay the reservation or premium fee. Tick internet access for the guest if they want it.",
        "Walk-ins start as pending like online bookings. After recording payment, issue the sales invoice and check them in from the **Front desk** tab.",
      ],
      images: [
        { src: "/manual/monitoring-walkin.jpg", alt: "Monitoring Station walk-in tab" },
        { src: "/manual/monitoring-online.jpg", alt: "Monitoring Station online booking grid" },
      ],
    },
    {
      id: "front-desk-tab",
      title: "Monitoring Station → Front desk",
      intro: "The first tab of the Monitoring Station, built around the SOP flowchart. It opens on **Today's arrivals**: every booking whose stay includes today.",
      bullets: [
        "**Find**: search by booking number (BK-…), guest name, cellphone or invoice number. **X** clears the search.",
        "Each card shows the cottage, guest, number of guests, Online/Walk-in, the booking status and the **Proof of payment** line (amber when not paid).",
        "**Check in**: marks the guest as arrived. Only paid or deposit-paid bookings can be checked in. A checked-in guest keeps the cottage booked for the day.",
        "**Issue sales invoice**: gives the booking the next invoice number and opens the printable invoice in a new tab (allow pop-ups for this site). **Reprint sales invoice** opens the same invoice again; the number never changes. Paid bookings in **Admin → Payments → Recent payments** also have a **Sales invoice** button.",
        "The invoice lists the rental, entrance fee, reservation/premium fee and internet access, the amount paid, balance, payment method and the staff member who issued it.",
      ],
      note: "If the resort must use BIR-registered official receipts or invoices, keep issuing those as required. The app's sales invoice is the resort's own printed record of the payment.",
    },
    {
      id: "chat",
      title: "Reply to guest chats",
      bullets: [
        "Open **Chat with us**, pick a guest, type your reply and tap **Reply**. Use **Open full inbox** for the larger view.",
        "Chats are stored in the browser: you only see chats started on the same computer and browser.",
      ],
      images: [{ src: "/manual/chat-inbox.jpg", alt: "Staff chat inbox" }],
    },
    {
      id: "map",
      title: "Location map",
      intro: "**Location Map** shows an interactive map of the resort for giving directions.",
      images: [{ src: "/manual/location-map.jpg", alt: "Resort location map" }],
    },
    {
      id: "troubleshooting",
      title: "Troubleshooting",
      table: {
        headers: ["Problem", "What to do"],
        rows: [
          ["Sign in reloads the page and nothing happens", "Open the app at http://localhost:3000 on the resort PC, or ask IT to allow the new network address"],
          ["\"Invalid username/email or password.\"", "Check the spelling, or ask an admin for a new password"],
          ["\"This account is disabled.\"", "Ask an admin to re-enable it"],
          ["Confirm after payment is greyed out", "Record the payment first"],
          ["A booking disappeared from approvals", "It was unpaid past its payment deadline and was cancelled automatically"],
          ["\"Enter the payment reference number to verify an online booking's payment.\"", "Online bookings need the GCash/bank reference number in the verify dialog"],
          ["\"Reference … is already recorded on booking …\"", "The same reference was used before. Check the receipt; it may be a duplicate or fake payment"],
          ["Guest says they cannot book a cottage online", "It is set to walk-in only. Book it for them in the Monitoring Station, or tick Designated for online reservations"],
          ["Cottage missing from Book Here", "Check Designated for online reservations and Available for booking"],
          ["Payment proof won't upload", "Use an image under 750 KB, or Use camera"],
        ],
      },
    },
  ],
};

const adminManual: Manual = {
  role: "admin",
  label: "Admin manual",
  title: "Admin manual",
  summary:
    "Admins can do everything in the Staff manual, plus set the online booking fees and payment instructions, manage user accounts, auto-reply answers and the footer credit in Admin → Users & settings.",
  sections: [
    {
      id: "online-booking-settings",
      title: "Online booking fees and payment instructions",
      intro: "The first panel in **Admin → Users & settings**, **Fees and online payment**. It controls what every online booking costs and where guests send payment.",
      steps: [
        "Enter the **Reservation fee** charged once on every online booking.",
        "Enter the **Premium booking fee** charged when a guest chooses their exact cottage. Standard bookings do not pay it.",
        "Under **Entrance fees**, enter the **Regular rate** per guest. It is added to every walk-in and online booking and printed on the sales invoice. 0 turns entrance fees off.",
        "Enter the **Children rate** and **Senior citizen / PWD rate**. Leave one blank to charge the regular rate, or enter 0 to make it free. Change any rate anytime; existing bookings keep the price they were booked at.",
        "Type the **Entrance fee rules shown to guests**, for example the children's age range and that seniors and PWD must show a valid ID.",
        "Enter the **Internet access add-on**. Leave it at 0 to hide the option from guests.",
        "Type the **Payment instructions**: the GCash number or bank account with the account name. Guests see this on the payment step.",
        "Check the example prices, then tap **Save online booking settings**.",
      ],
      bullets: [
        "New bookings use the new amounts immediately. Existing bookings keep the price they were booked at.",
        "To charge a different reservation or premium fee for one cottage, use the fee override fields in **Admin → Cottages**.",
        "To change the payment deadline, set **Reservation hold (hours)** on each cottage in **Admin → Cottages**.",
        "To move a cottage between online and walk-in, tick or untick **Designated for online reservations** in **Admin → Cottages**.",
      ],
    },
    {
      id: "add-user",
      title: "Add a user",
      steps: [
        "Open **Admin → Users & settings**.",
        "In **User administration**, fill in **Full name**, **Email**, **Phone** and **Password** (at least 6 characters).",
        "Choose **Privileges**: **Staff - manage operations** or **Admin - manage users and operations**.",
        "Tap **Create user**, then give the person their email and password.",
      ],
    },
    {
      id: "edit-user",
      title: "Edit a user, reset a password or disable an account",
      steps: [
        "Tap **Edit** next to the user in **Users and privileges**.",
        "Change the details. To reset the password, type it in **New password (optional)**; leave it blank to keep the current one.",
        "Tick **Disable this user** to block sign-in without deleting the account. They are signed out everywhere.",
        "Tap **Save changes**.",
      ],
      bullets: [
        "**Delete** removes an account after you type DELETE. This cannot be undone.",
        "You cannot disable, demote or delete your own admin account.",
      ],
    },
    {
      id: "auto-reply",
      title: "Auto-reply knowledge",
      intro: "The answers the guest chat sends automatically. The entry whose keywords best match the guest's message is used.",
      steps: [
        "Tap **Add information**, or pick an existing entry.",
        "Fill in **Information title**, **Sort order** (lower wins a tie), **Trigger keywords** separated by commas and the **Auto-reply response**.",
        "Tap **Create information** or **Save information**. **Delete** removes an entry.",
      ],
    },
    {
      id: "footer",
      title: "Footer credit",
      intro:
        "Change the \"Powered by\" strip at the bottom of every page: **Badge text**, **Logo letter** (up to 2 characters), **Company name** and **Team credit**. Check the **Preview**, tap **Save footer credit**, then refresh the page.",
    },
    {
      id: "passwords-it",
      title: "Password help from IT",
      intro:
        "If no admin can sign in, IT can reset a password on the server: node --env-file=.env.local scripts/set-password.mjs <email> <password>",
    },
    {
      id: "limitations",
      title: "Known limitations",
      bullets: [
        "Guests have no account; the Guest dashboard link only works for staff and admins.",
        "Recent payments shows only the five newest bookings.",
        "Only pending bookings can be declined from the dashboard.",
        "Total revenue counts the full price of deposit-paid bookings.",
        "Email and SMS are sent only when a booking is created, and only if those services are set up. They include the payment deadline.",
        "The app does not connect to GCash or the bank: staff verify each reference number by checking the account themselves.",
        "Sales invoice numbers run in one sequence (SI-<year>-000001, 000002…) and are never reused. The printed invoice is not a BIR-accredited receipt.",
        "Online payment needs the MySQL database. If the online booking columns are missing, IT runs: node --env-file=.env.local scripts/migrate-online-booking.mjs",
      ],
    },
  ],
};

export const manuals: Record<ManualRole, Manual> = {
  guest: guestManual,
  staff: staffManual,
  admin: adminManual,
};

/** Manuals a role may open, its own first. */
export function getManualsForRole(role: string | null | undefined): Manual[] {
  if (role === "admin") return [adminManual, staffManual, guestManual];
  if (role === "staff") return [staffManual, guestManual];
  return [guestManual];
}
