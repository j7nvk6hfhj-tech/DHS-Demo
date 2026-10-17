// DHS Logistics Order Dashboard — GitHub Pages + Firebase version
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc as fsDoc, collection as fsCollection, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

// How many days of orders the dashboard loads. Older orders stay in the database;
// raise this if you need older months in Summary / All Orders (uses more free-tier reads).
const DAYS_LOADED = 120;
// Dealers created automatically the first time an Admin signs in (edit on the Dealers tab later).
const STARTER_DEALERS = ["Dhaam Home Solutions", "CL Traders", "Shree Sai Associate"];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2, "0");
const PRODUCTS = ["PPC","OPC 43","OPC 53","Super Strong (SS)","Weather Protect (WSP)"];
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); };
const fmtDay = k => { const [y,m,d] = k.split("-"); return +d + " " + MON[+m-1]; };
const fmtDT = ms => { if (ms == null) return ""; const d = new Date(ms); return d.getDate() + " " + MON[d.getMonth()] + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes()); };
const toLocalInput = ms => { const d = new Date(ms); return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes()); };
const fromLocalInput = v => v ? new Date(v).getTime() : NaN;
const hm = ms => { if (ms == null || isNaN(ms)) return ""; const m = Math.max(0, Math.round(ms/60000)); return Math.floor(m/60) + ":" + pad(m%60); };
const waitTxt = ms => { const m = Math.max(0, Math.round(ms/60000)); const d = Math.floor(m/1440), h = Math.floor((m%1440)/60), mm = m%60; return (d? d+"d ":"") + (d||h ? h+"h ":"") + mm + "m"; };
const tonnes = bags => (bags * 50 / 1000).toLocaleString("en-IN", {maximumFractionDigits:1});

const S = { db:null, me:null, myName:"", role:null, isAdmin:false, canEdit:false, canWrite:false, members:[], orders:[], deliveries:new Map(), dealers:[], dealersLoaded:false, view:"new", names:{}, confirmId:null, ready:false };

function toast(msg){ const t=$("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true, 3200); }
function failMsg(e){
  if (e && e.code === "permission-denied") return "Your role doesn't allow this. Ask an Admin to change your role.";
  if (e && e.code === "resource-exhausted") return "Daily free limit reached. Try again tomorrow or upgrade the Firebase plan.";
  return "Couldn't save. Check your connection and try again.";
}
const ROLES = ["admin","dispatch","desk","viewer"];
const ROLE_LABEL = { admin:"Admin", dispatch:"Dispatch", desk:"Order desk", viewer:"Viewer" };
function nameOf(email){ if (!email) return ""; const m = S.members.find(x => x.id === email); return (m && m.name) || email; }

/* ---------- derived data ---------- */
function derive(){
  const list = S.orders.map(o => {
    const del = S.deliveries.get(o.id);
    const status = del ? "Dispatched" : (o.mark === "Cancelled" ? "Cancelled" : "Pending");
    const executedAt = del ? del.executedAt : null;
    return { ...o, status, executedAt, day: dayKey(o.orderAt), taken: executedAt != null ? executedAt - o.orderAt : null };
  }).sort((a,b) => (a.orderAt - b.orderAt) || ((a.createdAt||0) - (b.createdAt||0)) || (a.id < b.id ? -1 : 1));
  const perDay = {};
  for (const o of list){ perDay[o.day] = (perDay[o.day]||0) + 1; o.token = perDay[o.day]; }
  let q = 0;
  for (const o of list){ o.queue = o.status === "Pending" ? ++q : null; }
  return list;
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
const plate = v => v ? `<span class="plate">${esc(v)}</span>` : "";
const tok = o => `<span class="tok">${o.token}<small>${esc(fmtDay(o.day))}</small></span>`;


function render(){
  const all = derive();
  S.all = all;
  const pend = all.filter(o => o.status === "Pending").length;
  $("qn").textContent = pend || "";
  dealerOptions($("o-dealer"), true);
  renderToday(all); renderQueue(all); renderOrders(all); renderSummary(all); renderDealers(); renderTeam();
}

/* ---------- New order / today ---------- */
function renderToday(all){
  const k = dayKey(Date.now());
  const today = all.filter(o => o.day === k);
  $("todayTitle").textContent = "Today · " + fmtDay(k);
  const pend = today.filter(o => o.status === "Pending").length;
  $("todayCount").textContent = today.length ? `${today.length} orders · ${pend} pending` : "";
  $("todayList").innerHTML = today.length ? today.slice().reverse().map(o => `
    <div class="row" data-edit="${esc(o.id)}" style="cursor:pointer">${tok(o)}
      <div class="main"><b>${esc(o.party)}</b><div class="meta"><span>${pad(new Date(o.orderAt).getHours())}:${pad(new Date(o.orderAt).getMinutes())}</span>${o.dealer?`<span>${esc(o.dealer)}</span>`:""}<span>${o.bags} bags</span></div></div>
      ${pill(o.status)}</div>`).join("")
    : `<div class="empty"><b>No orders yet today</b>Orders you add appear here with their token.</div>`;
}

/* ---------- Queue ---------- */
function qCard(o, road){
  const canDel = S.canEdit;
  const confirming = S.confirmId === o.id;
  return `<div class="qcard">
    <div class="qpos"><b>${o.queue}</b><span>in line</span></div>
    <div style="min-width:0">
      <div class="top">${tok(o)}<b>${esc(o.party)}</b>${o.dealer?`<span class="pill" style="background:var(--surface-2);color:var(--muted)">${esc(o.dealer)}</span>`:""}</div>
      <div class="facts"><span><em>${o.bags}</em> bags</span><span>${esc(fmtItems(o))}</span>${o.location?`<span>${esc(o.location)}</span>`:""}${o.phone?`<span>${esc(o.phone)}</span>`:""}${plate(o.vehicle)}${o.driver?`<span>${esc(o.driver)}</span>`:""}</div>
      <div class="facts"><span>Ordered ${esc(fmtDT(o.orderAt))}</span><span class="wait">Waiting ${waitTxt(Date.now()-o.orderAt)}</span></div>
      ${confirming ? `<div class="confirm"><label for="c-time" style="color:var(--done)">Dispatched at</label><input type="datetime-local" id="c-time" value="${toLocalInput(Date.now())}"><button class="btn go sm" data-act="deliver-ok" data-id="${esc(o.id)}">Confirm dispatched</button><button class="btn sm" data-act="deliver-cancel">Cancel</button></div>`
      : `<div class="acts">
          <button class="btn go sm" data-act="deliver" data-id="${esc(o.id)}" ${canDel?"":"disabled title=\"Only Dispatch or Admin users can mark dispatched\""}>Mark dispatched</button>
          <button class="btn sm" data-edit="${esc(o.id)}">Edit</button></div>`}
    </div></div>`;
}
function renderQueue(all){
  const pend = all.filter(o => o.status === "Pending");
  $("queueNote").textContent = S.canEdit ? "" : (S.canWrite ? "Only Dispatch or Admin users can mark orders dispatched. You can edit or cancel orders." : "You have view-only access.");
  $("queueList").innerHTML = pend.length ? pend.map(o => qCard(o,false)).join("")
    : `<div class="empty"><b>Queue is clear</b>No pending orders. New orders join the end of the line by order time.</div>`;
}

/* ---------- All orders ---------- */
function filtered(all){
  const from = $("o-from").value, to = $("o-to").value, dl = $("o-dealer").value, st = $("o-status").value, q = $("o-q").value.trim().toLowerCase();
  return all.filter(o => (!from || o.day >= from) && (!to || o.day <= to) && (dl === "*" || (o.dealer||"") === dl) && (!st || o.status === st)
    && (!q || (o.party||"").toLowerCase().includes(q) || (o.location||"").toLowerCase().includes(q)));
}
async function renderOrders(all){
  const rows = filtered(all).slice().reverse();
  const bags = rows.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+(+o.bags||0),0);
  $("ordersCount").textContent = rows.length ? `${rows.length} orders · ${bags.toLocaleString("en-IN")} bags (≈ ${tonnes(bags)} t)` : "";
  $("ordersBody").innerHTML = rows.length ? rows.map(o => `<tr class="click" data-edit="${esc(o.id)}">
    <td>${tok(o)}</td><td>${esc(fmtDT(o.orderAt))}</td><td>${esc(o.dealer)}</td><td class="wrapc">${esc(o.party)}</td><td class="wrapc">${esc(o.location)}</td>
    <td class="wrapc">${esc(fmtItems(o))}</td><td class="num">${o.bags}</td><td>${plate(o.vehicle)}</td><td>${esc(o.driver)}</td><td>${pill(o.status)}</td>
    <td>${esc(fmtDT(o.executedAt))}</td><td class="num">${hm(o.taken)}</td><td>${esc(nameOf(o.createdBy))}</td></tr>`).join("")
    : `<tr><td colspan="13"><div class="empty" style="border:0"><b>No orders match</b>Change the dates or filters, or add an order from the New Order tab.</div></td></tr>`;
}

/* ---------- Summary ---------- */
function agg(list){
  const a = {n:list.length, Pending:0, Dispatched:0, Cancelled:0, bags:0, pbags:0, tsum:0, tn:0, last:null};
  for (const o of list){ a[o.status]++; if (o.status!=="Cancelled") a.bags += +o.bags||0; if (o.status==="Pending") a.pbags += +o.bags||0;
    if (o.taken!=null){ a.tsum += o.taken; a.tn++; } if (a.last==null || o.orderAt > a.last) a.last = o.orderAt; }
  a.avg = a.tn ? a.tsum/a.tn : null; return a;
}
function sumRow(label, a, cls, withLast){
  return `<tr class="${cls||""}"><td>${label}</td><td class="num">${a.n}</td><td class="num ${a.Pending?"red":""}">${a.Pending}</td><td class="num">${a.Dispatched}</td><td class="num">${a.Cancelled}</td><td class="num">${a.bags.toLocaleString("en-IN")}</td><td class="num">${a.pbags.toLocaleString("en-IN")}</td><td class="num">${hm(a.avg)}</td>${withLast?`<td>${esc(fmtDT(a.last))}</td>`:""}</tr>`;
}
function renderSummary(all){
  const m = $("s-month").value; if (!m) return;
  const inM = all.filter(o => o.day.startsWith(m));
  const t = agg(inM);
  const openAll = all.filter(o => o.status === "Pending").length;
  $("kpis").innerHTML = `
    <div class="kpi"><span>Orders</span><b>${t.n}</b><small>this month</small></div>
    <div class="kpi hot"><span>Pending now</span><b>${openAll}</b><small>all dates</small></div>
    <div class="kpi"><span>Dispatched</span><b>${t.Dispatched}</b><small>${t.Cancelled} cancelled</small></div>
    <div class="kpi"><span>Bags</span><b>${t.bags.toLocaleString("en-IN")}</b><small>≈ ${tonnes(t.bags)} t</small></div>
    <div class="kpi"><span>Avg time taken</span><b>${t.avg!=null?hm(t.avg):"–"}</b><small>order → dispatch</small></div>`;
  // dealer-wise
  const names = S.dealers.map(d=>d.name).filter(Boolean);
  const extra = [...new Set(inM.map(o=>o.dealer).filter(d=>d && !names.includes(d)))];
  let h = sumRow("<b>All orders</b>", t, "tot", true);
  for (const n of [...names, ...extra]){ const a = agg(inM.filter(o=>o.dealer===n)); h += sumRow(esc(n) + (extra.includes(n)?' <span class="hint">(not in list)</span>':""), a, a.n?"":"dim", true); }
  const noD = agg(inM.filter(o=>!o.dealer)); if (noD.n) h += sumRow("Older orders without a dealer", noD, "", true);
  $("dealerBody").innerHTML = h;
  // day-wise
  const [y, mo] = m.split("-").map(Number); const days = new Date(y, mo, 0).getDate();
  let dh = sumRow("<b>Month total</b>", t, "tot", false);
  for (let d=1; d<=days; d++){ const k = m + "-" + pad(d); const a = agg(inM.filter(o=>o.day===k)); dh += sumRow(fmtDay(k), a, a.n?"":"dim", false); }
  $("dayBody").innerHTML = dh;
}

/* ---------- Dealers ---------- */
function renderDealers(){
  const box = $("dealerEditor");
  if (box.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return; // don't wipe typing
  const rows = S.dealers.map((d,i) => `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.contact)}</td><td>${esc(d.phone)}</td><td>${esc(d.area)}</td>
    <td>${S.isAdmin?`<button class="btn sm danger" data-act="dl-del" data-i="${i}">Remove</button>`:""}</td></tr>`).join("");
  box.innerHTML = `<div style="display:grid;gap:14px">
    ${S.dealers.length ? `<div class="tscroll"><table><thead><tr><th>Dealer</th><th>Contact person</th><th>Phone</th><th>Area</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty"><b>No dealers added yet</b>${S.isAdmin ? "Add your first authorised dealer below." : "An Admin adds dealers here."}</div>`}
    ${S.isAdmin ? `<form class="grid" id="dealerForm" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <div class="fld"><label for="d-name">Dealer name <span class="req">*</span></label><input id="d-name" required></div>
      <div class="fld"><label for="d-contact">Contact person</label><input id="d-contact"></div>
      <div class="fld"><label for="d-phone">Phone</label><input id="d-phone" inputmode="tel"></div>
      <div class="fld"><label for="d-area">Area</label><input id="d-area"></div>
      <div class="fld" style="align-self:end"><button class="btn primary" type="submit">Add dealer</button></div></form>`
      : `<p class="hint">Only an Admin can change this list.</p>`}</div>`;
}
async function saveDealers(list){
  if (!S.db) return toast("Not connected.");
  try { await S.db.doc("config/dealers").set({ list }); toast("Dealer list saved"); } catch(e){ toast(failMsg(e)); }
}

/* ---------- edit sheet ---------- */
function openEdit(id){
  const o = (S.all||[]).find(x => x.id === id); if (!o) return;
  $("sheetCard").innerHTML = `
    <div class="head"><div style="display:flex;gap:12px;align-items:center">${tok(o)}<div><h3>Edit order</h3><div class="hint">Entered ${esc(fmtDT(o.createdAt))}${o.createdBy?" by "+esc(nameOf(o.createdBy)):""}</div></div></div>${pill(o.status)}</div>
    <form class="grid" id="editForm">
      <div class="fld"><label for="e-orderAt">Order date &amp; time</label><input type="datetime-local" id="e-orderAt" required value="${toLocalInput(o.orderAt)}"></div>
      <div class="fld combo"><label for="e-dealer">Dealer <span class="req">*</span></label><input id="e-dealer" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="e-dealer-list" placeholder="Type or pick a dealer" value="${esc(o.dealer)}"><div class="combo-list" id="e-dealer-list" role="listbox" hidden></div></div>
      <div class="fld"><label for="e-party">Party / customer</label><input id="e-party" required value="${esc(o.party)}"></div>
      <div class="fld"><label for="e-phone">Phone</label><input id="e-phone" value="${esc(o.phone)}"></div>
      <div class="fld wide"><label for="e-location">Delivery location</label><input id="e-location" value="${esc(o.location)}"></div>
      <div class="fld wide"><label>Products &amp; bags (50 kg)</label><div class="items" id="e-items">${itemsInner("e-", itemsOf(o))}</div></div>
      <div class="fld"><label for="e-vehicle">Vehicle no.</label><input id="e-vehicle" value="${esc(o.vehicle)}" style="text-transform:uppercase"></div>
      <div class="fld"><label for="e-driver">Driver</label><input id="e-driver" value="${esc(o.driver)}"></div>
      <div class="fld wide"><label for="e-remarks">Remarks</label><textarea id="e-remarks" rows="2">${esc(o.remarks)}</textarea></div>
      ${o.status!=="Dispatched" ? `<div class="fld"><label for="e-mark">Mark as</label><select id="e-mark"><option value="">Pending (in queue)</option><option ${o.mark==="Cancelled"?"selected":""}>Cancelled</option></select></div>` : ""}
      ${o.status==="Dispatched" && S.canEdit ? `<div class="fld"><label for="e-exec">Dispatched at</label><input type="datetime-local" id="e-exec" value="${toLocalInput(o.executedAt)}"></div>` : ""}
      ${o.status==="Dispatched" && !S.canEdit ? `<div class="fld"><label>Dispatched at</label><div>${esc(fmtDT(o.executedAt))}</div></div>` : ""}
      <div class="actions wide fld" style="justify-content:space-between">
        <div class="actions"><button class="btn primary" type="submit">Save changes</button><button class="btn" type="button" data-act="close">Close</button></div>
        <div class="actions">${o.status==="Dispatched" && S.canEdit ? `<button class="btn sm" type="button" data-act="undeliver" data-id="${esc(o.id)}">Undo dispatch</button>`:""}
        <button class="btn sm danger" type="button" data-act="delete" data-id="${esc(o.id)}">Delete order</button></div>
      </div>
    </form>`;
  $("sheet").hidden = false; $("sheet").dataset.id = id; itemsTotal($("e-items"));
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
  if (m) d.dealer = m; else if (!keepDealer || d.dealer !== keepDealer) return "Pick a dealer from the list. New dealers are added on the Dealers tab.";
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
$("tabs").addEventListener("click", e => {
  const b = e.target.closest(".tab"); if (!b) return;
  S.view = b.dataset.v;
  for (const t of document.querySelectorAll(".tab")) t.setAttribute("aria-selected", t === b ? "true" : "false");
  for (const v of ["new","queue","orders","summary","dealers","team"]) $("v-"+v).hidden = v !== S.view;
  try { localStorage.setItem("cod.view", S.view); } catch(e){}
});

$("orderForm").addEventListener("submit", async e => {
  e.preventDefault();
  const d = readForm("f-"); const err = validate(d);
  if (err) { $("formHint").textContent = err; return; }
  if (!S.db) { $("formHint").textContent = "Not connected to shared data, so the order can't be saved."; return; }
  $("saveBtn").disabled = true; $("formHint").textContent = "Saving…";
  try {
    const ref = await S.db.collection("orders").add({ ...d, mark: "", createdAt: Date.now(), createdBy: S.me || null });
    $("formHint").textContent = "";
    for (const k of ["dealer","party","phone","location","vehicle","driver","remarks"]) $("f-"+k).value = "";
    $("f-items").innerHTML = itemsInner("f-", []); itemsTotal($("f-items"));
    $("f-orderAt").value = toLocalInput(Date.now());
    S.lastId = ref.id; showTicket();
    $("f-party").focus();
  } catch(ex){ $("formHint").textContent = failMsg(ex); }
  $("saveBtn").disabled = false;
});
function showTicket(){
  const o = (S.all||[]).find(x => x.id === S.lastId); const box = $("lastTicket");
  if (!o) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<div class="ticket"><div class="stub"><span>Token</span><b>${o.token}</b><span>${esc(fmtDay(o.day))}</span></div>
    <div class="body"><strong>Saved: ${esc(o.party)}</strong><span class="hint">${o.bags} bags${o.dealer?" · "+esc(o.dealer):""} · ${o.queue?`No. ${o.queue} in the dispatch queue`:esc(o.status)}</span></div></div>`;
}

document.addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]"); if (ed && !e.target.closest("[data-act]")) { openEdit(ed.dataset.edit); return; }
  const b = e.target.closest("[data-act]"); if (!b) { if (e.target === $("sheet")) closeSheet(); return; }
  const act = b.dataset.act, id = b.dataset.id;
  if (act === "it-add") { const box = b.closest(".items"); const rows = box.querySelectorAll(".item"); if (rows.length < MAX_ITEMS) { rows[rows.length-1].insertAdjacentHTML("afterend", itemRow(b.dataset.p, {}, false)); const nr = box.querySelectorAll(".item"); nr[nr.length-1].querySelector("select").focus(); } itemsTotal(box); return; }
  if (act === "it-del") { const box = b.closest(".items"); b.closest(".item").remove(); itemsTotal(box); return; }
  if (act === "close") return closeSheet();
  if (act === "deliver") { S.confirmId = id; render(); return; }
  if (act === "deliver-cancel") { S.confirmId = null; render(); return; }
  if (act === "deliver-ok") {
    const t = fromLocalInput($("c-time").value); const o = S.all.find(x=>x.id===id);
    if (isNaN(t)) return toast("Enter the dispatch time.");
    if (o && t < o.orderAt) return toast("Dispatch time can't be before the order time.");
    b.disabled = true;
    try { await S.db.doc("deliveries/"+id).set({ executedAt: t, by: S.me || null, at: Date.now() }); S.confirmId = null; toast("Marked dispatched · " + fmtDT(t)); }
    catch(ex){ toast(failMsg(ex)); b.disabled = false; }
    return;
  }
  if (act === "mark") {
    try { await S.db.doc("orders/"+id).update({ mark: b.dataset.mark }); toast(b.dataset.mark ? "Marked " + b.dataset.mark : "Back in the queue"); } catch(ex){ toast(failMsg(ex)); }
    return;
  }
  if (act === "undeliver") {
    try { await S.db.doc("deliveries/"+id).delete(); toast("Dispatch undone. Order is back in the queue."); closeSheet(); } catch(ex){ toast(failMsg(ex)); }
    return;
  }
  if (act === "delete") {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again to delete"; setTimeout(()=>{ if (b.isConnected){ b.dataset.armed=""; b.textContent="Delete order"; } }, 4000); return; }
    try { await S.db.doc("orders/"+id).delete(); if (S.deliveries.has(id) && S.canEdit) await S.db.doc("deliveries/"+id).delete(); toast("Order deleted"); closeSheet(); } catch(ex){ toast(failMsg(ex)); }
    return;
  }
  if (act === "dl-del") {
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Tap again"; setTimeout(()=>{ if (b.isConnected){ b.dataset.armed=""; b.textContent="Remove"; } }, 4000); return; }
    const list = S.dealers.slice(); list.splice(+b.dataset.i, 1); saveDealers(list); return;
  }
});

document.addEventListener("submit", async e => {
  if (e.target.id === "editForm") {
    e.preventDefault();
    const id = $("sheet").dataset.id; const d = readForm("e-"); const orig = (S.all||[]).find(x => x.id === id); const err = validate(d, orig && orig.dealer);
    if (err) return toast(err);
    const upd = { ...d }; if ($("e-mark")) upd.mark = $("e-mark").value;
    try {
      await S.db.doc("orders/"+id).update(upd);
      if ($("e-exec")) { const t = fromLocalInput($("e-exec").value); const cur = S.deliveries.get(id);
        if (!isNaN(t) && cur && cur.executedAt !== t) { if (t < d.orderAt) return toast("Dispatch time can't be before the order time."); await S.db.doc("deliveries/"+id).set({ ...cur, executedAt: t }); } }
      toast("Order updated"); closeSheet();
    } catch(ex){ toast(failMsg(ex)); }
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
$("s-month").addEventListener("input", () => renderSummary(S.all||[]));

$("exportBtn").addEventListener("click", async () => {
  const rows = filtered(S.all||[]);
  if (!rows.length) return toast("No orders in this view to download.");
  const data = rows.map(o => ({ "Date": fmtDay(o.day), "Token": o.token, "Order Date & Time": fmtDT(o.orderAt), "Dealer": o.dealer || "", "Party": o.party, "Phone": o.phone,
    "Location": o.location, "Products": fmtItems(o), "Total Bags": o.bags, "Vehicle": o.vehicle, "Driver": o.driver, "Status": o.status,
    "Dispatched Date & Time": fmtDT(o.executedAt), "Time Taken (h:mm)": hm(o.taken), "Remarks": o.remarks, "Entered by": nameOf(o.createdBy) }));
  const from = $("o-from").value || "start", to = $("o-to").value || "today";
  try {
    let file, name;
    if (window.XLSX) { const ws = XLSX.utils.json_to_sheet(data); ws["!cols"] = Object.keys(data[0]).map(k => ({ wch: Math.max(10, k.length + 2) }));
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Orders"); file = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })); name = `Cement_Orders_${from}_to_${to}.xlsx`; }
    else { const keys = Object.keys(data[0]); file = [keys.join(","), ...data.map(r => keys.map(k => '"' + String(r[k] ?? "").replace(/"/g,'""') + '"').join(","))].join("\n"); name = `Cement_Orders_${from}_to_${to}.csv`; }
    downloadFile(name, file, name.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv");
  } catch(ex){ toast("Download didn't start. Try again."); }
});

/* ---------- boot ---------- */
const now = new Date();
$("f-orderAt").value = toLocalInput(Date.now());
$("f-items").innerHTML = itemsInner("f-", []); itemsTotal($("f-items"));
$("o-from").value = now.getFullYear() + "-" + pad(now.getMonth()+1) + "-01";
$("o-to").value = dayKey(Date.now());
$("s-month").value = now.getFullYear() + "-" + pad(now.getMonth()+1);
try { const v = localStorage.getItem("cod.view"); if (v && $("v-"+v)) document.querySelector(`.tab[data-v="${v}"]`).click(); } catch(e){}
render();
setInterval(() => { if (S.view === "queue" && !S.confirmId) renderQueue(S.all||[]); }, 60000);


/* ---------- file download ---------- */
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
  const rows = list.map(m => `<tr><td><b>${esc(m.name || "")}</b></td><td>${esc(m.id)}</td>
    <td><select data-role="${esc(m.id)}" aria-label="Role for ${esc(m.id)}" ${m.id === S.me ? "disabled" : ""}>${ROLES.map(r => `<option value="${r}" ${r === m.role ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select></td>
    <td>${m.id === S.me ? '<span class="hint">You</span>' : `<button class="btn sm danger" data-act="mem-del" data-id="${esc(m.id)}">Remove</button>`}</td></tr>`).join("");
  box.innerHTML = `<div style="display:grid;gap:14px">
    <div class="tscroll"><table><thead><tr><th>Name</th><th>Email (login ID)</th><th>Role</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <form class="grid" id="memberForm" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      <div class="fld"><label for="m-name">Name</label><input id="m-name" placeholder="e.g. Ramesh (office)"></div>
      <div class="fld"><label for="m-email">Email <span class="req">*</span></label><input id="m-email" type="email" required placeholder="name@gmail.com"></div>
      <div class="fld"><label for="m-role">Role</label><select id="m-role">${ROLES.map(r => `<option value="${r}" ${r === "desk" ? "selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select></div>
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

/* ---------- Firebase ---------- */
const configured = firebaseConfig && firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("PASTE");
let fbApp, auth, fdb;
if (configured) {
  fbApp = initializeApp(firebaseConfig); auth = getAuth(fbApp); fdb = getFirestore(fbApp);
  S.db = {
    doc: p => { const r = fsDoc(fdb, p); return { set: d => setDoc(r, d), update: d => updateDoc(r, d), delete: () => deleteDoc(r) }; },
    collection: p => ({ add: async d => { const r = await addDoc(fsCollection(fdb, p), d); return { id: r.id }; } })
  };
}

const MARK = `<div class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#1b1400" stroke-width="2"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8" fill="#e9a514"/><circle cx="17" cy="17.5" r="1.8" fill="#e9a514"/></svg></div>`;
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
      <div class="fld"><label for="g-email">Email</label><input id="g-email" type="email" required autocomplete="username"></div>
      <div class="fld"><label for="g-pass">Password</label><input id="g-pass" type="password" required minlength="6" autocomplete="current-password"></div>
      <div class="actions"><button class="btn primary" type="submit">Sign in</button><button class="btn" type="button" data-g="signup">Create account</button></div>
      <button class="btn sm" type="button" data-g="reset" style="justify-self:start;border:0;padding-left:0;background:none">Forgot password?</button>
    </form>
    <p class="hint">First time with email? Enter your work email and a new password, then tap <b>Create account</b>. Your email must already be added by the Admin.</p>`;
  if (mode === "verify") body = `<p>We sent a verification link to <b>${email}</b>. Open it from your inbox, then come back and tap <b>I've verified</b>.</p>
    <div class="actions"><button class="btn primary" type="button" data-g="reload">I've verified</button><button class="btn" type="button" data-g="resend">Send link again</button><button class="btn" type="button" data-g="signout">Sign out</button></div>`;
  if (mode === "denied") body = `<div class="banner"><b>${email}</b> is not on the authorised list.</div><p class="hint">Ask your Admin to add this exact email on the Team page, then sign in again.</p>
    <div class="actions"><button class="btn" type="button" data-g="signout">Sign out</button></div>`;
  $("gateCard").innerHTML = head + body + (msg ? `<p class="hint" style="color:var(--pending)">${esc(msg)}</p>` : "");
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

let unsubs = [];
function stop(){ unsubs.forEach(f => { try { f(); } catch(e){} }); unsubs = []; S.orders = []; S.deliveries = new Map(); S.members = []; }
async function boot(u){
  stop();
  if (!u) return gate("signin");
  if (!u.emailVerified) return gate("verify");
  gate("loading");
  const email = u.email.toLowerCase(); S.me = email;
  let m;
  try { m = await getDoc(fsDoc(fdb, "members", email)); } catch(e){ return gate("denied"); }
  if (!m.exists() || !ROLES.includes(m.data().role)) return gate("denied");
  S.role = m.data().role; S.myName = m.data().name || u.displayName || email;
  S.isAdmin = S.role === "admin"; S.canEdit = S.isAdmin || S.role === "dispatch"; S.canWrite = S.role !== "viewer";
  $("who").innerHTML = `<span>${esc(S.myName)} · ${ROLE_LABEL[S.role]}</span><button class="btn sm" type="button" data-g="signout">Sign out</button>`;
  document.querySelector('.tab[data-v="team"]').hidden = !S.isAdmin;
  $("saveBtn").disabled = !S.canWrite; $("formHint").textContent = S.canWrite ? "" : "You have view-only access.";
  if (!S.isAdmin && S.view === "team") document.querySelector('.tab[data-v="new"]').click();
  gate("ok");
  const since = Date.now() - DAYS_LOADED * 86400000;
  const onErr = e => { $("conn").textContent = "Reconnect"; $("conn").classList.remove("ok"); $("banner").hidden = false;
    $("banner").textContent = e && e.code === "permission-denied" ? "Your access changed. Reload the page." : "Lost the live connection. Reload the page to reconnect."; };
  $("conn").textContent = "Live"; $("conn").classList.add("ok"); $("banner").hidden = true;
  unsubs.push(onSnapshot(query(fsCollection(fdb, "orders"), where("orderAt", ">=", since)), s => { S.orders = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); if (S.lastId) showTicket(); }, onErr));
  unsubs.push(onSnapshot(query(fsCollection(fdb, "deliveries"), where("executedAt", ">=", since)), s => { S.deliveries = new Map(s.docs.map(d => [d.id, d.data()])); render(); if (S.lastId) showTicket(); }, onErr));
  unsubs.push(onSnapshot(fsCollection(fdb, "members"), s => { S.members = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, onErr));
  unsubs.push(onSnapshot(fsDoc(fdb, "config", "dealers"), async s => {
    if (!s.exists() && S.isAdmin) { try { await setDoc(fsDoc(fdb, "config", "dealers"), { list: STARTER_DEALERS.map(name => ({ name, contact: "", phone: "", area: "" })) }); } catch(e){} return; }
    S.dealers = s.exists() && Array.isArray(s.data().list) ? s.data().list : []; render();
  }, onErr));
}
if (!configured) gate("setup");
else { gate("loading"); onAuthStateChanged(auth, u => boot(u)); }
