// DHS Logistics Order Dashboard: GitHub Pages + Firebase version (v2: low-read data loading)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc as fsDoc, collection as fsCollection,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* =====================================================================
   HOW DATA IS LOADED (keeps Firebase reads low)
   - Live: orders that are still pending (any date) + every order of today
     and of the days that still have pending orders (needed for tokens).
   - All Orders: older dates load only when someone picks dates and taps Load.
   - Summary: one small "daysum" record per day holds that day's totals, so a
     month's summary reads about 31 records. Kept up to date on every change.
   ===================================================================== */
const MAX_LIVE_DAYS = 30;          // Firestore "in" queries allow up to 30 values
const STARTER_DEALERS = ["Dhaam Home Solutions", "CL Traders", "Shree Sai Associate"];
const PRODUCTS = ["PPC","OPC 43","OPC 53","Super Strong (SS)","Weather Protect (WSP)"];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2, "0");
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); };
const fmtDay = k => { const [y,m,d] = k.split("-"); return +d + " " + MON[+m-1]; };
const fmtDT = ms => { if (ms == null) return ""; const d = new Date(ms); return d.getDate() + " " + MON[d.getMonth()] + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const fmtTime = ms => { const d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const toLocalInput = ms => { const d = new Date(ms); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes()); };
const fromLocalInput = v => v ? new Date(v).getTime() : NaN;
const hm = ms => { if (ms == null || isNaN(ms)) return ""; const m = Math.max(0, Math.round(ms/60000)); return Math.floor(m/60) + ":" + pad(m%60); };
const waitTxt = ms => { const m = Math.max(0, Math.round(ms/60000)); const d = Math.floor(m/1440), h = Math.floor((m%1440)/60), mm = m%60; return (d? d+"d ":"") + (d||h ? h+"h ":"") + mm + "m"; };
const tonnes = bags => (bags * 50 / 1000).toLocaleString("en-IN", {maximumFractionDigits:1});
const inr = n => Number(n || 0).toLocaleString("en-IN");

const S = {
  me:null, myName:"", role:null, isAdmin:false, canEdit:false, canWrite:false,
  members:[], vehicles:[], dealers:[], view:"new", confirmId:null, lastId:null,
  today: dayKey(Date.now()),
  pending: [],                  // raw orders with open == true (live)
  live: new Map(),              // raw orders of the live days (live)
  liveDays: new Set(),          // days fully covered by the live listener
  liveKey: "",
  range: { from:null, to:null, map:new Map(), at:null },   // on-demand older orders
  sums: new Map(), sumAt: {},   // daysum records by day; when each month was fetched
  report: null,                 // weekly email settings (Admin only)
  lang: (() => { try { return localStorage.getItem("dhs.lang") === "hi" ? "hi" : "en"; } catch(e){ return "en"; } })(),
  all: []
};

/* ---------- Hindi labels ----------
   In Hindi, tab names, headings, column names and field labels switch. Orders, names, products, buttons and
   messages stay in English. The choice is kept on each device only: no database reads or writes. */
const HI = {
  "New Order": "नया ऑर्डर", "Orders": "ऑर्डर", "Summary": "सारांश", "Settings": "सेटिंग्स",
  "Queue": "कतार", "All orders": "सभी ऑर्डर", "Dealers": "डीलर", "Vehicles": "गाड़ियाँ", "Team & emails": "टीम और ईमेल",
  "Help": "मदद", "Sign out": "साइन आउट",
  // headings
  "New order": "नया ऑर्डर", "Today": "आज", "Dispatch queue": "डिस्पैच कतार", "Dealer-wise": "डीलर के अनुसार", "Day-wise": "दिन के अनुसार",
  "Authorised dealers": "अधिकृत डीलर", "Vehicles & GPS tracking": "गाड़ियाँ और GPS ट्रैकिंग", "How to get a tracking link": "ट्रैकिंग लिंक कैसे लें",
  "Team & roles": "टीम और रोल", "Who can do what": "कौन क्या कर सकता है", "Report emails": "रिपोर्ट ईमेल",
  "Weekly report": "साप्ताहिक रिपोर्ट", "Daily contact list": "दैनिक संपर्क सूची", "Monthly master file": "मासिक मास्टर फ़ाइल", "Edit order": "ऑर्डर बदलें", "Download Excel": "Excel डाउनलोड",
  // field labels
  "Order date & time": "ऑर्डर की तारीख और समय", "Dealer": "डीलर", "Party / customer": "पार्टी / ग्राहक", "Phone": "फ़ोन",
  "Delivery location": "डिलीवरी की जगह", "Products & bags (50 kg)": "प्रोडक्ट और बैग (50 किलो)", "Vehicle no.": "गाड़ी नंबर",
  "Driver": "ड्राइवर", "Remarks": "टिप्पणी", "Mark as": "स्थिति", "Dispatched at": "डिस्पैच का समय", "From": "से", "To": "तक",
  "Status": "स्थिति", "Search party, location or phone": "पार्टी, जगह या फ़ोन खोजें", "Month": "महीना", "Dealer name": "डीलर का नाम",
  "Contact person": "संपर्क व्यक्ति", "Area": "क्षेत्र", "WheelsEye tracking link": "WheelsEye ट्रैकिंग लिंक",
  "Name": "नाम", "Email": "ईमेल", "Password": "पासवर्ड", "Role": "रोल", "Day": "दिन", "Day of the month": "महीने की तारीख", "Time (India)": "समय (भारत)",
  // column names
  "Token": "टोकन", "Order time": "ऑर्डर का समय", "Party": "पार्टी", "Location": "जगह", "Products": "प्रोडक्ट", "Total bags": "कुल बैग",
  "Vehicle": "गाड़ी", "Time taken": "लगा समय", "Entered by": "दर्ज किया", "Device": "डिवाइस", "Pending": "बाकी", "Dispatched": "डिस्पैच हुए",
  "Cancelled": "रद्द", "Bags": "बैग", "Pending bags": "बाकी बैग", "Avg time": "औसत समय", "Last order": "आखिरी ऑर्डर", "Date": "तारीख",
  "Link status": "लिंक की स्थिति", "Link added": "लिंक जोड़ा", "Email (login ID)": "ईमेल (लॉगिन ID)",
  // small labels on cards
  "in line": "लाइन में", "bags": "बैग", "Ordered": "ऑर्डर", "Waiting": "इंतज़ार", "Pending now": "अभी बाकी", "this month": "इस महीने",
  "all dates": "सभी तारीखें", "cancelled": "रद्द", "Avg time taken": "औसत लगा समय", "order → dispatch": "ऑर्डर → डिस्पैच"
};
// "Entered by Ramesh" on queue cards (Hindi word order: "Ramesh ने दर्ज किया")
const enteredBy = o => !o.createdBy ? "" : S.lang === "hi"
  ? `<span class="by"><b>${esc(nameOf(o.createdBy))}</b> <span lang="hi">ने दर्ज किया</span></span>`
  : `<span class="by">Entered by <b>${esc(nameOf(o.createdBy))}</b></span>`;

// Who changed an order last, and when (saved with every change)
const stamp = () => ({ updatedBy: S.me || null, updatedAt: Date.now() });

/* ---------- WhatsApp messages to the customer: opens WhatsApp with the text ready; staff tap Send. No server involved. */
function waNumber(p){ let d = (p || "").replace(/\D/g, ""); if (d.length === 11 && d[0] === "0") d = d.slice(1); if (d.length === 10) d = "91" + d; return d.length >= 11 && d.length <= 13 ? d : ""; }
function waText(o){
  const tk = o.token ? ` (token ${o.token}, ${fmtDay(o.day)})` : "";
  if (o.status === "Dispatched")
    return `DHS Logistics: your order${tk} was dispatched at ${fmtDT(o.executedAt)}.${o.vehicle ? " Vehicle: " + o.vehicle + "." : ""}${o.driver ? " Driver: " + o.driver + "." : ""} ${o.bags} bags: ${fmtItems(o)}.`;
  return `DHS Logistics: we have received your order${tk}. ${o.bags} bags: ${fmtItems(o)}.${o.dealer ? " Dealer: " + o.dealer + "." : ""} We will message you when it is dispatched.`;
}
const WA_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z"/></svg>';
const waBtn = (o, label) => S.canWrite && o && o.status !== "Cancelled"
  ? `<a class="btn sm wa" href="${esc(`https://wa.me/${waNumber(o.phone)}?text=${encodeURIComponent(waText(o))}`)}" target="_blank" rel="noopener">${WA_ICON}${label}</a>` : "";

// T(): label as HTML (marked as Hindi so phones use a Hindi font); t(): plain text
const T = s => S.lang === "hi" && HI[s] ? `<span lang="hi">${HI[s]}</span>` : esc(s);
const t = s => S.lang === "hi" && HI[s] ? HI[s] : s;

function toast(msg){ const t=$("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true, 3200); }
function failMsg(e){
  if (e && e.code === "permission-denied") return "Your role doesn't allow this. Ask an Admin to change your role.";
  if (e && e.code === "resource-exhausted") return "Daily free limit reached. Ask the Admin to check the Firebase plan.";
  return "Couldn't save. Check your connection and try again.";
}
const ROLES = ["admin","dispatch","desk","viewer"];
// Designations. The stored keys stay the same as before; only the names changed:
// "dispatch" = Supervisor (was Dispatch), "desk" = Dispatch (was Order desk).
const ROLE_LABEL = { admin:"Admin", dispatch:"Supervisor", desk:"Dispatch", viewer:"Viewer" };
function nameOf(email){ if (!email) return ""; const m = S.members.find(x => x.id === email); return (m && m.name) || email; }
function banner(text){ const b = $("banner"); if (!text){ b.hidden = true; return; } b.hidden = false; b.textContent = text; }

/* ---------- orders: status, tokens, queue ---------- */
function norm(o){
  const at = o.dispatchedAt ?? null;
  const status = at != null ? "Dispatched" : (o.mark === "Cancelled" ? "Cancelled" : "Pending");
  return { ...o, day: o.day || dayKey(o.orderAt), status, executedAt: at, taken: at != null ? at - o.orderAt : null };
}
const byTime = (a,b) => (a.orderAt - b.orderAt) || ((a.createdAt||0) - (b.createdAt||0)) || (a.id < b.id ? -1 : 1);
function known(){
  // complete days = live days + loaded range days; tokens are only given where the whole day is known
  const m = new Map();
  for (const [id, o] of S.range.map) if (!S.live.has(id) && !S.liveDays.has(o.day || dayKey(o.orderAt))) m.set(id, o);
  for (const [id, o] of S.live) m.set(id, o);
  const complete = [...m.values()].map(norm).sort(byTime);
  const per = {}; for (const o of complete){ per[o.day] = (per[o.day]||0) + 1; o.token = per[o.day]; }
  const ids = new Set(complete.map(o => o.id));
  const extra = S.pending.filter(o => !ids.has(o.id)).map(o => ({ ...norm(o), token:null }));
  const all = complete.concat(extra).sort(byTime);
  let q = 0; for (const o of all) o.queue = o.status === "Pending" ? ++q : null;
  return all;
}

/* ---------- day totals (daysum) ---------- */
function aggOf(list){
  const a = { n:0, Pending:0, Dispatched:0, Cancelled:0, bags:0, pbags:0, tsum:0, tn:0, last:null };
  for (const o of list){ a.n++; a[o.status]++; if (o.status !== "Cancelled") a.bags += +o.bags || 0; if (o.status === "Pending") a.pbags += +o.bags || 0;
    if (o.taken != null){ a.tsum += o.taken; a.tn++; } if (a.last == null || o.orderAt > a.last) a.last = o.orderAt; }
  return a;
}
function daySummary(day, list){
  const groups = {}; for (const o of list) (groups[o.dealer || ""] ||= []).push(o);
  return { day, total: aggOf(list), dealers: Object.entries(groups).map(([dealer, l]) => ({ dealer, ...aggOf(l) })), updatedAt: Date.now() };
}
function addAgg(t, a){ for (const k of ["n","Pending","Dispatched","Cancelled","bags","pbags","tsum","tn"]) t[k] += a[k] || 0; if (a.last != null && (t.last == null || a.last > t.last)) t.last = a.last; return t; }
const emptyAgg = () => ({ n:0, Pending:0, Dispatched:0, Cancelled:0, bags:0, pbags:0, tsum:0, tn:0, last:null });

// Recompute one day's totals from its full list of orders and save them.
async function syncDay(day){
  if (!S.canWrite || !day || !fdb) return;
  try {
    let list;
    if (S.liveDays.has(day)) list = [...S.live.values()].filter(o => (o.day || dayKey(o.orderAt)) === day).map(norm);
    else {
      const snap = await getDocs(query(fsCollection(fdb, "orders"), where("day", "==", day)));
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      for (const [id, o] of S.range.map) if ((o.day || dayKey(o.orderAt)) === day) S.range.map.delete(id);
      if (S.range.from && day >= S.range.from && day <= S.range.to) for (const o of raw) S.range.map.set(o.id, o);
      list = raw.map(norm);
    }
    const s = daySummary(day, list); S.sums.set(day, s);
    await setDoc(fsDoc(fdb, "daysum", day), s);
    render();
  } catch(e){ /* totals can be rebuilt with Recalculate month */ }
}
// Fire a write without blocking the screen (works offline too), then refresh the affected days' totals.
function commit(promise, days, okMsg){
  if (okMsg) toast(okMsg);
  promise.then(() => { for (const d of new Set(days.filter(Boolean))) syncDay(d); }).catch(e => toast(failMsg(e)));
}

/* ---------- render: shared bits ---------- */
function dealerOptions(sel, withAll){
  const cur = sel.value;
  const names = S.dealers.map(d => d.name).filter(Boolean);
  let h = withAll ? '<option value="*">All dealers</option>' : '<option value="">Select dealer</option>';
  h += names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
  sel.innerHTML = h;
  sel.value = [...sel.options].some(o => o.value === cur) ? cur : (withAll ? "*" : "");
}
const pill = s => `<span class="pill ${s}">${s}</span>`;
const plate = v => v ? `<span class="plate">${esc(v)}</span>${trackBtn(v)}` : "";
const tok = o => `<span class="tok">${o.token ?? "–"}<small>${esc(fmtDay(o.day))}</small></span>`;

/* ---------- vehicles & GPS links ---------- */
const LINK_DAYS = 7; // WheelsEye share links appear to last 7 days
const normV = v => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function vehicleOf(v){ const k = normV(v); return k ? S.vehicles.find(x => normV(x.no) === k) : null; }
function linkAge(x){ const left = (x.addedAt || 0) + LINK_DAYS * 864e5 - Date.now(); return { left, days: Math.ceil(left / 864e5) }; }
function trackBtn(v){
  const x = vehicleOf(v); if (!x || !x.link) return "";
  const { left } = linkAge(x);
  return left > 0 ? `<a class="btn sm track" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">Track</a>`
    : `<a class="btn sm track old" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer" title="This link may have expired. Paste a fresh one under Settings → Vehicles.">Track (old link)</a>`;
}
function renderVehicles(){
  const box = $("vehicleBox"); if (!box) return;
  const dl = $("vehicleList"); if (dl) dl.innerHTML = S.vehicles.map(x => `<option value="${esc(x.no)}">`).join("");
  if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
  const list = S.vehicles.slice().sort((a, b) => normV(a.no).localeCompare(normV(b.no)));
  const rows = list.map(x => { const { left, days } = linkAge(x);
    const st = !x.link ? '<span class="vstat gone">No link</span>' : left <= 0 ? '<span class="vstat gone">Expired, paste a new link</span>'
      : days <= 2 ? `<span class="vstat soon">Expires in ${days} day${days > 1 ? "s" : ""}</span>` : `<span class="vstat ok">Active, ${days} days left</span>`;
    return `<tr><td><span class="plate">${esc(x.no)}</span></td><td>${esc(x.driver || "")}</td><td>${st}</td><td>${esc(fmtDT(x.addedAt))}</td>
      <td>${x.link ? `<a class="btn sm track" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">Track</a>` : ""}</td>
      <td>${S.canVehicles ? `<button class="btn sm" data-act="veh-edit" data-no="${esc(x.no)}">New link</button>` : ""} ${S.isAdmin ? `<button class="btn sm danger" data-act="veh-del" data-no="${esc(x.no)}">Remove</button>` : ""}</td></tr>`; }).join("");
  box.innerHTML = `<div style="display:grid;gap:14px">
    ${list.length ? `<div class="tscroll"><table><thead><tr><th>${T("Vehicle")}</th><th>${T("Driver")}</th><th>${T("Link status")}</th><th>${T("Link added")}</th><th></th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><b>No vehicles yet</b>${S.canVehicles ? "Add a truck number and its WheelsEye tracking link below." : "Staff add vehicles here."}</div>`}
    ${S.canVehicles ? `<form class="grid" id="vehicleForm" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="fld"><label for="v-no">${T("Vehicle no.")} <span class="req">*</span></label><input id="v-no" required placeholder="UK07 CD 2280" style="text-transform:uppercase"></div>
      <div class="fld"><label for="v-driver">${T("Driver")}</label><input id="v-driver"></div>
      <div class="fld" style="grid-column:1/-1"><label for="v-link">${T("WheelsEye tracking link")} <span class="req">*</span></label><input id="v-link" type="url" required placeholder="https://wheelseye.com/ui/track?token=..."></div>
      <div class="fld" style="align-self:end"><button class="btn primary" type="submit">Save vehicle</button></div></form>`
      : `<p class="hint">You can't add or change vehicles.</p>`}${S.canVehicles && !S.isAdmin ? `<p class="hint">You can add vehicles and paste new links. Only the Admin can remove a vehicle.</p>` : ""}</div>`;
}
async function saveVehicles(list){
  try { await setDoc(fsDoc(fdb, "config", "vehicles"), { list }); } catch(ex){ toast(failMsg(ex)); throw ex; }
}
document.addEventListener("submit", async e => {
  if (e.target.id !== "vehicleForm") return; e.preventDefault();
  const no = $("v-no").value.trim().toUpperCase().replace(/\s+/g, " "), link = $("v-link").value.trim(), driver = $("v-driver").value.trim();
  if (!normV(no)) return toast("Enter the vehicle number.");
  if (!/^https:\/\/\S+$/.test(link)) return toast("Paste the full tracking link, starting with https://");
  const rest = S.vehicles.filter(x => normV(x.no) !== normV(no)); const old = S.vehicles.find(x => normV(x.no) === normV(no));
  try { await saveVehicles([...rest, { no: old ? old.no : no, driver: driver || (old && old.driver) || "", link, addedAt: Date.now(), by: S.me }]);
    document.activeElement && document.activeElement.blur(); toast(old ? "Tracking link updated for " + no : "Vehicle " + no + " added"); } catch(ex){}
});
document.addEventListener("click", async e => {
  const b = e.target.closest('[data-act="veh-edit"],[data-act="veh-del"]'); if (!b) return;
  const x = S.vehicles.find(v => v.no === b.dataset.no); if (!x) return;
  if (b.dataset.act === "veh-edit") { $("v-no").value = x.no; $("v-driver").value = x.driver || ""; $("v-link").value = ""; $("v-link").focus(); return; }
  if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again"; setTimeout(() => { if (b.isConnected){ b.dataset.armed = ""; b.textContent = "Remove"; } }, 4000); return; }
  try { await saveVehicles(S.vehicles.filter(v => v.no !== x.no)); toast("Removed " + x.no); } catch(ex){}
});

function render(){
  const all = known();
  S.all = all;
  $("qn").textContent = $("qn2").textContent = all.filter(o => o.status === "Pending").length || "";
  dealerOptions($("o-dealer"), true);
  renderToday(all); renderQueue(all); renderOrders(all); renderSummary(); renderDealers(); renderVehicles(); renderTeam(); renderReport();
}

/* ---------- New order / today ---------- */
function renderToday(all){
  const k = S.today;
  const today = all.filter(o => o.day === k);
  $("todayTitle").innerHTML = T("Today") + " · " + esc(fmtDay(k));
  const pend = today.filter(o => o.status === "Pending").length;
  $("todayCount").textContent = today.length ? `${today.length} orders · ${pend} pending` : "";
  $("todayList").innerHTML = today.length ? today.slice().reverse().map(o => `
    <div class="row" data-edit="${esc(o.id)}" style="cursor:pointer">${tok(o)}
      <div class="main"><b>${esc(o.party)}</b><div class="meta"><span>${fmtTime(o.orderAt)}</span>${o.dealer?`<span>${esc(o.dealer)}</span>`:""}<span>${o.bags} ${T("bags")}</span>${o.createdBy ? `<span>${esc(nameOf(o.createdBy))}</span>` : ""}</div></div>
      ${pill(o.status)}</div>`).join("")
    : `<div class="empty"><b>No orders yet today</b>Orders you add appear here with their token.</div>`;
}

/* ---------- Queue ---------- */
function qCard(o){
  const confirming = S.confirmId === o.id;
  return `<div class="qcard">
    <div class="qpos"><b>${o.queue}</b><span>${T("in line")}</span></div>
    <div style="min-width:0">
      <div class="top">${tok(o)}<b>${esc(o.party)}</b>${o.dealer?`<span class="pill" style="background:var(--surface-2);color:var(--muted)">${esc(o.dealer)}</span>`:""}</div>
      <div class="facts"><span><em>${o.bags}</em> ${T("bags")}</span><span>${esc(fmtItems(o))}</span>${o.location?`<span>${esc(o.location)}</span>`:""}${o.phone?`<span>${esc(o.phone)}</span>`:""}${plate(o.vehicle)}${o.driver?`<span>${esc(o.driver)}</span>`:""}</div>
      <div class="facts"><span>${T("Ordered")} ${esc(fmtDT(o.orderAt))}</span>${enteredBy(o)}<span class="wait">${T("Waiting")} ${waitTxt(Date.now()-o.orderAt)}</span></div>
      ${confirming ? `<div class="confirm"><label for="c-time" style="color:var(--done)">${T("Dispatched at")}</label><input type="datetime-local" id="c-time" value="${toLocalInput(Date.now())}"><button class="btn go sm" data-act="deliver-ok" data-id="${esc(o.id)}">Confirm dispatched</button><button class="btn sm" data-act="deliver-cancel">Cancel</button></div>`
      : `<div class="acts">
          <button class="btn go sm" data-act="deliver" data-id="${esc(o.id)}" ${S.canEdit?"":"disabled title=\"View-only access\""}>Mark dispatched</button>
          ${S.canWrite ? `<button class="btn sm" data-edit="${esc(o.id)}">Edit</button>` : ""}</div>`}
    </div></div>`;
}
function renderQueue(all){
  const pend = all.filter(o => o.status === "Pending");
  const ld = S.lastDisp && all.find(o => o.id === S.lastDisp && o.status === "Dispatched");
  $("dispNote").hidden = !ld;
  if (ld) $("dispNote").innerHTML = `<span>Dispatched: <b>${esc(ld.party)}</b>${ld.token ? ` (token ${ld.token})` : ""}${ld.vehicle ? " · " + esc(ld.vehicle) : ""}</span>${waBtn(ld, "Send update on WhatsApp")}<button class="btn sm" type="button" data-act="dispnote-x" aria-label="Hide this note">Hide</button>`;
  $("queueNote").textContent = S.canWrite ? "" : "You have view-only access.";
  $("queueList").innerHTML = pend.length ? pend.map(qCard).join("")
    : `<div class="empty"><b>Queue is clear</b>No pending orders. New orders join the end of the line by order time.</div>`;
}

/* ---------- All orders ---------- */
function daysBetween(from, to){ const out = []; let t = Date.parse(from + "T00:00:00"); const end = Date.parse(to + "T00:00:00"); while (t <= end && out.length < 400){ out.push(dayKey(t)); t += 864e5; } return out; }
function rangeCovered(from, to){
  if (!from || !to || from > to) return true;
  const r = S.range;
  return daysBetween(from, to).every(d => S.liveDays.has(d) || (r.from && d >= r.from && d <= r.to));
}
function filtered(all){
  const from = $("o-from").value, to = $("o-to").value, dl = $("o-dealer").value, st = $("o-status").value, q = $("o-q").value.trim().toLowerCase(), qd = q.replace(/\D/g, "");
  return all.filter(o => (!from || o.day >= from) && (!to || o.day <= to) && (dl === "*" || (o.dealer||"") === dl) && (!st || o.status === st)
    && (!q || (o.party||"").toLowerCase().includes(q) || (o.location||"").toLowerCase().includes(q) || (qd.length >= 3 && (o.phone||"").replace(/\D/g, "").includes(qd))));
}
function renderOrders(all){
  const from = $("o-from").value, to = $("o-to").value;
  const lb = $("ordersLoad");
  if (!rangeCovered(from, to)) {
    const n = daysBetween(from, to).length;
    lb.hidden = false;
    lb.innerHTML = `<span>Orders for ${esc(fmtDay(from))} to ${esc(fmtDay(to))} aren't loaded yet. Loading ${n} day${n>1?"s":""} uses database reads, so it only happens when you ask.</span><button class="btn primary sm" type="button" data-act="load-range">Load these dates</button>`;
  } else if (S.range.at && S.range.from <= from && S.range.to >= to && daysBetween(from, to).some(d => !S.liveDays.has(d))) {
    lb.hidden = false;
    lb.innerHTML = `<span>Older orders loaded at ${fmtTime(S.range.at)}. Changes made by others since then won't show until you reload.</span><button class="btn sm" type="button" data-act="load-range">Reload</button>`;
  } else lb.hidden = true;
  const rows = filtered(all).slice().reverse();
  const bags = rows.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+(+o.bags||0),0);
  $("ordersCount").textContent = rows.length ? `${rows.length} orders · ${inr(bags)} bags (≈ ${tonnes(bags)} t)` : "";
  $("ordersBody").innerHTML = rows.length ? rows.map(o => `<tr class="click" data-edit="${esc(o.id)}">
    <td>${tok(o)}</td><td>${esc(fmtDT(o.orderAt))}</td><td>${esc(nameOf(o.createdBy))}</td><td>${esc(o.dealer)}</td><td class="wrapc">${esc(o.party)}</td><td class="wrapc">${esc(o.location)}</td>
    <td class="wrapc">${esc(fmtItems(o))}</td><td class="num">${o.bags}</td><td>${plate(o.vehicle)}</td><td>${esc(o.driver)}</td><td>${pill(o.status)}</td>
    <td>${esc(fmtDT(o.executedAt))}</td><td class="num">${hm(o.taken)}</td></tr>`).join("")
    : `<tr><td colspan="13"><div class="empty" style="border:0"><b>No orders match</b>Change the dates or filters${rangeCovered(from, to) ? "" : ", or tap Load these dates"}.</div></td></tr>`;
}
async function loadRange(){
  const from = $("o-from").value, to = $("o-to").value;
  if (!from || !to || from > to) return toast("Pick a From date on or before the To date.");
  if (daysBetween(from, to).length > 366) return toast("Pick up to one year at a time.");
  const lb = $("ordersLoad"); lb.innerHTML = "<span>Loading…</span>";
  try {
    const snap = await getDocs(query(fsCollection(fdb, "orders"), where("day", ">=", from), where("day", "<=", to)));
    S.range = { from, to, map: new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }])), at: Date.now() };
    render();
  } catch(e){ toast(failMsg(e)); render(); }
}

/* ---------- Summary ---------- */
function sumRow(label, a, cls, withLast, attr){
  const avg = a.tn ? a.tsum / a.tn : null;
  return `<tr class="${cls||""}${attr ? " click" : ""}" ${attr || ""}><td>${label}</td><td class="num">${a.n}</td><td class="num ${a.Pending?"red":""}">${a.Pending}</td><td class="num">${a.Dispatched}</td><td class="num">${a.Cancelled}</td><td class="num">${inr(a.bags)}</td><td class="num">${inr(a.pbags)}</td><td class="num">${hm(avg)}</td>${withLast?`<td>${esc(fmtDT(a.last))}</td>`:""}</tr>`;
}
function daySumFor(k){
  if (S.liveDays.has(k)) return daySummary(k, [...S.live.values()].filter(o => (o.day || dayKey(o.orderAt)) === k).map(norm));
  return S.sums.get(k) || null;
}
async function loadSums(month, force){
  if (!fdb || !month) return;
  if (!force && S.sumAt[month] && Date.now() - S.sumAt[month] < 5 * 60e3) return;
  S.sumAt[month] = Date.now();
  try {
    const snap = await getDocs(query(fsCollection(fdb, "daysum"), where("day", ">=", month + "-01"), where("day", "<=", month + "-31")));
    for (const d of snap.docs) S.sums.set(d.id, d.data());
  } catch(e){ S.sumAt[month] = 0; toast(failMsg(e)); }
  renderSummary();
}
function renderSummary(){
  const m = $("s-month").value; if (!m) return;
  const [y, mo] = m.split("-").map(Number); const ndays = new Date(y, mo, 0).getDate();
  const total = emptyAgg(), dealers = new Map(), rows = [];
  for (let d = 1; d <= ndays; d++){
    const k = m + "-" + pad(d); const s = daySumFor(k);
    const a = s ? s.total : emptyAgg(); rows.push([k, a]); addAgg(total, a);
    if (s) for (const r of s.dealers || []) addAgg(dealers.get(r.dealer) || dealers.set(r.dealer, emptyAgg()).get(r.dealer), r);
  }
  const avg = total.tn ? total.tsum / total.tn : null;
  $("kpis").innerHTML = `
    <div class="kpi"><span>${T("Orders")}</span><b>${inr(total.n)}</b><small>${T("this month")}</small></div>
    <div class="kpi hot"><span>${T("Pending now")}</span><b>${S.pending.length}</b><small>${T("all dates")}</small></div>
    <div class="kpi"><span>${T("Dispatched")}</span><b>${inr(total.Dispatched)}</b><small>${total.Cancelled} ${T("cancelled")}</small></div>
    <div class="kpi"><span>${T("Bags")}</span><b>${inr(total.bags)}</b><small>≈ ${tonnes(total.bags)} t</small></div>
    <div class="kpi"><span>${T("Avg time taken")}</span><b>${avg != null ? hm(avg) : "–"}</b><small>${T("order → dispatch")}</small></div>`;
  const names = S.dealers.map(d => d.name).filter(Boolean);
  const extra = [...dealers.keys()].filter(d => d && !names.includes(d));
  let h = sumRow("<b>All orders</b>", total, "tot", true);
  for (const n of [...names, ...extra]){ const a = dealers.get(n) || emptyAgg(); h += sumRow(esc(n) + (extra.includes(n)?' <span class="hint">(not in list)</span>':""), a, a.n?"":"dim", true, `data-xl-dealer="${esc(n)}"`); }
  const noD = dealers.get(""); if (noD && noD.n) h += sumRow("Older orders without a dealer", noD, "", true);
  $("dealerBody").innerHTML = h;
  let dh = sumRow("<b>Month total</b>", total, "tot", false);
  for (const [k, a] of rows) dh += sumRow(fmtDay(k), a, a.n?"":"dim", false, `data-xl-day="${k}"`);
  $("dayBody").innerHTML = dh;
  $("sumNote").textContent = S.sumAt[m] ? `Today and days with pending orders update live. Other days' totals were loaded at ${fmtTime(S.sumAt[m])}.` : "Loading totals…";
  $("sumRecalc").hidden = !S.isAdmin; $("sumMaster").hidden = !S.isAdmin; $("sumRefresh").hidden = !S.canRefresh;
}
async function recalcMonth(){
  const m = $("s-month").value; if (!m || !S.isAdmin) return;
  const btn = $("sumRecalc"); btn.disabled = true; btn.textContent = "Recalculating…";
  try {
    const snap = await getDocs(query(fsCollection(fdb, "orders"), where("day", ">=", m + "-01"), where("day", "<=", m + "-31")));
    const by = {}; for (const d of snap.docs){ const o = norm({ id: d.id, ...d.data() }); (by[o.day] ||= []).push(o); }
    const days = new Set([...Object.keys(by), ...[...S.sums.keys()].filter(k => k.startsWith(m))]);
    let batch = writeBatch(fdb), n = 0;
    for (const k of days){ const s = daySummary(k, by[k] || []); S.sums.set(k, s); batch.set(fsDoc(fdb, "daysum", k), s); if (++n % 400 === 0){ await batch.commit(); batch = writeBatch(fdb); } }
    await batch.commit(); S.sumAt[m] = Date.now(); toast("Month totals recalculated");
  } catch(e){ toast(failMsg(e)); }
  btn.disabled = false; btn.textContent = "Recalculate month"; renderSummary();
}

/* ---------- Excel files (same columns as the weekly email, so the master Excel can combine them) ---------- */
const isoDT = ms => ms == null ? "" : dayKey(ms) + " " + fmtTime(ms);
const monthEnd = m => { const [y, mo] = m.split("-").map(Number); return m + "-" + pad(new Date(y, mo, 0).getDate()); };
function excelRowAll(o){
  return { "Order ID": o.id, "Date": o.day, "Token": o.token ?? "", "Order Date & Time": isoDT(o.orderAt), "Dealer": o.dealer || "", "Party": o.party || "",
    "Phone": o.phone || "", "Location": o.location || "", "Products": fmtItems(o), "Total Bags": +o.bags || 0, "Vehicle": o.vehicle || "", "Driver": o.driver || "",
    "Status": o.status, "Dispatched Date & Time": isoDT(o.executedAt), "Time Taken (h:mm)": hm(o.taken), "Time Taken (minutes)": o.taken != null ? Math.round(o.taken / 60000) : "",
    "Remarks": o.remarks || "", "Entered by": nameOf(o.createdBy), "Last Changed By": o.updatedBy ? nameOf(o.updatedBy) : "", "Last Changed At": isoDT(o.updatedAt) };
}
// Time taken (per order and the averages) goes only into the Admin's Excel files.
function excelRow(o){
  const r = excelRowAll(o);
  if (!S.isAdmin) { delete r["Time Taken (h:mm)"]; delete r["Time Taken (minutes)"]; }
  return r;
}
async function fetchOrders(from, to){
  const snap = await getDocs(query(fsCollection(fdb, "orders"), where("day", ">=", from), where("day", "<=", to)));
  const list = snap.docs.map(d => norm({ id: d.id, ...d.data() })).sort(byTime);
  const per = {}; for (const o of list){ per[o.day] = (per[o.day]||0) + 1; o.token = per[o.day]; }
  return list;
}
function summaryAoa(title, from, to, list){
  const withTime = S.isAdmin;   // the average time column is for the Admin's files only
  const head = (first) => [first, "Orders", "Pending", "Dispatched", "Cancelled", "Bags", "Pending bags", ...(withTime ? ["Avg time (h:mm)"] : [])];
  const line = (label, a) => [label, a.n, a.Pending, a.Dispatched, a.Cancelled, a.bags, a.pbags, ...(withTime ? [a.tn ? hm(a.tsum / a.tn) : ""] : [])];
  const by = (key) => { const g = new Map(); for (const o of list){ const k = key(o); if (!g.has(k)) g.set(k, []); g.get(k).push(o); } return [...g.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))); };
  const total = aggOf(list);
  return [["DHS Logistics: " + title], ["From", from, "To", to], ["Downloaded", isoDT(Date.now())], [],
    ["By dealer"], head("Dealer"), ...by(o => o.dealer || "(no dealer)").map(([k, l]) => line(k, aggOf(l))), line("Total", total), [],
    ["By day"], head("Date"), ...by(o => o.day).map(([k, l]) => line(k, aggOf(l))), line("Total", total)];
}
function saveWorkbook(fname, rows, aoa){
  if (!window.XLSX) return toast("The Excel tool didn't load. Check your internet and reload the page.");
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [excelRow(norm({ id: "", orderAt: Date.now(), bags: 0 }))].map(r => Object.fromEntries(Object.keys(r).map(k => [k, ""]))));
  ws["!cols"] = Object.keys(excelRow(norm({ id: "", orderAt: Date.now(), bags: 0 }))).map(k => ({ wch: Math.max(10, k.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  if (aoa) { const s2 = XLSX.utils.aoa_to_sheet(aoa); s2["!cols"] = [{ wch: 26 }, ...Array(7).fill({ wch: 13 })]; XLSX.utils.book_append_sheet(wb, s2, "Summary"); }
  downloadFile(fname, new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
async function exportOrders({ from, to, dealer, fname, title }){
  if (!fdb) return;
  try {
    let list = await fetchOrders(from, to);
    if (dealer) list = list.filter(o => (o.dealer || "") === dealer);
    saveWorkbook(fname, list.map(excelRow), summaryAoa(title, from, to, list));
    return list.length;
  } catch(e){ toast(failMsg(e)); return null; }
}
const slug = t => String(t).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
function openExport({ dealer, day }){
  const m = $("s-month").value;
  const from = day || (m + "-01"), to = day || (monthEnd(m) < S.today ? monthEnd(m) : S.today);
  const title = dealer ? dealer : "Orders of " + fmtDay(day);
  $("sheetCard").innerHTML = `
    <div><h3>${T("Download Excel")}: ${esc(dealer || fmtDay(day))}</h3><p class="sub">${dealer ? "This dealer's orders and totals" : "Every order and the totals"} for the dates you pick. The file has an <b>Orders</b> sheet and a <b>Summary</b> sheet.</p></div>
    <form class="grid" id="xlForm" data-dealer="${esc(dealer || "")}" data-title="${esc(title)}">
      <div class="fld"><label for="x-from">${T("From")}</label><input type="date" id="x-from" required value="${from}"></div>
      <div class="fld"><label for="x-to">${T("To")}</label><input type="date" id="x-to" required value="${to}"></div>
      <p class="hint wide" id="x-note"></p>
      <div class="actions wide fld"><button class="btn primary" type="submit" id="x-go">Download Excel</button><button class="btn" type="button" data-act="close">Close</button></div>
    </form>`;
  $("sheet").hidden = false; $("sheet").dataset.id = ""; xlNote();
}
function xlNote(){ const f = $("x-from"), t = $("x-to"); if (!f || !t || !f.value || !t.value) return; const n = f.value <= t.value ? daysBetween(f.value, t.value).length : 0;
  $("x-note").textContent = n ? `${n} day${n > 1 ? "s" : ""} selected. Loading them uses database reads (about 100 per busy day), only when you tap Download.` : "Pick a From date on or before the To date."; }
document.addEventListener("input", e => { if (e.target.id === "x-from" || e.target.id === "x-to") xlNote(); });
document.addEventListener("click", e => {
  const r = e.target.closest("[data-xl-dealer],[data-xl-day]"); if (!r) return;
  openExport(r.dataset.xlDealer != null ? { dealer: r.dataset.xlDealer } : { day: r.dataset.xlDay });
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "xlForm") return; e.preventDefault();
  const from = $("x-from").value, to = $("x-to").value, dealer = e.target.dataset.dealer || null, title = e.target.dataset.title;
  if (!from || !to || from > to) return toast("Pick a From date on or before the To date.");
  if (daysBetween(from, to).length > 366) return toast("Pick up to one year at a time.");
  const btn = $("x-go"); btn.disabled = true; btn.textContent = "Preparing…";
  const fname = dealer ? `DHS_${slug(dealer)}_${from}_to_${to}.xlsx` : (from === to ? `DHS_Orders_${from}.xlsx` : `DHS_Orders_${from}_to_${to}.xlsx`);
  const n = await exportOrders({ from, to, dealer, fname, title });
  btn.disabled = false; btn.textContent = "Download Excel";
  if (n != null) { closeSheet(); toast(n ? `Excel ready: ${n} order${n > 1 ? "s" : ""}` : "No orders in those dates. The file is empty."); }
});
$("sumMaster").addEventListener("click", async () => {
  const m = $("s-month").value; if (!m || !S.isAdmin) return;
  const b = $("sumMaster"); b.disabled = true; b.textContent = "Preparing…";
  const n = await exportOrders({ from: m + "-01", to: monthEnd(m), dealer: null, fname: `DHS_Master_${m}.xlsx`, title: "Master file " + m });
  b.disabled = false; b.textContent = "Download master file";
  if (n != null) toast(`Master file ready: ${n} orders`);
});

/* ---------- report emails: schedule + recipients (Admin) ---------- */
const PY_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];   // same order as the email job
const REP_DEFAULT = { weekly: { on: true, day: 5, time: "21:00", recipients: [] }, monthly: { on: true, day: 1, time: "09:00", recipients: [] },
  daily: { on: true, time: "21:00", recipients: [] } };
const REP_LABEL = { weekly: "Weekly report", monthly: "Monthly master file", daily: "Daily contact list" };
const repOf = kind => repSettings()[{ weekly: "w", monthly: "m", daily: "d" }[kind]];
function repSettings(){
  const r = S.report || {};
  const w = { ...REP_DEFAULT.weekly, ...(r.weekly || {}) }, m = { ...REP_DEFAULT.monthly, ...(r.monthly || {}) };
  if (!(r.weekly && r.weekly.recipients && r.weekly.recipients.length) && Array.isArray(r.recipients)) w.recipients = r.recipients;
  const d = { ...REP_DEFAULT.daily, ...(r.daily || {}) };
  for (const x of [w, m, d]) x.recipients = Array.isArray(x.recipients) ? x.recipients : [];
  return { w, m, d };
}
const time12 = t => { const [h, mi] = t.split(":").map(Number); return ((h % 12) || 12) + ":" + pad(mi) + (h < 12 ? " am" : " pm"); };
const ordinal = n => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
function nextWeekly(w){ const [h, mi] = w.time.split(":").map(Number); const d = new Date(); d.setHours(h, mi, 0, 0);
  const jsDay = (w.day + 1) % 7; d.setDate(d.getDate() + ((jsDay - d.getDay() + 7) % 7)); if (d <= new Date()) d.setDate(d.getDate() + 7); return d.getTime(); }
function nextDaily(x){ const [h, mi] = x.time.split(":").map(Number); const d = new Date(); d.setHours(h, mi, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); return d.getTime(); }
function nextMonthly(m){ const [h, mi] = m.time.split(":").map(Number); const d = new Date(); d.setDate(m.day); d.setHours(h, mi, 0, 0);
  if (d <= new Date()) d.setMonth(d.getMonth() + 1); return d.getTime(); }
const fmtNext = ms => { const d = new Date(ms); return PY_DAYS[(d.getDay() + 6) % 7].slice(0, 3) + " " + d.getDate() + " " + MON[d.getMonth()] + ", " + time12(pad(d.getHours()) + ":" + pad(d.getMinutes())); };
function repCard(kind, x, r){
  const times = Array.from({ length: 48 }, (_, i) => pad(Math.floor(i / 2)) + ":" + (i % 2 ? "30" : "00"));
  const daySel = kind === "daily" ? `<div class="fld"><label>${T("Day")}</label><div class="repevery">Every day</div></div>`
    : kind === "weekly"
    ? `<div class="fld"><label for="rd-${kind}">${T("Day")}</label><select id="rd-${kind}" data-rep-day="${kind}">${PY_DAYS.map((n, i) => `<option value="${i}" ${i === +x.day ? "selected" : ""}>${n}</option>`).join("")}</select></div>`
    : `<div class="fld"><label for="rd-${kind}">${T("Day of the month")}</label><select id="rd-${kind}" data-rep-day="${kind}">${Array.from({ length: 28 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === +x.day ? "selected" : ""}>${ordinal(n)}</option>`).join("")}</select></div>`;
  const last = { weekly: [r.lastWeeklySentAt, r.lastWeeklyResult], monthly: [r.lastMonthlySentAt, r.lastMonthlyResult], daily: [r.lastDailySentAt, r.lastDailyResult] }[kind];
  const next = x.on && x.recipients.length ? "Next email: " + fmtNext({ weekly: nextWeekly, monthly: nextMonthly, daily: nextDaily }[kind](x)) : (x.on ? "Add at least one email address to start sending." : "Switched off. Nothing will be sent.");
  const about = { weekly: "The orders since the last weekly report, as Excel (without the time-taken columns).",
    monthly: "Every order of the previous month (DHS_Master_YYYY-MM.xlsx), the copy for your master folder.",
    daily: "Dealer, party, phone and location of every order since the 1st of the month (DHS_Contacts_YYYY-MM.xlsx). Each day's file has everything so far; it starts afresh on the 1st." }[kind];
  return `<div class="repcard">
    <div class="head"><div><h3>${T(REP_LABEL[kind])}</h3>
      <p class="sub">${about}</p></div>
      <label class="switch"><input type="checkbox" data-rep-on="${kind}" ${x.on ? "checked" : ""}> Send</label></div>
    <div class="grid2">${daySel}<div class="fld"><label for="rt-${kind}">${T("Time (India)")}</label><select id="rt-${kind}" data-rep-time="${kind}">${times.map(t => `<option value="${t}" ${t === x.time ? "selected" : ""}>${time12(t)}</option>`).join("")}</select></div></div>
    <p class="repnext">${esc(next)}</p>
    ${x.recipients.length ? `<div class="tscroll"><table><tbody>${x.recipients.map(e => `<tr><td>${esc(e)}</td><td class="num"><button class="btn sm danger" data-act="rep-del" data-kind="${kind}" data-email="${esc(e)}">Remove</button></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty"><b>No one on this list yet</b>Add an email address below.</div>`}
    <form class="repform" data-kind="${kind}"><input id="re-${kind}" type="email" required placeholder="name@gmail.com" aria-label="Email address for the ${kind} email"><button class="btn primary sm" type="submit">Add</button></form>
    <p class="hint">${last[0] ? `Last sent ${esc(fmtDT(last[0]))}` : "Not sent yet"}${last[1] ? " · " + esc(last[1]) : ""}</p></div>`;
}
function renderReport(){
  const box = $("reportBox"); if (!box) return;
  if (!S.isAdmin) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && document.activeElement.type === "email") return;
  const r = S.report || {}; const { w, m, d } = repSettings();
  box.innerHTML = `<div style="display:grid;gap:14px">
    <div><h3>${T("Report emails")}</h3><p class="sub">Choose who gets each email and when. Changes apply straight away. Emails usually arrive 5 to 10 minutes after the set time, sometimes later when GitHub is busy.</p></div>
    <div class="repgrid">${repCard("daily", d, r)}${repCard("weekly", w, r)}${repCard("monthly", m, r)}</div>
    <p class="hint">${r.lastCheckedAt ? `The email job last checked ${esc(fmtDT(r.lastCheckedAt))}.` : "The email job hasn't run yet. Set it up on GitHub once (see README); after that it checks every 30 minutes."}${r.lastError ? " Last problem: " + esc(r.lastError) : ""}</p></div>`;
}
async function saveRep(kind, patch, msg){
  const next = { ...repOf(kind), ...patch };
  try { await setDoc(fsDoc(fdb, "config", "report"), { ...(S.report || {}), [kind]: next }); if (msg) toast(msg); }
  catch(e){ toast(failMsg(e)); throw e; }
}
document.addEventListener("change", e => {
  const t = e.target; const kind = t.dataset.repOn || t.dataset.repDay || t.dataset.repTime; if (!kind) return;
  const label = REP_LABEL[kind];
  if (t.dataset.repOn) saveRep(kind, { on: t.checked }, label + (t.checked ? " switched on" : " switched off")).catch(() => {});
  if (t.dataset.repDay) saveRep(kind, { day: +t.value }, label + " day saved").catch(() => {});
  if (t.dataset.repTime) saveRep(kind, { time: t.value }, label + " time saved: " + time12(t.value)).catch(() => {});
});
document.addEventListener("submit", async e => {
  const f = e.target.closest(".repform"); if (!f) return; e.preventDefault();
  const kind = f.dataset.kind, inp = $("re-" + kind), email = inp.value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Enter a valid email address.");
  const list = repOf(kind).recipients;
  if (list.includes(email)) return toast("That email is already on the list.");
  if (list.length >= 20) return toast("A list can hold up to 20 addresses.");
  inp.blur();
  try { await saveRep(kind, { recipients: [...list, email] }, email + " added"); inp.value = ""; } catch(e){}
  renderReport();
});
document.addEventListener("click", async e => {
  const b = e.target.closest('[data-act="rep-del"]'); if (!b) return;
  if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again"; setTimeout(() => { if (b.isConnected){ b.dataset.armed = ""; b.textContent = "Remove"; } }, 4000); return; }
  const kind = b.dataset.kind, list = repOf(kind).recipients;
  try { await saveRep(kind, { recipients: list.filter(x => x !== b.dataset.email) }, "Removed " + b.dataset.email); } catch(e){}
});

/* ---------- Dealers ---------- */
function renderDealers(){
  const box = $("dealerEditor");
  if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
  const rows = S.dealers.map((d,i) => `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.contact)}</td><td>${esc(d.phone)}</td><td>${esc(d.area)}</td>
    <td>${S.isAdmin?`<button class="btn sm danger" data-act="dl-del" data-i="${i}">Remove</button>`:""}</td></tr>`).join("");
  box.innerHTML = `<div style="display:grid;gap:14px">
    ${S.dealers.length ? `<div class="tscroll"><table><thead><tr><th>${T("Dealer")}</th><th>${T("Contact person")}</th><th>${T("Phone")}</th><th>${T("Area")}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><b>No dealers added yet</b>${S.canAddDealer ? "Add your first authorised dealer below." : "An Admin adds dealers here."}</div>`}
    ${S.canAddDealer ? `<form class="grid" id="dealerForm" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <div class="fld"><label for="d-name">${T("Dealer name")} <span class="req">*</span></label><input id="d-name" required></div>
      <div class="fld"><label for="d-contact">${T("Contact person")}</label><input id="d-contact"></div>
      <div class="fld"><label for="d-phone">${T("Phone")}</label><input id="d-phone" inputmode="tel"></div>
      <div class="fld"><label for="d-area">${T("Area")}</label><input id="d-area"></div>
      <div class="fld" style="align-self:end"><button class="btn primary" type="submit">Add dealer</button></div></form>`
      : `<p class="hint">Only the Admin or a Supervisor can add dealers.</p>`}${S.canAddDealer && !S.isAdmin ? `<p class="hint">You can add dealers. Only the Admin can remove them.</p>` : ""}</div>`;
}
async function saveDealers(list){
  try { await setDoc(fsDoc(fdb, "config", "dealers"), { list }); toast("Dealer list saved"); } catch(e){ toast(failMsg(e)); }
}

/* ---------- edit sheet ---------- */
// Why this person can't change an order's details or cancel it ("" = they can).
function changeBlock(o){
  if (!S.canWrite) return "You have view-only access.";
  if (S.isAdmin) return "";
  if (o.status === "Dispatched") return "This order is dispatched. Only the Admin can change its details.";
  if (S.isDesk && o.createdBy !== S.me) return "You can change only the orders you entered. Ask a Supervisor or the Admin.";
  if (S.isDesk && o.day !== S.today) return "You can change only today's orders. Ask a Supervisor or the Admin.";
  return "";
}
function openEdit(id){
  const o = (S.all||[]).find(x => x.id === id); if (!o) return;
  const block = changeBlock(o), fixTime = o.status === "Dispatched" && S.canFixTime;
  $("sheetCard").innerHTML = `
    <div class="head"><div style="display:flex;gap:12px;align-items:center">${tok(o)}<div><h3>${T("Edit order")}</h3><div class="hint">Entered ${esc(fmtDT(o.createdAt))}${o.createdBy?" by "+esc(nameOf(o.createdBy)):""}</div>${o.updatedBy ? `<div class="hint">Last changed ${esc(fmtDT(o.updatedAt))} by ${esc(nameOf(o.updatedBy))}</div>` : ""}</div></div>${pill(o.status)}</div>
    <form class="grid" id="editForm">
      ${block ? `<div class="banner wide">${esc(block)}</div>` : ""}
      <div class="fld"><label for="e-orderAt">${T("Order date & time")}</label><input type="datetime-local" id="e-orderAt" required value="${toLocalInput(o.orderAt)}">${!S.canBackdate && !block ? '<span class="hint">Only the Admin can change the order time.</span>' : ""}</div>
      <div class="fld combo"><label for="e-dealer">${T("Dealer")} <span class="req">*</span></label><input id="e-dealer" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="e-dealer-list" placeholder="Type or pick a dealer" value="${esc(o.dealer)}"><div class="combo-list" id="e-dealer-list" role="listbox" hidden></div></div>
      <div class="fld"><label for="e-party">${T("Party / customer")}</label><input id="e-party" required value="${esc(o.party)}"></div>
      <div class="fld"><label for="e-phone">${T("Phone")}</label><input id="e-phone" value="${esc(o.phone)}"></div>
      <div class="fld wide"><label for="e-location">${T("Delivery location")}</label><input id="e-location" value="${esc(o.location)}"></div>
      <div class="fld wide"><label>${T("Products & bags (50 kg)")}</label><div class="items" id="e-items">${itemsInner("e-", itemsOf(o))}</div></div>
      <div class="fld"><label for="e-vehicle">${T("Vehicle no.")}</label><input id="e-vehicle" list="vehicleList" value="${esc(o.vehicle)}" style="text-transform:uppercase"></div>
      <div class="fld"><label for="e-driver">${T("Driver")}</label><input id="e-driver" value="${esc(o.driver)}"></div>
      <div class="fld wide"><label for="e-remarks">${T("Remarks")}</label><textarea id="e-remarks" rows="2">${esc(o.remarks)}</textarea></div>
      ${o.status!=="Dispatched" ? `<div class="fld"><label for="e-mark">${T("Mark as")}</label><select id="e-mark"><option value="">Pending (in queue)</option><option ${o.mark==="Cancelled"?"selected":""}>Cancelled</option></select></div>` : ""}
      ${fixTime ? `<div class="fld"><label for="e-exec">${T("Dispatched at")}</label><input type="datetime-local" id="e-exec" value="${toLocalInput(o.executedAt)}"></div>` : ""}
      ${o.status==="Dispatched" && !fixTime ? `<div class="fld"><label>${T("Dispatched at")}</label><div>${esc(fmtDT(o.executedAt))}</div></div>` : ""}
      <div class="actions wide fld" style="justify-content:space-between">
        <div class="actions">${!block || fixTime ? '<button class="btn primary" type="submit">Save changes</button>' : ""}<button class="btn" type="button" data-act="close">Close</button></div>
        <div class="actions">${waBtn(o, o.status === "Dispatched" ? "WhatsApp dispatch update" : "WhatsApp token")}${o.status==="Dispatched" && S.canEdit ? `<button class="btn sm" type="button" data-act="undeliver" data-id="${esc(o.id)}">Undo dispatch</button>`:""}
        ${S.isAdmin ? `<button class="btn sm danger" type="button" data-act="delete" data-id="${esc(o.id)}">Delete order</button>` : ""}</div>
      </div>
    </form>`;
  $("sheet").hidden = false; $("sheet").dataset.id = id; itemsTotal($("e-items"));
  // lock what this person may not change
  if (block) for (const el of $("editForm").querySelectorAll("input,select,textarea,.items button")) { if (el.id !== "e-exec") el.disabled = true; }
  else if (!S.canBackdate) $("e-orderAt").disabled = true;
}
function closeSheet(){ $("sheet").hidden = true; }

function readForm(p){
  const v = id => $(p+id).value.trim();
  return { orderAt: fromLocalInput($(p+"orderAt").value), dealer: $(p+"dealer").value, party: v("party"), phone: v("phone"), location: v("location"),
    items: readItems(p), vehicle: v("vehicle").toUpperCase(), driver: v("driver"), remarks: v("remarks") };
}
function validate(d, keepDealer){
  d.dealer = (d.dealer || "").trim();
  if (!d.dealer) return "Select a dealer.";
  const m = comboNames().find(n => n.toLowerCase() === d.dealer.toLowerCase());
  if (m) d.dealer = m; else if (!keepDealer || d.dealer !== keepDealer) return "Pick a dealer from the list. The Admin or a Supervisor adds new dealers under Settings → Dealers.";
  if (isNaN(d.orderAt)) return "Enter the order date and time.";
  if (!d.party) return "Enter the party / customer name.";
  const first = d.items[0] || {};
  if (!first.product || !(first.bags > 0)) return "Select the first product and enter its bags (a whole number above 0).";
  const clean = [];
  for (const it of d.items) {
    if (!it.product && !(it.bags > 0) && isNaN(it.bags)) continue;
    if (!it.product || !(it.bags > 0)) return "Each extra product needs both a product and its bags.";
    if (clean.some(c => c.product === it.product)) return it.product + " is added twice. Put all its bags on one line.";
    clean.push({ product: it.product, bags: it.bags });
  }
  d.items = clean; d.bags = clean.reduce((t, i) => t + i.bags, 0); d.brand = clean.map(i => i.product).join(", ");
  if (d.orderAt > Date.now() + 5*60000) return "Order time is in the future. Check the date.";
  return null;
}

/* ---------- events ---------- */
/* ---------- navigation: main tabs, and the switch inside Orders and Settings ---------- */
// To add a tab later: add a <button class="tab" data-v="NAME"> in index.html, a <section id="v-NAME"> (or a
// <div class="topview" id="t-NAME"> with its own switch), and list it in TOP below.
const TOP = { new: "v-new", orders: "t-orders", summary: "v-summary", settings: "t-settings" };
const SUBS = { orders: ["queue", "orders"], settings: ["dealers", "vehicles", "team"] };
S.sub = { orders: "queue", settings: "dealers" };
const onPage = (top, sub) => S.view === top && (!sub || S.sub[top] === sub);
function saveNav(){ try { localStorage.setItem("cod.nav", JSON.stringify({ view: S.view, sub: S.sub })); } catch(e){} }
function showSub(top, sub){
  if (!SUBS[top] || !SUBS[top].includes(sub)) return;
  const btn = document.querySelector(`.segb[data-top="${top}"][data-sub="${sub}"]`); if (!btn || btn.hidden) sub = SUBS[top][0];
  S.sub[top] = sub;
  for (const b of document.querySelectorAll(`.segb[data-top="${top}"]`)) b.setAttribute("aria-selected", b.dataset.sub === sub ? "true" : "false");
  for (const p of SUBS[top]) $("v-" + p).hidden = p !== sub;
  saveNav();
}
function showView(v){
  if (!TOP[v]) v = "new";
  S.view = v;
  for (const t of document.querySelectorAll(".tab")) t.setAttribute("aria-selected", t.dataset.v === v ? "true" : "false");
  for (const [k, id] of Object.entries(TOP)) $(id).hidden = k !== v;
  if (SUBS[v]) showSub(v, S.sub[v]);
  if (v === "summary") loadSums($("s-month").value);
  saveNav();
}
$("tabs").addEventListener("click", e => { const b = e.target.closest(".tab"); if (b) showView(b.dataset.v); });

/* ---------- language switch ---------- */
function applyLang(){
  const hi = S.lang === "hi";
  for (const el of document.querySelectorAll("[data-t]")) {
    if (!el.dataset.en) el.dataset.en = el.textContent;
    el.textContent = t(el.dataset.en);
    if (hi && HI[el.dataset.en]) el.lang = "hi"; else el.removeAttribute("lang");
  }
  $("langTxt").textContent = hi ? "English" : "हिंदी";
  $("langTxt").lang = hi ? "en" : "hi";
  $("langBtn").setAttribute("aria-label", hi ? "Switch to English" : "हिंदी में देखें (Switch to Hindi)");
}
function setLang(l){
  S.lang = l === "hi" ? "hi" : "en";
  try { localStorage.setItem("dhs.lang", S.lang); } catch(e){}
  applyLang();
  if (S.role) { render(); if (S.lastId) showTicket(); }
}

/* ---------- account menu: Help, language, Sign out ---------- */
function setMenu(open, focusBtn){
  const m = $("menu"), b = $("menuBtn");
  if (open) m.classList.toggle("left", b.getBoundingClientRect().right < 260);
  m.hidden = !open; b.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) m.querySelector(".mi").focus(); else if (focusBtn) b.focus();
}
$("menuBtn").addEventListener("click", () => setMenu($("menu").hidden));
document.addEventListener("click", e => {
  if ($("menu").hidden || e.target.closest("#menuBtn")) return;
  const item = e.target.closest("#menu .mi");
  if (item || !e.target.closest("#menu")) setMenu(false, item && item.id === "langBtn");
});
$("menu").addEventListener("keydown", e => {
  const items = [...$("menu").querySelectorAll(".mi")], i = items.indexOf(document.activeElement);
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); }
  if (e.key === "Escape") { e.stopPropagation(); setMenu(false, true); }
  if (e.key === "Tab") setMenu(false);
});

/* ---------- help guide ----------
   help.html is a plain page on GitHub: no database reads. It opens only when someone taps Help,
   opens over the dashboard (so nothing reloads), and the installed app keeps a copy for offline use. */
const HELP_AT = { new: "new-order", queue: "queue", orders: "all-orders", summary: "summary", dealers: "dealers", vehicles: "vehicles", team: "team" };
let helpBack = false;
function helpSection(){ return S.view === "new" || S.view === "summary" ? HELP_AT[S.view] : HELP_AT[S.sub[S.view]] || "start"; }
function openHelp(sec){
  sec = sec || helpSection();
  const admins = S.members.filter(m => m.role === "admin").map(m => ({ name: m.name || "", email: m.id }));
  const f = $("helpFrame"), go = () => { try { f.contentWindow.helpAdmins(admins); f.contentWindow.helpGo(sec); } catch(e){} };
  $("helpPanel").hidden = false; document.body.style.overflow = "hidden";
  if (f.dataset.ready) go();
  else if (!f.dataset.loading) { f.dataset.loading = "1"; f.addEventListener("load", () => { f.dataset.ready = "1"; go(); }, { once: true }); f.src = "help.html"; }
  // so the phone's Back button closes the guide instead of leaving the dashboard
  if (!helpBack) { try { history.pushState({ dhsHelp: 1 }, ""); helpBack = true; } catch(e){} }
  $("helpClose").focus();
}
function hideHelp(){ $("helpPanel").hidden = true; document.body.style.overflow = ""; }
function closeHelp(){ if ($("helpPanel").hidden) return; hideHelp(); if (helpBack) { helpBack = false; try { history.back(); } catch(e){} } if (!$("app").hidden) $("menuBtn").focus(); }
window.addEventListener("popstate", () => { if (helpBack) { helpBack = false; hideHelp(); } });
$("helpBtn").addEventListener("click", () => openHelp());
$("helpClose").addEventListener("click", closeHelp);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("helpPanel").hidden) closeHelp(); });
document.addEventListener("click", e => { const a = e.target.closest("[data-help]"); if (a) { e.preventDefault(); openHelp(a.dataset.help); } }, true);

$("langBtn").addEventListener("click", () => setLang(S.lang === "hi" ? "en" : "hi"));
applyLang();
document.addEventListener("click", e => { const b = e.target.closest(".segb"); if (b) showSub(b.dataset.top, b.dataset.sub); });

/* ---------- duplicate check: same dealer and same party (or phone) within 12 hours. Uses orders already on screen: no reads. */
const normName = s => (s || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, " ").trim();
const digits10 = s => (s || "").replace(/\D/g, "").slice(-10);
function findDup(d){
  const p = normName(d.party), ph = digits10(d.phone);
  return (S.all || []).filter(o => o.status !== "Cancelled" && (o.dealer || "") === d.dealer && Math.abs(o.orderAt - d.orderAt) < 12 * 3600e3
    && (normName(o.party) === p || (ph.length === 10 && digits10(o.phone) === ph))).sort((a, b) => b.orderAt - a.orderAt)[0] || null;
}
function clearDup(){ if (!S.dupOk) return; S.dupOk = null; $("saveBtn").textContent = "Add order & get token"; $("formHint").textContent = ""; }
$("orderForm").addEventListener("input", clearDup);
$("orderForm").addEventListener("change", clearDup);

$("orderForm").addEventListener("submit", e => {
  e.preventDefault();
  const d = readForm("f-"); if (!S.canBackdate) d.orderAt = Date.now();
  const err = validate(d);
  if (err) { $("formHint").textContent = err; return; }
  if (!fdb) { $("formHint").textContent = "Not connected to the database, so the order can't be saved."; return; }
  const dup = findDup(d), key = [d.dealer, normName(d.party), digits10(d.phone), d.bags].join("|");
  if (dup && S.dupOk !== key) {
    S.dupOk = key; $("saveBtn").textContent = "Save anyway";
    $("formHint").innerHTML = `<span class="dupwarn">Looks like a repeat of <b>token ${dup.token ?? "–"}</b>: ${esc(dup.party)}, ${dup.bags} bags, ${esc(fmtDT(dup.orderAt))} (${esc(dup.status)}). Check, then tap <b>Save anyway</b> if this is a new order.</span>`;
    return;
  }
  clearDup();
  const ref = fsDoc(fsCollection(fdb, "orders"));
  const day = dayKey(d.orderAt);
  const data = { ...d, day, mark: "", open: true, dispatchedAt: null, dispatchedBy: null, createdAt: Date.now(), createdBy: S.me || null };
  commit(setDoc(ref, data), [day]);
  $("formHint").textContent = "";
  for (const k of ["dealer","party","phone","location","vehicle","driver","remarks"]) $("f-"+k).value = "";
  $("f-items").innerHTML = itemsInner("f-", []); itemsTotal($("f-items"));
  $("f-orderAt").value = toLocalInput(Date.now());
  S.lastId = ref.id; showTicket();
  $("f-party").focus();
});
function showTicket(){
  const o = (S.all||[]).find(x => x.id === S.lastId); const box = $("lastTicket");
  if (!o) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<div class="ticket"><div class="stub"><span>${T("Token")}</span><b>${o.token ?? "–"}</b><span>${esc(fmtDay(o.day))}</span></div>
    <div class="body"><strong>Saved: ${esc(o.party)}</strong><span class="hint">${o.bags} bags${o.dealer?" · "+esc(o.dealer):""} · ${o.queue?`No. ${o.queue} in the dispatch queue`:esc(o.status)}</span>${waBtn(o, "Send token on WhatsApp")}</div></div>`;
}

document.addEventListener("click", async e => {
  if (e.target.closest("a[href]")) return;
  const ed = e.target.closest("[data-edit]"); if (ed && !e.target.closest("[data-act]")) { if (S.canWrite) openEdit(ed.dataset.edit); else toast("View-only access: order details can't be opened."); return; }
  const b = e.target.closest("[data-act]"); if (!b) { if (e.target === $("sheet")) closeSheet(); return; }
  const act = b.dataset.act, id = b.dataset.id;
  const o = id ? (S.all || []).find(x => x.id === id) : null;
  if (act === "it-add") { const box = b.closest(".items"); const rows = box.querySelectorAll(".item"); if (rows.length < MAX_ITEMS) { rows[rows.length-1].insertAdjacentHTML("afterend", itemRow(b.dataset.p, {}, false)); const nr = box.querySelectorAll(".item"); nr[nr.length-1].querySelector("select").focus(); } itemsTotal(box); return; }
  if (act === "it-del") { const box = b.closest(".items"); b.closest(".item").remove(); itemsTotal(box); return; }
  if (act === "close") return closeSheet();
  if (act === "dispnote-x") { S.lastDisp = null; $("dispNote").hidden = true; return; }
  if (act === "mem-out") {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again to sign out"; setTimeout(() => { if (b.isConnected){ b.dataset.armed = ""; b.textContent = "Sign out device"; } }, 4000); return; }
    const m = S.members.find(x => x.id === id); if (!m) return;
    try { await updateDoc(fsDoc(fdb, "members", id), { sess: (m.sess || 0) + 1, sessAt: Date.now(), device: ADMIN_SIGNOUT }); toast("Signed out. They can sign in again on one device."); }
    catch(ex){ toast(failMsg(ex)); }
    return;
  }
  if (act === "load-range") return loadRange();
  if (act === "deliver") { S.confirmId = id; render(); return; }
  if (act === "deliver-cancel") { S.confirmId = null; render(); return; }
  if (act === "deliver-ok") {
    const t = fromLocalInput($("c-time").value);
    if (isNaN(t)) return toast("Enter the dispatch time.");
    if (o && t < o.orderAt) return toast("Dispatch time can't be before the order time.");
    S.confirmId = null; S.lastDisp = id;
    commit(updateDoc(fsDoc(fdb, "orders", id), { dispatchedAt: t, dispatchedBy: S.me || null, open: false, ...stamp() }), [o && o.day], "Marked dispatched · " + fmtDT(t));
    return;
  }
  if (act === "undeliver") {
    commit(updateDoc(fsDoc(fdb, "orders", id), { dispatchedAt: null, dispatchedBy: null, open: !(o && o.mark === "Cancelled"), ...stamp() }), [o && o.day], "Dispatch undone. Order is back in the queue.");
    closeSheet(); return;
  }
  if (act === "delete") {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again to delete"; setTimeout(()=>{ if (b.isConnected){ b.dataset.armed=""; b.textContent="Delete order"; } }, 4000); return; }
    commit(deleteDoc(fsDoc(fdb, "orders", id)), [o && o.day], "Order deleted"); closeSheet(); return;
  }
  if (act === "dl-del") {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again"; setTimeout(()=>{ if (b.isConnected){ b.dataset.armed=""; b.textContent="Remove"; } }, 4000); return; }
    const list = S.dealers.slice(); list.splice(+b.dataset.i, 1); saveDealers(list); return;
  }
});

document.addEventListener("submit", async e => {
  if (e.target.id === "editForm") {
    e.preventDefault();
    const id = $("sheet").dataset.id; const orig = (S.all||[]).find(x => x.id === id); if (!orig) return closeSheet();
    if (changeBlock(orig)) {   // only the dispatch time may change here (Supervisor)
      if (!($("e-exec") && S.canFixTime)) return closeSheet();
      const t = fromLocalInput($("e-exec").value);
      if (isNaN(t) || t === orig.executedAt) return closeSheet();
      if (t < orig.orderAt) return toast("Dispatch time can't be before the order time.");
      commit(updateDoc(fsDoc(fdb, "orders", id), { dispatchedAt: t, ...stamp() }), [orig.day], "Dispatch time updated"); return closeSheet();
    }
    const d = readForm("e-"); if (!S.canBackdate) d.orderAt = orig.orderAt;
    const err = validate(d, orig.dealer); if (err) return toast(err);
    const upd = { ...d, day: dayKey(d.orderAt), ...stamp() };
    if ($("e-mark")) upd.mark = $("e-mark").value;
    const mark = upd.mark ?? orig.mark ?? "";
    let at = orig.executedAt ?? null;
    if ($("e-exec") && S.canFixTime) { const t = fromLocalInput($("e-exec").value);
      if (!isNaN(t) && t !== at) { if (t < d.orderAt) return toast("Dispatch time can't be before the order time."); upd.dispatchedAt = t; at = t; } }
    if (at != null && d.orderAt > at) return toast("Order time can't be after the dispatch time.");
    upd.open = mark !== "Cancelled" && at == null;
    commit(updateDoc(fsDoc(fdb, "orders", id), upd), [orig.day, upd.day], "Order updated"); closeSheet();
  }
  if (e.target.id === "dealerForm") {
    e.preventDefault();
    const name = $("d-name").value.trim(); if (!name) return;
    if (S.dealers.some(d => d.name.toLowerCase() === name.toLowerCase())) return toast("That dealer is already in the list.");
    const list = [...S.dealers, { name, contact: $("d-contact").value.trim(), phone: $("d-phone").value.trim(), area: $("d-area").value.trim() }];
    document.activeElement && document.activeElement.blur();
    await saveDealers(list);
  }
});

/* ---------- product lines ---------- */
const MAX_ITEMS = 5; let itemSeq = 0;
function itemsOf(o){ return (o.items && o.items.length) ? o.items : (o.brand ? [{ product: o.brand, bags: o.bags }] : []); }
function fmtItems(o){ return itemsOf(o).map(i => i.product + " × " + i.bags).join(", "); }
function itemRow(p, it, first){
  const k = ++itemSeq; const opts = [...PRODUCTS, ...(it.product && !PRODUCTS.includes(it.product) ? [it.product] : [])];
  return `<div class="item"><select class="it-prod" id="${p}prod-${k}" aria-label="Product"><option value="">${first ? "Select product" : "Select product (optional)"}</option>${opts.map(n => `<option ${n === it.product ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
    <input class="it-bags" id="${p}bags-${k}" type="number" min="1" step="1" inputmode="numeric" placeholder="Bags" aria-label="Bags" value="${it.bags ?? ""}">
    ${first ? `<span class="it-req">Required</span>` : `<button type="button" class="btn sm" data-act="it-del" aria-label="Remove this product">Remove</button>`}</div>`;
}
function itemsInner(p, items){
  const list = items.length ? items : [{}];
  return list.map((it, i) => itemRow(p, it, i === 0)).join("") +
    `<div class="items-foot"><button type="button" class="btn sm" data-act="it-add" data-p="${p}" ${list.length >= MAX_ITEMS ? "hidden" : ""}>+ Add product</button><span class="hint it-total"></span></div>`;
}
function readItems(p){ return [...$(p+"items").querySelectorAll(".item")].map(r => ({ product: r.querySelector(".it-prod").value, bags: parseInt(r.querySelector(".it-bags").value, 10) })); }
function itemsTotal(box){
  const rows = box.querySelectorAll(".item"); let t = 0; rows.forEach(r => { const b = parseInt(r.querySelector(".it-bags").value, 10); if (b > 0) t += b; });
  const el = box.querySelector(".it-total"); if (el) el.textContent = rows.length > 1 && t ? `Total ${t} bags (≈ ${tonnes(t)} t)` : `${rows.length} of ${MAX_ITEMS} products`;
  const add = box.querySelector('[data-act="it-add"]'); if (add) add.hidden = rows.length >= MAX_ITEMS;
}
document.addEventListener("input", e => { const box = e.target.closest(".items"); if (box) itemsTotal(box); });

/* ---------- dealer type-or-pick box ---------- */
function comboNames(){ return S.dealers.map(d => d.name).filter(Boolean); }
function comboOpen(inp){
  const list = inp.nextElementSibling; const q = inp.value.trim().toLowerCase();
  const names = comboNames().filter(n => !q || n.toLowerCase().includes(q));
  list.innerHTML = (names.length ? names.map(n => `<div class="opt" role="option" data-v="${esc(n)}">${esc(n)}</div>`).join("")
      : `<div class="opt none">${comboNames().length ? "No dealer matches" : "No dealers yet. Add them on the Dealers tab."}</div>`);
  list.hidden = false; inp.setAttribute("aria-expanded", "true"); list.dataset.on = "-1";
}
function comboClose(inp){ const list = inp.nextElementSibling; list.hidden = true; inp.setAttribute("aria-expanded", "false"); }
function comboPick(inp, v){ inp.value = v; comboClose(inp); }
document.addEventListener("focusin", e => { if (e.target.matches(".combo input")) comboOpen(e.target); });
document.addEventListener("focusout", e => { if (e.target.matches(".combo input")) setTimeout(() => comboClose(e.target), 120); });
document.addEventListener("input", e => { if (e.target.matches(".combo input")) comboOpen(e.target); });
document.addEventListener("mousedown", e => {
  const o = e.target.closest(".combo-list .opt[data-v]"); if (!o) return;
  e.preventDefault(); comboPick(o.closest(".combo").querySelector("input"), o.dataset.v);
});
document.addEventListener("keydown", e => {
  if (e.target.matches(".combo input")) {
    const inp = e.target, list = inp.nextElementSibling;
    if (list.hidden && (e.key === "ArrowDown")) { comboOpen(inp); }
    const opts = [...list.querySelectorAll(".opt[data-v]")]; let i = +list.dataset.on;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); i = e.key === "ArrowDown" ? Math.min(opts.length - 1, i + 1) : Math.max(0, i - 1);
      opts.forEach((o, k) => o.classList.toggle("on", k === i)); list.dataset.on = i; if (opts[i]) opts[i].scrollIntoView({ block: "nearest" });
      return;
    }
    if (e.key === "Enter" && !list.hidden && i >= 0 && opts[i]) { e.preventDefault(); comboPick(inp, opts[i].dataset.v); return; }
    if (e.key === "Escape" && !list.hidden) { e.stopPropagation(); comboClose(inp); return; }
  }
  if (e.key === "Escape" && !$("sheet").hidden) closeSheet();
});
for (const id of ["o-from","o-to","o-dealer","o-status","o-q"]) $(id).addEventListener("input", () => renderOrders(S.all||[]));
$("s-month").addEventListener("input", () => { renderSummary(); loadSums($("s-month").value); });
$("sumRefresh").addEventListener("click", () => loadSums($("s-month").value, true));
$("sumRecalc").addEventListener("click", recalcMonth);

$("exportBtn").addEventListener("click", async () => {
  const rows = filtered(S.all||[]);
  if (!rows.length) return toast("No orders in this view to download.");
  const from = $("o-from").value || "start", to = $("o-to").value || "today";
  try { saveWorkbook(`DHS_Orders_${from}_to_${to}.xlsx`, rows.slice().sort(byTime).map(excelRow), null); }
  catch(ex){ toast("Download didn't start. Try again."); }
});
function downloadFile(name, data, type){
  const blob = new Blob([data], { type }); const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ---------- Team (admin only) ---------- */
function renderTeam(){
  const box = $("teamBox"); if (!box) return;
  if (!S.isAdmin) { box.innerHTML = ""; return; }
  if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;
  const order = r => ROLES.indexOf(r);
  const list = S.members.slice().sort((a, b) => (order(a.role) - order(b.role)) || a.id.localeCompare(b.id));
  const dev = m => m.device === ADMIN_SIGNOUT ? `<span class="hint">${ADMIN_SIGNOUT}</span>`
    : m.sessAt ? `${esc(m.device || "")}<div class="hint">since ${esc(fmtDT(m.sessAt))}</div>` : '<span class="hint">Not signed in yet</span>';
  const rows = list.map(m => `<tr><td><b>${esc(m.name || "")}</b></td><td>${esc(m.id)}</td>
    <td><select data-role="${esc(m.id)}" aria-label="Role for ${esc(m.id)}" ${m.id === S.me ? "disabled" : ""}>${ROLES.map(r => `<option value="${r}" ${r === m.role ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select></td>
    <td>${dev(m)}</td>
    <td>${m.id === S.me ? '<span class="hint">You</span>' : `<div class="actions">${m.sessAt && m.device !== ADMIN_SIGNOUT ? `<button class="btn sm" data-act="mem-out" data-id="${esc(m.id)}">Sign out device</button>` : ""}<button class="btn sm danger" data-act="mem-del" data-id="${esc(m.id)}">Remove</button></div>`}</td></tr>`).join("");
  box.innerHTML = `<div style="display:grid;gap:14px">
    <div class="tscroll"><table><thead><tr><th>${T("Name")}</th><th>${T("Email (login ID)")}</th><th>${T("Role")}</th><th>${T("Device")}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <form class="grid" id="memberForm" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      <div class="fld"><label for="m-name">${T("Name")}</label><input id="m-name" placeholder="e.g. Ramesh (office)"></div>
      <div class="fld"><label for="m-email">${T("Email")} <span class="req">*</span></label><input id="m-email" type="email" required placeholder="name@gmail.com"></div>
      <div class="fld"><label for="m-role">${T("Role")}</label><select id="m-role">${ROLES.map(r => `<option value="${r}" ${r === "desk" ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select></div>
      <div class="fld" style="align-self:end"><button class="btn primary" type="submit">Add person</button></div>
    </form></div>`;
}
document.addEventListener("change", async e => {
  const sel = e.target.closest("select[data-role]"); if (!sel) return;
  try { await updateDoc(fsDoc(fdb, "members", sel.dataset.role), { role: sel.value }); toast("Role changed to " + ROLE_LABEL[sel.value]); }
  catch(ex){ toast(failMsg(ex)); }
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "memberForm") return;
  e.preventDefault();
  const email = $("m-email").value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Enter a valid email address.");
  if (S.members.some(m => m.id === email)) return toast("That email is already on the team.");
  try {
    await setDoc(fsDoc(fdb, "members", email), { name: $("m-name").value.trim(), role: $("m-role").value, addedBy: S.me, addedAt: Date.now() });
    document.activeElement && document.activeElement.blur();
    toast("Added " + email + ". They can sign in now.");
  } catch(ex){ toast(failMsg(ex)); }
});
document.addEventListener("click", async e => {
  const b = e.target.closest('[data-act="mem-del"]'); if (!b) return;
  if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again"; setTimeout(() => { if (b.isConnected){ b.dataset.armed = ""; b.textContent = "Remove"; } }, 4000); return; }
  try { await deleteDoc(fsDoc(fdb, "members", b.dataset.id)); toast("Removed. They can no longer sign in."); } catch(ex){ toast(failMsg(ex)); }
});

/* ---------- install as an app ---------- */
let installEvt = null;
const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("installBtn").hidden = false; });
window.addEventListener("appinstalled", () => { $("installBtn").hidden = true; toast("Installed. Open DHS Logistics from your home screen."); });
if (!standalone()) $("installBtn").hidden = false;
$("installBtn").addEventListener("click", async () => {
  if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch(e){} installEvt = null; return; }
  if (isIOS) return toast("On iPhone: tap the Share button in Safari, then Add to Home Screen.");
  toast("To install: open the browser menu (⋮) and choose Install app or Add to Home screen. Works in Chrome and Edge.");
});
if ("serviceWorker" in navigator && location.protocol === "https:" && !window.__DHS_PREVIEW) navigator.serviceWorker.register("sw.js").catch(() => {});

/* ---------- boot screen state ---------- */
const now = new Date();
$("f-orderAt").value = toLocalInput(Date.now());
$("f-items").innerHTML = itemsInner("f-", []); itemsTotal($("f-items"));
$("o-from").value = S.today; $("o-to").value = S.today;
$("s-month").value = now.getFullYear() + "-" + pad(now.getMonth()+1);
// Reopen on the page the person last used (Team waits until we know they are Admin).
try { S.navSaved = JSON.parse(localStorage.getItem("cod.nav") || "null"); } catch(e){ S.navSaved = null; }
if (S.navSaved && S.navSaved.sub) Object.assign(S.sub, S.navSaved.sub);
showView(S.navSaved ? S.navSaved.view : "new");
render();
setInterval(() => {
  if (onPage("orders", "queue") && !S.confirmId) renderQueue(S.all||[]);
  if ($("f-orderAt").disabled) $("f-orderAt").value = toLocalInput(Date.now());
  const t = dayKey(Date.now());
  if (t !== S.today && S.me) { S.today = t; updateLiveDays(true); render(); }   // past midnight: today's list starts fresh
}, 60000);
setInterval(() => { if (onPage("settings", "vehicles")) renderVehicles(); }, 3600000);

/* ---------- Firebase ---------- */
const configured = firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("PASTE");
let fbApp, auth, fdb;
if (configured) {
  fbApp = initializeApp(firebaseConfig); auth = getAuth(fbApp);
  try { fdb = initializeFirestore(fbApp, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch(e){ fdb = getFirestore(fbApp); }
}

const MARK = `<img class="logo" src="icons/logo.svg" alt="DHS Logistics logo" width="64" height="64">`;
function gate(mode, msg){
  if (mode === "ok") { $("gate").hidden = true; $("app").hidden = false; return; }
  $("gate").hidden = false; $("app").hidden = true;
  const u = auth && auth.currentUser; const email = u ? esc(u.email) : "";
  const head = `<div class="brand">${MARK}<div><h1>DHS Logistics Order Dashboard</h1><small>Authorised staff only</small></div></div>`;
  let body = "";
  if (mode === "setup") body = `<div class="banner">Firebase isn't set up yet. Open <b>firebase-config.js</b> and paste your Firebase web app settings (see README).</div>`;
  if (mode === "loading") body = `<p class="hint">Checking sign-in…</p>`;
  if (mode === "signin") body = `
    <button class="btn" type="button" data-g="google"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1c4.2-3.8 6.5-9.5 6.5-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z"/><path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C3 17.1 2 20.4 2 24s1 6.9 2.5 9.9l7.3-5.7z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>Sign in with Google</button>
    <div class="or"><span>or with email and password</span></div>
    <form id="pwForm" style="display:grid;gap:12px">
      <div class="fld"><label for="g-email">${T("Email")}</label><input id="g-email" type="email" required autocomplete="username"></div>
      <div class="fld"><label for="g-pass">${T("Password")}</label><input id="g-pass" type="password" required minlength="6" autocomplete="current-password"></div>
      <div class="actions"><button class="btn primary" type="submit">Sign in</button><button class="btn" type="button" data-g="signup">Create account</button></div>
      <button class="btn sm" type="button" data-g="reset" style="justify-self:start;border:0;padding-left:0;background:none">Forgot password?</button>
    </form>
    <p class="hint">First time with email? Enter your work email and a new password, then tap <b>Create account</b>. Your email must already be added by the Admin.</p>
    <p class="hint"><a href="help.html" data-help="signing-in">New here? Read the help guide</a></p>`;
  if (mode === "verify") body = `<p>We sent a verification link to <b>${email}</b>. Open it from your inbox, then come back and tap <b>I've verified</b>.</p>
    <div class="actions"><button class="btn primary" type="button" data-g="reload">I've verified</button><button class="btn" type="button" data-g="resend">Send link again</button><button class="btn" type="button" data-g="signout">Sign out</button></div>`;
  if (mode === "denied") body = `<div class="banner"><b>${email}</b> is not on the authorised list.</div><p class="hint">Ask your Admin to add this exact email under Settings → Team &amp; emails, then sign in again.</p>
    <div class="actions"><button class="btn" type="button" data-g="signout">Sign out</button></div>
    <p class="hint"><a href="help.html" data-help="signing-in">Read the help guide</a></p>`;
  $("gateCard").innerHTML = head + (msg ? `<div class="banner" role="alert">${esc(msg)}</div>` : "") + body;
}
function authMsg(e){
  const c = e && e.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Wrong email or password.";
  if (c.includes("email-already-in-use")) return "This email already has an account. Tap Sign in instead.";
  if (c.includes("weak-password")) return "Use a password of at least 6 characters.";
  if (c.includes("invalid-email")) return "Enter a valid email address.";
  if (c.includes("popup-closed") || c.includes("cancelled-popup")) return "";
  if (c.includes("unauthorized-domain")) return "This website address isn't allowed in Firebase yet. Add it under Authentication → Settings → Authorized domains.";
  if (c.includes("too-many-requests")) return "Too many attempts. Wait a few minutes and try again.";
  return "Sign-in failed: " + (e && e.message || "unknown error");
}
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-g]"); if (!b || !auth) return;
  const g = b.dataset.g;
  try {
    if (g === "google") await signInWithPopup(auth, new GoogleAuthProvider());
    if (g === "signup") { const em = $("g-email").value.trim(), pw = $("g-pass").value;
      if (!em || pw.length < 6) return gate("signin", "Enter your email and a password of at least 6 characters.");
      const cred = await createUserWithEmailAndPassword(auth, em, pw); await sendEmailVerification(cred.user); }
    if (g === "reset") { const em = $("g-email").value.trim(); if (!em) return gate("signin", "Type your email first, then tap Forgot password.");
      await sendPasswordResetEmail(auth, em); gate("signin", "Password reset link sent to " + em + "."); }
    if (g === "resend") { await sendEmailVerification(auth.currentUser); gate("verify", "Link sent again. Check spam too."); }
    if (g === "reload") { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); boot(auth.currentUser); }
    if (g === "signout") await signOut(auth);
  } catch(ex){ const m = authMsg(ex); if (m) gate(auth.currentUser ? (auth.currentUser.emailVerified ? "denied" : "verify") : "signin", m); }
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "pwForm") return; e.preventDefault();
  try { await signInWithEmailAndPassword(auth, $("g-email").value.trim(), $("g-pass").value); }
  catch(ex){ gate("signin", authMsg(ex)); }
});

/* ---------- live listeners ---------- */
let unsubs = [], daysUnsub = null;
const onErr = e => { $("conn").textContent = "Reconnect"; $("conn").classList.remove("ok");
  banner(e && e.code === "permission-denied" ? "Your access changed. Reload the page." : "Lost the live connection. Reload the page to reconnect."); };
// Keep a live listener on today + every day that still has pending orders (whole days, so tokens are right).
function updateLiveDays(force){
  const need = new Set([S.today, ...S.pending.map(o => o.day || dayKey(o.orderAt))]);
  let want = new Set([...(force ? [] : S.liveDays), ...need]);
  if (want.size > MAX_LIVE_DAYS) want = new Set([S.today, ...[...need].filter(d => d !== S.today).sort().reverse().slice(0, MAX_LIVE_DAYS - 1)]);
  if (force) for (const d of [...want]) if (!need.has(d)) want.delete(d);
  const list = [...want].sort(); const key = list.join(",");
  if (key === S.liveKey) return; S.liveKey = key;
  if (daysUnsub) daysUnsub();
  daysUnsub = onSnapshot(query(fsCollection(fdb, "orders"), where("day", "in", list)), s => {
    S.live = new Map(s.docs.map(d => [d.id, { id: d.id, ...d.data() }])); S.liveDays = new Set(list); render(); if (S.lastId) showTicket();
  }, onErr);
}
function stop(){ unsubs.forEach(f => { try { f(); } catch(e){} }); unsubs = []; if (daysUnsub){ daysUnsub(); daysUnsub = null; }
  Object.assign(S, { report: null, pending: [], live: new Map(), liveDays: new Set(), liveKey: "", members: [], vehicles: [], range: { from:null, to:null, map:new Map(), at:null }, sums: new Map(), sumAt: {} }); }

// One-time upgrade of data saved by the first version (separate "deliveries" records, no "day" field).
async function upgradeData(){
  let meta; try { meta = await getDoc(fsDoc(fdb, "config", "meta")); } catch(e){ return; }
  if (meta.exists() && (meta.data().schema || 0) >= 2) return;
  if (!S.isAdmin) { banner("The dashboard was updated. An Admin needs to sign in once to finish the upgrade. Until then, orders saved before the update may not show."); return; }
  banner("Upgrading saved orders for the new version. Please keep this page open…");
  const [os, ds] = await Promise.all([getDocs(fsCollection(fdb, "orders")), getDocs(fsCollection(fdb, "deliveries"))]);
  const del = new Map(ds.docs.map(d => [d.id, d.data()]));
  let batch = writeBatch(fdb), n = 0; const byDay = {};
  const flush = async () => { if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(fdb); } };
  for (const d of os.docs) {
    const o = { id: d.id, ...d.data() }, de = del.get(o.id);
    const at = o.dispatchedAt ?? (de ? de.executedAt : null);
    const upd = { day: dayKey(o.orderAt), dispatchedAt: at ?? null, dispatchedBy: o.dispatchedBy ?? (de ? de.by || null : null) };
    upd.open = o.mark !== "Cancelled" && upd.dispatchedAt == null;
    batch.update(d.ref || fsDoc(fdb, "orders", o.id), upd); await flush();
    (byDay[upd.day] ||= []).push(norm({ ...o, ...upd }));
  }
  for (const [day, list] of Object.entries(byDay)) { batch.set(fsDoc(fdb, "daysum", day), daySummary(day, list)); await flush(); }
  batch.set(fsDoc(fdb, "config", "meta"), { schema: 2, upgradedAt: Date.now(), by: S.me });
  await batch.commit();
  banner(""); toast("Upgrade complete: " + os.size + " orders updated.");
}

/* ---------- one device per account ----------
   Each sign-in has a time set by Google (auth_time). The member record keeps the newest one ("sess");
   the database rules refuse any device whose sign-in is older, so only the latest device works. */
const ADMIN_SIGNOUT = "Signed out by Admin";
async function authTime(u){ const r = await u.getIdTokenResult(); return Number(r.claims.auth_time) || Math.floor(Date.parse(r.authTime) / 1000) || 0; }
function deviceName(){
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? "iPhone" : (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) ? "iPad"
    : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet") : /Windows/.test(ua) ? "Windows computer"
    : /Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux computer" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "browser";
  return os + " · " + (standalone() ? "installed app" : br);
}
function kickOut(d, atStart){
  const where = d.device && d.device !== ADMIN_SIGNOUT ? ` (${d.device})` : "";
  S.kickMsg = d.device === ADMIN_SIGNOUT ? "Your Admin signed this device out. Sign in again to continue."
    : atStart ? `This account is now in use on another device${where}. Only one device can use an account at a time. Signing in here will sign that device out.`
    : `This account was just signed in on another device${where}, so it has been signed out here. Only one device can use an account at a time. If that wasn't you, tell your Admin.`;
  stop(); signOut(auth).catch(() => {});
}

async function boot(u){
  stop();
  if (!u) { const k = S.kickMsg; S.kickMsg = null; return gate("signin", k || undefined); }
  if (!u.emailVerified) return gate("verify");
  gate("loading");
  const email = u.email.toLowerCase(); S.me = email;
  let m;
  try { m = await getDoc(fsDoc(fdb, "members", email)); } catch(e){ return gate("denied"); }
  if (!m.exists() || !ROLES.includes(m.data().role)) return gate("denied");
  // one device per account: a newer sign-in elsewhere wins; otherwise this device becomes the account's device
  let at = 0;
  try { at = await authTime(u); } catch(e){}
  const md = m.data();
  if ((md.sess || 0) > at) return kickOut(md, true);
  if ((md.sess || 0) < at) {
    try { await updateDoc(fsDoc(fdb, "members", email), { sess: at, sessAt: Date.now(), device: deviceName() }); }
    catch(e){ S.devWarn = failMsg(e); }
  }
  S.myAt = at;
  S.role = m.data().role; S.myName = m.data().name || u.displayName || email;
  S.isAdmin = S.role === "admin"; S.isSup = S.role === "dispatch"; S.isDesk = S.role === "desk"; S.isViewer = S.role === "viewer";
  S.canWrite = !S.isViewer;                 // add, change and cancel orders (with the limits in changeBlock), WhatsApp
  S.canEdit = !S.isViewer;                  // mark dispatched and undo dispatch
  S.canFixTime = S.isAdmin || S.isSup;      // correct the dispatch time of a dispatched order
  S.canBackdate = S.isAdmin;                // enter or change an order's date and time
  S.canAddDealer = S.isAdmin || S.isSup;    // add dealers (removing: Admin)
  S.canVehicles = !S.isViewer;              // add vehicles, paste tracking links (removing: Admin)
  S.canRefresh = S.isAdmin || S.isSup;      // Summary: refresh older days' totals
  $("who").innerHTML = `<b>${esc(S.myName)}</b><span>${esc(S.me)}</span><span>${ROLE_LABEL[S.role]}</span>`;
  $("menuName").textContent = S.myName;
  document.querySelector('.segb[data-sub="team"]').hidden = !S.isAdmin;
  document.querySelector('.segb[data-sub="vehicles"]').hidden = S.isViewer;
  if (S.isViewer && onPage("settings", "vehicles")) showSub("settings", "dealers");
  $("f-orderAt").disabled = !S.canBackdate; $("f-orderAt-hint").hidden = S.canBackdate; $("f-orderAt").value = toLocalInput(Date.now());
  $("saveBtn").disabled = !S.canWrite; $("formHint").textContent = S.canWrite ? "" : "You have view-only access.";
  if (!S.isAdmin && onPage("settings", "team")) showSub("settings", "dealers");
  if (S.isAdmin && S.view === "settings" && S.navSaved && S.navSaved.sub && S.navSaved.sub.settings === "team") showSub("settings", "team");
  S.navSaved = null;
  gate("ok"); banner("");
  if (S.devWarn) { banner("This device couldn't be registered as your one signed-in device (" + S.devWarn + "). Tell your Admin."); S.devWarn = null; }
  try { await upgradeData(); } catch(e){ banner("Upgrade didn't finish: " + failMsg(e) + " Reload the page to try again."); }
  $("conn").textContent = "Live"; $("conn").classList.add("ok");
  S.today = dayKey(Date.now());
  unsubs.push(onSnapshot(query(fsCollection(fdb, "orders"), where("open", "==", true)), s => {
    S.pending = s.docs.map(d => ({ id: d.id, ...d.data() })); updateLiveDays(); render();
  }, onErr));
  if (!S.isViewer) unsubs.push(onSnapshot(fsDoc(fdb, "config", "vehicles"), s => { S.vehicles = s.exists() && Array.isArray(s.data().list) ? s.data().list : []; render(); }, onErr));
  else S.vehicles = [];
  unsubs.push(onSnapshot(fsCollection(fdb, "members"), s => { S.members = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, onErr));
  // signed in on another device later (or signed out by the Admin)? Then this device signs out.
  unsubs.push(onSnapshot(fsDoc(fdb, "members", email), s => { const d = s.exists() ? s.data() : null; if (d && (d.sess || 0) > S.myAt) kickOut(d, false); }, () => {}));
  unsubs.push(onSnapshot(fsDoc(fdb, "config", "dealers"), async s => {
    if (!s.exists() && S.isAdmin) { try { await setDoc(fsDoc(fdb, "config", "dealers"), { list: STARTER_DEALERS.map(name => ({ name, contact: "", phone: "", area: "" })) }); } catch(e){} return; }
    S.dealers = s.exists() && Array.isArray(s.data().list) ? s.data().list : []; render();
  }, onErr));
  if (S.isAdmin) unsubs.push(onSnapshot(fsDoc(fdb, "config", "report"), s => { S.report = s.exists() ? s.data() : null; renderReport(); }, onErr));
  if (S.view === "summary") loadSums($("s-month").value);
}
if (!configured) gate("setup");
else { gate("loading"); onAuthStateChanged(auth, u => boot(u)); }
