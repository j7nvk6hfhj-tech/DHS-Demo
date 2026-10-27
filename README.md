# DHS Logistics - Orders Dashboard (Alpha)

Dehradun and Harrawala orders. All rights are reserved to Niket Sharma.

A web dashboard for cement orders: orders numbered within each day, a live first-come-first-served dispatch queue, dealer list, day-wise and dealer-wise summaries, and an Excel download.

- **Website hosting:** GitHub Pages (free)
- **Login and database:** Google Firebase. Normal use stays inside the free allowance; the pay-as-you-go **Blaze** plan is recommended as a safety net so the app never stops (see below).
- **Login:** Google account (Gmail) or any email with a password. Only emails you add under **Settings → Team & emails** can get in.
- **Roles:** enforced by the database security rules in `firestore.rules`, so a person can't get around them by tinkering with the page.

| Designation | Can do |
|---|---|
| **Admin** | Everything, including **Settings → Team & emails** (who can log in, designations, report emails), changing order times, changing dispatched orders, deleting orders, renaming and removing dealers, editing and removing vehicles, the master file and recalculating totals |
| **Supervisor** | Add orders; change, cancel, hold or change the date of any order not yet dispatched; mark dispatched, correct dispatch times, undo dispatch; add dealers and edit their contact details; add vehicles and tracking links; refresh Summary totals |
| **Dispatch** | Add orders; change details only of their own orders from the same day, before dispatch; cancel, hold or change the date of any order not yet dispatched; mark dispatched and undo dispatch; edit dealers' contact details; add vehicles and tracking links |
| **Viewer** | See orders, the queue and summaries and download Excel. Can't open order details, see vehicles or change anything |

Order times are set automatically when an order is saved; only the Admin can enter or change one. The full list, row by row, is in the permissions checklist (DHS_Permissions_26Oct2026.xlsx), kept with your records and not on GitHub, because GitHub Pages sites are public. The designations were renamed in this version: **Supervisor** was called Dispatch, and **Dispatch** was called Order desk. The renaming itself doesn't change anyone's access; what each designation can do now is in the table above.

## Layout

Four tabs along the top:

- **New Order:** take an order. The ticket shows its **order of the day** (e.g. 3rd order of 25 Oct) and, next to it, its place **in line** for dispatch (e.g. 4th), so you can tell the customer both.
- **Orders:** a switch at the top flips between **Queue** (pending orders, oldest first, with Mark dispatched) and **All orders** (search, filter by date, Excel download). The red number shows how many orders are waiting.
- **Summary:** month totals by dealer and by day, Excel downloads, and the Admin's master file.
- **Settings:** a switch for **Dealers**, **Vehicles** (tracking links) and **Team & emails** (Admin only).

**Your name** at the top right opens a menu with **Help**, **हिंदी / English** and **Sign out**. Hindi switches the tab names, page headings, column names and field labels; orders, dealer names, products, buttons and Excel files stay in English. Each phone or computer remembers its own choice, so it uses no database reads and costs nothing.

**Help** (in the same menu) opens the help guide over the dashboard, at the part about the page you're on. It has a search box ("cancel", "order", "Excel", a few Hindi words too), quick answers to common problems, and a "Still stuck? Reach your Admin" box. New staff can also open it from the sign-in screen, or you can send them the link `…/help.html`.

The dashboard reopens on the page each person last used. A new tab can be added later as its own top tab, or as one more option in a switch.

## Files

| File | What it is |
|---|---|
| `index.html` | The page and its styling |
| `app.js` | All the dashboard logic |
| `help.html` | The help guide staff open with the **Help** button |
| `firebase-config.js` | Your Firebase project settings. **Already on your GitHub with your values; it isn't in the upgrade pack, so it can't be overwritten.** (For a brand-new setup, create it as described in step 5 below.) |
| `firestore.rules` | Who can read and change what. Paste it into Firebase |
| `manifest.json`, `sw.js`, `icons/` | Let staff install the dashboard on their phone or computer like an app. `icons/logo.svg` is the DHS logo used in the header; the PNG files are the app icons |
| `report/` and `.github/workflows/report-emails.yml` | The daily contact list, weekly report and monthly master emails (set up once, see below) |

---

## Going live with this version (your site is already running)

Your data stays where it is. Do these steps in this order.

**Before the day**
1. **Switch on the safety net:** move Firebase to the **Blaze** plan, set budget alerts (for example ₹100 and ₹500), and turn on Firestore **scheduled backups** (details under *Good to know* and the security checklist below). These only protect you once they're on.
2. **Retire the old tools:** tell staff the switch-over time. From then on, orders go only into the dashboard. Keep the old Excel register and the first Claude version of the app as read-only records, and stop entering orders there; otherwise those orders never reach the dashboard.

**Upload (after office hours)**
3. **Upload the new files to GitHub:** everything in the pack's `1_Upload_to_GitHub` folder: `index.html`, `app.js`, `help.html`, `manifest.json`, `sw.js`, `README.md`, `firestore.rules`, and the `icons` and `report` folders. Use **Add file → Upload files**, then **Commit changes**. **Don't upload `firebase-config.js`**; keep the one that has your settings. (The email files are set up separately; see *Report emails* below.)
4. **Paste the new rules into Firebase:** **Firestore Database → Rules**, replace everything with the new `firestore.rules`, then click **Publish**.
5. **Sign in as the Admin first, before anyone else.** The dashboard upgrades the saved orders for the new version. A yellow message with a count ("x of y") shows while it works; keep the page open until it says **Upgrade complete**. If it says *Upgrade didn't finish*, reload once: it carries on safely. Until an Admin has done this, other staff see a message asking for it.

**10-minute check, before staff start.** A few things can only be tested on your live site: the security rules on Google's servers, the real Excel files and Gmail sending. This check covers all three.

6. **As a Dispatch user** (a staff member, or a spare email you add with that designation): the order time field is greyed out. Add a test order with your own mobile number as the phone. The ticket shows its order of the day and place in line, and **Send on WhatsApp** opens WhatsApp with the message ready ("It is 4th in line for dispatch"). Open the order, change the remarks and save. There should be no **Delete order** button. Open an order someone else entered: it should say you can change only your own orders.
   *If saving shows a permission message, the rules weren't published: paste them again and click **Publish**. If anything is still wrong, Firebase keeps earlier versions of the rules: in the **Rules** tab, open the version history and restore the previous one, then tell me what you saw.*
7. **One device per account:** sign in to the test account on a second phone. Within a few seconds the first one signs out and shows "signed in on another device". In **Settings → Team & emails**, the **Device** column shows the second phone.
8. **As a Supervisor, Dispatch or Admin:** mark the test order dispatched. A green note offers **Send update on WhatsApp**. Open the order: it shows **Last changed … by** your name. Try **Undo dispatch**, then dispatch it again. Then tap **Put on hold** on a queue card: it moves to **Orders → On hold**, has no **Mark dispatched** button, and **Release to queue** puts it back in its place.
9. **Excel:** in **Orders → All orders**, tap **Download Excel** and open the file. The columns run from **Order ID** to **Last Changed At**.
10. **Emails** (once they're set up): in GitHub open **Actions → Report emails → Run workflow**, keep **Test run** ticked, run it, and check that all three **[TEST]** emails arrive with their Excel files.
11. **As Admin:** delete the test order.
12. **Phones:** ask staff to close and reopen the app. iPhone users remove the old icon and add the app to the home screen again to get the new logo. Anyone who was signed in on two devices stays signed in only on the one where they signed in most recently.

---

## Setup (about 20 minutes, one time)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> and sign in with the Google account that will own the system.
2. Click **Create a project**. Name it, for example `dhs-logistics`. You can turn Google Analytics off.

### 2. Turn on login
1. In the left menu, open **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, enable **Google**, choose a support email, and save.
3. Also enable **Email/Password**. Keep only the first switch on, then save.

### 3. Create the database
1. Open **Build → Firestore Database → Create database**.
2. Location: **asia-south1 (Mumbai)**. This can't be changed later.
3. Start in **production mode**.
4. Open the **Rules** tab, delete what's there, paste the whole of `firestore.rules`, and click **Publish**.

### 4. Make yourself the first Admin
1. Still in Firestore, open the **Data** tab and click **Start collection**.
2. Collection ID: `members`
3. Document ID: **your email in small letters**, for example `owner@gmail.com`
4. Add field `role` (string) = `admin`
5. Add field `name` (string) = your name, then click **Save**.

You add everyone else later, under **Settings → Team & emails**.

### 5. Connect the website to Firebase
1. Click the ⚙️ next to **Project Overview**, then **Project settings**.
2. Under **Your apps**, click the **</>** (Web) icon. Give it any nickname and click **Register app**. You don't need Firebase Hosting.
3. Firebase shows a `firebaseConfig = { ... }` block. Copy those values into `firebase-config.js`, replacing each `PASTE_...`.

### 6. Put it on GitHub Pages
1. Create a new repository on <https://github.com>, for example `dhs-dashboard`.
2. Click **Add file → Upload files**, upload all the files from this folder, and click **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source: Deploy from a branch**, **Branch: main / (root)**, then **Save**.
4. After a minute or two, the site is live at `https://YOUR-GITHUB-NAME.github.io/dhs-dashboard/`.

### 7. Allow your website address to log in
1. In Firebase, go to **Authentication → Settings → Authorized domains → Add domain**.
2. Add `YOUR-GITHUB-NAME.github.io`. Leave out `https://` and the folder name.

### 8. First login
1. Open your site and click **Sign in with Google**, using the email from step 4.
2. Under **Settings → Dealers**, check the dealer list. Dhaam Home Solutions, CL Traders and Shree Sai Associate are added automatically on your first login.
3. Under **Settings → Team & emails**, add your staff's emails and pick each person's role.

---

## How your staff log in
- **With Gmail:** tap **Sign in with Google**.
- **With any other email:** type the email and a new password, then tap **Create account**. They get a verification email. After clicking the link in it, they come back and tap **I've verified**. Next time they just tap **Sign in**.
- Anyone whose email isn't on the team list sees "not on the authorised list" and can't see any data.
- To remove someone's access, remove them under **Settings → Team & emails**. It takes effect immediately.

## Good to know
- **GPS tracking (WheelsEye):** under **Settings → Vehicles**, the Admin, Supervisors and Dispatch users paste each truck's WheelsEye share link (only the Admin can remove a vehicle). Every order and queue card with that truck number then shows a **Track** button. WheelsEye links appear to expire after 7 days, so the tab shows days left and asks for a fresh link when one expires. Anyone with a link can see that truck, so keep the links inside the team.
- **What loads, and when:** opening the dashboard loads only pending orders and the orders of today (and of any day that still has a pending order). On **Orders → All orders**, older dates load only when you pick dates and tap **Load these dates**. **Summary** reads one small totals record per day, so a whole month costs about 31 reads.
- **Free limits:** Firebase's free allowance is 50,000 reads a day. With the loading above, a normal day should use roughly 10,000 to 20,000 at 100 orders a day.
- **Safety net (strongly recommended):** switch the Firebase project to the **Blaze** plan (bottom-left of the Firebase console: **Upgrade**). Blaze still includes the free allowance; you only pay for usage beyond it, so the dashboard never stops at the limit. Set a budget alert (for example ₹100 and ₹500) so Google emails you if spending ever grows.
- **Excel downloads:** on **Summary**, tap a dealer or a day, pick the dates and tap **Download Excel** (an Orders sheet and a Summary sheet). Admins also get **Download master file**, which gives every order of the chosen month. Excel files have the same columns, each order with its own **Order ID**, with one difference: the **time taken** columns (per order, and the average on the Summary sheet) appear only in files downloaded by the Admin and in the monthly master file email. Everyone else's downloads, and the weekly report, leave them out.
- **If totals ever look wrong:** an Admin can open **Summary**, pick the month and tap **Recalculate month**.
- **Offline:** if the office internet drops, the dashboard keeps showing what it already loaded and saves new orders as soon as the connection returns. Orders by staff (not the Admin) must reach the database within 30 minutes of being entered, because order times can't be back-dated; if the internet is down longer, enter the order again once it's back.
- **Order of the day** (formerly called the token): orders are numbered by order time within each day, so if the Admin enters an order with an earlier time, or deletes one, the later numbers that day shift by one. **In line** is the order's place in the dispatch queue across all days; it's shown next to the order number on the ticket, in Today's list and in All orders. Excel files call the number column **Order of the Day**.
- **Repeat orders:** before saving, the dashboard checks for an order from the same dealer for the same party (or the same phone number) in the last 12 hours, and asks before saving a likely duplicate. It checks the orders already on screen, so it costs no reads.
- **Who changed what:** every edit, cancel, dispatch and undo records who did it and when. Open an order to see **Last changed … by …**; Excel files have **Last Changed By** and **Last Changed At** columns. Only the Admin can delete an order; everyone else cancels it, which keeps the record.
- **WhatsApp to customers:** after saving, **Send on WhatsApp** opens WhatsApp on that phone or computer with the message ready (place in line, bags, products, dealer). After dispatch, **Send update on WhatsApp** sends the dispatch time, vehicle and driver. The tracking link isn't included. Staff tap Send themselves; it's free and nothing goes through your server.
- **Advance orders:** New Order has **Deliver on** (today by default; **Tomorrow** link). A later date saves the order now (order time = when booked) with `schedAt` = midnight of its day and `day` = that day. Until then it is **Scheduled**: not in the queue, listed under **Orders → Scheduled** by day, counted on a **Scheduled** card. On its day it becomes Pending by itself and joins the line at the start of the day (behind older waiting orders, ahead of that day's orders); its order-of-the-day number, Today's list, Summary and Excel belong to that day. **Change date** (also for a normal order) and **Send today** for Admin, Supervisor and Dispatch. The database refuses dispatching it before its day, and dates in the past. WhatsApp: "we have received your order for 28 Oct". Excel/email column **Scheduled For**. Time taken and the dispatch estimate count from the start of its day.
- **Tracking links:** pasting a WheelsEye link fills in the truck number it belongs to, and warns if it's saved under a different truck. An optional **Link valid until** date covers long-lasting links from WheelsEye support (status shows "Active till …"); without it, a link counts as 7 days.
- **Depot-wise view:** Summary has a **Depot-wise** table (Transport Nagar, Harrawala, Doiwala, and "No depot yet"); tapping a depot downloads its orders as Excel. All orders has a **Depot** filter. Each day's totals record keeps per-depot totals for this.
- **Driver's phone:** saved with each truck under Settings → Vehicles and on each order (fills in by itself when the vehicle number is typed). The dispatch WhatsApp reads "Vehicle: UK07CD2280. Driver: Raju, 98xxxxxxxx." (from the order, or the truck's saved details). It is not put in Excel files or emails.
- **Vehicles:** the WheelsEye link is optional (a truck can be saved with just its number and driver; "No link", no Track button). The Admin has **Edit** on each saved vehicle to change its number, driver, driver's phone, link or valid-until date; staff can add vehicles and add or renew links.
- **Dealers:** **Edit** on each dealer. The Admin, Supervisors and Dispatch staff can change its contact person, phone and area; only the Admin can rename it (and remove it). Orders already saved keep the dealer name they were entered with, so after a rename, Summary shows older orders under the old name, marked "(not in list)". The database enforces this: the names list and the contact details are kept separately, and only the Admin may change the names.
- **Dispatch depot:** New Order has an optional **Dispatch depot** list (Transport Nagar, Harrawala, Doiwala). It shows on queue cards, in All orders, the order window, Excel and emails (**Dispatch Depot** column). To change the list, edit `DEPOTS` in `app.js` and the same three names in `firestore.rules` (then publish the rules).
- **Phone number, vehicle number and depot before dispatch:** if an order has no phone number (10+ digits), no vehicle number or no depot, **Mark dispatched** opens a window asking for what's missing; the database refuses a dispatch without all three. On New Order, Phone and Delivery location sit in the top block with the required fields. If an order has no vehicle number, **Mark dispatched** opens a window asking for it (the driver fills in from Settings → Vehicles). Without it the order can't be dispatched and stays in the queue; the database rules refuse a dispatch without a vehicle too.
- **Cancel order:** a button on queue and On hold cards, with an optional reason. Admin, Supervisor and Dispatch can cancel any order not yet dispatched (decided 26 Oct). Cancelled orders stay in the records. Who cancelled and when is always recorded (the database refuses a cancel that doesn't carry the canceller's own name) and shows in All orders, Today's list, the order window, Excel (**Hold / Cancel Reason**, **Cancelled By**, **Cancelled At**) and the weekly and daily emails (a "who cancelled" list).
- **Expected dispatch time:** queue cards, Today's list, All orders and the ticket show "Expected ~15:30" (the ticket adds "give or take …"). Learned from all past daily totals (one small read per day of history, once a day per device, kept on the device for the day; about 365 reads a device per day after a year, well within the free allowance): the pace when orders are waiting (time between back-to-back dispatches), the usual first and last dispatch times, and weekdays with no dispatching. Estimate = now + place in line × pace, counted only within working hours. Summary shows what was learned and checks it on the last 60 days of orders, trying four weightings of recent vs. older days and "order time + average wait", and uses whichever was closest. Starts after 5 working days with dispatches. Each day's totals record now keeps each order's order/dispatch/cancel times for this (the Admin's one-time upgrade and Recalculate month fill it in for older days). Not in the WhatsApp message.
- **Count cards on All orders:** the same cards as Summary, for the dates picked (Pending now and On hold: all dates); tapping one filters the list, the active card is highlighted.
- **Summary cards open the orders:** tap **Pending now** or **On hold** to jump to All orders filtered to every such order across all dates (no extra reads: open orders are always loaded). **Orders**, **Dispatched** and **Cancelled** open that month's orders, loading the month if needed (same reads as Load these dates). In All orders, the Pending and On hold filters never need loading.
- **Summary counts:** cards for **Pending now**, **On hold** (both all dates, with bags) and **Cancelled** (this month, with bags); the tables and Excel Summary sheets have separate Pending, On hold, Dispatched and Cancelled columns (plus Cancelled bags in Excel). The weekly, monthly and daily emails list pending, on hold and cancelled counts.
- **On hold:** Admin, Supervisors and Dispatch can tap **Put on hold** (queue card, ticket or order window, with an optional reason). The order leaves the queue for **Orders → On hold**, the orders behind it move up, and it can't be marked dispatched, on screen or in the database rules, until someone taps **Release to queue**. A released order returns to its place by order time. Held orders have their own **On hold** count in the Summary, Excel and emails, apart from pending.
- **Search:** **Orders → All orders** finds orders by party, location or phone number.
- **Who took each order:** queue cards show **Entered by**, All orders has an **Entered by** column next to the order time, and Today's list on New Order shows the name.
- **One device per account:** each email works on one phone or computer at a time. Signing in on a new device signs the old one out with a message ("signed in on another device"). This is enforced by the database rules, not just the screen. With 5 people on the team, at most 5 devices have access. Under **Settings → Team & emails**, the **Device** column shows where each person is signed in and since when, and **Sign out device** signs out a lost phone or an account that seems shared. On iPhone, the installed app and Safari count as two devices, so staff should use the installed app.
- **Making changes:** edit the files in GitHub (click a file, then the ✏️ icon) and commit. The site updates within a minute or two.
- **Products list:** edit the `PRODUCTS` line near the top of the dashboard logic in `app.js`.

## Install on phones and computers
- **Android (Chrome):** open the site, then tap **Install app** in the dashboard header (or Chrome's menu → **Install app**).
- **iPhone (Safari):** open the site, tap the **Share** button, then **Add to Home Screen**.
- **Computer (Chrome or Edge):** click **Install app** in the header, or the install icon in the address bar.

The installed app opens full-screen with the DHS Logistics icon. Updates you upload to GitHub reach everyone automatically.

## Keeping your data secure (checklist)
1. **Turn on 2-step verification** on the Google account that owns Firebase and on your GitHub account. Whoever controls these controls the system.
2. **Add a second owner** in Firebase (**Project settings → Users and permissions**) so you can't be locked out if one account has a problem.
3. **Watch the Device column** under **Settings → Team & emails**. If an account keeps switching devices, it's probably being shared. Sign it out and have a word.
4. **Keep Admins few.** Give staff the lowest role they need. Remove leavers under **Settings → Team & emails** the same day they leave.
5. **Limit the web key to your site:** Google Cloud Console → **APIs & Services → Credentials** → the "Browser key" → **Application restrictions: Websites** → add `https://YOUR-GITHUB-NAME.github.io/*` and `https://YOUR-PROJECT-ID.firebaseapp.com/*`. Test sign-in afterwards.
6. **Authorized domains:** in Firebase **Authentication → Settings**, keep only your `github.io` address and the Firebase defaults.
7. **Backups:** on the Blaze plan, turn on Firestore **scheduled backups** (Firestore Database → Disaster recovery). As an extra copy, download each month's orders as Excel from **Orders → All orders**.
8. **Budget alerts** on Blaze also act as an early warning if someone ever misuses your project.
9. **Tracking links:** anyone with a WheelsEye link can see that truck, so don't share them outside the team.

## Report emails (daily contact list, weekly report, monthly master file), one-time setup (about 25 minutes)

Three emails are sent automatically, each with its own on/off switch, time and list of recipients. The Admin sets all of this on the dashboard: **Settings → Team & emails → Report emails**.
- **Daily contact list:** every day, an Excel file (`DHS_Contacts_YYYY-MM.xlsx`) with four columns, **Dealer, Party, Phone, Location**, one row per order, oldest first. Each day's file has every order from the 1st of the month up to the send time, so it keeps growing; save it over the previous day's copy. On the 1st it starts afresh. Cancelled orders are included (the customer is still a contact). Orders entered after the send time on the last day of a month aren't in any daily list; they're in that month's master file. Default: every day at 9:00 pm.
- **Weekly report:** the orders since the previous weekly report, as Excel, without the time-taken columns. Default: Saturday at 9:00 pm.
- **Monthly master file:** every order of the previous month (`DHS_Master_YYYY-MM.xlsx`). Default: the 1st at 9:00 am.

A small free job on GitHub checks every 30 minutes and sends whatever is due. Emails usually arrive 5 to 10 minutes after the set time, sometimes later when GitHub is busy. If a run fails, GitHub emails you, and **Settings → Team & emails** shows the last check and any problem.

**1. A Gmail account to send from.** A separate one such as `dhs.reports@gmail.com` is best.
1. Turn on **2-Step Verification** for it (Google Account → Security).
2. Then open <https://myaccount.google.com/apppasswords>, create an app password named `DHS report`, and copy the 16 letters.

**2. A Firebase key for the job.**
1. In Firebase, go to **Project settings → Service accounts → Generate new private key**. A `.json` file downloads.
2. Open it with Notepad (or TextEdit) and copy everything.
3. Keep this file private and delete it after step 3. It can read and change the whole database.

**3. Store both in GitHub as secrets.** In your repository, go to **Settings → Secrets and variables → Actions → New repository secret** and add three:

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | everything from the `.json` file |
| `GMAIL_USER` | the sending Gmail address |
| `GMAIL_APP_PASSWORD` | the 16-letter app password |

**4. Add the job files.**
1. The `report` folder (`report_emails.py`, `requirements.txt`, `last-run.txt`) is already on GitHub if you uploaded the pack's `1_Upload_to_GitHub` folder. If not, upload it now.
2. Create the schedule file: **Add file → Create new file**, type the name `.github/workflows/report-emails.yml` (the slashes create the folders), paste the contents of `report-emails.yml` from the pack's `2_Email_setup` folder, then **Commit changes**. On a Mac, the `.github` folder is hidden in Finder, so creating it this way is easier.

**5. Set recipients and times** on the dashboard: **Settings → Team & emails → Report emails**.

**6. Send a test.**
1. In GitHub, open the **Actions** tab. If GitHub asks, click to enable workflows.
2. Open **Report emails**, click **Run workflow**, keep **Test run** ticked, and click **Run workflow**.
3. Within about 2 minutes, all three emails should arrive with **[TEST]** in the subject. Check Spam the first time and mark them **Not spam**.

**Good to know**
- **First check:** the job only starts counting at its first check. The first weekly report covers the orders after the most recent scheduled time, and the first master file is for the first full month after setup.
- **No gaps or doubles:** each weekly report starts exactly where the previous one ended, so no order is missed or counted twice. If you change the day, the next report simply covers a slightly longer or shorter period.
- **Switched off:** while an email is switched off (or its list is empty), nothing is sent for those periods.
- **The 60-day rule:** GitHub pauses scheduled jobs in public repositories after 60 days with no change to the repository. Each real send records the date in `report/last-run.txt`, which keeps it active. If both emails are switched off for two months, open the **Actions** tab afterwards and re-enable the workflow if GitHub asks.

## Master Excel that combines every month (Excel for Windows / Microsoft 365)
1. Make a folder, for example `DHS Master`, and save each month's `DHS_Master_YYYY-MM.xlsx` there. You get these from the monthly master email or from **Download master file**. If a month is downloaded again, replace the old file.
2. In a new Excel workbook, go to **Data → Get Data → From File → From Folder**, pick the folder, then choose **Combine & Transform** (or **Combine & Load**).
3. When asked which sheet to use, pick **Orders**, then **OK** → **Close & Load**.
4. Each month, drop the new file into the folder and click **Data → Refresh All**. All months appear in one table, ready for pivot tables and filters.

Don't put the dealer-wise or day-wise downloads in this folder: their dates overlap with the master files, so orders would be counted twice.

---

## Help guide

`help.html` is a plain page on your GitHub site. Opening it uses **no database reads**, it opens over the dashboard (so nothing reloads), and the installed app keeps a copy, so it also works without internet.

**"Still stuck?"** at the end of the guide tells staff to reach their Admin. When the guide is opened from the dashboard, it lists your Admins' names and emails from the team list (no extra database reads).

**Keep it current:** if a button or page in the dashboard changes later, update the matching part of `help.html` too.

---

## Logo and app icon

The DHS logo (amber swirl, dark truck and lettering) is `icons/logo.svg`. It shows in the header, on the sign-in screen and in the help guide, and the app icons (`icons/*.png`) are made from it.

**Phones that already installed the app:** Android picks up the new icon by itself within a day or so. On iPhone, the home-screen icon is fixed when it's added, so remove the old icon and add the app to the home screen again.

