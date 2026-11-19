/* DHS Logistics - Hindi screen (19 Nov 2026)
   When someone picks Hindi, this swaps the English words on the screen for Hindi as the page draws them:
   buttons, headings, hints, messages, dates. The Brief page stays in English. Names that people typed
   (dealers, parties, places, vehicles) and product names stay as they are. Picking English puts every word back.
   Used by both the dashboard (index.html) and the stock ledger (stock.html). No database reads or writes:
   the choice is kept on each device only ("dhs.lang"). */
(function () {
  "use strict";
  if (window.DHSHindi) return;
  const DOC = document;
  const MON = { Jan: "जनवरी", Feb: "फ़रवरी", Mar: "मार्च", Apr: "अप्रैल", May: "मई", Jun: "जून", Jul: "जुलाई", Aug: "अगस्त", Sep: "सितंबर", Oct: "अक्टूबर", Nov: "नवंबर", Dec: "दिसंबर" };
  const MONTH = { January: "जनवरी", February: "फ़रवरी", March: "मार्च", April: "अप्रैल", May: "मई", June: "जून", July: "जुलाई", August: "अगस्त", September: "सितंबर", October: "अक्टूबर", November: "नवंबर", December: "दिसंबर" };
  const WD = { Mon: "सोम", Tue: "मंगल", Wed: "बुध", Thu: "गुरु", Fri: "शुक्र", Sat: "शनि", Sun: "रवि" };
  const clean = s => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/​/g, "").replace(/\s+/g, " ").trim();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const D = new Map();
  const add = (obj, keep) => { for (const k in obj) { const c = clean(k); if (typeof obj[k] === "string" && obj[k] && !(keep && D.has(c))) D.set(c, obj[k]); } cache.clear(); };
  const cache = new Map();
  const LAT = /[A-Za-z]{2,}/;

  // "9:00 pm" -> "रात 9:00"
  function hTime(h, mm, ap) {
    const H = (h % 12) + (ap === "pm" ? 12 : 0);
    const p = H < 4 ? "रात" : H < 12 ? "सुबह" : H < 16 ? "दोपहर" : H < 19 ? "शाम" : "रात";
    return p + " " + h + ":" + mm;
  }
  // months, weekdays and am/pm times inside a short piece of text
  function dates(s) {
    return String(s)
      .replace(/\b(\d{1,2}):(\d\d) ?(am|pm)\b/gi, (_, h, m, ap) => hTime(+h, m, ap.toLowerCase()))
      .replace(/\b(\d{1,2}) ?(am|pm)\b/gi, (_, h, ap) => hTime(+h, "00", ap.toLowerCase()))
      .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, m => MONTH[m])
      .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, m => MON[m])
      .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/g, d => WD[d]);
  }
  // A closed set of words that can be swapped one by one, for short counts like "2 orders · 270 bags" or "1 h 32 min".
  const WORDS = { bags: "बैग", bag: "बैग", orders: "ऑर्डर", order: "ऑर्डर", pending: "बाकी", ordered: "ऑर्डर हुए", dispatched: "डिस्पैच हुए",
    min: "मिनट", mins: "मिनट", h: "घंटे", t: "टन", days: "दिन", day: "दिन", dealers: "डीलर", dealer: "डीलर", entries: "एंट्री", entry: "एंट्री",
    reports: "रिपोर्ट", report: "रिपोर्ट", records: "रिकॉर्ड", MT: "MT", SAP: "SAP", Today: "आज", Tomorrow: "कल", Yesterday: "बीता कल",
    today: "आज", tomorrow: "कल", yesterday: "बीता कल", of: "में से", to: "से", and: "और", on: "को", hold: "होल्ड" };
  function words(s) {
    let ok = true;
    const d = dates(s).replace(/\b(\d+)h\b/g, "$1 घं").replace(/\b(\d+)m\b/g, "$1 मि").replace(/\b(\d+)d\b/g, "$1 दिन");
    const out = d.replace(/[A-Za-z]+/g, w => { if (Object.prototype.hasOwnProperty.call(WORDS, w)) return WORDS[w]; ok = false; return w; });
    return ok && out !== s ? out : null;
  }
  const x = s => { const r = tr(s); return r == null ? s : r; };       // translate a part, or keep it as it is
  const xd = s => { const r = tr(s); return r == null ? dates(s) : r; };  // the same, with dates turned into Hindi
  const P = [];   // [pattern on the whole (cleaned) text, function(match) -> Hindi]
  const B = [];   // [pattern on a short block's whole text, function(match) -> Hindi HTML]; for sentences with bold parts
  const p = (re, fn) => P.push([re, fn]);
  const b = (re, fn) => B.push([re, fn]);
  const DEPOT = { "Transport Nagar": "ट्रांसपोर्ट नगर", "Harrawala": "हर्रावाला", "Doiwala": "डोईवाला", "TP + Harrawala": "TP + हर्रावाला", "TP+Harrawala": "TP+हर्रावाला",
    "TRANSPORT NAGAR": "ट्रांसपोर्ट नगर", "HARRAWALA": "हर्रावाला", "DOIWALA": "डोईवाला" };
  const dep = s => DEPOT[s] || s;
  const STATUS = { pending: "बाकी", "on hold": "होल्ड पर", scheduled: "आगे के लिए बुक", dispatched: "डिस्पैच हो चुका", cancelled: "रद्द" };
  const num = "(-?[\\d,]+(?:\\.\\d+)?)";
  const R = s => new RegExp("^" + s + "$");
  const PROD = "([A-Z][A-Z0-9/. ()]*?)";   // a product's column label, e.g. OPC 43, LPP/BLACK

  /* ---- dashboard ---- */
  p(/^Reads : (.+)$/, m => "रीड्स : " + m[1]);
  p(/^Expected ~(.+)$/, m => "अनुमान ~" + dates(m[1]));
  p(/^Pending orders, oldest first\. Number (\d+) goes next\.$/, m => "बाकी ऑर्डर, सबसे पुराना पहले। अगला नंबर " + m[1] + " जाएगा।");
  p(/^Ordered (.+)$/, m => "ऑर्डर: " + dates(m[1]));
  p(/^Waiting (.+)$/, m => "इंतज़ार " + x(m[1]));
  p(/^Booked (.+)$/, m => "बुक: " + dates(m[1]));
  p(/^Entered (\d.+?)(?: by (.+))?$/, m => "दर्ज: " + dates(m[1]) + (m[2] ? ", " + m[2] + " ने" : ""));
  p(/^Last changed (.+?) by (.+)$/, m => "आखिरी बदलाव: " + dates(m[1]) + ", " + m[2] + " ने");
  p(/^Advance orders\. Each joins the queue by itself at (\d+) am on its day\.$/, m => "एडवांस ऑर्डर। हर ऑर्डर अपने दिन सुबह " + m[1] + " बजे अपने-आप कतार में जुड़ता है।");
  p(/^Goes into the queue on (.+)$/, m => dates(m[1]) + " को कतार में जाएगा");
  p(/^Orders for (.+) to (.+) aren't loaded yet\. Loading (\d+) days? uses database reads, so it only happens when you ask\.$/,
    m => dates(m[1]) + " से " + dates(m[2]) + " तक के ऑर्डर अभी लोड नहीं हुए। " + m[3] + " दिन लोड करने में डेटाबेस रीड्स लगते हैं, इसलिए यह तभी होता है जब आप कहें।");
  p(/^(.+) selected\. Loading them uses database reads \(about 100 per busy day\), only when you tap Download\.$/, m => x(m[1]) + " चुने गए। इन्हें लोड करने में डेटाबेस रीड्स लगते हैं (व्यस्त दिन में लगभग 100), सिर्फ़ डाउनलोड टैप करने पर।");
  p(/^\((\d+) on the order form\)$/, m => "(ऑर्डर फ़ॉर्म पर " + m[1] + ")");
  p(/^Dealer-sheet column: (.+)$/, m => "डीलर शीट कॉलम: " + m[1]);
  p(/^Expires in (\d+) days?$/, m => m[1] + " दिन में खत्म");
  p(/^Active, (\d+) days left$/, m => "चालू, " + m[1] + " दिन बाकी");
  p(/^Active till (.+)$/, m => dates(m[1]) + " तक चालू");
  p(/^empty = (\d+) days$/, m => "खाली = " + m[1] + " दिन");
  p(/^Database reads by everyone since Google's daily reset \(12:30 or 1:30 pm IST\)\. Updated (.+)\.$/, m => "Google के रोज़ाना रीसेट (दोपहर 12:30 या 1:30 IST) के बाद से सभी के डेटाबेस रीड्स। अपडेट: " + dates(m[1]) + "।");
  p(/^(\d+)(?:st|nd|rd|th) order of (.+)$/, m => dates(m[2]) + " का ऑर्डर नं. " + m[1]);
  p(/^the (\d+)(?:st|nd|rd|th) order of (.+)$/, m => dates(m[2]) + " के ऑर्डर नं. " + m[1]);
  p(/^(\d+)(?:st|nd|rd|th) in line$/, m => "लाइन में नं. " + m[1]);
  p(/^(\d+)(?:st|nd|rd|th)$/, m => m[1] + " तारीख");
  p(/^since (.+)$/, m => dates(m[1]) + " से");
  p(/^Next email: (.+)$/, m => "अगला ईमेल: " + dates(m[1]));
  p(/^Last sent ([^·]+)$/, m => "पिछली बार भेजा: " + dates(m[1]));
  p(/^Sent to (\d+), (.+)$/, m => m[1] + " लोगों को भेजा, " + x(m[2]));
  p(/^The email job last checked (.+)\.( Last problem: (.+))?$/, m => "ईमेल जॉब ने आखिरी बार " + dates(m[1]) + " को जाँचा।" + (m[2] ? " पिछली समस्या: " + m[3] : ""));
  p(/^The email job hasn't run yet\. Set it up on GitHub once \(see README\); after that it checks every 30 minutes\.( Last problem: (.+))?$/, m => "ईमेल जॉब अभी तक नहीं चला। इसे एक बार GitHub पर सेट करें (README देखें); उसके बाद यह हर 30 मिनट में जाँचता है।" + (m[1] ? " पिछली समस्या: " + m[2] : ""));
  p(/^Role for (.+)$/, m => m[1] + " का रोल");
  p(/^On hold since (.+?)(?: by (.+?))?(?: · Reason:)?$/, m => "होल्ड पर: " + dates(m[1]) + " से" + (m[2] ? ", " + m[2] + " ने रखा" : "") + (/Reason:$/.test(m[0]) ? " · कारण:" : ""));
  p(/^cancelled by (.+)$/, m => m[1] + " ने रद्द किया");
  p(/^Scheduled for (.+?)\. It joins the queue by itself at 6 am that day\.$/, m => dates(m[1]) + " के लिए बुक। उस दिन सुबह 6 बजे यह अपने-आप कतार में जुड़ जाएगा।");
  p(/^Scheduled for (.+)$/, m => dates(m[1]) + " के लिए बुक");
  p(/^This link is for (.+?)\.$/, m => "यह लिंक " + m[1] + " का है।");
  p(/^Marked dispatched · (.+)$/, m => "डिस्पैच हुआ · " + m[1].split(" · ").map(xd).join(" · "));
  p(/^Starts once there are (\d+) working days with dispatches \(now: (\d+); a working day has at least 3 dispatches spread over an hour or more\)\. If this stays at 0, the Admin runs Recalculate month for this month and last\. Until then, no estimate is shown\.$/,
    m => "जब डिस्पैच वाले " + m[1] + " कामकाजी दिन हो जाएँगे तब शुरू होगा (अभी: " + m[2] + "; कामकाजी दिन में कम से कम 3 डिस्पैच एक घंटे या ज़्यादा में फैले होते हैं)। अगर यह 0 पर ही रहे, तो एडमिन इस और पिछले महीने के लिए \"महीना दोबारा गिनें\" चलाए। तब तक कोई अनुमान नहीं दिखेगा।");
  // toasts
  p(/^(.+) is already saved as another vehicle\.$/, m => m[1] + " पहले से दूसरी गाड़ी के रूप में सेव है।");
  p(/^Vehicle (.+) saved$/, m => "गाड़ी " + m[1] + " सेव हुई");
  p(/^Vehicle (.+) added$/, m => "गाड़ी " + m[1] + " जोड़ी गई");
  p(/^Vehicle (.+) updated$/, m => "गाड़ी " + m[1] + " अपडेट हुई");
  p(/^Tracking link updated for (.+)$/, m => m[1] + " का ट्रैकिंग लिंक अपडेट हुआ");
  p(/^Removed (.+)$/, m => m[1] + " हटाया गया");
  p(/^Excel ready: (\d+) orders?$/, m => "एक्सेल तैयार: " + m[1] + " ऑर्डर");
  p(/^Master file ready: (\d+) orders$/, m => "मास्टर फ़ाइल तैयार: " + m[1] + " ऑर्डर");
  p(/^(.+) is already (?:in|on) the list\.$/, m => m[1] + " पहले से सूची में है।");
  p(/^Renamed to (.+)\. Orders already saved keep "(.+)"\.$/, m => "नाम बदलकर " + m[1] + " किया। पहले से सेव ऑर्डर में \"" + m[2] + "\" ही रहेगा।");
  p(/^This order is for (.+)\. Tap Send today first\.$/, m => "यह ऑर्डर " + dates(m[1]) + " का है। पहले \"आज भेजें\" टैप करें।");
  p(/^This order is (pending|on hold|scheduled|dispatched|cancelled)\.$/, m => "यह ऑर्डर " + STATUS[m[1]] + " है।");
  p(/^Role changed to (.+)$/, m => "रोल बदलकर " + x(m[1]) + " किया");
  p(/^Added (.+)\. They can sign in now\.$/, m => m[1] + " जोड़ा गया। अब वे साइन इन कर सकते हैं।");
  p(/^Upgrade complete: (\d+) orders updated\.$/, m => "अपग्रेड पूरा: " + m[1] + " ऑर्डर अपडेट हुए।");
  p(/^(Allowed|Not allowed): (.+)$/, m => (m[1] === "Allowed" ? "अनुमति दी: " : "अनुमति हटाई: ") + x(m[2]));
  p(/^(.+) is back on the order form$/, m => m[1] + " फिर ऑर्डर फ़ॉर्म पर है");
  p(/^(.+) is off the order form\. Old orders keep it\.$/, m => m[1] + " ऑर्डर फ़ॉर्म से हटाया गया। पुराने ऑर्डर में यह बना रहेगा।");
  p(/^(.+) added\. It's on the order form now\.$/, m => m[1] + " जोड़ा गया। अब यह ऑर्डर फ़ॉर्म पर है।");
  p(/^(Weekly report|Daily contact list|Monthly master file) switched (on|off)$/, m => x(m[1]) + (m[2] === "on" ? " चालू किया" : " बंद किया"));
  p(/^Sign-in failed: (.+)$/, m => "साइन-इन नहीं हुआ: " + m[1]);
  p(/^Pending \(in queue\)$/, () => "बाकी (कतार में)");
  p(/^(.+) \(not in list\)$/, m => m[1] + " (सूची में नहीं)");
  p(/^(\d+) bags of pending orders have no depot yet\.$/, m => "बाकी ऑर्डर के " + m[1] + " बैग का अभी डिपो तय नहीं।");
  p(/^(.+) \((\d+) bags?\)$/, m => { const y = tr(m[1]); return y == null ? null : y + " (" + m[2] + " बैग)"; });

  p(/^Today and days with pending orders update live\. Other days' totals were loaded at (.+)\.$/, m => "आज और बाकी ऑर्डर वाले दिन लाइव अपडेट होते हैं। बाकी दिनों के कुल " + dates(m[1]) + " पर लोड हुए थे।");
  p(/^This order has no (.+?)\. Fill (it|them) in to mark the order dispatched\. Without (?:it|them), the order stays in the queue\.$/,
    m => "इस ऑर्डर में " + m[1].replace("customer's phone number", "ग्राहक का फ़ोन नंबर").replace("phone number", "फ़ोन नंबर").replace("vehicle number", "गाड़ी नंबर").replace("dispatch depot", "डिस्पैच डिपो").replace(/ and /g, " और ") +
      " नहीं है। डिस्पैच करने के लिए " + (m[2] === "it" ? "इसे" : "इन्हें") + " भरें। इनके बिना ऑर्डर कतार में ही रहेगा।");

  // a refused change, with the reason (19 Nov 2026)
  const whoNe = w => w === "You" ? "आपने" : w === "Someone" ? "किसी ने" : w + " ने";
  p(/^(.+?) cancelled this order(?: at (.+))?\. Nothing was changed\.$/, m => whoNe(m[1]) + (m[2] ? " " + dates(m[2]) + " पर" : "") + " यह ऑर्डर रद्द किया। कुछ नहीं बदला।");
  p(/^(.+?) marked this order dispatched(?: at (.+))?\. Nothing was changed\.$/, m => whoNe(m[1]) + (m[2] ? " " + dates(m[2]) + " पर" : "") + " यह ऑर्डर डिस्पैच किया। कुछ नहीं बदला।");
  p(/^(.+?) put this order on hold(?: at (.+))?\. Release it first\.$/, m => whoNe(m[1]) + (m[2] ? " " + dates(m[2]) + " पर" : "") + " यह ऑर्डर होल्ड पर रखा। पहले इसे छोड़ें।");

  /* ---- stock ledger ---- */
  p(/^Last (\d+) days$/, m => "पिछले " + m[1] + " दिन");
  p(R(PROD + " bags"), m => m[1] + " बैग");
  p(R(PROD + " MT"), m => m[1] + " MT");
  p(R(PROD + " SAP stock"), m => m[1] + " SAP स्टॉक");
  p(R(PROD + " physical stock"), m => m[1] + " फ़िज़िकल स्टॉक");
  p(/^(Transport Nagar|Harrawala|Doiwala) capacity (MT|bags)$/, m => dep(m[1]) + " क्षमता " + (m[2] === "MT" ? "MT" : "बैग"));
  p(/^(Transport Nagar|Harrawala|Doiwala): (.+?) bags \((.+?) MT\), off in (.+)$/, m => dep(m[1]) + ": " + m[2] + " बैग (" + m[3] + " MT), अंतर: " + m[4]);
  p(/^(Transport Nagar|Harrawala|Doiwala|TP\+Harrawala): matche[sd]( ✓)?$/, m => dep(m[1]) + ": मिलान हुआ" + (m[2] || ""));
  p(/^(Transport Nagar|Harrawala|Doiwala), (.+): Not entered$/, m => dep(m[1]) + ", " + m[2] + ": नहीं भरा");
  p(/^(.+): Not entered$/, m => x(m[1]) + ": नहीं भरा");
  p(/^Within capacity$/, () => "क्षमता के अंदर");
  p(/^of (.+) MT in SAP$/, m => "SAP में " + m[1] + " MT में से");
  p(/^(\d+)% of capacity$/, m => "क्षमता का " + m[1] + "%");
  p(/^(.+) GODOWN STOCK$/, m => m[1] + " गोदाम स्टॉक");
  p(/^ORDERS AND LEDGER DIFFER ON (\d+) DEPOT-DAYS?$/, m => m[1] + " डिपो-दिनों पर ऑर्डर और लेजर में अंतर");
  p(/^DEALER CHECK \((.+)\)$/, m => "डीलर जाँच (" + dep(m[1]) + ")");
  p(/^DEALER CHECK (.+)$/, m => "डीलर जाँच " + dep(m[1]));
  p(/^STOCK (.+)$/, m => "स्टॉक " + dep(m[1]));
  p(/^(TRANSPORT NAGAR|HARRAWALA|DOIWALA) · OPENING (.+)$/, m => dep(m[1]) + " · शुरुआती " + m[2]);
  p(/^(.+?) CAPACITY: SAP (.+)$/, m => dep(m[1]) + " क्षमता: SAP " + m[2].replace(/OVER by/, "ज़्यादा:"));
  p(/^Vehicle (.+)$/, m => "गाड़ी " + m[1]);
  p(/^Ref (.+)$/, m => "रेफ़ " + m[1]);
  p(/^Reason: (.+)$/, m => "कारण: " + m[1]);
  p(/^(\d+) of (\d+) entries$/, m => m[2] + " में से " + m[1] + " एंट्री");
  p(/^(\d+) entr(?:y|ies) taken off the ledger since (.+), newest first\.$/, m => m[2] + " से लेजर से हटाई गई " + m[1] + " एंट्री, नई सबसे ऊपर।");
  p(/^No entries taken off the ledger since (.+)\.$/, m => m[1] + " से लेजर से कोई एंट्री नहीं हटाई गई।");
  p(/^(\d+) corrections? in (\w+) (\d{4})\. For other months, download the entries as Excel \(Correction type\): the reason is a column\.$/,
    m => dates(m[2]) + " " + m[3] + " में " + m[1] + " सुधार। दूसरे महीनों के लिए एंट्री एक्सेल में डाउनलोड करें (टाइप: सुधार): कारण एक कॉलम में है।");
  p(/^No corrections in (.+)\.$/, m => dates(m[1]) + " में कोई सुधार नहीं।");
  p(/^Closing position: (stock carried forward to|SAP opening stock of) (.+?) \+ (\d+) entries up to (.+?)\. Difference = physical − SAP\.$/,
    m => "समापन स्थिति: " + m[2] + " का " + (m[1][0] === "s" ? "आगे लाया गया स्टॉक" : "SAP शुरुआती स्टॉक") + " + " + m[4] + " तक की " + m[3] + " एंट्री। अंतर = फ़िज़िकल − SAP।");
  p(/^Closing balance: balances (carried forward to|of) (.+?) \+ billing − dispatch from then up to (.+?)\. Minus = pendency, plus = advance\. Bags, with MT below\.$/,
    m => "समापन बैलेंस: " + m[2] + " के " + (m[1] === "of" ? "" : "आगे लाए गए ") + "बैलेंस + तब से " + m[3] + " तक बिलिंग − डिस्पैच। माइनस = पेंडेंसी, प्लस = एडवांस। बैग, नीचे MT।");
  p(/^TP\+Harrawala opening balances are kept combined, so this shows only (.+?) billing − dispatch since (.+)\.$/, m => "TP+हर्रावाला के शुरुआती बैलेंस एक साथ रखे गए हैं, इसलिए यहाँ केवल " + dep(m[1]) + " की " + m[2] + " से बिलिंग − डिस्पैच दिखती है।");
  p(/^(\d+) dealers? came in from dashboard dispatches under a name that isn't on this ledger: (.+)\. If it is a dealer you already have here under another spelling, pair the names so the balances join\.$/,
    m => m[1] + " डीलर डैशबोर्ड डिस्पैच से ऐसे नाम से आए जो इस लेजर में नहीं है: " + m[2] + "। अगर यह डीलर यहाँ दूसरी स्पेलिंग से पहले से है, तो नाम मिलाएँ ताकि बैलेंस जुड़ जाएँ।");
  p(/^Dispatches marked on the dashboard come in under the dashboard's dealer name\. (1 name is|(\d+) names are) spelt the same as a dealer here and join by themselves\. (.+)$/,
    m => "डैशबोर्ड पर डिस्पैच किए गए ऑर्डर डैशबोर्ड के डीलर नाम से आते हैं। " + (m[2] || 1) + " नाम यहाँ के डीलर जैसे ही लिखे हैं और अपने-आप जुड़ जाते हैं। " + x(m[3]));
  p(/^Enter (Transport Nagar|Harrawala|Doiwala)'s opening balance for (.+) above to tally it\.$/, m => "मिलान के लिए ऊपर " + dep(m[1]) + " का " + m[2] + " का शुरुआती बैलेंस भरें।");
  p(/^Ledger position at the end of (.+?) against the SAP report for the opening of (.+?)\. Bags, with MT below\. Mismatch = ledger − official\.$/,
    m => m[1] + " के अंत में लेजर की स्थिति, " + m[2] + " की शुरुआती SAP रिपोर्ट के मुकाबले। बैग, नीचे MT। अंतर = लेजर − आधिकारिक।");
  p(/^The ledger closes each month by itself on the 1st\. Its start \((.+)\) can no longer be moved; fix a balance with a Correction entry\.$/,
    m => "लेजर हर महीना 1 तारीख को अपने-आप बंद करता है। इसकी शुरुआत (" + m[1] + ") अब नहीं बदली जा सकती; बैलेंस सुधार एंट्री से ठीक करें।");
  p(/^Entries must be dated (.+?) or later \(the opening stock date\)\.$/, m => "एंट्री की तारीख " + m[1] + " या उसके बाद की होनी चाहिए (शुरुआती स्टॉक की तारीख)।");
  p(/^Entries must be dated (.+?) or later\. The ledger keeps the last two months; earlier months are closed\. Fix an older balance with a Correction entry\.$/,
    m => "एंट्री की तारीख " + m[1] + " या उसके बाद की होनी चाहिए। लेजर पिछले दो महीने रखता है; उससे पहले के महीने बंद हैं। पुराना बैलेंस सुधार एंट्री से ठीक करें।");
  p(/^A dealer in the (.+) sheet has figures but no name\.$/, m => x(m[1]) + " शीट में एक डीलर के आँकड़े हैं पर नाम नहीं है।");
  p(/^(.+) appears twice in the (.+) sheet\. Combine them into one row\.$/, m => m[1] + " " + x(m[2]) + " शीट में दो बार है। दोनों को एक लाइन में जोड़ें।");
  p(/^Dealer balances of (.+) saved\. Dealer Stock now shows them\.$/, m => m[1] + " के डीलर बैलेंस सेव हुए। अब डीलर स्टॉक में दिख रहे हैं।");
  p(/^Opening balances can be entered from (.+), the ledger's start day, onward\.$/, m => "शुरुआती बैलेंस " + m[1] + " (लेजर का शुरुआती दिन) से आगे भरे जा सकते हैं।");
  p(/^The ledger keeps the last two months\. Opening balances can be entered from (.+) onward\.$/, m => "लेजर पिछले दो महीने रखता है। शुरुआती बैलेंस " + m[1] + " से आगे भरे जा सकते हैं।");
  p(/^Copying… (\d+) of (\d+)$/, m => "कॉपी हो रहा है… " + m[2] + " में से " + m[1]);
  p(/^Stopped after (\d+) of (\d+): (.+)\. Nothing is lost; choose the file again to finish\.$/, m => m[2] + " में से " + m[1] + " के बाद रुक गया: " + m[3] + "। कुछ नहीं खोया; पूरा करने के लिए फ़ाइल फिर चुनें।");
  p(/^Done: (\d+) records copied\. The ledger now shows them\.$/, m => "हो गया: " + m[1] + " रिकॉर्ड कॉपी हुए। अब लेजर में दिख रहे हैं।");
  p(/^Copy the dealer rows from Excel: the name, then (.+?) \(the total is optional\)(; a sheet with only the first six columns works too)?\. Dealers already in the list are updated; new ones are added\.$/,
    m => "एक्सेल से डीलर की लाइनें कॉपी करें: पहले नाम, फिर " + m[1] + " (कुल ज़रूरी नहीं)" + (m[2] ? "; केवल पहले छह कॉलम वाली शीट भी चलेगी" : "") + "। सूची में पहले से मौजूद डीलर अपडेट होंगे; नए जुड़ जाएँगे।");
  p(/^Its own dealer: (.+)$/, m => "अलग डीलर: " + m[1]);
  p(/^Looks like (.+)\?$/, m => "शायद " + m[1] + "?");
  p(/^Dealer on this ledger for (.+)$/, m => m[1] + " के लिए इस लेजर का डीलर");
  p(/^This reads every order dispatched since (.+?) \(one read per order\) and puts the ledger's order lines and day counts right\. Hand-typed dispatches stay as they are\.$/,
    m => "यह " + m[1] + " से डिस्पैच हुआ हर ऑर्डर पढ़ता है (हर ऑर्डर पर एक रीड) और लेजर की ऑर्डर लाइनें और दिन की गिनती ठीक करता है। हाथ से लिखे डिस्पैच जैसे हैं वैसे रहेंगे।");
  p(/^Reading dashboard orders since (.+?)…$/, m => m[1] + " से डैशबोर्ड ऑर्डर पढ़े जा रहे हैं…");
  p(/^Checked (\d+) dispatched orders since (.+?): the ledger already matches them\. Nothing to fix\.$/, m => m[2] + " से डिस्पैच हुए " + m[1] + " ऑर्डर जाँचे: लेजर पहले से मेल खाता है। ठीक करने को कुछ नहीं।");
  p(/^Checked (\d+) dispatched orders since (.+?): (.+); day counts brought up to date\.$/,
    m => m[2] + " से डिस्पैच हुए " + m[1] + " ऑर्डर जाँचे: " + m[3].replace(/(\d+) added/, "$1 जोड़े").replace(/(\d+) corrected/, "$1 सुधारे").replace(/(\d+) removed/, "$1 हटाए").replace("order lines already right", "ऑर्डर लाइनें पहले से सही") + "; दिन की गिनती अपडेट हुई।");
  p(/^Saving… (\d+) of (\d+)$/, m => "सेव हो रहा है… " + m[2] + " में से " + m[1]);
  p(/^Couldn't finish: (.+)\. Nothing is lost; try again\.$/, m => "पूरा नहीं हो सका: " + m[1] + "। कुछ नहीं खोया; फिर कोशिश करें।");
  p(/^Not saved\. (.+)$/, m => "सेव नहीं हुआ। " + x(m[1]));
  p(/^The ledger starts on (.+?)\. Pick that date or later\.$/, m => "लेजर " + m[1] + " से शुरू होता है। वह तारीख या उसके बाद की चुनें।");
  p(/^The ledger starts on (.+?), so there is nothing before that\.$/, m => "लेजर " + m[1] + " से शुरू होता है, इसलिए उससे पहले कुछ नहीं है।");
  p(/^Can now open the ledger: (.+)$/, m => "अब लेजर खोल सकते हैं: " + m[1]);
  p(/^Can no longer open the ledger: (.+)$/, m => "अब लेजर नहीं खोल सकते: " + m[1]);
  p(/^Move the ledger start to (.+?)(\?)?$/, m => "लेजर की शुरुआत " + m[1] + " पर ले जाएँ" + (m[2] || ""));
  p(/^Start the ledger from (.+?)(\?)?$/, m => "लेजर " + m[1] + " से शुरू करें" + (m[2] || ""));
  p(/^(\d+) entr(?:y|ies) dated before (.+) will stop counting\.$/, m => m[2] + " से पहले की " + m[1] + " एंट्री अब नहीं गिनी जाएँगी।");
  p(/^Dealer balances stay as entered for (.+?)\. Update them to (.+?) on Dealer Stock\. The current setup is kept as a backup\.$/,
    m => "डीलर बैलेंस " + m[1] + " के लिए भरे अनुसार रहेंगे। डीलर स्टॉक में इन्हें " + m[2] + " के अनुसार अपडेट करें। मौजूदा सेटअप बैकअप के रूप में रखा जाता है।");
  p(/^Next, enter the dealers' balances of (.+) on Dealer Stock\.$/, m => "अब डीलर स्टॉक में " + m[1] + " के डीलर बैलेंस भरें।");
  p(/^The ledger now starts from (.+)\. Next: dealer balances on Dealer Stock\.$/, m => "लेजर अब " + m[1] + " से शुरू होता है। अगला: डीलर स्टॉक में डीलर बैलेंस।");
  p(/^Opening balance saved: (.+), (.+)$/, m => "शुरुआती बैलेंस सेव हुआ: " + dep(m[1]) + ", " + m[2]);
  p(/^(Billing|Dispatch|Arrival|Trailer arrival|Correction) saved(?:: (.+?))?, (.+)$/, m => x(m[1]) + " सेव हुई" + (m[2] ? ": " + m[2] : "") + ", " + x(m[3]));
  p(/^New dealer: "(.+)" will be added to the dealer sheet\.$/, m => "नया डीलर: \"" + m[1] + "\" डीलर शीट में जोड़ा जाएगा।");
  p(/^No dealer matches "(.+)"\.$/, m => "\"" + m[1] + "\" से कोई डीलर मेल नहीं खाता।");
  p(/^A dispatch of the same bags to (.+?) from (Transport Nagar|Harrawala|Doiwala) on (.+?) came in from the dashboard(?: \(vehicle (.+)\))?\. Saving this would count it twice\.$/,
    m => m[3] + " को " + dep(m[2]) + " से " + m[1] + " को इन्हीं बैग का डिस्पैच डैशबोर्ड से आ चुका है" + (m[4] ? " (गाड़ी " + m[4] + ")" : "") + "। इसे सेव करने से यह दो बार गिना जाएगा।");
  p(/^This takes SAP stock to (.+) MT\. Capacity is (.+) MT, so it would be (.+) MT over\.$/, m => "इससे SAP स्टॉक " + m[1] + " MT हो जाएगा। क्षमता " + m[2] + " MT है, यानी " + m[3] + " MT ज़्यादा।");
  p(/^Over capacity at (.+)$/, m => dep(m[1]) + " में क्षमता से ज़्यादा");
  p(/^No SAP reports were entered for (.+)\.$/, m => x(m[1]) + " के लिए कोई SAP रिपोर्ट नहीं भरी गई।");
  p(/^SAP reports of (.+) \(Excel\)$/, m => m[1] + " की SAP रिपोर्ट (एक्सेल)");
  p(/^All SAP reports of (.+) \(Excel\)$/, m => dates(m[1]) + " की सभी SAP रिपोर्ट (एक्सेल)");
  p(/^Balances at the end of (.+) \(Excel\)$/, m => m[1] + " के अंत के बैलेंस (एक्सेल)");
  p(/^Entries of (.+) \(Excel\)$/, m => xd(m[1]) + " की एंट्री (एक्सेल)");
  p(/^(.+) \(Excel\)$/, m => { const y = tr(m[1]); return y == null ? null : y + " (एक्सेल)"; });
  p(/^Downloaded the balances at the end of (.+)\.$/, m => m[1] + " के अंत के बैलेंस डाउनलोड हुए।");
  p(/^Downloaded (\d+) (entry|entries|report|reports)\.$/, m => m[1] + (/^e/.test(m[2]) ? " एंट्री" : " रिपोर्ट") + " डाउनलोड हुईं।");
  p(/^Ready: (.+)$/, m => "तैयार: " + x(m[1]));
  p(/^The ledger shows this month and, when you pick one of its dates, last month \(from (.+?)\)\. Each month closes by itself on the 1st\. For (.+?), download an Excel file instead\.$/,
    m => "लेजर इस महीने को और, उसकी कोई तारीख चुनने पर, पिछले महीने (" + m[1] + " से) को दिखाता है। हर महीना 1 तारीख को अपने-आप बंद होता है। " + m[2] + " के लिए एक्सेल फ़ाइल डाउनलोड करें।");
  p(/^(.+) sheet total$/, m => x(m[1]) + " शीट का कुल");
  p(/^(.+)'s opening balance for (.+)$/, m => dep(m[1]) + " का " + m[2] + " का शुरुआती बैलेंस");
  p(/^Dealer balance · (.+)$/, m => "डीलर बैलेंस · " + m[1]);
  p(/^\+ (.+)$/, m => { const y = tr(m[1]); return y == null ? null : "+ " + y; });

  /* ---- sentences with bold parts ---- */
  b(/^Fields marked \* are required\. The rest can be added later\.$/, () => '<span class="req">*</span> वाले खाने ज़रूरी हैं। बाकी बाद में भी भर सकते हैं।');
  b(/^It leaves the queue but stays in the records, the Summary and Excel as Cancelled\. If it was a mistake, open the order and set Mark as back\.$/,
    () => "यह कतार से हट जाएगा, पर रिकॉर्ड, सारांश और एक्सेल में <b>रद्द</b> के रूप में रहेगा। गलती हो तो ऑर्डर खोलकर <b>स्थिति</b> वापस बदल दें।");
  b(/^About (\d+) min per order \(usually (\d+)–(\d+)\), dispatching (\S+)–(\S+?)(?:, none on (.+?))?\. Learned from (\d+) working days since (.+?)(?:, recent weeks counting more \(a day (\d+) days back counts half\)|, every day counting the same)\.$/,
    m => "हर ऑर्डर में लगभग <b>" + m[1] + " मिनट</b> (आम तौर पर " + m[2] + "–" + m[3] + "), डिस्पैच " + m[4] + "–" + m[5] + (m[6] ? ", " + m[6].split(", ").map(x).join(", ") + " को बंद" : "") +
      "। " + dates(m[8]) + " से " + m[7] + " कामकाजी दिनों से सीखा, " + (m[9] ? "हाल के हफ़्तों को ज़्यादा महत्व (" + m[9] + " दिन पुराना दिन आधा गिना जाता है)" : "हर दिन बराबर गिना गया") + "।");
  b(/^Checked on (\d+) orders from the last (\d+) days: estimating by place in line was off by (.+?) \(half the orders were closer than this\); using the average wait \((.+?)\) would have been off by (.+?)\. Using (the average wait|place in line), because it was closer\.$/,
    m => "पिछले " + m[2] + " दिनों के " + m[1] + " ऑर्डर पर जाँचा: लाइन में जगह से अनुमान <b>" + x(m[3]) + "</b> गलत रहा (आधे ऑर्डर इससे करीब थे); औसत इंतज़ार (" + x(m[4]) + ") से अनुमान <b>" + x(m[5]) + "</b> गलत रहता। <b>" +
      (m[6] === "place in line" ? "लाइन में जगह" : "औसत इंतज़ार") + "</b> इस्तेमाल हो रहा है, क्योंकि वह ज़्यादा सही रहा।");
  b(/^This link is for (.+?), not (.+?)\. Check the truck, or tap Save vehicle again to save it anyway\.$/,
    m => "<b style=\"color:var(--pending)\">यह लिंक " + esc(m[1]) + " का है, " + esc(m[2]) + " का नहीं।</b> ट्रक जाँचें, या फिर भी सेव करने के लिए \"गाड़ी सेव करें\" दोबारा टैप करें।");
  b(/^Looks like a repeat of (the (.+?)|an order): (.+?), (\d+) bags, (.+?) \((\w[\w ]*)\)\. Check, then tap Save anyway if this is a new order\.$/,
    m => "<span class=\"dupwarn\">यह <b>" + (m[2] ? esc(x(m[2])) : "किसी ऑर्डर") + "</b> जैसा लगता है: " + esc(m[3]) + ", " + m[4] + " बैग, " + esc(dates(m[5])) + " (" + esc(x(m[6])) + ")। जाँच लें, नया ऑर्डर हो तो <b>फिर भी सेव करें</b> टैप करें।</span>");
  b(/^This order has no (.+?)\. Fill (it|them) in to mark the order dispatched\. Without (?:it|them), the order stays in the queue\.$/,
    m => "इस ऑर्डर में " + m[1].replace("customer's phone number", "ग्राहक का फ़ोन नंबर").replace("phone number", "फ़ोन नंबर").replace("vehicle number", "गाड़ी नंबर").replace("dispatch depot", "डिस्पैच डिपो").replace(/ and /g, " और ").replace(/, /g, ", ") +
      " नहीं है। डिस्पैच करने के लिए " + (m[2] === "it" ? "इसे" : "इन्हें") + " भरें। इसके बिना ऑर्डर कतार में ही रहेगा।");
  b(/^We sent a verification link to (.+?)\. Open it from your inbox, then come back and tap I've verified\.$/,
    m => "हमने <b>" + esc(m[1]) + "</b> पर पुष्टि का लिंक भेजा है। इनबॉक्स से इसे खोलें, फिर यहाँ लौटकर <b>पुष्टि कर दी</b> टैप करें।");
  b(/^(.+?) is not on the authorised list\.$/, m => "<b>" + esc(m[1]) + "</b> अधिकृत सूची में नहीं है।");
  b(/^First time with email\? Enter your work email and a new password, then tap Create account\. Your email must already be added by the Admin\.$/,
    () => "पहली बार ईमेल से? अपना काम का ईमेल और नया पासवर्ड भरें, फिर <b>अकाउंट बनाएँ</b> टैप करें। आपका ईमेल पहले से एडमिन ने जोड़ा होना चाहिए।");
  b(/^Report emails have stopped\. The email job last ran (.+?)\. GitHub switches it off after 60 days without an upload: open GitHub → DHS-Demo → Actions → Report emails and tap Enable workflow\. This note goes away within an hour of it running again\.$/,
    m => "<b>रिपोर्ट ईमेल बंद हो गए हैं।</b> ईमेल जॉब आखिरी बार " + esc(dates(m[1])) + " को चला। 60 दिन तक कोई अपलोड न हो तो GitHub इसे बंद कर देता है: GitHub → DHS-Demo → Actions → Report emails खोलें और <b>Enable workflow</b> टैप करें। इसके फिर चलने के एक घंटे के अंदर यह नोट हट जाएगा।");
  b(/^(Allowed|Not allowed)\. (.+)$/, m => { const y = tr(m[2]); return y == null ? null : "<b class=\"" + (m[1] === "Allowed" ? "yes" : "no") + "\">" + (m[1] === "Allowed" ? "अनुमति है।" : "अनुमति नहीं है।") + "</b> " + esc(y); });
  b(/^Each dealer's balance on the ledger's start day, (.+?)\. Billing and dispatches from that day on are added to these\. Only admins can change them\.$/,
    m => "लेजर के शुरुआती दिन <b>" + esc(m[1]) + "</b> पर हर डीलर का बैलेंस। उस दिन से आगे की बिलिंग और डिस्पैच इनमें जुड़ते हैं। इन्हें केवल एडमिन बदल सकते हैं।");
  b(/^Use the dealer sheet of (.+?)\. For a later day's sheet, first move the ledger start on Opening Balance\. Minus = pendency, plus = advance\. Blank = 0\.$/,
    m => "<b>" + esc(m[1]) + "</b> की डीलर शीट इस्तेमाल करें। बाद के दिन की शीट के लिए पहले शुरुआती बैलेंस में लेजर की शुरुआत आगे करें। माइनस = पेंडेंसी, प्लस = एडवांस। खाली = 0।");

  function tr(raw) {
    const s = clean(raw);
    if (!s || !LAT.test(s)) return null;
    if (cache.has(s)) return cache.get(s);
    cache.set(s, null);   // guards against loops while working it out
    let r = D.has(s) ? D.get(s) : null;
    if (r == null) for (const [re, fn] of P) { const m = s.match(re); if (m) { try { r = fn(m); } catch (e) { r = null; } if (r != null) break; } }
    if (r == null) r = words(s);
    if (r == null && s.includes(" · ")) {
      let any = false;
      const o = s.split(" · ").map(p => { const y = tr(p); if (y != null) any = true; return y == null ? p : y; });
      if (any) r = o.join(" · ");
    }
    if (r == null) { const m = s.match(/^(.*?[A-Za-z)])\s*([:.?!…]+)$/); if (m && D.has(m[1])) r = D.get(m[1]) + (m[2] === "." ? "।" : m[2]); }
    if (r == null) { const m = s.match(/^([:.,;·(]\s*)(.+)$/); if (m) { const y = tr(m[2]); if (y != null) r = m[1] + y; } }
    if (cache.size > 30000) cache.clear();
    cache.set(s, r);
    return r;
  }

  /* ---------- the page ---------- */
  const SKIP = "script,style,textarea,noscript,svg,pre,code,[data-nohi],#v-brief,.pvbar,[contenteditable=true]";
  const INLINE = { B: 1, STRONG: 1, SPAN: 1, BR: 1, I: 1, EM: 1, SUP: 1, SMALL: 1 };
  const ATTRS = ["placeholder", "title", "aria-label"];
  let on = false, mo = null;
  const inSkip = el => !!(el && el.closest && el.closest(SKIP));

  function doText(n) {
    const v = n.nodeValue;
    if (v == null || n.__hiOut === v) return;
    const r = tr(v);
    if (r == null) { delete n.__hiEn; delete n.__hiOut; return; }
    const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0], out = lead + r + trail;
    n.__hiEn = v; n.__hiOut = out; n.nodeValue = out;
    const p = n.parentElement;
    if (!p) return;
    if (p.tagName === "OPTION" && !p.hasAttribute("value")) p.setAttribute("value", clean(v));
    if (!p.hasAttribute("lang") && p.childNodes.length === 1) { p.setAttribute("lang", "hi"); p.__hiLang = 1; }
  }
  function doAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute(a); if (!v) continue;
      const st = el.__hiA || (el.__hiA = {});
      if (st[a] && st[a].out === v) continue;
      const r = tr(v);
      if (r == null) { delete st[a]; continue; }
      st[a] = { en: v, out: r }; el.setAttribute(a, r);
    }
  }
  // a short sentence with bold parts, translated as a whole so the Hindi word order is right
  function doBlock(el) {
    if (el.__hiBlkOut != null && el.innerHTML === el.__hiBlkOut) return true;
    const kids = el.childNodes; if (kids.length < 2 || kids.length > 14) return false;
    let hasEl = false;
    for (const k of kids) { if (k.nodeType === 1) { if (!INLINE[k.tagName] || k.children.length) return false; hasEl = true; } else if (k.nodeType !== 3) return false; }
    if (!hasEl) return false;
    const s = clean(el.textContent); if (s.length > 900 || !LAT.test(s)) return false;
    for (const [re, fn] of B) {
      const m = s.match(re); if (!m) continue;
      let h = null; try { h = fn(m, el); } catch (e) { h = null; }
      if (h == null) continue;
      el.__hiBlk = el.innerHTML; el.innerHTML = h; el.__hiBlkOut = el.innerHTML;
      if (!el.hasAttribute("lang")) { el.setAttribute("lang", "hi"); el.__hiLang = 1; }
      return true;
    }
    return false;
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || root.matches(SKIP)) return;
    const w = DOC.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const els = [], texts = [];
    let n = w.currentNode;
    while (n) { if (n.nodeType === 1) els.push(n); else texts.push(n); n = w.nextNode(); }
    for (const el of els) {
      if (!el.isConnected && el !== root) continue;
      if (el.hasAttribute("placeholder") || el.hasAttribute("title") || el.hasAttribute("aria-label")) doAttrs(el);
      if (B.length) doBlock(el);
    }
    for (const t of texts) {
      if (!t.isConnected && !root.contains(t)) continue;
      const p = t.parentElement;
      if (p && p.__hiBlkOut != null && p.innerHTML === p.__hiBlkOut) continue;
      doText(t);
    }
  }
  function onMut(recs) {
    if (!on) return;
    const seen = new Set();
    for (const r of recs) {
      const tg = r.target;
      if (r.type === "childList") {
        if (tg.nodeType === 1 && !seen.has(tg) && !inSkip(tg)) { seen.add(tg); if (doBlock(tg)) continue; }
        for (const n of r.addedNodes) if (n.isConnected && !inSkip(n.parentElement)) walk(n);
      } else if (r.type === "characterData") { if (!inSkip(tg.parentElement)) doText(tg); }
      else if (r.type === "attributes") { if (!inSkip(tg)) doAttrs(tg); }
    }
  }
  function restore(root) {
    if (!root) return;
    const all = [root, ...root.querySelectorAll("*")];
    for (const el of all) if (el.__hiBlk != null) { if (el.innerHTML === el.__hiBlkOut) el.innerHTML = el.__hiBlk; delete el.__hiBlk; delete el.__hiBlkOut; }
    const w = DOC.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (n.__hiEn != null) { if (n.nodeValue === n.__hiOut) n.nodeValue = n.__hiEn; delete n.__hiEn; delete n.__hiOut; }
    for (const el of root.querySelectorAll("*")) {
      if (el.__hiA) { for (const a in el.__hiA) if (el.getAttribute(a) === el.__hiA[a].out) el.setAttribute(a, el.__hiA[a].en); delete el.__hiA; }
      if (el.__hiLang) { el.removeAttribute("lang"); delete el.__hiLang; }
    }
    if (root.__hiLang) { root.removeAttribute("lang"); delete root.__hiLang; }
  }
  function startObs() {
    if (!mo) mo = new MutationObserver(onMut);
    mo.observe(DOC.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  function set(lang) {
    const want = lang === "hi";
    if (want === on) return;
    on = want;
    DOC.documentElement.classList.toggle("hi-on", on);
    if (on) { startObs(); if (DOC.body) walk(DOC.body); else DOC.addEventListener("DOMContentLoaded", () => on && walk(DOC.body), { once: true }); }
    else { if (mo) { onMut(mo.takeRecords()); mo.disconnect(); } if (DOC.body) restore(DOC.body); }
  }
  // Hindi words need no letter-spacing or capitals
  const css = DOC.createElement("style");
  css.textContent = "html.hi-on [lang=hi]{letter-spacing:0;text-transform:none}";
  (DOC.head || DOC.documentElement).appendChild(css);

  add({
  "DHS Logistics Order Dashboard": "DHS लॉजिस्टिक्स ऑर्डर डैशबोर्ड",
  "DHS Logistics - Orders Dashboard": "DHS लॉजिस्टिक्स - ऑर्डर डैशबोर्ड",
  "(Alpha)": "(अल्फ़ा)",
  "Dehradun and Harrawala orders. All rights are reserved to Niket Sharma.": "देहरादून और हर्रावाला के ऑर्डर। सभी अधिकार निकेत शर्मा के पास सुरक्षित हैं।",
  "Authorised staff only": "केवल अधिकृत स्टाफ़ के लिए",
  "Checking sign-in…": "साइन-इन जाँचा जा रहा है…",
  "Install app": "ऐप इंस्टॉल करें",
  "Live": "लाइव",
  "Help": "मदद",
  "Sign out": "साइन आउट",
  "New Order": "नया ऑर्डर",
  "Orders": "ऑर्डर",
  "Summary": "सारांश",
  "Stock": "स्टॉक",
  "Settings": "सेटिंग्स",
  "Maintenance is on.": "मेंटेनेंस चालू है।",
  "Staff see the \"under maintenance\" screen and can't make changes.": "स्टाफ़ को \"मेंटेनेंस चल रहा है\" वाली स्क्रीन दिखती है और वे कोई बदलाव नहीं कर सकते।",
  "Turn off": "बंद करें",
  "Help guide": "मदद गाइड",
  "Close": "बंद करें",
  "Menu": "मेन्यू",
  "Refresh: get the latest orders and totals": "रीफ़्रेश: नए ऑर्डर और कुल जोड़ लाएँ",
  "Menu: Help, language, sign out": "मेन्यू: मदद, भाषा, साइन आउट",
  "Settings section": "सेटिंग्स का हिस्सा",
  "Orders view": "ऑर्डर व्यू",
  "Depot stock ledger": "डिपो स्टॉक लेजर",
  "Under maintenance": "मेंटेनेंस चल रहा है",
  "This page opens again by itself when it's back.": "काम पूरा होते ही यह पेज अपने-आप फिर खुल जाएगा।",
  "Check again": "फिर से जाँचें",
  "The dashboard is under maintenance. Please check again after some time.": "डैशबोर्ड पर मेंटेनेंस चल रहा है। कृपया कुछ देर बाद फिर देखें।",
  "Reload": "रीलोड करें",
  "Reconnect": "फिर से जोड़ें",
  "Refreshed": "रीफ़्रेश हुआ",
  "Loading…": "लोड हो रहा है…",
  "Loading the new version…": "नया वर्ज़न लोड हो रहा है…",
  "Your access changed. Reload the page.": "आपकी अनुमति बदल गई है। पेज रीलोड करें।",
  "Lost the live connection. Reload the page to reconnect.": "लाइव कनेक्शन टूट गया। दोबारा जोड़ने के लिए पेज रीलोड करें।",
  "Not connected to the database, so the order can't be saved.": "डेटाबेस से कनेक्शन नहीं है, इसलिए ऑर्डर सेव नहीं हो सकता।",
  "Your role doesn't allow this. Ask an Admin to change your role.": "आपका रोल इसकी अनुमति नहीं देता। रोल बदलने के लिए एडमिन से कहें।",
  "Daily free limit reached. Ask the Admin to check the Firebase plan.": "रोज़ की मुफ़्त सीमा पूरी हो गई। एडमिन से Firebase प्लान जाँचने को कहें।",
  "Couldn't save. Check your connection and try again.": "सेव नहीं हो सका। कनेक्शन जाँचें और फिर कोशिश करें।",
  "Installed. Open DHS Logistics from your home screen.": "इंस्टॉल हो गया। होम स्क्रीन से DHS Logistics खोलें।",
  "On iPhone: tap the Share button in Safari, then Add to Home Screen.": "iPhone पर: Safari में Share बटन टैप करें, फिर Add to Home Screen चुनें।",
  "To install: open the browser menu (⋮) and choose Install app or Add to Home screen. Works in Chrome and Edge.": "इंस्टॉल करने के लिए: ब्राउज़र मेन्यू (⋮) खोलें और Install app या Add to Home screen चुनें। Chrome और Edge में चलता है।",
  "Sign in": "साइन इन करें",
  "Sign in with Google": "Google से साइन इन करें",
  "or with email and password": "या ईमेल और पासवर्ड से",
  "Create account": "अकाउंट बनाएँ",
  "Forgot password?": "पासवर्ड भूल गए?",
  "New here? Read the help guide": "नए हैं? मदद गाइड पढ़ें",
  "Read the help guide": "मदद गाइड पढ़ें",
  "I've verified": "पुष्टि कर दी",
  "Send link again": "लिंक फिर भेजें",
  "Password": "पासवर्ड",
  "Ask your Admin to add this exact email under Settings → Team & emails, then sign in again.": "एडमिन से कहें कि यही ईमेल सेटिंग्स → टीम और ईमेल में जोड़ें, फिर दोबारा साइन इन करें।",
  "Wrong email or password.": "ईमेल या पासवर्ड गलत है।",
  "This email already has an account. Tap Sign in instead.": "इस ईमेल का अकाउंट पहले से है। \"साइन इन करें\" टैप करें।",
  "Use a password of at least 6 characters.": "कम से कम 6 अक्षर का पासवर्ड रखें।",
  "Enter a valid email address.": "सही ईमेल पता भरें।",
  "Too many attempts. Wait a few minutes and try again.": "बहुत बार कोशिश हुई। कुछ मिनट रुककर फिर कोशिश करें।",
  "Enter your email above first, then tap Forgot password? again.": "पहले ऊपर अपना ईमेल भरें, फिर \"पासवर्ड भूल गए?\" दोबारा टैप करें।",
  "New order": "नया ऑर्डर",
  "Dealer": "डीलर",
  "Party / customer": "पार्टी / ग्राहक",
  "Phone": "फ़ोन",
  "needed before dispatch": "डिस्पैच से पहले ज़रूरी",
  "Delivery location": "डिलीवरी की जगह",
  "Products & bags (50 kg)": "प्रोडक्ट और बैग (50 किलो)",
  "Select product": "प्रोडक्ट चुनें",
  "+ Add product": "+ प्रोडक्ट जोड़ें",
  "Order date & time": "ऑर्डर की तारीख और समय",
  "Set when you save": "सेव करने पर भरेगा",
  "Deliver on": "डिलीवरी कब",
  "Today": "आज",
  "Tomorrow": "कल",
  "Yesterday": "बीता कल",
  "Dispatch & delivery": "डिस्पैच और डिलीवरी",
  "optional now · depot and vehicle are needed before dispatch": "अभी ज़रूरी नहीं · डिस्पैच से पहले डिपो और गाड़ी चाहिए",
  "Dispatch depot": "डिस्पैच डिपो",
  "Select depot": "डिपो चुनें",
  "Transport Nagar": "ट्रांसपोर्ट नगर",
  "Harrawala": "हर्रावाला",
  "Doiwala": "डोईवाला",
  "TP + Harrawala": "TP + हर्रावाला",
  "Vehicle no.": "गाड़ी नंबर",
  "Driver": "ड्राइवर",
  "Driver's phone": "ड्राइवर का फ़ोन",
  "Remarks": "टिप्पणी",
  "Add order": "ऑर्डर जोड़ें",
  "Type or pick a dealer": "डीलर लिखें या चुनें",
  "e.g. Sharma Builders": "जैसे Sharma Builders",
  "e.g. Rajpur Road, near Jakhan": "जैसे राजपुर रोड, जाखन के पास",
  "Product": "प्रोडक्ट",
  "Name": "नाम",
  "Anything the driver or office should know": "ड्राइवर या ऑफ़िस को जो जानना चाहिए",
  "Select dealer": "डीलर चुनें",
  "No dealer matches": "कोई डीलर मेल नहीं खाता",
  "No dealers yet. Add them on the Dealers tab.": "अभी कोई डीलर नहीं। इन्हें डीलर टैब में जोड़ें।",
  "Not a saved vehicle. Keep typing, or pick Self.": "यह सेव की हुई गाड़ी नहीं है। लिखते रहें, या Self चुनें।",
  "Pick the day this order should go. It waits under Orders → Scheduled and joins the queue by itself at 6 am that day. Pick today to put it in today's queue now.": "वह दिन चुनें जिस दिन यह ऑर्डर जाना है। यह ऑर्डर → आगे के ऑर्डर में रुकेगा और उस दिन सुबह 6 बजे अपने-आप कतार में जुड़ जाएगा। अभी आज की कतार में डालने के लिए आज चुनें।",
  "Orders you add appear here, numbered by order time.": "आपके जोड़े ऑर्डर यहाँ ऑर्डर के समय के क्रम से नंबर के साथ दिखते हैं।",
  "No orders yet today": "आज अभी कोई ऑर्डर नहीं",
  "Save anyway": "फिर भी सेव करें",
  "Enter the vehicle number.": "गाड़ी नंबर भरें।",
  "Pick today or a later date.": "आज या बाद की तारीख चुनें।",
  "The deliver-on date can't be before the order date.": "डिलीवरी की तारीख ऑर्डर की तारीख से पहले नहीं हो सकती।",
  "Pick a deliver-on date within the next 90 days.": "अगले 90 दिनों के अंदर डिलीवरी की तारीख चुनें।",
  "Keep at least one product on the order form.": "ऑर्डर फ़ॉर्म पर कम से कम एक प्रोडक्ट रखें।",
  "Enter the customer's phone number (10 digits). The order can't be dispatched without it.": "ग्राहक का फ़ोन नंबर (10 अंक) भरें। इसके बिना ऑर्डर डिस्पैच नहीं हो सकता।",
  "Enter the vehicle number. The order can't be dispatched without it.": "गाड़ी नंबर भरें। इसके बिना ऑर्डर डिस्पैच नहीं हो सकता।",
  "Select the dispatch depot. The order can't be dispatched without it.": "डिस्पैच डिपो चुनें। इसके बिना ऑर्डर डिस्पैच नहीं हो सकता।",
  "in line": "लाइन में",
  "Pending": "बाकी",
  "Queue": "कतार",
  "On hold": "होल्ड पर",
  "Scheduled": "आगे के ऑर्डर",
  "All orders": "सभी ऑर्डर",
  "Dispatch queue": "डिस्पैच कतार",
  "bags": "बैग",
  "Track": "ट्रैक करें",
  "Entered by": "दर्ज किया",
  "Mark dispatched": "डिस्पैच हुआ",
  "Put on hold": "होल्ड पर रखें",
  "Cancel order": "ऑर्डर रद्द करें",
  "Edit": "बदलें",
  "Depot": "डिपो",
  "Change date": "तारीख बदलें",
  "Send today": "आज भेजें",
  "Track (old link)": "ट्रैक (पुराना लिंक)",
  "Out of the queue and can't be dispatched until released.": "कतार से बाहर; छोड़े जाने तक डिस्पैच नहीं हो सकता।",
  "Nothing on hold": "होल्ड पर कुछ नहीं",
  "Orders put on hold wait here. They can't be marked dispatched until they're released back to the queue.": "होल्ड पर रखे ऑर्डर यहाँ रुकते हैं। कतार में वापस छोड़े जाने तक इन्हें डिस्पैच नहीं किया जा सकता।",
  "Orders booked for a later day wait here, then join the queue by themselves on their day.": "आगे के दिन के लिए बुक हुए ऑर्डर यहाँ रुकते हैं, फिर अपने दिन अपने-आप कतार में जुड़ जाते हैं।",
  "No advance orders": "कोई एडवांस ऑर्डर नहीं",
  "No pending orders. New orders join the end of the line by order time.": "कोई बाकी ऑर्डर नहीं। नए ऑर्डर अपने समय के हिसाब से लाइन के आखिर में जुड़ते हैं।",
  "Queue is clear": "कतार खाली है",
  "Release to queue": "कतार में छोड़ें",
  "Undo dispatch": "डिस्पैच वापस लें",
  "Send on WhatsApp": "WhatsApp पर भेजें",
  "WhatsApp booking": "WhatsApp बुकिंग",
  "WhatsApp place in line": "WhatsApp लाइन में जगह",
  "WhatsApp dispatch update": "WhatsApp डिस्पैच अपडेट",
  "Estimate learned from all past dispatches": "पिछले सभी डिस्पैच से सीखा गया अनुमान",
  "Expected": "अनुमान",
  "This link may have expired. Paste a fresh one under Settings → Vehicles.": "यह लिंक शायद खत्म हो गया है। सेटिंग्स → गाड़ियाँ में नया लिंक पेस्ट करें।",
  "Customer's own vehicle": "ग्राहक की अपनी गाड़ी",
  "customer's own vehicle": "ग्राहक की अपनी गाड़ी",
  "Waiting": "इंतज़ार",
  "Ordered": "ऑर्डर",
  "Entered by hand": "हाथ से दर्ज",
  "This order is no longer in the queue.": "यह ऑर्डर अब कतार में नहीं है।",
  "This order is already cancelled.": "यह ऑर्डर पहले से रद्द है।",
  "This order is already dispatched.": "यह ऑर्डर पहले से डिस्पैच हो चुका है।",
  "Release it from hold first.": "पहले इसे होल्ड से छोड़ें।",
  "It joins today's queue at 6 am.": "यह सुबह 6 बजे आज की कतार में जुड़ जाएगा।",
  "It's already in today's queue.": "यह पहले से आज की कतार में है।",
  "It's already on that date.": "यह पहले से उसी तारीख पर है।",
  "Sent to today's queue.": "आज की कतार में भेज दिया।",
  "On hold. Find it under Orders → On hold.": "होल्ड पर रखा। इसे ऑर्डर → होल्ड पर में देखें।",
  "Released. It's back in the queue at its place by order time.": "छोड़ दिया। यह ऑर्डर के समय के हिसाब से कतार में अपनी जगह पर वापस है।",
  "Order cancelled. It stays in the records as Cancelled.": "ऑर्डर रद्द हुआ। यह रिकॉर्ड में \"रद्द\" के रूप में रहेगा।",
  "Dispatch undone. Order is back in the queue.": "डिस्पैच वापस लिया। ऑर्डर फिर कतार में है।",
  "Only a Supervisor or the Admin can do this.": "यह केवल सुपरवाइज़र या एडमिन कर सकते हैं।",
  "Only a Supervisor or the Admin marks orders dispatched.": "ऑर्डर केवल सुपरवाइज़र या एडमिन डिस्पैच करते हैं।",
  "Only a Supervisor or the Admin marks orders dispatched": "ऑर्डर केवल सुपरवाइज़र या एडमिन डिस्पैच करते हैं",
  "Vehicle number needed": "गाड़ी नंबर चाहिए",
  "Phone number needed": "फ़ोन नंबर चाहिए",
  "Details needed before dispatch": "डिस्पैच से पहले जानकारी चाहिए",
  "View-only access: order details can't be opened.": "केवल देखने की अनुमति: ऑर्डर की पूरी जानकारी नहीं खुल सकती।",
  "Tap again": "फिर टैप करें",
  "Dispatch depot needed": "डिस्पैच डिपो चाहिए",
  "Confirm dispatched": "डिस्पैच पक्का करें",
  "Not now": "अभी नहीं",
  "The order leaves the queue and can't be marked dispatched until it's released. When released, it goes back to its place in line by its order time.": "ऑर्डर कतार से हट जाएगा और छोड़े जाने तक डिस्पैच नहीं हो सकेगा। छोड़ने पर यह ऑर्डर के समय के हिसाब से लाइन में अपनी जगह पर लौट आएगा।",
  "Reason (optional)": "कारण (ज़रूरी नहीं)",
  "Cancel": "रहने दें",
  "e.g. payment pending, site not ready": "जैसे पेमेंट बाकी, साइट तैयार नहीं",
  "Cancel this order?": "यह ऑर्डर रद्द करें?",
  "Keep order": "ऑर्डर रखें",
  "e.g. customer called it off": "जैसे ग्राहक ने मना कर दिया",
  "Mark as": "स्थिति",
  "Edit order": "ऑर्डर बदलें",
  "Save changes": "बदलाव सेव करें",
  "Save date": "तारीख सेव करें",
  "Delete order": "ऑर्डर मिटाएँ",
  "Tap again to delete": "मिटाने के लिए फिर टैप करें",
  "Order deleted": "ऑर्डर मिटाया गया",
  "Order updated": "ऑर्डर अपडेट हुआ",
  "Dispatch time updated": "डिस्पैच समय अपडेट हुआ",
  "Enter the dispatch time.": "डिस्पैच का समय भरें।",
  "Dispatch time can't be before the order time.": "डिस्पैच का समय ऑर्डर के समय से पहले नहीं हो सकता।",
  "Order time can't be after the dispatch time.": "ऑर्डर का समय डिस्पैच के समय के बाद नहीं हो सकता।",
  "A dispatched order needs its vehicle number.": "डिस्पैच हुए ऑर्डर में गाड़ी नंबर ज़रूरी है।",
  "A dispatched order needs its dispatch depot.": "डिस्पैच हुए ऑर्डर में डिस्पैच डिपो ज़रूरी है।",
  "A dispatched order needs the customer's phone number.": "डिस्पैच हुए ऑर्डर में ग्राहक का फ़ोन नंबर ज़रूरी है।",
  "Dispatched at": "डिस्पैच का समय",
  "Today and days with pending orders are live; older dates load when you ask. Tap a row to open it.": "आज और बाकी ऑर्डर वाले दिन लाइव हैं; पुरानी तारीखें माँगने पर लोड होती हैं। खोलने के लिए किसी लाइन पर टैप करें।",
  "Download Excel": "एक्सेल डाउनलोड करें",
  "From": "से",
  "To": "तक",
  "All dealers": "सभी डीलर",
  "All depots": "सभी डिपो",
  "No depot yet": "अभी डिपो नहीं",
  "Status": "स्थिति",
  "All": "सभी",
  "Dispatched": "डिस्पैच हुए",
  "Cancelled": "रद्द",
  "Search": "खोजें",
  "Party, location or phone": "पार्टी, जगह या फ़ोन",
  "Search party, location or phone": "पार्टी, जगह या फ़ोन खोजें",
  "these dates": "इन तारीखों में",
  "Pending now": "अभी बाकी",
  "Bags": "बैग",
  "ordered": "ऑर्डर हुए",
  "dispatched": "डिस्पैच हुए",
  "Avg time taken": "औसत लगा समय",
  "order → dispatch": "ऑर्डर → डिस्पैच",
  "Load these dates": "ये तारीखें लोड करें",
  "Order of the day": "दिन का ऑर्डर",
  "In line": "लाइन में",
  "Order time": "ऑर्डर का समय",
  "Party": "पार्टी",
  "Location": "जगह",
  "Products": "प्रोडक्ट",
  "Total bags": "कुल बैग",
  "Vehicle": "गाड़ी",
  "Time taken": "लगा समय",
  "No orders match": "कोई ऑर्डर मेल नहीं खाता",
  "Change the dates or filters": "तारीखें या फ़िल्टर बदलें",
  "No orders in this view to download.": "इस व्यू में डाउनलोड के लिए कोई ऑर्डर नहीं।",
  "No orders in those dates. The file is empty.": "उन तारीखों में कोई ऑर्डर नहीं। फ़ाइल खाली है।",
  "Download didn't start. Try again.": "डाउनलोड शुरू नहीं हुआ। फिर कोशिश करें।",
  "Pick a From date on or before the To date.": "\"से\" की तारीख \"तक\" की तारीख से पहले या उसी दिन की चुनें।",
  "Pick up to one year at a time.": "एक बार में ज़्यादा से ज़्यादा एक साल चुनें।",
  "The Excel tool didn't load. Check your internet and reload the page.": "एक्सेल टूल लोड नहीं हुआ। इंटरनेट जाँचें और पेज रीलोड करें।",
  "Excel download works on your real site. It's blocked inside this preview.": "एक्सेल डाउनलोड आपकी असली साइट पर चलता है। इस प्रीव्यू में यह बंद है।",
  "Preparing…": "तैयार हो रहा है…",
  "The month you pick, by dealer and by day. Time taken is order time to dispatch time; averages leave out Self vehicles.": "चुने गए महीने का हिसाब, डीलर और दिन के अनुसार। लगा समय = ऑर्डर से डिस्पैच तक; औसत में ग्राहक की अपनी (Self) गाड़ियाँ नहीं गिनी जातीं।",
  "Month": "महीना",
  "Refresh": "रीफ़्रेश",
  "Download master file": "मास्टर फ़ाइल डाउनलोड करें",
  "Recalculate month": "महीना दोबारा गिनें",
  "Recalculating…": "दोबारा गिना जा रहा है…",
  "Month totals recalculated": "महीने के कुल दोबारा गिने गए",
  "Loading totals…": "कुल जोड़ लोड हो रहा है…",
  "this month": "इस महीने",
  "all dates": "सभी तारीखें",
  "coming days": "आने वाले दिन",
  "Tap a card to see those orders. Tap a dealer, a depot or a day to download its orders and totals as Excel.": "वे ऑर्डर देखने के लिए कार्ड पर टैप करें। किसी डीलर, डिपो या दिन पर टैप करके उसके ऑर्डर और कुल एक्सेल में डाउनलोड करें।",
  "Dispatch time estimate": "डिस्पैच समय का अनुमान",
  "Dealer-wise": "डीलर के अनुसार",
  "Pending bags": "बाकी बैग",
  "Avg time": "औसत समय",
  "Last order": "आखिरी ऑर्डर",
  "Depot-wise": "डिपो के अनुसार",
  "Day-wise": "दिन के अनुसार",
  "Date": "तारीख",
  "Month total": "महीने का कुल",
  "Every order and the totals": "सभी ऑर्डर और कुल",
  "None this month.": "इस महीने कोई नहीं।",
  "Dealers": "डीलर",
  "Vehicles": "गाड़ियाँ",
  "Team & emails": "टीम और ईमेल",
  "Authorised dealers": "अधिकृत डीलर",
  "These names fill the Dealer list on every order.": "हर ऑर्डर की डीलर सूची इन्हीं नामों से भरती है।",
  "Contact person": "संपर्क व्यक्ति",
  "Area": "क्षेत्र",
  "You can edit a dealer's contact person, phone and area. Only the Admin or a Supervisor can add dealers, and only the Admin can rename or remove one.": "आप डीलर का संपर्क व्यक्ति, फ़ोन और क्षेत्र बदल सकते हैं। नए डीलर केवल एडमिन या सुपरवाइज़र जोड़ सकते हैं, और नाम बदलना या हटाना केवल एडमिन कर सकता है।",
  "You can add dealers and edit their contact person, phone and area. Only the Admin can rename or remove a dealer.": "आप डीलर जोड़ सकते हैं और उनका संपर्क व्यक्ति, फ़ोन और क्षेत्र बदल सकते हैं। डीलर का नाम बदलना या हटाना केवल एडमिन कर सकता है।",
  "You have view-only access.": "आपके पास केवल देखने की अनुमति है।",
  "Only the Admin or a Supervisor can add dealers.": "डीलर केवल एडमिन या सुपरवाइज़र जोड़ सकते हैं।",
  "Dealer name": "डीलर का नाम",
  "Add dealer": "डीलर जोड़ें",
  "Edit dealer": "डीलर बदलें",
  "No dealers added yet": "अभी कोई डीलर नहीं जोड़ा",
  "Add your first authorised dealer below.": "नीचे अपना पहला अधिकृत डीलर जोड़ें।",
  "An Admin adds dealers here.": "एडमिन यहाँ डीलर जोड़ता है।",
  "Renaming changes the name for new orders. Orders already saved keep the name they were entered with.": "नाम बदलने से नए ऑर्डर में नाम बदलता है। पहले से सेव ऑर्डर में वही नाम रहता है जिससे वे दर्ज हुए थे।",
  "You can change the contact person, phone and area. Only the Admin can rename a dealer.": "आप संपर्क व्यक्ति, फ़ोन और क्षेत्र बदल सकते हैं। डीलर का नाम केवल एडमिन बदल सकता है।",
  "Dealer list saved": "डीलर सूची सेव हुई",
  "Dealer details saved": "डीलर की जानकारी सेव हुई",
  "This dealer was changed or removed meanwhile. Open it again.": "इस बीच इस डीलर को बदला या हटाया गया। इसे फिर खोलें।",
  "Enter the dealer name.": "डीलर का नाम भरें।",
  "Save": "सेव करें",
  "Remove": "हटाएँ",
  "Removed": "हटाया गया",
  "These fill the Product list on every order, and the product columns of the stock ledger and the Brief. Only the Admin can change them.": "हर ऑर्डर की प्रोडक्ट सूची, स्टॉक लेजर और ब्रीफ़ के प्रोडक्ट कॉलम इन्हीं से भरते हैं। इन्हें केवल एडमिन बदल सकता है।",
  "New product name": "नए प्रोडक्ट का नाम",
  "Column heading on the dealer sheet": "डीलर शीट में कॉलम का नाम",
  "(optional)": "(ज़रूरी नहीं)",
  "Add product": "प्रोडक्ट जोड़ें",
  "A new product goes at the end of the Product list on orders, and at the end of the stock ledger's columns: Opening Balance, Dealer Stock, the dealer-sheet paste and the Excel files. Orders already saved keep their products.": "नया प्रोडक्ट ऑर्डर की प्रोडक्ट सूची के आखिर में और स्टॉक लेजर के कॉलम के आखिर में जुड़ता है: शुरुआती बैलेंस, डीलर स्टॉक, डीलर शीट पेस्ट और एक्सेल फ़ाइलें। पहले से सेव ऑर्डर के प्रोडक्ट नहीं बदलते।",
  "On the order form": "ऑर्डर फ़ॉर्म पर है",
  "Not on the order form": "ऑर्डर फ़ॉर्म पर नहीं",
  "Take off the order form": "ऑर्डर फ़ॉर्म से हटाएँ",
  "Put back on the order form": "ऑर्डर फ़ॉर्म पर वापस लाएँ",
  "e.g. PPC Premium": "जैसे PPC Premium",
  "as on your Excel": "जैसा आपकी एक्सेल में है",
  "Type the product's name.": "प्रोडक्ट का नाम लिखें।",
  "Leave out commas and × in the name.": "नाम में कॉमा और × न लिखें।",
  "Vehicles & GPS tracking": "गाड़ियाँ और GPS ट्रैकिंग",
  "Paste a truck's WheelsEye link; orders with that vehicle number then show Track.": "ट्रक का WheelsEye लिंक पेस्ट करें; फिर उस गाड़ी नंबर वाले ऑर्डर पर \"ट्रैक करें\" दिखेगा।",
  "Link status": "लिंक की स्थिति",
  "Link added": "लिंक जोड़ा",
  "Expired, paste a new link": "समय खत्म, नया लिंक पेस्ट करें",
  "New link": "नया लिंक",
  "Add link": "लिंक जोड़ें",
  "Customer's own vehicle. Always at the bottom of the vehicle list; built in, can't be removed. Not counted in average time taken.": "ग्राहक की अपनी गाड़ी। गाड़ी सूची में हमेशा सबसे नीचे; पहले से बनी है, हटाई नहीं जा सकती। औसत लगे समय में नहीं गिनी जाती।",
  "WheelsEye tracking link": "WheelsEye ट्रैकिंग लिंक",
  "optional": "ज़रूरी नहीं",
  "Link valid until": "लिंक कब तक चलेगा",
  "Save vehicle": "गाड़ी सेव करें",
  "Edit vehicle": "गाड़ी बदलें",
  "You can add vehicles and paste new links. Only the Admin can edit all of a vehicle's details or remove one.": "आप गाड़ियाँ जोड़ सकते हैं और नए लिंक पेस्ट कर सकते हैं। गाड़ी की पूरी जानकारी बदलना या गाड़ी हटाना केवल एडमिन कर सकता है।",
  "How to get a tracking link": "ट्रैकिंग लिंक कैसे लें",
  "Open the WheelsEye app and select the truck.": "WheelsEye ऐप खोलें और ट्रक चुनें।",
  "Tap Share location and copy the link (it starts with https://wheelseye.com/ui/track).": "Share location टैप करें और लिंक कॉपी करें (यह https://wheelseye.com/ui/track से शुरू होता है)।",
  "Paste it in the form above; the truck number fills in. Tap Save vehicle.": "इसे ऊपर के फ़ॉर्म में पेस्ट करें; ट्रक नंबर अपने-आप भर जाएगा। \"गाड़ी सेव करें\" टैप करें।",
  "Anyone who has a tracking link can see that truck's location, so only share it inside the team.": "जिसके पास ट्रैकिंग लिंक है वह उस ट्रक की जगह देख सकता है, इसलिए इसे केवल टीम के अंदर ही शेयर करें।",
  "No trucks saved yet": "अभी कोई ट्रक सेव नहीं है",
  "Staff add vehicles here.": "स्टाफ़ यहाँ गाड़ियाँ जोड़ते हैं।",
  "Add a truck number below (its WheelsEye link is optional).": "नीचे ट्रक नंबर जोड़ें (उसका WheelsEye लिंक ज़रूरी नहीं)।",
  "You can't add or change vehicles.": "आप गाड़ियाँ जोड़ या बदल नहीं सकते।",
  "View-only access": "केवल देखने की अनुमति",
  "Orders already saved keep the vehicle number they were entered with.": "पहले से सेव ऑर्डर में वही गाड़ी नंबर रहेगा जिससे वे दर्ज हुए थे।",
  "Self is built in. It doesn't need saving.": "Self पहले से बनी है। इसे सेव करने की ज़रूरत नहीं।",
  "Paste the full tracking link, starting with https://": "पूरा ट्रैकिंग लिंक पेस्ट करें, जो https:// से शुरू होता है",
  "The valid-until date can't be in the past.": "\"कब तक\" की तारीख बीती हुई नहीं हो सकती।",
  "Check the truck, or tap Save vehicle again to save it anyway.": "ट्रक जाँचें, या फिर भी सेव करने के लिए \"गाड़ी सेव करें\" दोबारा टैप करें।",
  "Team & roles": "टीम और रोल",
  "Only emails listed here can sign in. Role changes apply immediately.": "केवल यहाँ लिखे ईमेल से साइन इन हो सकता है। रोल का बदलाव तुरंत लागू होता है।",
  "Maintenance": "मेंटेनेंस",
  "Pause the dashboard for everyone except you, for example while you upload an update. Staff see an \"under maintenance\" message and can't make changes until you switch it off; their screens come back by themselves.": "अपने अलावा सभी के लिए डैशबोर्ड रोकें, जैसे अपडेट अपलोड करते समय। स्टाफ़ को \"मेंटेनेंस चल रहा है\" संदेश दिखेगा और जब तक आप इसे बंद नहीं करते, वे बदलाव नहीं कर सकेंगे; उनकी स्क्रीन अपने-आप वापस आ जाएगी।",
  "Pause the dashboard for staff": "स्टाफ़ के लिए डैशबोर्ड रोकें",
  "Open.": "चालू।",
  "Paused.": "रुका हुआ।",
  "Everyone can use the dashboard as usual.": "सभी डैशबोर्ड हमेशा की तरह इस्तेमाल कर सकते हैं।",
  "Staff see the maintenance message and can't make changes.": "स्टाफ़ को मेंटेनेंस का संदेश दिखता है और वे बदलाव नहीं कर सकते।",
  "Dashboard open again for everyone.": "डैशबोर्ड सभी के लिए फिर खुल गया।",
  "Dashboard paused for staff. Switch it off when you're done.": "स्टाफ़ के लिए डैशबोर्ड रुका है। काम पूरा होने पर इसे बंद कर दें।",
  "Message to staff (optional)": "स्टाफ़ के लिए संदेश (ज़रूरी नहीं)",
  "Who can do what": "कौन क्या कर सकता है",
  "Admin": "एडमिन",
  "admin": "एडमिन",
  "Supervisor": "सुपरवाइज़र",
  "DMO": "DMO",
  "Viewer": "व्यूअर",
  "Dispatch": "डिस्पैच",
  "Admin only": "केवल एडमिन",
  "Everything, including this Team & emails page, changing order times, changing dispatched orders, deleting orders, renaming and removing dealers, removing vehicles, and the master file.": "सब कुछ, जिसमें यह \"टीम और ईमेल\" पेज, ऑर्डर के समय बदलना, डिस्पैच हुए ऑर्डर बदलना, ऑर्डर मिटाना, डीलर का नाम बदलना और हटाना, गाड़ियाँ हटाना और मास्टर फ़ाइल शामिल हैं।",
  "Add, change and cancel any order that isn't dispatched; hold, reschedule, mark dispatched, correct dispatch times and undo; add dealers and edit their contact details; add vehicles and tracking links.": "डिस्पैच न हुआ कोई भी ऑर्डर जोड़ना, बदलना और रद्द करना; होल्ड, तारीख बदलना, डिस्पैच करना, डिस्पैच समय सुधारना और वापस लेना; डीलर जोड़ना और उनका संपर्क बदलना; गाड़ियाँ और ट्रैकिंग लिंक जोड़ना।",
  "The same rights as a Supervisor.": "सुपरवाइज़र जैसे ही सभी अधिकार।",
  "Add orders; change only their own orders from today; cancel, hold or reschedule any order that isn't dispatched; mark dispatched and undo; edit dealers' contact details; add vehicles and tracking links.": "ऑर्डर जोड़ना; केवल आज के अपने ऑर्डर बदलना; डिस्पैच न हुए किसी भी ऑर्डर को रद्द करना, होल्ड पर रखना या तारीख बदलना; डिस्पैच करना और वापस लेना; डीलर का संपर्क बदलना; गाड़ियाँ और ट्रैकिंग लिंक जोड़ना।",
  "Sees the queue, orders and summaries and can download Excel. Can't open order details, see vehicles, or change anything.": "कतार, ऑर्डर और सारांश देख सकता है और एक्सेल डाउनलोड कर सकता है। ऑर्डर की पूरी जानकारी नहीं खोल सकता, गाड़ियाँ नहीं देख सकता, कुछ बदल नहीं सकता।",
  "These are the usual rights. The Admin can switch some of them off (or the Excel time columns on) under Staff permissions above. They are enforced by the database security rules, not just hidden on screen.": "ये सामान्य अधिकार हैं। एडमिन ऊपर \"स्टाफ़ की अनुमतियाँ\" में इनमें से कुछ बंद (या एक्सेल के समय वाले कॉलम चालू) कर सकता है। इन्हें डेटाबेस के सुरक्षा नियम लागू करते हैं, ये सिर्फ़ स्क्रीन से छिपाए नहीं जाते।",
  "Email (login ID)": "ईमेल (लॉगिन ID)",
  "Role": "रोल",
  "Device": "डिवाइस",
  "You": "आप",
  "Sign out device": "डिवाइस से साइन आउट करें",
  "Tap again to sign out": "साइन आउट के लिए फिर टैप करें",
  "Not signed in yet": "अभी साइन इन नहीं किया",
  "Email": "ईमेल",
  "Add person": "व्यक्ति जोड़ें",
  "e.g. Ramesh (office)": "जैसे रमेश (ऑफ़िस)",
  "name@gmail.com": "name@gmail.com",
  "That email is already on the team.": "यह ईमेल पहले से टीम में है।",
  "Removed. They can no longer sign in.": "हटा दिया। अब वे साइन इन नहीं कर सकते।",
  "Signed out. They can sign in again on one device.": "साइन आउट हो गया। वे एक डिवाइस पर फिर साइन इन कर सकते हैं।",
  "Android phone": "Android फ़ोन",
  "Android tablet": "Android टैबलेट",
  "Staff permissions": "स्टाफ़ की अनुमतियाँ",
  "Tick a box to allow it, untick to stop it. It applies to everyone with that designation straight away, and the line under each box says what's allowed right now. The Admin can always do everything.": "अनुमति देने के लिए बॉक्स पर टिक करें, रोकने के लिए टिक हटाएँ। यह उस पद के सभी लोगों पर तुरंत लागू होता है, और हर बॉक्स के नीचे की लाइन बताती है कि अभी क्या अनुमति है। एडमिन हमेशा सब कुछ कर सकता है।",
  "Dispatch staff": "डिस्पैच स्टाफ़",
  "Mark orders dispatched, and undo": "ऑर्डर डिस्पैच करना, और वापस लेना",
  "Allowed.": "अनुमति है।",
  "Not allowed.": "अनुमति नहीं है।",
  "Dispatch staff can mark orders dispatched.": "डिस्पैच स्टाफ़ ऑर्डर डिस्पैच कर सकते हैं।",
  "Dispatch staff can't mark orders dispatched. Only a Supervisor or the Admin can.": "डिस्पैच स्टाफ़ ऑर्डर डिस्पैच नहीं कर सकते। केवल सुपरवाइज़र या एडमिन कर सकते हैं।",
  "Cancel any order not yet dispatched": "डिस्पैच न हुआ कोई भी ऑर्डर रद्द करना",
  "Dispatch staff can cancel any order that hasn't been dispatched.": "डिस्पैच स्टाफ़ डिस्पैच न हुआ कोई भी ऑर्डर रद्द कर सकते हैं।",
  "Dispatch staff can cancel only orders they entered themselves today. Anything else needs a Supervisor or the Admin.": "डिस्पैच स्टाफ़ केवल आज अपने दर्ज किए ऑर्डर रद्द कर सकते हैं। बाकी के लिए सुपरवाइज़र या एडमिन चाहिए।",
  "Put on hold, release, change date and send today": "होल्ड पर रखना, छोड़ना, तारीख बदलना और आज भेजना",
  "Dispatch staff can do all four.": "डिस्पैच स्टाफ़ ये चारों कर सकते हैं।",
  "Dispatch staff can't do these. Only a Supervisor or the Admin can.": "डिस्पैच स्टाफ़ ये नहीं कर सकते। केवल सुपरवाइज़र या एडमिन कर सकते हैं।",
  "Supervisor and DMO": "सुपरवाइज़र और DMO",
  "Correct the dispatch time of a dispatched order": "डिस्पैच हुए ऑर्डर का डिस्पैच समय सुधारना",
  "Supervisors and DMOs can fix a wrong dispatch time.": "सुपरवाइज़र और DMO गलत डिस्पैच समय ठीक कर सकते हैं।",
  "Supervisors and DMOs can't fix it. Only the Admin can.": "सुपरवाइज़र और DMO इसे ठीक नहीं कर सकते। केवल एडमिन कर सकता है।",
  "Add dealers": "डीलर जोड़ना",
  "Supervisors and DMOs can add new dealers.": "सुपरवाइज़र और DMO नए डीलर जोड़ सकते हैं।",
  "Supervisors and DMOs can't add dealers. Only the Admin can.": "सुपरवाइज़र और DMO डीलर नहीं जोड़ सकते। केवल एडमिन जोड़ सकता है।",
  "Supervisor, DMO and Dispatch staff": "सुपरवाइज़र, DMO और डिस्पैच स्टाफ़",
  "Edit a dealer's contact person, phone and area": "डीलर का संपर्क व्यक्ति, फ़ोन और क्षेत्र बदलना",
  "Supervisors, DMOs and Dispatch staff can edit these. Renaming a dealer stays with the Admin.": "सुपरवाइज़र, DMO और डिस्पैच स्टाफ़ इन्हें बदल सकते हैं। डीलर का नाम बदलना एडमिन के पास ही रहेगा।",
  "Supervisors, DMOs and Dispatch staff can't edit dealer details. Only the Admin can.": "सुपरवाइज़र, DMO और डिस्पैच स्टाफ़ डीलर की जानकारी नहीं बदल सकते। केवल एडमिन बदल सकता है।",
  "Add vehicles and paste tracking links": "गाड़ियाँ जोड़ना और ट्रैकिंग लिंक पेस्ट करना",
  "Supervisors, DMOs and Dispatch staff can add trucks and tracking links.": "सुपरवाइज़र, DMO और डिस्पैच स्टाफ़ ट्रक और ट्रैकिंग लिंक जोड़ सकते हैं।",
  "Supervisors, DMOs and Dispatch staff can't add trucks or links. Only the Admin can.": "सुपरवाइज़र, DMO और डिस्पैच स्टाफ़ ट्रक या लिंक नहीं जोड़ सकते। केवल एडमिन जोड़ सकता है।",
  "Time-taken columns in their Excel downloads": "उनकी एक्सेल फ़ाइलों में लगे समय वाले कॉलम",
  "Their Excel files show how long each order took.": "उनकी एक्सेल फ़ाइलों में दिखता है कि हर ऑर्डर में कितना समय लगा।",
  "Their Excel files leave out time taken. Only the Admin's files show it.": "उनकी एक्सेल फ़ाइलों में लगा समय नहीं होता। यह केवल एडमिन की फ़ाइलों में दिखता है।",
  "Report emails": "रिपोर्ट ईमेल",
  "Choose who gets each email and when. Changes apply straight away. Emails usually arrive 5 to 10 minutes after the set time, sometimes later when GitHub is busy.": "चुनें कि कौन-सा ईमेल किसे और कब मिले। बदलाव तुरंत लागू होते हैं। ईमेल आम तौर पर तय समय के 5 से 10 मिनट बाद आते हैं, GitHub व्यस्त हो तो कभी-कभी और देर से।",
  "Daily contact list": "दैनिक संपर्क सूची",
  "Dealer, party, phone and location of every order since the 1st of the month (DHS_Contacts_YYYY-MM.xlsx). Each day's file has everything so far; it starts afresh on the 1st.": "महीने की 1 तारीख से अब तक के हर ऑर्डर का डीलर, पार्टी, फ़ोन और जगह (DHS_Contacts_YYYY-MM.xlsx)। हर दिन की फ़ाइल में अब तक का सब कुछ होता है; 1 तारीख को यह नए सिरे से शुरू होती है।",
  "Send": "भेजें",
  "Day": "दिन",
  "Every day": "हर दिन",
  "Time (India)": "समय (भारत)",
  "Add at least one email address to start sending.": "भेजना शुरू करने के लिए कम से कम एक ईमेल पता जोड़ें।",
  "Switched off. Nothing will be sent.": "बंद है। कुछ नहीं भेजा जाएगा।",
  "No one on this list yet": "इस सूची में अभी कोई नहीं",
  "Add an email address below.": "नीचे ईमेल पता जोड़ें।",
  "Add": "जोड़ें",
  "Not sent yet": "अभी नहीं भेजा",
  "Weekly report": "साप्ताहिक रिपोर्ट",
  "The orders since the last weekly report, as Excel (without the time-taken columns).": "पिछली साप्ताहिक रिपोर्ट के बाद के ऑर्डर, एक्सेल में (लगे समय वाले कॉलम के बिना)।",
  "Monthly master file": "मासिक मास्टर फ़ाइल",
  "Every order of the previous month (DHS_Master_YYYY-MM.xlsx), the copy for your master folder.": "पिछले महीने के सभी ऑर्डर (DHS_Master_YYYY-MM.xlsx), आपके मास्टर फ़ोल्डर के लिए कॉपी।",
  "Day of the month": "महीने की तारीख",
  "Email address for the daily email": "दैनिक ईमेल के लिए ईमेल पता",
  "Email address for the weekly email": "साप्ताहिक ईमेल के लिए ईमेल पता",
  "Email address for the monthly email": "मासिक ईमेल के लिए ईमेल पता",
  "That email is already on the list.": "यह ईमेल पहले से सूची में है।",
  "A list can hold up to 20 addresses.": "एक सूची में ज़्यादा से ज़्यादा 20 पते हो सकते हैं।",
  "The last report email check failed.": "पिछली रिपोर्ट ईमेल जाँच विफल रही।",
  "It tries again every 30 minutes. If this note stays, see \"Report emails\" in the README.": "यह हर 30 मिनट में फिर कोशिश करता है। अगर यह नोट बना रहे, तो README में \"Report emails\" देखें।",
  "Report emails have stopped.": "रिपोर्ट ईमेल बंद हो गए हैं।",
  "Monday": "सोमवार",
  "Tuesday": "मंगलवार",
  "Wednesday": "बुधवार",
  "Thursday": "गुरुवार",
  "Friday": "शुक्रवार",
  "Saturday": "शनिवार",
  "Sunday": "रविवार",
  "Mondays": "सोमवार",
  "Tuesdays": "मंगलवार",
  "Wednesdays": "बुधवार",
  "Thursdays": "गुरुवार",
  "Fridays": "शुक्रवार",
  "Saturdays": "शनिवार",
  "Sundays": "रविवार",
  "Master file ready": "मास्टर फ़ाइल तैयार",
  "Checking access…": "अनुमति जाँची जा रही है…",
  "Back to the dashboard": "डैशबोर्ड पर वापस",
  "Depot Stock Ledger": "डिपो स्टॉक लेजर",
  "Dashboard": "डैशबोर्ड",
  "New Entry": "नई एंट्री",
  "Depot Status": "डिपो की स्थिति",
  "Dealer Stock": "डीलर स्टॉक",
  "Opening Balance": "शुरुआती बैलेंस",
  "Get Report": "रिपोर्ट लें",
  "Who can open this ledger": "यह लेजर कौन खोल सकता है",
  "Only the people ticked here, and the Admin, can open this page or read its figures; the database refuses everyone else. Nobody else sees the way in. Of those ticked, Supervisors and DMOs can make changes; everyone else can only view.": "केवल यहाँ टिक किए गए लोग और एडमिन यह पेज खोल सकते हैं या इसके आँकड़े पढ़ सकते हैं; बाकी सबको डेटाबेस मना कर देता है। किसी और को इसका रास्ता दिखता ही नहीं। टिक किए गए लोगों में सुपरवाइज़र और DMO बदलाव कर सकते हैं; बाकी केवल देख सकते हैं।",
  "Bring over the old ledger (one time)": "पुराना लेजर लाएँ (एक बार)",
  "Choose the file": "फ़ाइल चुनें",
  "that Claude gave you. It copies the opening balances, the SAP and physical stock reports and the entries from the claude.ai ledger into this one. Records with the same date and depot are replaced, so choosing it twice does no harm.": "जो Claude ने आपको दी थी। यह claude.ai लेजर से शुरुआती बैलेंस, SAP और फ़िज़िकल स्टॉक रिपोर्ट और एंट्री इस लेजर में कॉपी करता है। एक ही तारीख और डिपो के रिकॉर्ड बदल दिए जाते हैं, इसलिए इसे दो बार चुनने से कोई नुकसान नहीं।",
  "The ledger hasn't been started yet. On Opening Balance, save the day's SAP opening stock of all three depots (with physical stock) and press Start the ledger. Then enter the dealers' balances of that day on Dealer Stock.": "लेजर अभी शुरू नहीं हुआ है। शुरुआती बैलेंस में उस दिन का तीनों डिपो का SAP शुरुआती स्टॉक (फ़िज़िकल स्टॉक के साथ) सेव करें और \"लेजर शुरू करें\" दबाएँ। फिर डीलर स्टॉक में उस दिन के डीलरों के बैलेंस भरें।",
  "Go to Opening Balance": "शुरुआती बैलेंस पर जाएँ",
  "Access": "अनुमति",
  "Sections": "हिस्से",
  "Ledger export file": "लेजर एक्सपोर्ट फ़ाइल",
  "Loading the team…": "टीम लोड हो रही है…",
  "Couldn't load the team. Reload and try again.": "टीम लोड नहीं हो सकी। रीलोड करके फिर कोशिश करें।",
  "No one on the team yet.": "टीम में अभी कोई नहीं।",
  "always allowed": "हमेशा अनुमति",
  "can make changes": "बदलाव कर सकते हैं",
  "view only": "केवल देखना",
  "Reading the file…": "फ़ाइल पढ़ी जा रही है…",
  "That file isn't a ledger export.": "यह फ़ाइल लेजर एक्सपोर्ट नहीं है।",
  "The ledger has already closed a month, so the one-time import can't be used any more.": "लेजर एक महीना बंद कर चुका है, इसलिए एक बार वाला इम्पोर्ट अब इस्तेमाल नहीं हो सकता।",
  "Not connected. Reload the page.": "कनेक्ट नहीं है। पेज रीलोड करें।",
  "Couldn't connect to the database. Check your connection and reload the page.": "डेटाबेस से नहीं जुड़ सके। कनेक्शन जाँचें और पेज रीलोड करें।",
  "Check your internet connection and reload the page.": "इंटरनेट कनेक्शन जाँचें और पेज रीलोड करें।",
  "Your access to this page has ended. Open it again from the dashboard.": "इस पेज की आपकी अनुमति खत्म हो गई है। डैशबोर्ड से इसे फिर खोलें।",
  "Your sign-in has ended on this device.": "इस डिवाइस पर आपका साइन-इन खत्म हो गया है।",
  "Sign in on the dashboard again, then come back here.": "डैशबोर्ड पर फिर साइन इन करें, फिर यहाँ लौटें।",
  "Sign in on the dashboard first.": "पहले डैशबोर्ड पर साइन इन करें।",
  "Then come back here from the dashboard.": "फिर डैशबोर्ड से यहाँ लौटें।",
  "This page isn't available.": "यह पेज उपलब्ध नहीं है।",
  "You can view this ledger. Only the Admin, Supervisors and DMOs can make changes.": "आप यह लेजर देख सकते हैं। बदलाव केवल एडमिन, सुपरवाइज़र और DMO कर सकते हैं।",
  "You can view this ledger but not make changes. Only the Admin, Supervisors and DMOs can.": "आप यह लेजर देख सकते हैं पर बदलाव नहीं कर सकते। बदलाव केवल एडमिन, सुपरवाइज़र और DMO कर सकते हैं।",
  "You can view this ledger but not enter reports. Ask the owner for Contributor access.": "आप यह लेजर देख सकते हैं पर रिपोर्ट नहीं भर सकते। मालिक से Contributor अनुमति माँगें।",
  "Ledger": "लेजर",
  "LEDGER": "लेजर",
  "Loading": "लोड हो रहा है",
  "New entry": "नई एंट्री",
  "Punch in what happened at a depot. Depot Status and Dealer Stock update by themselves.": "डिपो पर जो हुआ वह दर्ज करें। डिपो की स्थिति और डीलर स्टॉक अपने-आप अपडेट हो जाते हैं।",
  "What happened?": "क्या हुआ?",
  "Billing": "बिलिंग",
  "Invoice raised in SAP": "SAP में इनवॉइस बना",
  "Lifted from the godown": "गोदाम से उठा",
  "Arrival": "आवक",
  "Trailer arrival": "ट्रेलर आवक",
  "Correction": "सुधार",
  "Fix a balance": "बैलेंस ठीक करें",
  "Invoice raised in SAP. SAP stock goes down; dealer balance goes up (advance).": "SAP में इनवॉइस बना। SAP स्टॉक घटता है; डीलर बैलेंस बढ़ता है (एडवांस)।",
  "Material lifted from the godown. Physical stock goes down; dealer balance goes down (pendency). Orders marked dispatched on the dashboard are entered here by themselves: use this only for a dispatch that has no dashboard order.": "गोदाम से माल उठा। फ़िज़िकल स्टॉक घटता है; डीलर बैलेंस घटता है (पेंडेंसी)। डैशबोर्ड पर डिस्पैच किए गए ऑर्डर यहाँ अपने-आप दर्ज होते हैं: इसे केवल उस डिस्पैच के लिए इस्तेमाल करें जिसका कोई डैशबोर्ड ऑर्डर नहीं है।",
  "Trailer received. Adds to both SAP and physical stock.": "ट्रेलर आया। SAP और फ़िज़िकल दोनों स्टॉक में जुड़ता है।",
  "Trailer received": "ट्रेलर आया",
  "Fix a balance after checking. Use + or − to add or remove. The depot decides which dealer sheet a dealer correction goes to. A reason is needed; the Admin sees every correction with its reason.": "जाँच के बाद बैलेंस ठीक करें। जोड़ने या घटाने के लिए + या − लगाएँ। डिपो से तय होता है कि डीलर का सुधार किस डीलर शीट में जाएगा। कारण ज़रूरी है; एडमिन हर सुधार उसके कारण के साथ देखता है।",
  "Details": "विवरण",
  "Correct": "क्या ठीक करें",
  "Dealer balance": "डीलर बैलेंस",
  "SAP stock": "SAP स्टॉक",
  "Physical stock": "फ़िज़िकल स्टॉक",
  "Invoice / vehicle no. (optional)": "इनवॉइस / गाड़ी नंबर (ज़रूरी नहीं)",
  "Invoice / vehicle no.": "इनवॉइस / गाड़ी नंबर",
  "Reason for the correction": "सुधार का कारण",
  "e.g. 10 torn bags found in the count": "जैसे गिनती में 10 फटे बैग मिले",
  "Quantity": "मात्रा",
  "Type bags or MT. The other fills in.": "बैग या MT लिखें। दूसरा अपने-आप भर जाएगा।",
  "Type bags or MT, with − to remove. The other fills in.": "बैग या MT लिखें, घटाने के लिए − लगाएँ। दूसरा अपने-आप भर जाएगा।",
  "TOTAL": "कुल",
  "no dealer yet": "अभी डीलर नहीं",
  "no quantity yet": "अभी मात्रा नहीं",
  "Clear": "साफ़ करें",
  "Save billing": "बिलिंग सेव करें",
  "Save dispatch": "डिस्पैच सेव करें",
  "Save arrival": "आवक सेव करें",
  "Save correction": "सुधार सेव करें",
  "Entry type": "एंट्री का टाइप",
  "Start typing a dealer name": "डीलर का नाम लिखना शुरू करें",
  "New dealer": "नया डीलर",
  "Pick a date.": "तारीख चुनें।",
  "Enter bags or MT for at least one product.": "कम से कम एक प्रोडक्ट के बैग या MT भरें।",
  "Quantities can't be negative here. Use a Correction to reduce a balance.": "यहाँ मात्रा माइनस नहीं हो सकती। बैलेंस घटाने के लिए सुधार इस्तेमाल करें।",
  "Write the reason for this correction. The Admin sees every correction with its reason.": "इस सुधार का कारण लिखें। एडमिन हर सुधार उसके कारण के साथ देखता है।",
  "Couldn't save. Try again.": "सेव नहीं हो सका। फिर कोशिश करें।",
  "Couldn't save. Only the Admin can change this. Check your connection and try again.": "सेव नहीं हो सका। इसे केवल एडमिन बदल सकता है। कनेक्शन जाँचें और फिर कोशिश करें।",
  "Couldn't save. Only the Admin can change this.": "सेव नहीं हो सका। इसे केवल एडमिन बदल सकता है।",
  "The ledger hasn't been set up yet. An admin needs to enter the starting balances in Ledger setup first.": "लेजर अभी सेट नहीं हुआ है। पहले किसी एडमिन को लेजर सेटअप में शुरुआती बैलेंस भरने होंगे।",
  "The ledger has to be started on Opening Balance first.": "पहले शुरुआती बैलेंस में लेजर शुरू करना होगा।",
  "The ledger hasn't been started yet. An admin needs to start it from Opening Balance.": "लेजर अभी शुरू नहीं हुआ है। किसी एडमिन को इसे शुरुआती बैलेंस से शुरू करना होगा।",
  "Already in the ledger from a dashboard order": "डैशबोर्ड ऑर्डर से पहले ही लेजर में है",
  "Press Save anyway only if this is a second, separate dispatch.": "\"फिर भी सेव करें\" तभी दबाएँ जब यह दूसरा, अलग डिस्पैच हो।",
  "Bill pending material first if you can. Press Save anyway only if this stock is really arriving.": "हो सके तो पहले बाकी माल की बिलिंग करें। \"फिर भी सेव करें\" तभी दबाएँ जब यह स्टॉक सच में आ रहा हो।",
  "You can still save. The difference will show as unreconciled on Depot Status until it is corrected.": "आप फिर भी सेव कर सकते हैं। सुधार होने तक यह अंतर डिपो की स्थिति में बिना मिलान के रूप में दिखेगा।",
  "Depot status": "डिपो की स्थिति",
  "As of": "तारीख",
  "Depots": "डिपो",
  "SAP stock against what each godown can hold. Above capacity means stock on paper that can't physically be there.": "SAP स्टॉक बनाम हर गोदाम की क्षमता। क्षमता से ज़्यादा का मतलब है कागज़ पर ऐसा स्टॉक जो असल में वहाँ हो ही नहीं सकता।",
  "Set capacity": "क्षमता तय करें",
  "Only admins can change these. Type MT or bags; the other fills in.": "इन्हें केवल एडमिन बदल सकते हैं। MT या बैग लिखें; दूसरा अपने-आप भर जाएगा।",
  "Warn from (% full)": "चेतावनी कब से (% भरा)",
  "Save capacity": "क्षमता सेव करें",
  "Godown stock": "गोदाम स्टॉक",
  "GODOWN STOCK": "गोदाम स्टॉक",
  "Copy for WhatsApp": "WhatsApp के लिए कॉपी करें",
  "Copied. Paste it into WhatsApp.": "कॉपी हो गया। इसे WhatsApp में पेस्ट करें।",
  "Text selected below. Copy it from there.": "टेक्स्ट नीचे चुना गया है। वहाँ से कॉपी करें।",
  "Orders vs ledger": "ऑर्डर बनाम लेजर",
  "Each day this month, by depot: bags dispatched in dashboard orders against bags dispatched in this ledger. Any gap shows in red. Only the Admin sees this.": "इस महीने हर दिन, डिपो के अनुसार: डैशबोर्ड ऑर्डर में डिस्पैच हुए बैग बनाम इस लेजर में डिस्पैच हुए बैग। कोई भी अंतर लाल रंग में दिखता है। यह केवल एडमिन देखता है।",
  "Show every day": "हर दिन दिखाएँ",
  "Show gaps only": "केवल अंतर दिखाएँ",
  "Fix from orders": "ऑर्डर से ठीक करें",
  "Tap again to fix": "ठीक करने के लिए फिर टैप करें",
  "A dispatch typed in the ledger by hand shows here as a gap, and so does an order whose ledger line didn't save. Fix from orders adds missing order lines; check the hand-typed ones.": "लेजर में हाथ से लिखा डिस्पैच यहाँ अंतर के रूप में दिखता है, और वह ऑर्डर भी जिसकी लेजर लाइन सेव नहीं हुई। \"ऑर्डर से ठीक करें\" छूटी हुई ऑर्डर लाइनें जोड़ता है; हाथ से लिखी लाइनें खुद जाँचें।",
  "The link with dashboard orders starts when the Admin first opens the new dashboard. This check starts then.": "डैशबोर्ड ऑर्डर से जुड़ाव तब शुरू होता है जब एडमिन पहली बार नया डैशबोर्ड खोलता है। यह जाँच भी तभी से शुरू होती है।",
  "Every depot-day this month: bags dispatched in orders = bags dispatched in the ledger.": "इस महीने हर डिपो-दिन: ऑर्डर में डिस्पैच हुए बैग = लेजर में डिस्पैच हुए बैग।",
  "No dispatches this month yet.": "इस महीने अभी कोई डिस्पैच नहीं।",
  "No dispatches yet": "अभी कोई डिस्पैच नहीं",
  "ORDERS AND LEDGER MATCH ✓": "ऑर्डर और लेजर मेल खाते हैं ✓",
  "Ledger from orders": "ऑर्डर से लेजर",
  "Ledger by hand": "हाथ से लेजर",
  "Gap": "अंतर",
  "DATE": "तारीख",
  "Capacity": "क्षमता",
  "Room left in SAP": "SAP में बची जगह",
  "Over by": "इतना ज़्यादा",
  "Capacity not set": "क्षमता तय नहीं",
  "Not set": "तय नहीं",
  "Press Set capacity": "\"क्षमता तय करें\" दबाएँ",
  "Admin to set": "एडमिन तय करेगा",
  "Over capacity": "क्षमता से ज़्यादा",
  "Near capacity": "क्षमता के करीब",
  "Near limit": "सीमा के करीब",
  "Capacity saved": "क्षमता सेव हुई",
  "Capacity can't be negative.": "क्षमता माइनस नहीं हो सकती।",
  "Warn level must be between 50% and 100%.": "चेतावनी का स्तर 50% से 100% के बीच होना चाहिए।",
  "Only an admin can change capacity.": "क्षमता केवल एडमिन बदल सकता है।",
  "NOT RECONCILED": "मिलान नहीं हुआ",
  "ALL RECONCILED": "सब मिलान हो गया",
  "TRANSPORT NAGAR": "ट्रांसपोर्ट नगर",
  "HARRAWALA": "हर्रावाला",
  "DOIWALA": "डोईवाला",
  "STOCK": "स्टॉक",
  "STOCK DEHRADUN TPN": "स्टॉक देहरादून TPN",
  "SAP IN MT": "SAP (MT में)",
  "SAP MT": "SAP MT",
  "SAP IN BAGS": "SAP (बैग में)",
  "SAP BAGS": "SAP बैग",
  "PHYSICAL STOCK IN MT": "फ़िज़िकल स्टॉक (MT में)",
  "PHY MT": "फ़िज़ि. MT",
  "PHYSICAL STOCK IN BAGS": "फ़िज़िकल स्टॉक (बैग में)",
  "PHY BAGS": "फ़िज़ि. बैग",
  "TOTAL DIFFERENCE PHY. STOCK IN MT": "फ़िज़ि. स्टॉक में कुल अंतर (MT में)",
  "DIFF MT": "अंतर MT",
  "TOTAL DIFFERENCE PHY. STOCK IN BAGS": "फ़िज़ि. स्टॉक में कुल अंतर (बैग में)",
  "DIFF BAGS": "अंतर बैग",
  "TOTAL OF COMBINE STOCK IN BAGS": "संयुक्त स्टॉक का कुल (बैग में)",
  "TP+H DIFF BAGS": "TP+H अंतर बैग",
  "TOTAL OF COMBINE STOCK IN MT": "संयुक्त स्टॉक का कुल (MT में)",
  "TP+H DIFF MT": "TP+H अंतर MT",
  "TOTAL OF ALL 3 DEPOTS IN BAGS": "तीनों डिपो का कुल (बैग में)",
  "ALL 3 DIFF BAGS": "तीनों का अंतर बैग",
  "TOTAL OF ALL 3 DEPOTS IN MT": "तीनों डिपो का कुल (MT में)",
  "ALL 3 DIFF MT": "तीनों का अंतर MT",
  "DEALER BALANCE IN BAGS": "डीलर बैलेंस (बैग में)",
  "DEALER BAGS": "डीलर बैग",
  "DEALER BALANCE IN MT": "डीलर बैलेंस (MT में)",
  "DEALER MT": "डीलर MT",
  "UNRECONCILED IN BAGS": "बिना मिलान (बैग में)",
  "UNREC. BAGS": "बिना मिलान बैग",
  "UNRECONCILED IN MT": "बिना मिलान (MT में)",
  "UNREC. MT": "बिना मिलान MT",
  "DEALER BALANCES MATCH THE STOCK ✓": "डीलर बैलेंस स्टॉक से मेल खाते हैं ✓",
  "DEALER BALANCES DON'T MATCH THE STOCK": "डीलर बैलेंस स्टॉक से मेल नहीं खाते",
  "TOTAL SAP": "कुल SAP",
  "Depot stock": "डिपो स्टॉक",
  "Dealer stock": "डीलर स्टॉक",
  "Dealer sheet": "डीलर शीट",
  "Pendency": "पेंडेंसी",
  "Advance": "एडवांस",
  "Net": "नेट",
  "TP+Harrawala": "TP+हर्रावाला",
  "Opening dealer balances": "डीलरों के शुरुआती बैलेंस",
  "Dashboard names": "डैशबोर्ड के नाम",
  "Sheet": "शीट",
  "List": "सूची",
  "Show dealers with zero balance": "शून्य बैलेंस वाले डीलर दिखाएँ",
  "Back": "वापस",
  "Type in": "हाथ से लिखें",
  "Paste from your Excel dealer sheet": "अपनी एक्सेल डीलर शीट से पेस्ट करें",
  "Add pasted rows": "पेस्ट की गई लाइनें जोड़ें",
  "Sheet total": "शीट का कुल",
  "No changes yet": "अभी कोई बदलाव नहीं",
  "Save dealer balances": "डीलर बैलेंस सेव करें",
  "Pasted dealer rows": "पेस्ट की गई डीलर लाइनें",
  "Dealer or invoice no.": "डीलर या इनवॉइस नंबर",
  "View as": "इस रूप में देखें",
  "Show": "दिखाएँ",
  "DEALERS": "डीलर",
  "Pair names": "नाम मिलाएँ",
  "Dashboard dealer names": "डैशबोर्ड के डीलर नाम",
  "Has dispatches on this ledger": "इस लेजर में डिस्पैच हैं",
  "Save names": "नाम सेव करें",
  "Dealer names saved": "डीलर नाम सेव हुए",
  "Every dashboard dealer name matches a dealer on this ledger. Nothing to pair.": "डैशबोर्ड का हर डीलर नाम इस लेजर के किसी डीलर से मेल खाता है। मिलाने को कुछ नहीं।",
  "The Admin can pair them.": "एडमिन इन्हें मिला सकता है।",
  "For each name below, pick the dealer it is on this ledger, or keep it as a dealer of its own. You do this once; new dealers show up here when they are first dispatched.": "नीचे हर नाम के लिए चुनें कि इस लेजर में वह कौन-सा डीलर है, या उसे अलग डीलर ही रहने दें। यह एक बार करना है; नए डीलर पहली बार डिस्पैच होने पर यहाँ दिखेंगे।",
  "Loading the dashboard's dealer list…": "डैशबोर्ड की डीलर सूची लोड हो रही है…",
  "Couldn't load the dashboard's dealers. Check your connection and try again.": "डैशबोर्ड के डीलर लोड नहीं हो सके। कनेक्शन जाँचें और फिर कोशिश करें।",
  "Loading balances…": "बैलेंस लोड हो रहे हैं…",
  "No balances yet.": "अभी कोई बैलेंस नहीं।",
  "No dealer rows found.": "कोई डीलर लाइन नहीं मिली।",
  "No dealers in this sheet yet. Paste them from Excel or add them one by one.": "इस शीट में अभी कोई डीलर नहीं। एक्सेल से पेस्ट करें या एक-एक करके जोड़ें।",
  "Not saved yet. Dealer Stock still shows the saved balances until you press Save.": "अभी सेव नहीं हुआ। जब तक आप सेव नहीं दबाते, डीलर स्टॉक में पुराने सेव बैलेंस ही दिखेंगे।",
  "You have unsaved dealer balances. Save them, or tap Discard again to throw them away.": "आपके कुछ डीलर बैलेंस सेव नहीं हुए हैं। उन्हें सेव करें, या छोड़ने के लिए \"छोड़ें\" फिर टैप करें।",
  "Only an admin can change the opening dealer balances.": "डीलरों के शुरुआती बैलेंस केवल एडमिन बदल सकता है।",
  "Tap again to remove": "हटाने के लिए फिर टैप करें",
  "Tap again to discard": "छोड़ने के लिए फिर टैप करें",
  "Discard": "छोड़ें",
  "Keep": "रखें",
  "Saving…": "सेव हो रहा है…",
  "Saved": "सेव हुआ",
  "Not saved.": "सेव नहीं हुआ।",
  "Skipped": "छोड़ा गया",
  "Added": "जोड़ा गया",
  "Updated": "अपडेट हुआ",
  "Opening balance": "शुरुआती बैलेंस",
  "Opening balances": "शुरुआती बैलेंस",
  "Every morning, enter each depot's opening stock from the SAP report. The ledger checks it against its own figures.": "हर सुबह SAP रिपोर्ट से हर डिपो का शुरुआती स्टॉक भरें। लेजर इसे अपने आँकड़ों से मिलाता है।",
  "SAP report date": "SAP रिपोर्ट की तारीख",
  "Physical": "फ़िज़िकल",
  "Physical MT": "फ़िज़िकल MT",
  "Physical bags": "फ़िज़िकल बैग",
  "SAP bags": "SAP बैग",
  "Total MT": "कुल MT",
  "Physical is optional: fill it in when you have the godown count. It is needed on the ledger's start day.": "फ़िज़िकल ज़रूरी नहीं: गोदाम की गिनती हो जाने पर भरें। लेजर के शुरुआती दिन पर यह ज़रूरी है।",
  "Save opening balance": "शुरुआती बैलेंस सेव करें",
  "Update opening balance": "शुरुआती बैलेंस अपडेट करें",
  "Saved. Change any figure and save again to update it.": "सेव हुआ। अपडेट करने के लिए कोई भी आँकड़ा बदलें और फिर सेव करें।",
  "Tally": "मिलान",
  "TALLY": "मिलान",
  "Tap a day to open it. ✓ means official SAP agrees with the ledger (and physical stock too, when it was entered).": "किसी दिन को खोलने के लिए टैप करें। ✓ का मतलब है आधिकारिक SAP लेजर से मेल खाता है (और फ़िज़िकल स्टॉक भी, जब वह भरा गया हो)।",
  "Ledger start": "लेजर की शुरुआत",
  "Start the ledger": "लेजर शुरू करें",
  "Confirm": "पक्का करें",
  "Pick the SAP report date.": "SAP रिपोर्ट की तारीख चुनें।",
  "This is the ledger's start day. Only an admin can change it.": "यह लेजर का शुरुआती दिन है। इसे केवल एडमिन बदल सकता है।",
  "This is the ledger's start day. Only an admin can change these figures.": "यह लेजर का शुरुआती दिन है। ये आँकड़े केवल एडमिन बदल सकता है।",
  "Enter the SAP stock from the report.": "रिपोर्ट से SAP स्टॉक भरें।",
  "Enter the physical stock too. The ledger needs it on its start day.": "फ़िज़िकल स्टॉक भी भरें। लेजर को शुरुआती दिन पर यह चाहिए।",
  "Stock can't be negative.": "स्टॉक माइनस नहीं हो सकता।",
  "Only an admin can start the ledger.": "लेजर केवल एडमिन शुरू कर सकता है।",
  "The ledger hasn't been started yet, so there is nothing to tally against. Save this day's opening balance for all three depots (with physical stock), then start the ledger below.": "लेजर अभी शुरू नहीं हुआ है, इसलिए मिलान के लिए कुछ नहीं है। इस दिन का तीनों डिपो का शुरुआती बैलेंस (फ़िज़िकल स्टॉक के साथ) सेव करें, फिर नीचे लेजर शुरू करें।",
  "The ledger starts from this day. Its starting depot stock is this day's opening balance of all three depots; the dealers' starting balances are on Dealer Stock.": "लेजर इसी दिन से शुरू होता है। इसका शुरुआती डिपो स्टॉक इस दिन का तीनों डिपो का शुरुआती बैलेंस है; डीलरों के शुरुआती बैलेंस डीलर स्टॉक में हैं।",
  "The ledger starts from this day's opening balance, so there is nothing earlier to check it against. Every later day is checked against it.": "लेजर इसी दिन के शुरुआती बैलेंस से शुरू होता है, इसलिए इससे पहले मिलाने को कुछ नहीं है। बाद का हर दिन इसी से मिलाया जाता है।",
  "Every sheet will be worked out from this day's opening balance of all three depots.": "हर शीट इस दिन के तीनों डिपो के शुरुआती बैलेंस से गिनी जाएगी।",
  "Official SAP, ledger SAP and physical stock all match for every product.": "हर प्रोडक्ट के लिए आधिकारिक SAP, लेजर SAP और फ़िज़िकल स्टॉक सब मेल खाते हैं।",
  "Official SAP matches the ledger for every product. Physical stock wasn't entered, so it wasn't checked.": "हर प्रोडक्ट के लिए आधिकारिक SAP लेजर से मेल खाता है। फ़िज़िकल स्टॉक नहीं भरा गया, इसलिए उसे नहीं जाँचा गया।",
  "Physical stock wasn't entered, so only SAP was checked.": "फ़िज़िकल स्टॉक नहीं भरा गया, इसलिए केवल SAP जाँचा गया।",
  "Physical: not entered": "फ़िज़िकल: नहीं भरा",
  "NOT ENTERED YET": "अभी नहीं भरा",
  "NOT STARTED YET": "अभी शुरू नहीं",
  "NOT TALLIED": "मिलान नहीं हुआ",
  "LEDGER START DAY": "लेजर का शुरुआती दिन",
  "✓ SAP tallied": "✓ SAP मिलान हुआ",
  "❌ NOT TALLIED": "❌ मिलान नहीं हुआ",
  "SAP STOCK": "SAP स्टॉक",
  "OFFICIAL SAP (REPORT)": "आधिकारिक SAP (रिपोर्ट)",
  "OFFICIAL": "आधिकारिक",
  "Official SAP": "आधिकारिक SAP",
  "LEDGER SAP": "लेजर SAP",
  "MISMATCH (LEDGER − OFFICIAL)": "अंतर (लेजर − आधिकारिक)",
  "MISMATCH": "अंतर",
  "PHYSICAL STOCK": "फ़िज़िकल स्टॉक",
  "PHYSICAL": "फ़िज़िकल",
  "PHYSICAL (REPORT)": "फ़िज़िकल (रिपोर्ट)",
  "REPORT": "रिपोर्ट",
  "LEDGER PHYSICAL": "लेजर फ़िज़िकल",
  "MISMATCH (LEDGER − REPORT)": "अंतर (लेजर − रिपोर्ट)",
  "Not entered": "नहीं भरा",
  "Before the ledger starts": "लेजर शुरू होने से पहले",
  "Older than the last two months": "पिछले दो महीने से पुराना",
  "Get report": "रिपोर्ट लें",
  "This month's entries, newest first. Pick a date for an earlier day: last month opens here, older months download as Excel. Filter by type, dealer or invoice number.": "इस महीने की एंट्री, नई सबसे ऊपर। पहले के दिन के लिए तारीख चुनें: पिछला महीना यहीं खुलता है, उससे पुराने महीने एक्सेल में डाउनलोड होते हैं। टाइप, डीलर या इनवॉइस नंबर से छाँटें।",
  "Any date": "कोई भी तारीख",
  "Type": "टाइप",
  "All types": "सभी टाइप",
  "For the Admin": "एडमिन के लिए",
  "This month's corrections with their reasons, and every entry taken off the ledger, with who did it and when.": "इस महीने के सुधार उनके कारणों के साथ, और लेजर से हटाई गई हर एंट्री, किसने और कब हटाई उसके साथ।",
  "Corrections": "सुधार",
  "Deleted entries": "हटाई गई एंट्री",
  "Loading entries…": "एंट्री लोड हो रही हैं…",
  "No entries match these filters.": "इन फ़िल्टर से कोई एंट्री मेल नहीं खाती।",
  "No entries yet. Add the first one from New Entry.": "अभी कोई एंट्री नहीं। पहली एंट्री \"नई एंट्री\" से जोड़ें।",
  "Corrected": "सुधारा गया",
  "Reason": "कारण",
  "Saved by": "किसने सेव किया",
  "Saved at": "सेव का समय",
  "From order": "ऑर्डर से",
  "Dashboard order": "डैशबोर्ड ऑर्डर",
  "Change it on the dashboard order": "इसे डैशबोर्ड ऑर्डर में बदलें",
  "BAGS": "बैग",
  "Delete": "मिटाएँ",
  "Delete this entry?": "यह एंट्री मिटाएँ?",
  "Entry deleted": "एंट्री मिटाई गई",
  "Couldn't delete. Try again.": "मिटा नहीं सके। फिर कोशिश करें।",
  "Entry date": "एंट्री की तारीख",
  "Taken off by": "किसने हटाया",
  "When": "कब",
  "Why": "क्यों",
  "Deleted in the ledger": "लेजर में मिटाया गया",
  "Order deleted on the dashboard": "डैशबोर्ड पर ऑर्डर मिटाया गया",
  "Order cancelled on the dashboard": "डैशबोर्ड पर ऑर्डर रद्द हुआ",
  "Dispatch undone on the dashboard": "डैशबोर्ड पर डिस्पैच वापस लिया गया",
  "(no reason: before reasons were needed)": "(कारण नहीं: कारण ज़रूरी होने से पहले की)",
  "Couldn't load the deleted entries. Check your connection.": "हटाई गई एंट्री लोड नहीं हो सकीं। कनेक्शन जाँचें।",
  "Couldn't load them. Check your connection.": "लोड नहीं हो सके। अपना कनेक्शन जाँचें।",
  "Entries": "एंट्री",
  "The type and search filters you picked apply to the download.": "आपके चुने टाइप और खोज फ़िल्टर डाउनलोड पर भी लागू होते हैं।",
  "Preparing the Excel…": "एक्सेल तैयार हो रही है…",
  "Couldn't make the Excel. Check your connection and try again.": "एक्सेल नहीं बन सकी। कनेक्शन जाँचें और फिर कोशिश करें।",
  "Couldn't check the ledger. Check your connection and try again.": "लेजर जाँच नहीं सके। कनेक्शन जाँचें और फिर कोशिश करें।",
  "Done": "हो गया",
  "Excel downloads work on your real site; they're blocked inside this preview.": "एक्सेल डाउनलोड आपकी असली साइट पर चलते हैं; इस प्रीव्यू में बंद हैं।",
  "That dealer is already in the list.": "यह डीलर पहले से सूची में है।",
  "The database refused this change. Reload the page and try again; if it happens again, tell your Admin.": "डेटाबेस ने यह बदलाव नहीं माना। पेज रीलोड करके फिर कोशिश करें; फिर भी हो तो एडमिन को बताएँ।",
  "The dashboard is under maintenance, so changes are paused. Try again when it's back.": "डैशबोर्ड पर मेंटेनेंस चल रहा है, इसलिए बदलाव रुके हुए हैं। वापस चालू होने पर फिर कोशिश करें।",
  "Someone deleted this order a moment ago. Nothing was changed.": "किसी ने अभी-अभी यह ऑर्डर मिटा दिया। कुछ नहीं बदला।"
  });

  window.DHSHindi = { set, add, tr: s => tr(s), get on() { return on; } };
  // start in Hindi if this device chose it; the ledger inside the dashboard follows the dashboard
  let first = null;
  try { first = localStorage.getItem("dhs.lang"); } catch (e) {}
  try { if (window.parent !== window && window.parent.DHSHindi) first = window.parent.DHSHindi.on ? "hi" : "en"; } catch (e) {}
  if (first === "hi") set("hi");
  window.addEventListener("storage", e => { if (e.key === "dhs.lang") set(e.newValue); });
})();
