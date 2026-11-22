/* ==========================================================================
   منصة غابات الغذاء (The Food Forests) - النظام الميداني الشامل v2.0
   ========================================================================== */

const DB_NAME = 'TFF_FOS_DB_V2';
const DB_STORE = 'state';
let db = null, saveTimer = null, pendingPhotoCtx = null, activeInvZoneId = null, activeEntryPrompt = null;
let cachedTemplateArrayBuffer = null;

const MASTER_ZONES = ['OL1','OL2','OR1','OR2','AL1','AL2','AR1','AR2','AR3','AR4','AR5','B1','B2','B3','B4','C1','C2','C3','C4','E1','E2','D1','H1','H2','H3','H4','H5','OH','Admin','Nursery','AC','W','عام / General'];
const MASTER_TASKS = [
    'Irrigation  /  ري المنطقة', 'Pruning  /  تقليم الأشجار', 'Weeding  /  إزالة الأعشاب',
    'Fertilizing  /  تسميد', 'Planting  /  زراعة وتشتيل', 'Harvesting  /  حصاد',
    'Soil Preparation  /  تحضير التربة', 'Pest Control  /  رش المبيدات أو العلاج',
    'Inspection  /  فحص ومراقبة', 'Cleaning  /  جمع النفايات وتنظيف الموقع',
    'Equipment Maintenance  /  صيانة المعدات', 'Main Line & Equipment Maintenance  /  صيانة الأنابيب الرئيسية والمعدات',
    'Water System Check  /  فحص نظام الري', 'Meter Reading  /  قراءة العدادات', 'Other  /  أخرى'
];
const DEFAULT_STAFF = [
    { name: 'Hussein M. Abed  /  حسين مرتضى عبد', type: 'Employee  /  موظف', tIn: '08:00', tOut: '17:00' },
    { name: 'Hussein Y. Hussin / حسين يوسف حسين', type: 'Employee  /  موظف', tIn: '08:00', tOut: '17:00' },
    { name: 'Mohammed M. Hassan  /  محمد مهدي حسن', type: 'Employee  /  موظف', tIn: '08:00', tOut: '17:00' },
    { name: 'حمزة خضر جاسم', type: 'Outside Worker  /  عامل خارجي', tIn: '08:00', tOut: '16:00' },
    { name: 'علي مسلم جواد', type: 'Outside Worker  /  عامل خارجي', tIn: '08:00', tOut: '16:00' },
    { name: 'امير علي فريز', type: 'Outside Worker  /  عامل خارجي', tIn: '08:00', tOut: '16:00' },
    { name: 'نوار عنيد جبر', type: 'Outside Worker  /  عامل خارجي', tIn: '08:00', tOut: '16:00' },
    { name: 'عادل حميد جبر', type: 'Outside Worker  /  عامل خارجي', tIn: '08:00', tOut: '16:00' }
];
const DEFAULT_TOOLS = [
    { name: 'Transport E3W', cat: 'Equipment / معدة', qty: 1, cond: 'Good / جيد', note: '' },
    { name: 'Garden broom (مكنسة حدائق)', cat: 'Tool / أداة', qty: 1, cond: 'Good / جيد', note: '' },
    { name: 'Grass Trimmer / Lawn Mower (آلة / أداة جز عشب)', cat: 'Equipment / معدة', qty: 2, cond: 'Good / جيد', note: '' },
    { name: 'Gardening gloves (كفوف حدائق)', cat: 'Tool / أداة', qty: 3, cond: 'Good / جيد', note: '' },
    { name: 'اكياس نفايات', cat: 'Materials / مادة', qty: 5, cond: 'Good / جيد', note: '' }
];
const HEALTH_CONDITIONS = [
    { id: 'c1', name: 'بصحة جيدة', color: '#81c784', dfl: 'ممتاز' },
    { id: 'c2', name: 'مصفر', color: '#fff176', dfl: 'متوسط' },
    { id: 'c3', name: 'هالك', color: '#e0e0e0', dfl: 'سيء' },
    { id: 'c4', name: 'محروق الأطراف', color: '#ffb74d', dfl: 'متوسط' },
    { id: 'c5', name: 'مجهدة', color: '#ff8a65', dfl: 'متوسط' },
    { id: 'c6', name: 'حالة حرجة', color: '#e57373', dfl: 'سيء' }
];
const AL_MUTAHIDA_PLAN = {
    Saturday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'B1, B2, C4', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'B3', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Sprinklers only', zones: 'B4', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'Admin', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Sunday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'D1', dur: '1:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun (Planters)', zones: 'H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip & Sprinklers automated cycle', zones: 'E1, E2, H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Monday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'AR5, C3, OL2, OR2', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip & Sprinklers automated cycle', zones: 'AL2, AC', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Water System Check  /  فحص نظام الري', desc: 'Routine line inspection, valve checks, filter cleaning', zones: 'عام / General', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Tuesday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'B1, B2, C4', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Manual Drip Valves (Dual-Worker)', zones: 'W', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'B3', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Sprinklers only', zones: 'B4', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Manual Drip Valve Switch', zones: 'C1, C2', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Wednesday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'D1', dur: '1:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun (Planters)', zones: 'H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip & Sprinklers automated cycle', zones: 'E1, E2, H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'Admin', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Thursday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'AR5, C3, OL2, OR2', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip & Sprinklers automated cycle', zones: 'AL2, AC', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Water System Check  /  فحص نظام الري', desc: 'Routine line inspection, valve checks, filter cleaning', zones: 'عام / General', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Friday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Manual Drip Valves (Dual-Worker)', zones: 'W', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Manual Drip Valve Switch', zones: 'C1, C2', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ]
};

let state = {
    activeSiteId: 'mutahida',
    activeDate: new Date().toISOString().split('T')[0],
    activeTab: 'att',
    company: {
        teamLead: 'Hussein M. Abed  /  حسين مرتضى عبد',
        supervisor: 'Maitham Ibrahim',
        shift: 'Morning Shift',
        outsideRate: 25000,
        heightUnit: 'م',
        photoQuality: 'uhd',
        templateName: '',
        staffPool: [...DEFAULT_STAFF],
        customTasks: [...MASTER_TASKS],
        customTools: DEFAULT_TOOLS.map(t => t.name),
        speciesDict: {}
    },
    sites: {
        mutahida: {
            id: 'mutahida',
            name: 'Almutahida — Hilla  /  المتحدة — الحلة',
            nextDfl: 187,
            zones: [...MASTER_ZONES],
            meters: [{ id: 'm1', name: 'Serious of B1 Tank 2', lastReading: 14753 }],
            gauges: [
                { id: 'g1', name: 'OL2-PWG', normal: 2.0 }, { id: 'g2', name: 'OR2-PWG', normal: 2.0 },
                { id: 'g3', name: 'C4-PWG', normal: 2.0 }, { id: 'g4', name: 'B1-PWG', normal: 2.0 },
                { id: 'g5', name: 'B2-PWG', normal: 2.0 }
            ],
            plan: AL_MUTAHIDA_PLAN,
            inventory: [],
            issues: [],
            stopMarker: null,
            lastInvAction: null,
            logs: {}
        }
    }
};

/* ================= IndexedDB Storage ================= */
function initDB() {
    return new Promise(resolve => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
            if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
        };
        req.onsuccess = e => {
            db = e.target.result;
            const tx = db.transaction([DB_STORE, 'files'], 'readonly');
            tx.objectStore(DB_STORE).get('root').onsuccess = r1 => {
                if (r1.target.result && r1.target.result.sites) state = r1.target.result;
            };
            tx.objectStore('files').get('dfl_template').onsuccess = r2 => {
                if (r2.target.result) cachedTemplateArrayBuffer = r2.target.result;
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        };
        req.onerror = () => resolve();
    });
}

function saveState() {
    const pill = document.getElementById('savePill');
    if (pill) { pill.className = 'save-pill saving'; pill.textContent = '⏳ حفظ...'; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        if (!db) return;
        const tx = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(state, 'root');
        tx.onsuccess = () => { if (pill) { pill.className = 'save-pill'; pill.textContent = '✓ محفوظ'; } };
    }, 180);
}

function saveTemplateToDB(buf, fileName) {
    cachedTemplateArrayBuffer = buf;
    state.company.templateName = fileName;
    if (db) {
        db.transaction('files', 'readwrite').objectStore('files').put(buf, 'dfl_template');
    }
    saveState();
}

function getSite() { return state.sites[state.activeSiteId] || Object.values(state.sites)[0]; }

function getDayLog(dateStr = state.activeDate) {
    const site = getSite();
    if (!site.logs[dateStr]) {
        const sortedDates = Object.keys(site.logs).sort();
        const prevDate = sortedDates.filter(d => d < dateStr).pop();
        const prevLog = prevDate ? site.logs[prevDate] : null;
        site.logs[dateStr] = {
            dflNum: site.nextDfl++,
            weather: { cond: '', min: '', max: '', wind: '', hum: '' },
            attendance: state.company.staffPool.map((s, idx) => ({
                id: 'w_' + idx + '_' + Date.now(), name: s.name, type: s.type,
                status: 'Present / حاضر', tIn: s.tIn || '08:00', tOut: s.tOut || '16:00', ot: 0, note: ''
            })),
            tasks: [],
            meters: site.meters.map(m => {
                const prevM = prevLog && prevLog.meters ? prevLog.meters.find(x => x.id === m.id) : null;
                const startVal = prevM && prevM.curr !== '' && prevM.curr != null ? prevM.curr : (m.lastReading || 0);
                return { id: m.id, name: m.name, status: 'working', prev: startVal, curr: '', visual: 'Clear / صافية', note: '', photo: null };
            }),
            gauges: site.gauges.map(g => ({ id: g.id, name: g.name, normal: g.normal, val: '', note: '' })),
            machinery: { pumpHrs: '', genHrs: '', fuelL: '' },
            moisture: [1, 2, 3, 4, 5].map(n => ({ id: n, zone: '', pct: '', note: '' })),
            perf: { status: 'جيد', duration: '', notes: '' },
            tools: [],
            incidents: [],
            sdls: [],
            oar: { obs: '', ana: '', rec: '' }
        };
        saveState();
    }
    const l = site.logs[dateStr];
    if (!l.machinery) l.machinery = { pumpHrs: '', genHrs: '', fuelL: '' };
    if (!l.incidents) l.incidents = [];
    if (!l.sdls) l.sdls = [];
    if (!l.weather) l.weather = { cond: '', min: '', max: '', wind: '', hum: '' };
    return l;
}

function showToast(msg) {
    const el = document.getElementById('toastBar');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3200);
}

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getDayNameEn(dateStr) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(dateStr + 'T12:00:00').getDay()];
}

/* ================= Rendering & Navigation ================= */
function renderAll() {
    const site = getSite();
    const log = getDayLog();
    const dayEn = getDayNameEn(state.activeDate);

    const sel = document.getElementById('siteSelect');
    sel.innerHTML = Object.values(state.sites).map(s => `<option value="${s.id}" ${s.id === site.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('') +
        `<option value="__NEW__">+ إضافة موقع جديد للشركة</option>`;

    document.getElementById('dateInput').value = state.activeDate;
    document.getElementById('dayBadge').textContent = dayEn;
    document.getElementById('planDayLabel').textContent = dayEn;
    document.getElementById('dflNumInput').value = log.dflNum;

    document.getElementById('globalZonesList').innerHTML = site.zones.map(z => `<option value="${esc(z)}">`).join('');
    document.getElementById('globalTasksList').innerHTML = state.company.customTasks.map(t => `<option value="${esc(t)}">`).join('');
    document.getElementById('globalToolsList').innerHTML = state.company.customTools.map(t => `<option value="${esc(t)}">`).join('');
    const pNames = new Set(Object.keys(state.company.speciesDict));
    site.inventory.forEach(z => z.plants.forEach(p => pNames.add(p.name)));
    document.getElementById('globalPlantsList').innerHTML = Array.from(pNames).map(n => `<option value="${esc(n)}">`).join('');

    const hr = new Date().getHours();
    const isShiftEdge = (hr >= 7 && hr <= 9) || (hr >= 15 && hr <= 18);
    const missingMeterPhoto = log.meters.some(m => !m.photo);
    document.getElementById('meterReminderBar').classList.toggle('show', isShiftEdge && missingMeterPhoto);

    document.body.classList.toggle('alpha-pad', state.activeTab === 'inv' && activeInvZoneId !== null);

    renderAttendance(log);
    renderTasks(log);
    renderReadingsAndTools(log);
    renderInventory(site);
    renderExportAndIssues(site, log);
}

function switchTab(tabId) {
    state.activeTab = tabId;
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.body.classList.toggle('alpha-pad', tabId === 'inv' && activeInvZoneId !== null);
}

function onDateChange(val) { if (!val) return; state.activeDate = val; getDayLog(val); saveState(); renderAll(); }
function onDflNumChange(val) {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) { getDayLog().dflNum = n; getSite().nextDfl = Math.max(getSite().nextDfl, n + 1); saveState(); }
}
function onSiteSelectChange(val) {
    if (val === '__NEW__') { openNewSiteModal(); renderAll(); return; }
    state.activeSiteId = val; activeInvZoneId = null; getDayLog(); saveState(); renderAll();
    showToast('📍 تم التبديل إلى: ' + getSite().name);
}

/* ================= TAB 1: Attendance (Add / Edit / Delete / Copy Yesterday) ================= */
function renderAttendance(log) {
    let presentCount = 0, outsidePresent = 0, totalOt = 0;
    log.attendance.forEach(w => {
        if (!w.status.includes('Absent')) {
            presentCount++;
            if (w.type.includes('Outside')) outsidePresent++;
        }
        totalOt += (parseFloat(w.ot) || 0);
    });
    const cost = outsidePresent * (state.company.outsideRate || 25000);

    document.getElementById('attKpiStrip').innerHTML = `
        <div class="kpi-box"><div class="kpi-val">${presentCount}/${log.attendance.length}</div><div class="kpi-sub">الحضور اليوم</div></div>
        <div class="kpi-box"><div class="kpi-val">${totalOt}h</div><div class="kpi-sub">أوفرتايم</div></div>
        <div class="kpi-box"><div class="kpi-val">${cost.toLocaleString()}</div><div class="kpi-sub">كلفة خارجية (IQD)</div></div>
    `;

    document.getElementById('attListContainer').innerHTML = log.attendance.map((w, idx) => {
        const isPres = w.status.includes('Present');
        const isAbs = w.status.includes('Absent');
        const isLate = w.status.includes('Late');
        return `
        <div class="worker-item">
            <div class="worker-top">
                <div style="flex:1;">
                    <div style="font-weight:bold;font-size:13px;">${esc(w.name.split('/')[1] || w.name)}</div>
                    <div style="font-size:10px;color:var(--muted);">${esc(w.type)}</div>
                </div>
                <div class="att-pills">
                    <button class="att-pill ${isPres ? 'st-present' : ''}" onclick="setWorkerAtt(${idx},'Present / حاضر')">حاضر</button>
                    <button class="att-pill ${isLate ? 'st-late' : ''}" onclick="setWorkerAtt(${idx},'Late / متأخر')">متأخر</button>
                    <button class="att-pill ${isAbs ? 'st-absent' : ''}" onclick="setWorkerAtt(${idx},'Absent / غائب')">غائب</button>
                    <button class="att-pill" onclick="editWorkerModal(${idx})" title="تعديل">✏️</button>
                    <button class="att-pill" style="color:var(--red);" onclick="deleteWorkerFromToday(${idx})" title="حذف">🗑️</button>
                </div>
            </div>
            ${!isAbs ? `
            <div class="worker-sub">
                <span>دخول: <input class="time-mini" value="${esc(w.tIn)}" onchange="updateWorkerField(${idx},'tIn',this.value)"></span>
                <span>خروج: <input class="time-mini" value="${esc(w.tOut)}" onchange="updateWorkerField(${idx},'tOut',this.value)"></span>
                <span>OT: <input type="number" step="0.5" class="time-mini" style="width:44px;" value="${w.ot || 0}" onchange="updateWorkerField(${idx},'ot',this.value)"></span>
            </div>` : ''}
        </div>`;
    }).join('');
}

function setWorkerAtt(idx, st) { getDayLog().attendance[idx].status = st; saveState(); renderAttendance(getDayLog()); }
function updateWorkerField(idx, k, v) { getDayLog().attendance[idx][k] = v; saveState(); renderAttendance(getDayLog()); }
function markAllPresent() { getDayLog().attendance.forEach(w => w.status = 'Present / حاضر'); saveState(); renderAttendance(getDayLog()); showToast('✓ تم تسجيل الجميع حاضرين'); }
function deleteWorkerFromToday(idx) {
    if (confirm('حذف العامل من قائمة اليوم؟')) {
        getDayLog().attendance.splice(idx, 1);
        saveState(); renderAttendance(getDayLog());
    }
}
function copyYesterdayCrew() {
    const site = getSite();
    const prevDate = Object.keys(site.logs).sort().filter(d => d < state.activeDate).pop();
    if (!prevDate || !site.logs[prevDate].attendance.length) { showToast('⚠️ لا يوجد سجل كادر سابق'); return; }
    getDayLog().attendance = JSON.parse(JSON.stringify(site.logs[prevDate].attendance)).map((w, i) => ({
        ...w, id: 'w_' + i + '_' + Date.now(), ot: 0, note: ''
    }));
    saveState(); renderAttendance(getDayLog()); showToast('📋 تم نسخ كادر الأمس');
}
function editWorkerModal(idx) {
    const w = getDayLog().attendance[idx];
    openModal(`
        <h3 class="card-title">✏️ تعديل بيانات العامل</h3>
        <label class="lbl">الاسم:</label>
        <input id="edWName" class="inp" value="${esc(w.name)}">
        <label class="lbl">نوع التوظيف:</label>
        <select id="edWType" class="inp">
            <option value="Employee  /  موظف" ${w.type.includes('Employee') ? 'selected' : ''}>Employee / موظف</option>
            <option value="Outside Worker  /  عامل خارجي" ${w.type.includes('Outside') ? 'selected' : ''}>Outside Worker / عامل خارجي</option>
            <option value="Intern  /  متدرب" ${w.type.includes('Intern') ? 'selected' : ''}>Intern / متدرب</option>
        </select>
        <label class="lbl">ملاحظة:</label>
        <input id="edWNote" class="inp" value="${esc(w.note || '')}" placeholder="ملاحظة حضور...">
        <div class="grid-2">
            <button class="btn btn-green" onclick="saveEditWorker(${idx})">حفظ</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function saveEditWorker(idx) {
    const w = getDayLog().attendance[idx];
    w.name = document.getElementById('edWName').value.trim() || w.name;
    w.type = document.getElementById('edWType').value;
    w.note = document.getElementById('edWNote').value.trim();
    closeModal(); saveState(); renderAttendance(getDayLog());
}
function promptAddWorker() {
    openModal(`
        <h3 class="card-title">👷 إضافة عامل خارجي / موظف</h3>
        <label class="lbl">الاسم الكامل:</label>
        <input id="newWName" class="inp" placeholder="اكتب اسم العامل...">
        <label class="lbl">نوع التوظيف:</label>
        <select id="newWType" class="inp">
            <option value="Outside Worker  /  عامل خارجي">Outside Worker / عامل خارجي</option>
            <option value="Employee  /  موظف">Employee / موظف</option>
            <option value="Intern  /  متدرب">Intern / متدرب</option>
        </select>
        <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:10px;">
            <input type="checkbox" id="newWSavePool" checked> تثبيت في القائمة الدائمة للشركة
        </label>
        <div class="grid-2">
            <button class="btn btn-green" onclick="confirmAddWorker()">إضافة</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function confirmAddWorker() {
    const name = document.getElementById('newWName').value.trim();
    const type = document.getElementById('newWType').value;
    const savePool = document.getElementById('newWSavePool').checked;
    if (!name) return;
    const tOut = type.includes('Employee') ? '17:00' : '16:00';
    getDayLog().attendance.push({ id: 'w_' + Date.now(), name, type, status: 'Present / حاضر', tIn: '08:00', tOut, ot: 0, note: '' });
    if (savePool && !state.company.staffPool.some(s => s.name === name)) {
        state.company.staffPool.push({ name, type, tIn: '08:00', tOut });
    }
    closeModal(); saveState(); renderAttendance(getDayLog()); showToast('✓ تمت إضافة ' + name);
}

/* ================= TAB 2: Tasks, Zone Splitting & Plan Editor ================= */
function loadSiteIrrigationPlan() {
    const site = getSite();
    const log = getDayLog();
    const dayEn = getDayNameEn(state.activeDate);
    const planItems = (site.plan && site.plan[dayEn]) || [];
    if (planItems.length === 0) { showToast('⚠️ لا توجد خطة ري مسجلة لهذا اليوم'); return; }
    planItems.forEach((item, i) => {
        log.tasks.push({
            id: 't_' + Date.now() + '_' + i,
            task: item.task, desc: item.desc, zones: item.zones, dur: item.dur || '1:00 hr',
            status: 'Completed / مكتمل', workers: [], note: '',
            isTanker: !!item.isTanker || (item.desc || '').toLowerCase().includes('tanker'),
            tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية',
            agroName: '', agroDose: '', photo: null
        });
    });
    saveState(); renderTasks(log); showToast(`⚡ تم تحميل ${planItems.length} مهام ري ليوم ${dayEn}`);
}

function renderTasks(log) {
    const el = document.getElementById('tasksContainer');
    if (log.tasks.length === 0) {
        el.innerHTML = `<div class="card" style="text-align:center;color:var(--muted);padding:24px;">💧 اضغط على زر خطة الري أعلاه أو أضف مهمة جديدة</div>`;
        return;
    }
    el.innerHTML = log.tasks.map((t, idx) => {
        const isDone = t.status.includes('Completed');
        const isProg = t.status.includes('Progress');
        const isBlock = t.status.includes('Blocked') || t.status.includes('Not Started');
        const zoneList = (t.zones || '').split(',').map(s => s.trim()).filter(Boolean);
        const canSplit = zoneList.length > 1;
        const wNames = t.workers && t.workers.length ? t.workers.join(' / ') : 'عمال...';
        const isAgro = t.task.includes('Fertilizing') || t.task.includes('Pest Control');

        return `
        <div class="card task-box ${isBlock ? 'is-blocked' : (isDone ? 'is-done' : '')}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
                <div style="font-weight:bold;font-size:14px;">${esc(t.task.split('/')[1] || t.task)}</div>
                <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                    <span class="zone-pill" onclick="openZonePickerModal(${idx})">📍 ${esc(t.zones)} ✏️</span>
                    ${canSplit ? `<button class="btn btn-orange btn-sm" onclick="splitTaskZones(${idx})" title="تفريق كل منطقة ببطاقة مستقلة">✂️ تفريق</button>` : ''}
                </div>
            </div>
            <div style="font-size:12px;color:var(--muted);margin:4px 0 8px 0;">${esc(t.desc)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
                <span class="chip" onclick="editTaskDuration(${idx})">⏱️ ${esc(t.dur)}</span>
                <span class="chip" onclick="openAssignWorkersModal(${idx})">👷 ${esc(wNames)} (${t.workers ? t.workers.length : 0})</span>
                <span class="chip" onclick="openPhotoSourceChoice('task', ${idx})">📸 ${t.photo ? 'صورة ✓' : 'صورة'}</span>
                <span class="chip" onclick="duplicateTask(${idx})" title="نسخ المهمة">📋</span>
                <span class="chip" style="color:var(--red);" onclick="deleteTask(${idx})" title="حذف">🗑️</span>
            </div>

            ${t.isTanker ? `
            <div class="tanker-banner">
                <span>🚚 التنكر: ${t.tankerLiters ? `${Number(t.tankerLiters).toLocaleString()} L | ${t.tankerPpm || '-'} ppm` : 'لم تُسجل الكمية بعد'}</span>
                <button class="btn btn-blue btn-sm" onclick="openTankerModal(${idx})">الكمية</button>
            </div>` : ''}

            ${isAgro ? `
            <div class="agro-banner">
                <span>🧪 المادة: ${t.agroName ? `${esc(t.agroName)} (${esc(t.agroDose)})` : 'سجل اسم السماد/المبيد والجرعة'}</span>
                <button class="btn btn-green btn-sm" onclick="openAgroModal(${idx})">الجرعة</button>
            </div>` : ''}

            <div class="st-bar">
                <button class="st-btn ${isDone ? 'on-done' : ''}" onclick="setTaskStatus(${idx},'Completed / مكتمل')">مكتمل</button>
                <button class="st-btn ${isProg ? 'on-prog' : ''}" onclick="setTaskStatus(${idx},'In Progress / جاري')">جاري</button>
                <button class="st-btn ${isBlock ? 'on-block' : ''}" onclick="setTaskStatus(${idx},'Blocked / متوقف')">متوقف / لم يبدأ</button>
            </div>

            ${isBlock ? `
            <div class="block-drawer">
                <label class="lbl" style="color:var(--red);">سبب التوقف:</label>
                <div style="display:flex;gap:4px;margin-bottom:6px;">
                    <input id="tnote_${idx}" class="inp" style="margin:0;background:white;" value="${esc(t.note)}" placeholder="اكتب السبب..." onchange="updateTaskNote(${idx}, this.value)">
                    <button class="btn btn-outline btn-sm" onclick="startDictation('tnote_${idx}', v => updateTaskNote(${idx}, v))">🎤</button>
                </div>
                <div>
                    <span class="chip" onclick="setTaskNoteChip(${idx}, 'Not included in the current irrigation plan for today')">غير مشمول بخطة اليوم</span>
                    <span class="chip" onclick="setTaskNoteChip(${idx}, 'Blocked due to leak/break in drip/main supply pipe')">كسر/تسريب أنبوب</span>
                    <span class="chip" onclick="setTaskNoteChip(${idx}, 'Blocked due to soil preparation and excavation works')">أعمال حفريات/تربة</span>
                    <span class="chip" onclick="setTaskNoteChip(${idx}, 'Water tanker was not provided')">عدم توفر حوضية</span>
                </div>
            </div>` : `
            <div style="display:flex;gap:4px;margin-top:8px;">
                <input id="tnote_${idx}" class="inp" style="margin:0;font-size:12px;padding:6px 8px;" value="${esc(t.note)}" placeholder="ملاحظة إضافية للمهمة..." onchange="updateTaskNote(${idx}, this.value)">
                <button class="btn btn-outline btn-sm" onclick="startDictation('tnote_${idx}', v => updateTaskNote(${idx}, v))">🎤</button>
            </div>`}
        </div>`;
    }).join('');
}

function splitTaskZones(idx) {
    const log = getDayLog();
    const t = log.tasks[idx];
    const zones = (t.zones || '').split(',').map(s => s.trim()).filter(Boolean);
    if (zones.length <= 1) return;
    const expanded = zones.map((z, i) => ({
        ...JSON.parse(JSON.stringify(t)),
        id: 't_' + Date.now() + '_' + i,
        zones: z
    }));
    log.tasks.splice(idx, 1, ...expanded);
    saveState(); renderTasks(log); showToast(`✂️ تم تفريق المهمة إلى ${zones.length} مناطق مستقلة`);
}

function duplicateTask(idx) {
    const log = getDayLog();
    const copy = JSON.parse(JSON.stringify(log.tasks[idx]));
    copy.id = 't_' + Date.now();
    log.tasks.splice(idx + 1, 0, copy);
    saveState(); renderTasks(log); showToast('📋 تم نسخ المهمة');
}

function openZonePickerModal(tIdx) {
    const site = getSite();
    const t = getDayLog().tasks[tIdx];
    const current = new Set((t.zones || '').split(',').map(s => s.trim()).filter(Boolean));
    openModal(`
        <h3 class="card-title">📍 تعديل مناطق المهمة</h3>
        <div style="max-height:220px;overflow-y:auto;margin-bottom:10px;border:1px solid var(--border);border-radius:8px;padding:8px;">
            ${site.zones.map(z => `
                <span class="chip ${current.has(z) ? 'active' : ''}" onclick="this.classList.toggle('active')" data-z="${esc(z)}">${esc(z)}</span>
            `).join('')}
        </div>
        <label class="lbl">أو اكتب مناطق مخصصة (مفصولة بفاصلة):</label>
        <input id="customZonesInp" class="inp" value="${esc(t.zones)}" placeholder="مثلاً: W (الفلل), B1">
        <div class="grid-2">
            <button class="btn btn-green" onclick="savePickedZones(${tIdx})">تحديث المناطق</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
    document.querySelectorAll('#genericModalBody .chip').forEach(ch => {
        ch.addEventListener('click', () => {
            const activeZones = Array.from(document.querySelectorAll('#genericModalBody .chip.active')).map(x => x.dataset.z);
            document.getElementById('customZonesInp').value = activeZones.join(', ');
        });
    });
}
function savePickedZones(tIdx) {
    const val = document.getElementById('customZonesInp').value.trim();
    if (val) getDayLog().tasks[tIdx].zones = val;
    closeModal(); saveState(); renderTasks(getDayLog());
}

function setTaskStatus(idx, st) { getDayLog().tasks[idx].status = st; saveState(); renderTasks(getDayLog()); }
function updateTaskNote(idx, v) { getDayLog().tasks[idx].note = v; saveState(); }
function setTaskNoteChip(idx, v) { getDayLog().tasks[idx].note = v; saveState(); renderTasks(getDayLog()); }
function deleteTask(idx) { getDayLog().tasks.splice(idx, 1); saveState(); renderTasks(getDayLog()); }
function editTaskDuration(idx) {
    const val = prompt('أدخل المدة (مثلاً: 0:30 hr أو 1:30 hr):', getDayLog().tasks[idx].dur);
    if (val) { getDayLog().tasks[idx].dur = val; saveState(); renderTasks(getDayLog()); }
}

function openTaskModal() {
    openModal(`
        <h3 class="card-title">📋 إضافة مهمة جديدة (قائمة أو كتابة حرة)</h3>
        <label class="lbl">نوع المهمة (اختر أو اكتب أي مهمة مخصصة):</label>
        <input id="mTaskType" list="globalTasksList" class="inp" placeholder="مثلاً: Irrigation أو مهمة مخصصة...">
        <label class="lbl">وصف مختصر:</label>
        <input id="mTaskDesc" class="inp" placeholder="تفاصيل العمل المنفذ...">
        <label class="lbl">المنطقة / المناطق:</label>
        <input id="mTaskZones" list="globalZonesList" class="inp" placeholder="مثلاً: AR5 أو B1, B2">
        <div class="grid-2">
            <div><label class="lbl">المدة:</label><input id="mTaskDur" class="inp" value="1:00 hr"></div>
            <div style="display:flex;align-items:center;padding-top:14px;">
                <label style="font-size:12px;font-weight:bold;"><input type="checkbox" id="mTaskTanker"> ري بالتنكر 🚚</label>
            </div>
        </div>
        <div class="grid-2">
            <button class="btn btn-green" onclick="saveNewTask()">حفظ المهمة</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function saveNewTask() {
    const rawTask = document.getElementById('mTaskType').value.trim() || 'Other  /  أخرى';
    const desc = document.getElementById('mTaskDesc').value.trim();
    const zones = document.getElementById('mTaskZones').value.trim() || 'عام / General';
    const dur = document.getElementById('mTaskDur').value.trim() || '1:00 hr';
    const isTanker = document.getElementById('mTaskTanker').checked;
    const isStandard = MASTER_TASKS.includes(rawTask);
    getDayLog().tasks.push({
        id: 't_' + Date.now(),
        task: isStandard ? rawTask : 'Other  /  أخرى',
        desc: isStandard ? desc : (desc ? `${rawTask} — ${desc}` : rawTask),
        zones, dur, status: 'Completed / مكتمل', workers: [], note: '',
        isTanker, tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية',
        agroName: '', agroDose: '', photo: null
    });
    closeModal(); saveState(); renderTasks(getDayLog()); showToast('✓ تمت إضافة المهمة');
}

function openAssignWorkersModal(tIdx) {
    const log = getDayLog();
    const task = log.tasks[tIdx];
    const presentWorkers = log.attendance.filter(w => !w.status.includes('Absent'));
    openModal(`
        <h3 class="card-title">👷 تحديد العمال المنفذين</h3>
        <div style="margin-bottom:10px;">
            ${presentWorkers.map(w => {
                const shortName = (w.name.split('/')[1] || w.name).trim();
                const checked = task.workers.includes(shortName);
                return `<label style="display:block;padding:8px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:bold;">
                    <input type="checkbox" class="wk-chk" value="${esc(shortName)}" ${checked ? 'checked' : ''}> ${esc(shortName)}
                </label>`;
            }).join('')}
        </div>
        <div class="grid-2">
            <button class="btn btn-green" onclick="saveAssignedWorkers(${tIdx})">حفظ</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function saveAssignedWorkers(tIdx) {
    getDayLog().tasks[tIdx].workers = Array.from(document.querySelectorAll('.wk-chk:checked')).map(c => c.value);
    closeModal(); saveState(); renderTasks(getDayLog());
}

function openTankerModal(tIdx) {
    const t = getDayLog().tasks[tIdx];
    openModal(`
        <h3 class="card-title">🚚 حاسبة التنكر (Water Tanker)</h3>
        <label class="lbl">كمية الماء المصروفة (لتر):</label>
        <div style="margin-bottom:6px;">
            <span class="chip" onclick="document.getElementById('tkL').value=5000">5,000 L</span>
            <span class="chip" onclick="document.getElementById('tkL').value=10000">10,000 L</span>
            <span class="chip" onclick="document.getElementById('tkL').value=12000">12,000 L</span>
            <span class="chip" onclick="document.getElementById('tkL').value=15000">15,000 L</span>
        </div>
        <input type="number" id="tkL" class="inp" value="${esc(t.tankerLiters)}" placeholder="مثلاً: 10000">
        <label class="lbl">الملوحة (PPM):</label>
        <input type="number" id="tkPpm" class="inp" value="${esc(t.tankerPpm)}" placeholder="مثلاً: 780">
        <label class="lbl">نقاوة الماء:</label>
        <select id="tkVis" class="inp">
            <option value="Clear / صافية" ${t.tankerVisual === 'Clear / صافية' ? 'selected' : ''}>Clear / صافية</option>
            <option value="Turbid / عكرة" ${t.tankerVisual === 'Turbid / عكرة' ? 'selected' : ''}>Turbid / عكرة</option>
            <option value="Sediment / رواسب" ${t.tankerVisual === 'Sediment / رواسب' ? 'selected' : ''}>Sediment / رواسب</option>
        </select>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="saveTankerData(${tIdx})">حفظ</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function saveTankerData(tIdx) {
    const t = getDayLog().tasks[tIdx];
    t.tankerLiters = document.getElementById('tkL').value;
    t.tankerPpm = document.getElementById('tkPpm').value;
    t.tankerVisual = document.getElementById('tkVis').value;
    if (t.tankerLiters) {
        t.note = `${t.tankerPpm ? t.tankerPpm + ' ppm \\ ' : ''}${Number(t.tankerLiters).toLocaleString()} L`;
    }
    closeModal(); saveState(); renderTasks(getDayLog()); renderReadingsAndTools(getDayLog());
}

function openAgroModal(tIdx) {
    const t = getDayLog().tasks[tIdx];
    openModal(`
        <h3 class="card-title">🧪 سجل الأسمدة والمبيدات</h3>
        <label class="lbl">اسم السماد أو المبيد:</label>
        <input id="agName" class="inp" value="${esc(t.agroName)}" placeholder="مثلاً: NPK 20-20-20 أو هيوميك أسيد">
        <label class="lbl">الكمية / الجرعة:</label>
        <input id="agDose" class="inp" value="${esc(t.agroDose)}" placeholder="مثلاً: 2 كغم / 1000 لتر">
        <div class="grid-2">
            <button class="btn btn-green" onclick="saveAgroData(${tIdx})">حفظ</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function saveAgroData(tIdx) {
    const t = getDayLog().tasks[tIdx];
    t.agroName = document.getElementById('agName').value.trim();
    t.agroDose = document.getElementById('agDose').value.trim();
    if (t.agroName) {
        t.note = `المادة: ${t.agroName} (${t.agroDose})`;
        getDayLog().tools.push({ name: t.agroName, cat: 'Materials / مادة', qty: 1, cond: 'Good / جيد', note: t.agroDose });
    }
    closeModal(); saveState(); renderTasks(getDayLog()); renderReadingsAndTools(getDayLog());
}

function openPlanEditorModal() {
    const site = getSite();
    const dayEn = getDayNameEn(state.activeDate);
    const items = (site.plan && site.plan[dayEn]) || [];
    openModal(`
        <h3 class="card-title">🗓️ تعديل خطة الري ليوم (${dayEn})</h3>
        <div id="planEditList" style="margin-bottom:10px;">
            ${items.map((it, i) => `
                <div class="meter-card" style="padding:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <b style="font-size:12px;">${esc(it.zones)} — ${esc(it.dur)}</b>
                        <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="removePlanItem('${dayEn}', ${i})">🗑️</button>
                    </div>
                    <div style="font-size:11px;color:var(--muted);">${esc(it.desc)}</div>
                </div>
            `).join('') || '<div style="font-size:12px;color:var(--muted);">لا توجد مهام مجدولة لهذا اليوم</div>'}
        </div>
        <label class="lbl">إضافة بند جديد ليوم ${dayEn}:</label>
        <input id="plZones" list="globalZonesList" class="inp" placeholder="المناطق (مثلاً: B1, B2)">
        <input id="plDesc" class="inp" placeholder="الوصف (مثلاً: Drip only أو Water tanker)">
        <div class="grid-2">
            <input id="plDur" class="inp" value="1:00 hr" placeholder="المدة">
            <label style="font-size:12px;font-weight:bold;padding-top:8px;"><input type="checkbox" id="plTanker"> تنكر 🚚</label>
        </div>
        <div class="grid-2">
            <button class="btn btn-green" onclick="addPlanItem('${dayEn}')">+ إضافة للخطة</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}
function addPlanItem(dayEn) {
    const site = getSite();
    if (!site.plan) site.plan = {};
    if (!site.plan[dayEn]) site.plan[dayEn] = [];
    const zones = document.getElementById('plZones').value.trim();
    const desc = document.getElementById('plDesc').value.trim() || 'Drip & Sprinklers';
    const dur = document.getElementById('plDur').value.trim() || '1:00 hr';
    const isTanker = document.getElementById('plTanker').checked;
    if (!zones) return;
    site.plan[dayEn].push({ task: 'Irrigation  /  ري المنطقة', desc, zones, dur, isTanker });
    saveState(); openPlanEditorModal();
}
function removePlanItem(dayEn, idx) {
    getSite().plan[dayEn].splice(idx, 1);
    saveState(); openPlanEditorModal();
}

/* ================= TAB 3: Readings, Meters (Add/Edit/Clear/Delete), Machinery & Tools ================= */
function jumpToMeters() { switchTab('tools'); window.scrollTo(0, 0); }

function renderReadingsAndTools(log) {
    const totalTankerL = log.tasks.reduce((sum, t) => sum + (parseFloat(t.tankerLiters) || 0), 0);
    const anyFaulty = log.meters.some(m => m.status === 'faulty');

    document.getElementById('tankerSummaryBox').innerHTML = (totalTankerL > 0 || anyFaulty) ? `
        <div class="tanker-banner" style="margin-bottom:10px;">
            <span>🚚 مياه التنكر اليوم: ${totalTankerL.toLocaleString()} L (${(totalTankerL / 1000).toFixed(1)} m³)</span>
            ${anyFaulty ? `<span style="color:var(--red);">⚠️ عداد عاطل</span>` : ''}
        </div>` : '';

    document.getElementById('metersContainer').innerHTML = log.meters.map((m, idx) => {
        const isFaulty = m.status === 'faulty';
        const usage = (!isFaulty && m.curr !== '' && !isNaN(parseFloat(m.curr))) ? (parseFloat(m.curr) - parseFloat(m.prev || 0)).toFixed(2) : '-';
        return `
        <div class="meter-card ${isFaulty ? 'faulty' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:4px;flex-wrap:wrap;">
                <b style="font-size:13px;" onclick="renameMeter(${idx})">${esc(m.name)} ✏️</b>
                <div style="display:flex;gap:3px;">
                    <button class="btn btn-sm ${!isFaulty ? 'btn-green' : 'btn-outline'}" onclick="setMeterStatus(${idx},'working')">شغال</button>
                    <button class="btn btn-sm ${isFaulty ? 'btn-red' : 'btn-outline'}" onclick="setMeterStatus(${idx},'faulty')">عاطل</button>
                    <button class="btn btn-sm btn-blue" onclick="openPhotoSourceChoice('meter', ${idx})">📸 ${m.photo ? '✓' : ''}</button>
                    <button class="btn btn-sm btn-outline" onclick="clearMeterReading(${idx})" title="مسح القراءة">🧹</button>
                    <button class="btn btn-sm btn-outline" style="color:var(--red);" onclick="deleteMeter(${idx})" title="حذف العداد">🗑️</button>
                </div>
            </div>
            ${!isFaulty ? `
            <div class="grid-2" style="font-size:12px;">
                <div><label class="lbl">السابق:</label><input type="number" class="inp" style="margin:0;padding:6px;" value="${esc(m.prev)}" onchange="updateMeterField(${idx},'prev',this.value)"></div>
                <div><label class="lbl">الحالي (الاستهلاك: ${usage} m³):</label><input type="number" class="inp" style="margin:0;padding:6px;" value="${esc(m.curr)}" onchange="updateMeterField(${idx},'curr',this.value)"></div>
            </div>` : `
            <input class="inp" style="margin:0;background:white;font-size:12px;" value="${esc(m.note)}" placeholder="وصف عطل العداد (يُنقل تلقائياً لـ OAR)..." onchange="updateMeterField(${idx},'note',this.value)">`}
        </div>`;
    }).join('');

    document.getElementById('gaugesContainer').innerHTML = log.gauges.map((g, idx) => {
        const v = parseFloat(g.val);
        const isLow = !isNaN(v) && v < g.normal;
        return `
        <div class="gauge-box ${isLow ? 'low' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                <b style="font-size:12px;">${esc(g.name)}</b>
                <span style="font-size:11px;color:var(--red);cursor:pointer;" onclick="deleteGauge(${idx})">✕</span>
            </div>
            <div style="font-size:10px;color:var(--muted);margin-bottom:5px;">الطبيعي: ${g.normal} bar</div>
            <input type="number" step="0.1" class="inp" style="margin:0;padding:6px;text-align:center;font-weight:bold;" value="${esc(g.val)}" placeholder="bar" onchange="updateGaugeVal(${idx}, this.value)">
        </div>`;
    }).join('');

    document.getElementById('pumpHrsInput').value = log.machinery.pumpHrs || '';
    document.getElementById('genHrsInput').value = log.machinery.genHrs || '';
    document.getElementById('fuelLitersInput').value = log.machinery.fuelL || '';

    document.getElementById('sysStatusSelect').value = log.perf.status || 'جيد';
    document.getElementById('sysDurationInput').value = log.perf.duration || '';
    document.getElementById('sysNotesInput').value = log.perf.notes || '';

    document.getElementById('moistureContainer').innerHTML = log.moisture.map((mo, idx) => `
        <div style="display:flex;gap:5px;margin-bottom:5px;">
            <input list="globalZonesList" class="inp" style="margin:0;padding:6px;flex:1;" value="${esc(mo.zone)}" placeholder="المنطقة ${mo.id}" onchange="updateMoisture(${idx},'zone',this.value)">
            <input type="number" class="inp" style="margin:0;padding:6px;width:75px;" value="${esc(mo.pct)}" placeholder="%" onchange="updateMoisture(${idx},'pct',this.value)">
        </div>
    `).join('');

    document.getElementById('toolsContainer').innerHTML = log.tools.length === 0
        ? `<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px;">لا توجد أدوات مسجلة اليوم بعد</div>`
        : log.tools.map((tl, idx) => `
            <div class="worker-item" style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                <div>
                    <div style="font-size:13px;font-weight:bold;">${esc(tl.name)} <span style="color:var(--blue);">×${tl.qty}</span></div>
                    <div style="font-size:10px;color:var(--muted);">${esc(tl.cat)} | ${esc(tl.cond)}</div>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-outline btn-sm" onclick="editToolQty(${idx})">✏️</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteTool(${idx})">🗑️</button>
                </div>
            </div>`).join('');
}

function setMeterStatus(idx, st) { getDayLog().meters[idx].status = st; saveState(); renderReadingsAndTools(getDayLog()); }
function updateMeterField(idx, k, v) {
    getDayLog().meters[idx][k] = v;
    if (k === 'curr' && v !== '' && getSite().meters[idx]) getSite().meters[idx].lastReading = parseFloat(v);
    saveState(); renderReadingsAndTools(getDayLog());
}
function clearMeterReading(idx) {
    getDayLog().meters[idx].curr = '';
    getDayLog().meters[idx].photo = null;
    saveState(); renderReadingsAndTools(getDayLog()); showToast('🧹 تم مسح قراءة العداد');
}
function renameMeter(idx) {
    const cur = getDayLog().meters[idx].name;
    const n = prompt('تعديل اسم العداد:', cur);
    if (n && n.trim()) {
        getDayLog().meters[idx].name = n.trim();
        if (getSite().meters[idx]) getSite().meters[idx].name = n.trim();
        saveState(); renderReadingsAndTools(getDayLog());
    }
}
function deleteMeter(idx) {
    if (confirm('حذف هذا العداد نهائياً من الموقع؟')) {
        getDayLog().meters.splice(idx, 1);
        getSite().meters.splice(idx, 1);
        saveState(); renderReadingsAndTools(getDayLog()); showToast('🗑️ تم حذف العداد');
    }
}
function addCustomMeter() {
    const name = prompt('اسم عداد المياه الجديد:');
    if (!name) return;
    const id = 'm_' + Date.now();
    getSite().meters.push({ id, name, lastReading: 0 });
    getDayLog().meters.push({ id, name, status: 'working', prev: 0, curr: '', visual: 'Clear / صافية', note: '', photo: null });
    saveState(); renderReadingsAndTools(getDayLog());
}
function updateGaugeVal(idx, v) { getDayLog().gauges[idx].val = v; saveState(); renderReadingsAndTools(getDayLog()); }
function deleteGauge(idx) {
    if (confirm('حذف مقياس الضغط؟')) {
        getDayLog().gauges.splice(idx, 1);
        getSite().gauges.splice(idx, 1);
        saveState(); renderReadingsAndTools(getDayLog());
    }
}
function addCustomGauge() {
    const name = prompt('اسم مقياس الضغط الجديد (مثلاً: D1-PWG):');
    if (!name) return;
    const id = 'g_' + Date.now();
    getSite().gauges.push({ id, name, normal: 2.0 });
    getDayLog().gauges.push({ id, name, normal: 2.0, val: '', note: '' });
    saveState(); renderReadingsAndTools(getDayLog());
}
function updateMachinery(k, v) { getDayLog().machinery[k] = v; saveState(); }
function updatePerfField(k, v) { getDayLog().perf[k] = v; saveState(); }
function updateMoisture(idx, k, v) { getDayLog().moisture[idx][k] = v; saveState(); }
function copyYesterdayTools() {
    const site = getSite();
    const prevDate = Object.keys(site.logs).sort().filter(d => d < state.activeDate).pop();
    const sourceTools = (prevDate && site.logs[prevDate].tools.length) ? site.logs[prevDate].tools : DEFAULT_TOOLS;
    getDayLog().tools = JSON.parse(JSON.stringify(sourceTools));
    saveState(); renderReadingsAndTools(getDayLog()); showToast('📋 تم نسخ قائمة الأدوات');
}
function clearTodayTools() { if (confirm('مسح جميع الأدوات المسجلة اليوم؟')) { getDayLog().tools = []; saveState(); renderReadingsAndTools(getDayLog()); } }
function editToolQty(idx) {
    const q = prompt('الكمية الجديدة:', getDayLog().tools[idx].qty);
    if (q !== null && !isNaN(parseFloat(q))) { getDayLog().tools[idx].qty = parseFloat(q); saveState(); renderReadingsAndTools(getDayLog()); }
}
function openToolModal() {
    openModal(`
        <h3 class="card-title">🧰 إضافة معدة / أداة / مادة</h3>
        <label class="lbl">الاسم (اختر أو اكتب أي مادة حرة):</label>
        <input id="tlName" list="globalToolsList" class="inp" placeholder="مثلاً: اكياس نفايات أو منقطات...">
        <div class="grid-2">
            <div><label class="lbl">الفئة:</label><select id="tlCat" class="inp"><option value="Equipment / معدة">Equipment / معدة</option><option value="Tool / أداة">Tool / أداة</option><option value="Materials / مادة">Materials / مادة</option></select></div>
            <div><label class="lbl">الكمية:</label><input type="number" id="tlQty" class="inp" value="1"></div>
        </div>
        <label class="lbl">الحالة:</label>
        <select id="tlCond" class="inp">
            <option value="Good / جيد">Good / جيد</option>
            <option value="Needs Maintenance / يحتاج صيانة">Needs Maintenance / يحتاج صيانة</option>
            <option value="Out of Service / خارج الخدمة">Out of Service / خارج الخدمة</option>
        </select>
        <div class="grid-2">
            <button class="btn btn-green" onclick="saveNewTool()">إضافة</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function saveNewTool() {
    const name = document.getElementById('tlName').value.trim();
    if (!name) return;
    getDayLog().tools.push({ name, cat: document.getElementById('tlCat').value, qty: parseFloat(document.getElementById('tlQty').value) || 1, cond: document.getElementById('tlCond').value, note: '' });
    if (!state.company.customTools.includes(name)) state.company.customTools.push(name);
    closeModal(); saveState(); renderReadingsAndTools(getDayLog());
}
function deleteTool(idx) { getDayLog().tools.splice(idx, 1); saveState(); renderReadingsAndTools(getDayLog()); }

/* ================= TAB 4: Full Plant Inventory (With Sequence Log, Stop Marker, Copy Species) ================= */
function renderInventory(site) {
    const lastBox = document.getElementById('lastInvTracker');
    const invBox = document.getElementById('invContainer');
    const alphaBox = document.getElementById('alphaScroller');

    if (site.lastInvAction) {
        const la = site.lastInvAction;
        lastBox.innerHTML = `
        <div class="sticky-last">
            <div style="font-size:12px;">
                <div style="color:var(--blue);font-weight:bold;">🕒 آخر إضافة (${esc(la.time)}): ${esc(la.zoneName)}</div>
                <div><b>${esc(la.plantName)}</b> — ${esc(la.condName)} ${la.height ? `(${la.height} ${state.company.heightUnit})` : ''}</div>
                ${site.stopMarker ? `<div style="color:var(--red);font-size:11px;">🎀 علامة التوقف: ${esc(site.stopMarker)}</div>` : ''}
            </div>
            <div style="display:flex;gap:4px;">
                <button class="btn btn-outline btn-sm" onclick="setStopMarker()">🎀 علامة</button>
                <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="undoLastInv()">↩️ تراجع</button>
            </div>
        </div>`;
    } else { lastBox.innerHTML = ''; }

    if (!activeInvZoneId) {
        alphaBox.innerHTML = '';
        invBox.innerHTML = `
            <div class="card">
                <div class="card-head">
                    <h3 class="card-title">🌿 مناطق الجرد (${site.inventory.length})</h3>
                    <button class="btn btn-green btn-sm" onclick="addInvZone()">+ منطقة</button>
                </div>
                ${site.inventory.length === 0 ? `<div style="text-align:center;color:var(--muted);padding:20px;">اضغط + منطقة لبدء جرد النباتات</div>` :
                site.inventory.map(z => {
                    const tot = z.plants.reduce((s, p) => s + Object.values(p.counts).reduce((a, b) => a + (b || 0), 0), 0);
                    return `
                    <div class="card" style="display:flex;justify-content:space-between;align-items:center;border-right:5px solid var(--blue);cursor:pointer;" onclick="enterInvZone('${z.id}')">
                        <div><b style="font-size:16px;">📍 ${esc(z.name)}</b><div style="font-size:12px;color:var(--muted);">الأصناف: ${z.plants.length} | الإجمالي: ${tot}</div></div>
                        <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="event.stopPropagation();deleteInvZone('${z.id}')">حذف</button>
                    </div>`;
                }).join('')}
            </div>`;
        return;
    }

    const zone = site.inventory.find(z => z.id === activeInvZoneId);
    if (!zone) { activeInvZoneId = null; renderInventory(site); return; }

    const unit = state.company.heightUnit || 'م';
    const chips = unit === 'م' ? [0.5, 1, 1.5, 2] : [50, 100, 150, 200];

    const letters = ['أ','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','هـ','و','ي'];
    alphaBox.innerHTML = `<div class="alpha-bar">${letters.map(l => `<div class="alpha-ch has" onclick="jumpAlpha('${l}')">${l}</div>`).join('')}</div>`;

    invBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-blue btn-sm" onclick="exitInvZone()">➡️ المناطق</button>
            <b>📍 ${esc(zone.name)} (${zone.plants.length})</b>
            <div style="display:flex;gap:4px;">
                <button class="btn btn-outline btn-sm" onclick="copySpeciesFromZone()">📋 نسخ أصناف</button>
                <button class="btn btn-outline btn-sm" onclick="sortZonePlants()">🔤</button>
            </div>
        </div>
        ${zone.plants.map((p, pIdx) => {
            const total = Object.values(p.counts).reduce((a, b) => a + (b || 0), 0);
            const hArr = (p.entries || []).map(e => parseFloat(e.height)).filter(n => !isNaN(n) && n > 0);
            const avgH = hArr.length ? (hArr.reduce((a, b) => a + b, 0) / hArr.length).toFixed(2) : null;
            return `
            <div class="plant-box" id="pbox_${p.id}">
                <div style="display:flex;gap:4px;margin-bottom:8px;">
                    <input list="globalPlantsList" class="inp" style="margin:0;font-weight:bold;font-size:15px;" value="${esc(p.name)}" onchange="renameInvPlant(${pIdx}, this.value)">
                    <button class="btn btn-outline btn-sm" onclick="openPlantSeqLogModal(${pIdx})" title="سجل الترتيب والصور">📜 (${(p.entries || []).length})</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteInvPlant(${pIdx})">✕</button>
                </div>
                <div style="font-size:12px;color:var(--blue);font-weight:bold;margin-bottom:8px;">
                    الإجمالي: ${total} ${avgH ? `| 📏 متوسط الطول: ${avgH} ${unit}` : ''} | 📸 صور اليوم: ${(p.entries || []).filter(e => e.date === state.activeDate && e.photo).length}
                </div>
                <div class="grid-2">
                    ${HEALTH_CONDITIONS.map(c => {
                        const showBar = activeEntryPrompt && activeEntryPrompt.plantId === p.id && activeEntryPrompt.condId === c.id;
                        return `
                        <div class="cond-box" style="background:${c.color};">
                            <div style="font-size:12px;font-weight:bold;text-align:center;">${c.name}</div>
                            <div class="cnt-row">
                                <button class="cnt-btn" onclick="changePlantCount(${pIdx},'${c.id}',-1)">-</button>
                                <b style="font-size:18px;">${p.counts[c.id] || 0}</b>
                                <button class="cnt-btn" onclick="changePlantCount(${pIdx},'${c.id}',1)">+</button>
                            </div>
                        </div>
                        ${showBar ? `
                        <div class="quick-entry-bar">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                <b style="font-size:12px;">📏 الطول (${unit}) وصورة #${activeEntryPrompt.seq}:</b>
                                <div style="display:flex;gap:4px;">
                                    <button class="btn btn-blue btn-sm" onclick="openPhotoSourceChoice('plant', {pIdx:${pIdx}, entryId:'${activeEntryPrompt.entryId}'})">📸 / 🖼️</button>
                                    <button class="btn btn-outline btn-sm" onclick="activeEntryPrompt=null;renderInventory(getSite())">✕</button>
                                </div>
                            </div>
                            <div style="display:flex;gap:4px;flex-wrap:wrap;">
                                <input type="number" step="any" class="inp" style="width:75px;margin:0;padding:5px;text-align:center;" placeholder="${unit}" oninput="setPlantEntryHeight(${pIdx},'${activeEntryPrompt.entryId}',this.value)">
                                ${chips.map(v => `<button class="chip" onclick="setPlantEntryHeight(${pIdx},'${activeEntryPrompt.entryId}',${v})">${v}</button>`).join('')}
                            </div>
                        </div>` : ''}`;
                    }).join('')}
                </div>
                <input class="inp" style="margin-top:8px;margin-bottom:0;font-size:12px;padding:6px;" value="${esc(p.note || '')}" placeholder="ملاحظة ميدانية للنبات..." onchange="updateInvPlantNote(${pIdx}, this.value)">
            </div>`;
        }).join('')}
        <button class="btn btn-blue btn-full" onclick="addInvPlant()">+ إضافة نوع نبات جديد</button>
    `;
}

function setStopMarker() {
    const site = getSite();
    const m = prompt('أدخل مكان الشريط الملون / علامة التوقف الميداني:', site.stopMarker || '');
    if (m !== null) { site.stopMarker = m.trim(); saveState(); renderInventory(site); }
}
function copySpeciesFromZone() {
    const site = getSite();
    const otherZones = site.inventory.filter(z => z.id !== activeInvZoneId && z.plants.length > 0);
    if (!otherZones.length) { showToast('⚠️ لا توجد مناطق أخرى تحتوي على أصناف'); return; }
    openModal(`
        <h3 class="card-title">📋 نسخ قائمة الأصناف من منطقة سابقة</h3>
        <select id="copySrcZone" class="inp">
            ${otherZones.map(z => `<option value="${z.id}">${esc(z.name)} (${z.plants.length} أصناف)</option>`).join('')}
        </select>
        <div class="grid-2">
            <button class="btn btn-green" onclick="confirmCopySpecies()">نسخ الأصناف (بعدادات صفرية)</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function confirmCopySpecies() {
    const site = getSite();
    const src = site.inventory.find(z => z.id === document.getElementById('copySrcZone').value);
    const dst = site.inventory.find(z => z.id === activeInvZoneId);
    if (src && dst) {
        src.plants.forEach((p, i) => {
            if (!dst.plants.some(x => x.name === p.name)) {
                dst.plants.push({ id: 'p_' + Date.now() + '_' + i, name: p.name, counts: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 }, entries: [], note: '' });
            }
        });
        saveState(); renderInventory(site); showToast('📋 تم نسخ الأصناف بنجاح');
    }
    closeModal();
}
function openPlantSeqLogModal(pIdx) {
    const z = getSite().inventory.find(x => x.id === activeInvZoneId);
    const p = z.plants[pIdx];
    const entries = p.entries || [];
    openModal(`
        <h3 class="card-title">📜 سجل الترتيب: ${esc(p.name)} (${entries.length})</h3>
        <div style="max-height:320px;overflow-y:auto;">
            ${entries.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:15px;">لا توجد قيود مسجلة</div>' :
            entries.map((e, i) => {
                const cObj = HEALTH_CONDITIONS.find(c => c.id === e.condId);
                return `
                <div class="meter-card" style="display:flex;justify-content:space-between;align-items:center;padding:8px;">
                    <div>
                        <b>#${i + 1} — ${cObj ? cObj.name : ''}</b>
                        <div style="font-size:11px;color:var(--muted);">${esc(e.date)} ${e.height ? `| الطول: ${e.height} ${state.company.heightUnit}` : ''}</div>
                    </div>
                    <div style="display:flex;gap:5px;align-items:center;">
                        ${e.photo ? `<img src="${e.photo}" class="photo-thumb" onclick="window.open('${e.photo}')">` : `<button class="btn btn-outline btn-sm" onclick="openPhotoSourceChoice('plant', {pIdx:${pIdx}, entryId:'${e.id}'})">📸</button>`}
                    </div>
                </div>`;
            }).join('')}
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:10px;" onclick="closeModal()">إغلاق</button>
    `);
}

function addInvZone() {
    openModal(`
        <h3 class="card-title">📍 إضافة منطقة للجرد</h3>
        <input id="izName" list="globalZonesList" class="inp" placeholder="اختر أو اكتب اسم المنطقة (مثلاً: AR5)...">
        <div class="grid-2">
            <button class="btn btn-green" onclick="confirmAddInvZone()">دخول</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function confirmAddInvZone() {
    const name = document.getElementById('izName').value.trim();
    if (!name) return;
    const z = { id: 'z_' + Date.now(), name, plants: [] };
    getSite().inventory.push(z); activeInvZoneId = z.id;
    closeModal(); saveState(); renderAll();
}
function deleteInvZone(id) { if (confirm('حذف المنطقة؟')) { getSite().inventory = getSite().inventory.filter(z => z.id !== id); saveState(); renderInventory(getSite()); } }
function enterInvZone(id) { activeInvZoneId = id; activeEntryPrompt = null; renderAll(); }
function exitInvZone() { activeInvZoneId = null; activeEntryPrompt = null; renderAll(); }
function sortZonePlants() { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z) { z.plants.sort((a, b) => a.name.localeCompare(b.name, 'ar')); saveState(); renderInventory(getSite()); } }
function jumpAlpha(ch) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (!z) return; const t = z.plants.find(p => (p.name || '').trim().startsWith(ch)); if (t) document.getElementById('pbox_' + t.id)?.scrollIntoView({ behavior: 'smooth' }); }
function addInvPlant() { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (!z) return; z.plants.push({ id: 'p_' + Date.now(), name: 'نبات ' + (z.plants.length + 1), counts: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 }, entries: [], note: '' }); saveState(); renderInventory(getSite()); }
function renameInvPlant(pIdx, val) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z) { z.plants[pIdx].name = val; saveState(); } }
function deleteInvPlant(pIdx) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z && confirm('حذف النبات؟')) { z.plants.splice(pIdx, 1); saveState(); renderInventory(getSite()); } }
function updateInvPlantNote(pIdx, val) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z) { z.plants[pIdx].note = val; saveState(); } }
function changePlantCount(pIdx, cId, delta) {
    const site = getSite();
    const z = site.inventory.find(x => x.id === activeInvZoneId);
    const p = z.plants[pIdx];
    const cur = p.counts[cId] || 0;
    if (cur + delta < 0) return;
    p.counts[cId] = cur + delta;
    if (!p.entries) p.entries = [];
    const cObj = HEALTH_CONDITIONS.find(c => c.id === cId);
    if (delta > 0) {
        const entry = { id: 'e_' + Date.now(), date: state.activeDate, condId: cId, height: null, photo: null };
        p.entries.push(entry);
        const nowStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
        site.lastInvAction = { zoneId: z.id, zoneName: z.name, plantId: p.id, plantName: p.name, condId: cId, condName: cObj.name, height: null, time: nowStr };
        activeEntryPrompt = { plantId: p.id, condId: cId, entryId: entry.id, seq: p.entries.length };
    } else {
        for (let i = p.entries.length - 1; i >= 0; i--) { if (p.entries[i].condId === cId) { p.entries.splice(i, 1); break; } }
        activeEntryPrompt = null;
    }
    saveState(); renderInventory(site);
}
function setPlantEntryHeight(pIdx, entryId, val) {
    const site = getSite();
    const z = site.inventory.find(x => x.id === activeInvZoneId);
    const p = z.plants[pIdx];
    const ent = (p.entries || []).find(e => e.id === entryId);
    const num = parseFloat(val);
    if (ent) ent.height = (!isNaN(num) && num > 0) ? num : null;
    if (site.lastInvAction && site.lastInvAction.plantId === p.id) site.lastInvAction.height = ent ? ent.height : null;
    saveState(); renderInventory(site);
}
function undoLastInv() {
    const site = getSite(); const la = site.lastInvAction; if (!la) return;
    const z = site.inventory.find(x => x.id === la.zoneId);
    const p = z ? z.plants.find(x => x.id === la.plantId) : null;
    if (p && p.counts[la.condId] > 0) {
        p.counts[la.condId]--;
        for (let i = (p.entries || []).length - 1; i >= 0; i--) { if (p.entries[i].condId === la.condId) { p.entries.splice(i, 1); break; } }
    }
    site.lastInvAction = null; activeEntryPrompt = null; saveState(); renderInventory(site); showToast('↩️ تم التراجع');
}

/* ================= TAB 5: Issues, Incident Report (IR), SDL, OAR & Direct Excel Export ================= */
function renderExportAndIssues(site, log) {
    document.getElementById('issuesContainer').innerHTML = site.issues.length === 0
        ? `<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px;">لا توجد مشاكل مفتوحة</div>`
        : site.issues.map((iss, idx) => {
            const isOpen = iss.status === 'Open';
            return `
            <div class="meter-card ${isOpen ? 'faulty' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <b style="font-size:12px;">${esc(iss.code)} | 📍 ${esc(iss.zone)} (${esc(iss.severity)})</b>
                    <span class="badge" style="background:${isOpen ? '#fee2e2' : '#dcfce7'};color:${isOpen ? '#b91c1c' : '#166534'};">${isOpen ? 'Open' : 'Resolved'}</span>
                </div>
                <div style="font-size:12px;margin:5px 0;">${esc(iss.desc)}</div>
                <div style="display:flex;gap:5px;">
                    ${isOpen ? `<button class="btn btn-green btn-sm" onclick="resolveIssue(${idx})">✓ إغلاق</button>` : ''}
                    <button class="btn btn-outline btn-sm" onclick="openPhotoSourceChoice('issue', ${idx})">📸 ${iss.photo ? '✓' : 'صورة'}</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteIssue(${idx})">✕</button>
                </div>
            </div>`;
        }).join('');

    const irSdlItems = [
        ...log.incidents.map((ir, i) => `<div class="meter-card faulty"><b>🚨 ${esc(ir.code)} (${esc(ir.severity)}) — 📍 ${esc(ir.zone)}</b><div style="font-size:12px;">${esc(ir.type)}: ${esc(ir.action)}</div><button class="btn btn-outline btn-sm" style="color:var(--red);margin-top:4px;" onclick="deleteIncident(${i})">حذف</button></div>`),
        ...log.sdls.map((sd, i) => `<div class="meter-card"><b>📑 ${esc(sd.code)} (${esc(sd.severity)}) — 📍 ${esc(sd.zone)}</b><div style="font-size:12px;">${esc(sd.subject)}</div><button class="btn btn-outline btn-sm" style="color:var(--red);margin-top:4px;" onclick="deleteSdl(${i})">حذف</button></div>`)
    ];
    document.getElementById('irSdlContainer').innerHTML = irSdlItems.length
        ? irSdlItems.join('')
        : `<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px;">لا توجد تقارير حوادث أو انحرافات رسمية اليوم</div>`;

    document.getElementById('oarObs').value = log.oar.obs || '';
    document.getElementById('oarAna').value = log.oar.ana || '';
    document.getElementById('oarRec').value = log.oar.rec || '';
}

function openIssueModal() {
    openModal(`
        <h3 class="card-title">⚠️ تسجيل مشكلة ميدانية</h3>
        <label class="lbl">المنطقة:</label><input id="issZone" list="globalZonesList" class="inp" placeholder="مثلاً: B1 أو E2">
        <label class="lbl">درجة الخطورة:</label>
        <select id="issSev" class="inp"><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option><option value="Low">Low</option></select>
        <label class="lbl">وصف المشكلة:</label><textarea id="issDesc" class="inp" rows="3"></textarea>
        <div class="grid-2"><button class="btn btn-red" onclick="saveNewIssue()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveNewIssue() {
    const site = getSite();
    const desc = document.getElementById('issDesc').value.trim();
    if (!desc) return;
    const code = 'ISS-' + String(site.issues.length + 1).padStart(2, '0');
    site.issues.unshift({ id: 'i_' + Date.now(), code, date: state.activeDate, zone: document.getElementById('issZone').value.trim() || 'General', severity: document.getElementById('issSev').value, desc, status: 'Open', resolvedDate: '', photo: null });
    closeModal(); saveState(); renderExportAndIssues(site, getDayLog());
}
function resolveIssue(idx) { const iss = getSite().issues[idx]; iss.status = 'Resolved'; iss.resolvedDate = state.activeDate; saveState(); renderExportAndIssues(getSite(), getDayLog()); }
function deleteIssue(idx) { getSite().issues.splice(idx, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }

function openIncidentModal() {
    openModal(`
        <h3 class="card-title">🚨 نموذج تقرير حادث (Incident Report)</h3>
        <div class="grid-2">
            <div><label class="lbl">وقت الحادث:</label><input type="time" id="irTime" class="inp" value="10:30"></div>
            <div><label class="lbl">الموقع / المنطقة:</label><input id="irZone" list="globalZonesList" class="inp" placeholder="B1"></div>
        </div>
        <div class="grid-2">
            <div><label class="lbl">نوع الحادث:</label><input id="irType" class="inp" placeholder="كسر أنبوب / إصابة / معدة"></div>
            <div><label class="lbl">الخطورة:</label><select id="irSev" class="inp"><option value="Minor / طفيف">Minor / طفيف</option><option value="Moderate / متوسط">Moderate / متوسط</option><option value="Major / كبير">Major / كبير</option><option value="Critical / حرج">Critical / حرج</option></select></div>
        </div>
        <label class="lbl">الأشخاص المتورطون:</label><input id="irPersons" class="inp" placeholder="الأسماء...">
        <label class="lbl">ماذا حدث (التسلسل):</label><textarea id="irTimeline" class="inp" rows="2"></textarea>
        <label class="lbl">الإجراء الفوري المتخذ:</label><textarea id="irAction" class="inp" rows="2"></textarea>
        <div class="grid-2">
            <div><label class="lbl">رعاية طبية؟</label><select id="irMed" class="inp"><option value="No / لا">No / لا</option><option value="Yes / نعم">Yes / نعم</option></select></div>
            <div style="padding-top:16px;"><button class="btn btn-blue btn-full" onclick="openPhotoSourceChoice('ir_temp', 0)">📸 صورة الحادث</button></div>
        </div>
        <div class="grid-2"><button class="btn btn-orange" onclick="saveIncident()">حفظ تقرير الحادث</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
let tempModalPhoto = null;
function saveIncident() {
    const log = getDayLog();
    const code = 'IR-' + String(log.incidents.length + 1).padStart(3, '0');
    log.incidents.push({
        code, time: document.getElementById('irTime').value, zone: document.getElementById('irZone').value.trim() || 'General',
        type: document.getElementById('irType').value.trim(), severity: document.getElementById('irSev').value,
        persons: document.getElementById('irPersons').value.trim(), timeline: document.getElementById('irTimeline').value.trim(),
        action: document.getElementById('irAction').value.trim(), medical: document.getElementById('irMed').value, photo: tempModalPhoto
    });
    tempModalPhoto = null; closeModal(); saveState(); renderExportAndIssues(getSite(), log); showToast('🚨 تم حفظ تقرير الحادث ' + code);
}
function deleteIncident(i) { getDayLog().incidents.splice(i, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }

function openSdlModal() {
    openModal(`
        <h3 class="card-title">📑 سجل انحراف موقع (Site Deviation Log)</h3>
        <label class="lbl">موضوع الانحراف (Subject):</label><input id="sdlSub" class="inp" placeholder="مثلاً: أعمال حفر المقاول وتضرر خطوط الري">
        <div class="grid-2">
            <div><label class="lbl">المنطقة:</label><input id="sdlZone" list="globalZonesList" class="inp"></div>
            <div><label class="lbl">الخطورة:</label><select id="sdlSev" class="inp"><option value="Moderate / متوسط">Moderate / متوسط</option><option value="Major / كبير">Major / كبير</option><option value="Critical / حرج">Critical / حرج</option><option value="Minor / طفيف">Minor / طفيف</option></select></div>
        </div>
        <div class="grid-2">
            <div><label class="lbl">نوع الانحراف:</label><input id="sdlType" class="inp" placeholder="بنية تحتية / جدول"></div>
            <div><label class="lbl">الطرف المسؤول:</label><input id="sdlParty" class="inp" placeholder="المقاول / جهة خارجية"></div>
        </div>
        <label class="lbl">الملاحظة (OBS):</label><textarea id="sdlObs" class="inp" rows="2"></textarea>
        <label class="lbl">التحليل (ANA):</label><textarea id="sdlAna" class="inp" rows="2"></textarea>
        <label class="lbl">التوصية (REC):</label><textarea id="sdlRec" class="inp" rows="2"></textarea>
        <button class="btn btn-blue btn-full" onclick="openPhotoSourceChoice('sdl_temp', 0)">📸 إرفاق صورة دليل</button>
        <div class="grid-2"><button class="btn btn-purple" onclick="saveSdl()">حفظ الانحراف</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveSdl() {
    const log = getDayLog();
    const code = 'SDL-' + String(log.sdls.length + 1).padStart(3, '0');
    log.sdls.push({
        code, subject: document.getElementById('sdlSub').value.trim(), zone: document.getElementById('sdlZone').value.trim() || 'General',
        severity: document.getElementById('sdlSev').value, type: document.getElementById('sdlType').value.trim(),
        party: document.getElementById('sdlParty').value.trim(), obs: document.getElementById('sdlObs').value.trim(),
        ana: document.getElementById('sdlAna').value.trim(), rec: document.getElementById('sdlRec').value.trim(), photo: tempModalPhoto
    });
    tempModalPhoto = null; closeModal(); saveState(); renderExportAndIssues(getSite(), log); showToast('📑 تم حفظ سجل الانحراف ' + code);
}
function deleteSdl(i) { getDayLog().sdls.splice(i, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }

function saveOarFields() {
    const log = getDayLog();
    log.oar.obs = document.getElementById('oarObs').value;
    log.oar.ana = document.getElementById('oarAna').value;
    log.oar.rec = document.getElementById('oarRec').value;
    saveState();
}

function autoGenerateOAR() {
    const site = getSite(); const log = getDayLog();
    const blocked = log.tasks.filter(t => t.status.includes('Blocked') || t.status.includes('Not Started')).map(t => `${t.zones}: ${t.note || t.desc}`);
    const faultyMeters = log.meters.filter(m => m.status === 'faulty').map(m => `${m.name} (${m.note || 'عاطل'})`);
    const lowGauges = log.gauges.filter(g => g.val !== '' && parseFloat(g.val) < g.normal).map(g => `${g.name} (${g.val} bar)`);
    const openIssues = site.issues.filter(i => i.status === 'Open').map(i => `${i.code} [${i.zone}]: ${i.desc}`);
    const totalTanker = log.tasks.reduce((s, t) => s + (parseFloat(t.tankerLiters) || 0), 0);

    const obsParts = [];
    if (blocked.length) obsParts.push(`توقف/عدم تنفيذ الري في: ${blocked.join('؛ ')}.`);
    if (faultyMeters.length) obsParts.push(`عدادات مياه عاطلة: ${faultyMeters.join('، ')}.`);
    if (totalTanker > 0) obsParts.push(`تم تعويض الري بالتنكر بكمية إجمالية ${totalTanker.toLocaleString()} لتر.`);
    if (lowGauges.length) obsParts.push(`انخفاض ضغط في المقاييس: ${lowGauges.join('، ')}.`);
    if (openIssues.length) obsParts.push(`مشاكل ميدانية مفتوحة: ${openIssues.join('؛ ')}.`);

    log.oar.obs = obsParts.join('\n') || 'سارت الأعمال الميدانية والري وفق الخطة المقررة بدون معوقات.';
    log.oar.ana = (blocked.length || openIssues.length || faultyMeters.length)
        ? 'الأسباب الرئيسية تعود إلى الأعطال الفنية في خطوط الشبكة/العدادات أو أعمال الموقع الجارية.'
        : 'استقرار ضغط الشبكة والتزام الكادر بتوزيع المهام اليومية.';
    log.oar.rec = (blocked.length || openIssues.length || faultyMeters.length)
        ? 'توجيه فريق الصيانة لمعالجة التسريبات والعدادات العاطلة وتأمين حوضيات المياه للمناطق المتأثرة.'
        : 'الاستمرار على نفس جدول الري والمتابعة الدورية.';

    saveState(); renderExportAndIssues(site, log); showToast('🔄 تم توليد مسودة OAR تلقائياً');
}

/* ================= Direct ExcelJS Export (Embeds Photos Inside Cells!) ================= */
function openTemplateUploadModal() {
    openModal(`
        <h3 class="card-title">📄 قالب الـ DFL الأصلي</h3>
        <p style="font-size:12px;color:var(--muted);line-height:1.5;">
            الحالة الحالية: <b>${cachedTemplateArrayBuffer ? '✓ محفوظ (' + esc(state.company.templateName) + ')' : '⚠️ لم يُرفع بعد'}</b><br>
            ارفع ملف قالبكم الفارغ (<code>Al-Mutahida_DFL_186_Perfected.xlsx</code>) مرة واحدة وسيحفظه التطبيق في ذاكرة الهاتف ليملأه بالصور مباشرة في كل مرة.
        </p>
        <div class="grid-2">
            <button class="btn btn-green" onclick="document.getElementById('tplFileInput').click()">📂 اختيار ملف القالب</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}
function onTemplateFileSelected(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        saveTemplateToDB(ev.target.result, f.name);
        closeModal();
        showToast('✓ تم حفظ قالب الـ DFL في ذاكرة التطبيق');
    };
    r.readAsArrayBuffer(f);
}

function runPreExportCheck() {
    if (!cachedTemplateArrayBuffer) {
        showToast('⚠️ يرجى اختيار ملف قالب الـ DFL الفارغ أولاً');
        openTemplateUploadModal();
        return;
    }
    const log = getDayLog();
    const warnings = [];
    if (log.meters.some(m => m.status === 'working' && m.curr === '')) warnings.push('• توجد قراءة عداد شغال غير مدخلة.');
    if (log.meters.some(m => !m.photo)) warnings.push('• لم تُلتقط صورة عداد المياه اليوم.');
    if (log.tasks.some(t => t.status.includes('Blocked')) && !log.oar.obs) warnings.push('• توجد مهام متوقفة ولم يُملأ تقرير OAR بعد.');

    if (warnings.length > 0) {
        openModal(`
            <h3 class="card-title">🔍 تنبيهات ما قبل التصدير</h3>
            <div style="font-size:12px;color:#92400e;background:#fef3c7;padding:10px;border-radius:8px;margin-bottom:10px;line-height:1.6;">
                ${warnings.join('<br>')}
            </div>
            <div class="grid-2">
                <button class="btn btn-green" onclick="closeModal();generateDirectExcelDFL()">تصدير على أي حال</button>
                <button class="btn btn-outline" onclick="closeModal()">مراجعة البيانات</button>
            </div>
        `);
    } else {
        generateDirectExcelDFL();
    }
}

async function generateDirectExcelDFL() {
    if (typeof ExcelJS === 'undefined') { showToast('⚠️ مكتبة ExcelJS غير محملة، تأكد من الاتصال بالإنترنت مرة واحدة'); return; }
    showToast('⏳ جاري بناء ملف الـ DFL وزرع الصور...');
    try {
        const site = getSite();
        const log = getDayLog();
        const dayEn = getDayNameEn(state.activeDate);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(cachedTemplateArrayBuffer.slice(0));
        const ws = wb.getWorksheet('Daily Field Log');
        if (!ws) throw new Error('ورقة Daily Field Log غير موجودة في القالب');

        const embedPhotoInCell = (base64Url, targetWs, colZeroIdx, rowZeroIdx, widthPx = 110, heightPx = 75) => {
            if (!base64Url) return;
            const imgId = wb.addImage({ base64: base64Url, extension: 'jpeg' });
            targetWs.addImage(imgId, {
                tl: { col: colZeroIdx + 0.08, row: rowZeroIdx + 0.08 },
                ext: { width: widthPx, height: heightPx }
            });
            const rObj = targetWs.getRow(rowZeroIdx + 1);
            if (!rObj.height || rObj.height < 64) rObj.height = 66;
        };

        const photoRegistry = [];
        const registerPhoto = (b64, section, desc) => {
            if (!b64) return '';
            const fname = `PHOTO_${String(photoRegistry.length + 1).padStart(2, '0')}.jpg`;
            photoRegistry.push({ fileName: fname, section, description: desc, b64 });
            return fname;
        };

        // 1. Metadata
        ws.getCell('F5').value = log.dflNum;
        ws.getCell('F6').value = site.name;
        ws.getCell('B7').value = state.activeDate;
        ws.getCell('F7').value = dayEn;
        ws.getCell('B8').value = state.company.teamLead;
        ws.getCell('B9').value = state.company.shift;
        ws.getCell('F9').value = state.company.supervisor || 'Maitham Ibrahim';
        ws.getCell('B10').value = state.company.outsideRate;

        // 2. Section 2: Attendance (Rows 18..24)
        for (let r = 18; r <= 24; r++) {
            const w = log.attendance[r - 18];
            const row = ws.getRow(r);
            if (w) {
                row.hidden = false;
                ws.getCell(`A${r}`).value = r - 17;
                ws.getCell(`B${r}`).value = w.name;
                ws.getCell(`C${r}`).value = w.type;
                ws.getCell(`D${r}`).value = w.status;
                ws.getCell(`E${r}`).value = w.status.includes('Absent') ? '' : w.tIn;
                ws.getCell(`F${r}`).value = w.status.includes('Absent') ? '' : w.tOut;
                ws.getCell(`G${r}`).value = parseFloat(w.ot) || 0;
                ws.getCell(`H${r}`).value = w.note || '';
            } else {
                row.hidden = true;
            }
        }

        // 3. Section 3: Tasks (Rows 29..77 - 1 zone per row, vertical merge for shared task groups!)
        for (let r = 29; r <= 77; r++) {
            ['A','B','C','D','E','F','G','H','K','L'].forEach(col => {
                try { ws.unMergeCells(`${col}${r}`); } catch {}
                ws.getCell(`${col}${r}`).value = null;
            });
            try { ws.unMergeCells(`H${r}:J${r}`); } catch {}
            ws.mergeCells(`H${r}:J${r}`);
        }
        // Safe unmerge across A29:L77
        const existingMerges = Object.keys(ws._merges || {});
        existingMerges.forEach(m => {
            const match = m.match(/^[A-L](\d+):[A-L](\d+)$/);
            if (match && parseInt(match[1]) >= 29 && parseInt(match[2]) <= 77) {
                try { ws.unMergeCells(m); } catch {}
            }
        });
        for (let r = 29; r <= 77; r++) {
            ws.mergeCells(`H${r}:J${r}`);
        }

        // Expand any comma-separated zones into 1 row per zone while grouping consecutive identical tasks
        const expandedRows = [];
        log.tasks.forEach((t, gIdx) => {
            const zList = (t.zones || 'عام / General').split(',').map(s => s.trim()).filter(Boolean);
            zList.forEach((z, zIdx) => {
                expandedRows.push({
                    groupKey: `${gIdx}_${t.task}_${t.desc}_${t.dur}_${(t.workers||[]).join('/')}`,
                    task: t.task,
                    desc: t.desc,
                    zone: z,
                    dur: t.dur,
                    workersCount: (t.workers || []).length || 1,
                    status: t.status,
                    note: t.note || '',
                    workersStr: (t.workers || []).join(' / '),
                    photo: zIdx === 0 ? t.photo : null
                });
            });
        });

        const usedTaskCount = Math.min(expandedRows.length, 49);
        if (usedTaskCount > 0) {
            ws.getCell('A29').value = dayEn;
            if (usedTaskCount > 1) ws.mergeCells(`A29:A${29 + usedTaskCount - 1}`);
        }

        let rCursor = 29;
        let idx = 0;
        while (idx < usedTaskCount) {
            let endIdx = idx;
            while (endIdx + 1 < usedTaskCount && expandedRows[endIdx + 1].groupKey === expandedRows[idx].groupKey) {
                endIdx++;
            }
            const startR = rCursor;
            const endR = rCursor + (endIdx - idx);
            const first = expandedRows[idx];

            ws.getCell(`B${startR}`).value = first.task;
            ws.getCell(`C${startR}`).value = first.desc;
            ws.getCell(`F${startR}`).value = first.workersCount;
            ws.getCell(`K${startR}`).value = first.workersStr;

            if (endR > startR) {
                ws.mergeCells(`B${startR}:B${endR}`);
                ws.mergeCells(`C${startR}:C${endR}`);
                ws.mergeCells(`F${startR}:F${endR}`);
                ws.mergeCells(`K${startR}:K${endR}`);
            }

            for (let k = idx; k <= endIdx; k++) {
                const curR = rCursor + (k - idx);
                const item = expandedRows[k];
                ws.getRow(curR).hidden = false;
                ws.getCell(`D${curR}`).value = item.zone;
                ws.getCell(`E${curR}`).value = item.dur;
                ws.getCell(`G${curR}`).value = item.status;
                ws.getCell(`H${curR}`).value = item.note;
                if (item.photo) {
                    const ref = registerPhoto(item.photo, 'Section 3 - Tasks', `${item.task} - ${item.zone}`);
                    ws.getCell(`L${curR}`).value = ref;
                    embedPhotoInCell(item.photo, ws, 11, curR - 1, 95, 62);
                }
            }
            rCursor = endR + 1;
            idx = endIdx + 1;
        }
        for (let r = rCursor; r <= 77; r++) {
            ws.getRow(r).hidden = true;
        }

        // 4. Section 4: Equipment / Tools / Materials (Rows 82..88)
        for (let r = 82; r <= 88; r++) {
            const tl = log.tools[r - 82];
            const row = ws.getRow(r);
            if (tl) {
                row.hidden = false;
                ws.getCell(`A${r}`).value = r - 81;
                ws.getCell(`B${r}`).value = tl.name;
                ws.getCell(`C${r}`).value = tl.cat;
                ws.getCell(`D${r}`).value = tl.qty;
                ws.getCell(`E${r}`).value = tl.cond;
                ws.getCell(`F${r}`).value = tl.note || '';
            } else {
                row.hidden = true;
            }
        }

        // 5. Section 5: Site Readings
        for (let r = 93; r <= 97; r++) {
            const mo = log.moisture[r - 93];
            ws.getCell(`B${r}`).value = mo ? mo.zone : '';
            ws.getCell(`D${r}`).value = mo && mo.pct !== '' ? parseFloat(mo.pct) : null;
        }
        for (let r = 101; r <= 102; r++) {
            const m = log.meters[r - 101];
            const row = ws.getRow(r);
            if (m) {
                row.hidden = false;
                ws.getCell(`B${r}`).value = m.name;
                ws.getCell(`E${r}`).value = m.visual;
                if (m.status === 'faulty') {
                    ws.getCell(`F${r}`).value = 'Faulty';
                    ws.getCell(`G${r}`).value = 'Faulty';
                    ws.getCell(`H${r}`).value = 'Faulty';
                    ws.getCell(`I${r}`).value = `Faulty Meter: ${m.note || 'عاطل'}`;
                } else {
                    ws.getCell(`F${r}`).value = parseFloat(m.prev) || 0;
                    ws.getCell(`G${r}`).value = m.curr !== '' ? parseFloat(m.curr) : null;
                    ws.getCell(`I${r}`).value = m.note || '';
                }
                if (m.photo) {
                    registerPhoto(m.photo, 'Section 5B - Water Meters', m.name);
                    embedPhotoInCell(m.photo, ws, 9, r - 1, 95, 62);
                }
            } else {
                row.hidden = true;
            }
        }

        const irrigatedZones = Array.from(new Set(log.tasks.filter(t => t.task.includes('Irrigation') && t.status.includes('Completed')).map(t => t.zones))).join(', ');
        const totalTankerL = log.tasks.reduce((s, t) => s + (parseFloat(t.tankerLiters) || 0), 0);
        const machNote = (log.machinery.pumpHrs || log.machinery.genHrs || log.machinery.fuelL)
            ? ` | Pump: ${log.machinery.pumpHrs || 0}h, Gen: ${log.machinery.genHrs || 0}h, Fuel: ${log.machinery.fuelL || 0}L` : '';
        const tankerNote = totalTankerL > 0 ? ` | Tanker Total: ${totalTankerL.toLocaleString()} L` : '';
        ws.getCell('B105').value = log.perf.status;
        ws.getCell('E105').value = log.perf.duration;
        ws.getCell('B106').value = irrigatedZones;
        ws.getCell('B107').value = (log.perf.notes || '') + tankerNote + machNote;

        for (let r = 111; r <= 116; r++) {
            const g = log.gauges[r - 111];
            const row = ws.getRow(r);
            if (g) {
                row.hidden = false;
                ws.getCell(`B${r}`).value = g.name;
                ws.getCell(`C${r}`).value = g.val !== '' ? parseFloat(g.val) : null;
                ws.getCell(`E${r}`).value = g.normal;
                ws.getCell(`F${r}`).value = (g.val !== '' && parseFloat(g.val) < g.normal) ? 'Low / منخفض' : (g.val !== '' ? 'Normal / طبيعي' : '');
            } else {
                row.hidden = true;
            }
        }

        // 6. Section 6: Plants Health (Rows 120..124)
        const sickPlantsToday = [];
        site.inventory.forEach(z => z.plants.forEach(p => {
            const todayEntries = (p.entries || []).filter(e => e.date === state.activeDate);
            const aff = todayEntries.filter(e => e.condId !== 'c1');
            if (aff.length > 0) {
                const cObj = HEALTH_CONDITIONS.find(c => c.id === aff[0].condId);
                const pEnt = aff.find(e => e.photo) || todayEntries.find(e => e.photo);
                sickPlantsToday.push({
                    name: p.name,
                    sci: state.company.speciesDict[p.name] || '',
                    status: cObj ? cObj.dfl : 'متوسط',
                    signs: `${cObj ? cObj.name : ''} (${aff.length})${p.note ? ' - ' + p.note : ''}`,
                    zone: z.name,
                    photo: pEnt ? pEnt.photo : null
                });
            }
        }));
        for (let r = 120; r <= 124; r++) {
            const sp = sickPlantsToday[r - 120];
            const row = ws.getRow(r);
            if (sp) {
                row.hidden = false;
                ws.getCell(`B${r}`).value = sp.name;
                ws.getCell(`D${r}`).value = sp.sci;
                ws.getCell(`E${r}`).value = sp.status;
                ws.getCell(`F${r}`).value = sp.signs;
                ws.getCell(`H${r}`).value = sp.zone;
                if (sp.photo) {
                    const ref = registerPhoto(sp.photo, 'Section 6 - Plants Health', `${sp.name} (${sp.zone})`);
                    ws.getCell(`I${r}`).value = ref;
                    embedPhotoInCell(sp.photo, ws, 8, r - 1, 95, 62);
                }
            } else {
                row.hidden = true;
            }
        }

        // 7. Section 7: Incidents & Issues (Rows 128..131)
        const activeIssues = site.issues.filter(i => i.status === 'Open' || i.date === state.activeDate);
        for (let r = 128; r <= 131; r++) {
            const iss = activeIssues[r - 128];
            const row = ws.getRow(r);
            if (iss) {
                row.hidden = false;
                ws.getCell(`B${r}`).value = `${iss.code} [${iss.zone}] (${iss.status}): ${iss.desc}`;
                ws.getCell(`F${r}`).value = iss.severity;
                ws.getCell(`G${r}`).value = iss.code;
                if (iss.photo) registerPhoto(iss.photo, 'Section 7 - Issues', `${iss.code} - ${iss.zone}`);
            } else {
                row.hidden = true;
            }
        }

        // 8. Section 8: Photo References (Rows 135..140)
        for (let r = 135; r <= 140; r++) {
            const pr = photoRegistry[r - 135];
            const row = ws.getRow(r);
            if (pr) {
                row.hidden = false;
                ws.getCell(`B${r}`).value = pr.fileName;
                ws.getCell(`E${r}`).value = pr.section;
                ws.getCell(`H${r}`).value = pr.description;
            } else {
                row.hidden = true;
            }
        }

        // 9. Section 9 & 10: OAR & Sign-Off
        ws.getCell('B144').value = log.oar.obs || '';
        ws.getCell('B146').value = log.oar.ana || '';
        ws.getCell('B148').value = log.oar.rec || '';
        ws.getCell('A153').value = `Team Lead Name  /  اسم قائد الفريق: ${state.company.teamLead}`;
        ws.getCell('H153').value = `Date & Time  /  التاريخ والوقت: ${state.activeDate}`;

        // Populate Incident Report (2) if logged today
        const wsIr = wb.getWorksheet('Incident Report (2)');
        if (wsIr && log.incidents.length > 0) {
            const ir = log.incidents[0];
            wsIr.getCell('G5').value = ir.code;
            wsIr.getCell('G6').value = site.name;
            wsIr.getCell('D7').value = state.activeDate;
            wsIr.getCell('G7').value = ir.time;
            wsIr.getCell('D8').value = state.company.teamLead;
            wsIr.getCell('D9').value = `DFL-${log.dflNum}`;
            wsIr.getCell('G9').value = state.activeDate;
            wsIr.getCell('D12').value = ir.severity;
            wsIr.getCell('G16').value = ir.zone;
            wsIr.getCell('D19').value = ir.type;
            wsIr.getCell('C23').value = ir.persons;
            wsIr.getCell('D31').value = ir.timeline;
            wsIr.getCell('B39').value = ir.action;
            wsIr.getCell('D45').value = ir.medical;
            if (ir.photo) embedPhotoInCell(ir.photo, wsIr, 1, 39, 140, 90);
        }

        // Populate Site Deviation Log if logged today
        const wsSdl = wb.getWorksheet('Site Deviation Log');
        if (wsSdl && log.sdls.length > 0) {
            const sd = log.sdls[0];
            wsSdl.getCell('G5').value = sd.code;
            wsSdl.getCell('G6').value = site.name;
            wsSdl.getCell('D7').value = state.activeDate;
            wsSdl.getCell('D8').value = state.company.teamLead;
            wsSdl.getCell('D11').value = 'Open / مفتوح';
            wsSdl.getCell('G11').value = sd.severity;
            wsSdl.getCell('D15').value = sd.subject;
            wsSdl.getCell('D16').value = sd.zone;
            wsSdl.getCell('D17').value = sd.type;
            wsSdl.getCell('D18').value = sd.party;
            wsSdl.getCell('C30').value = sd.obs;
            wsSdl.getCell('C32').value = sd.ana;
            wsSdl.getCell('C34').value = sd.rec;
            if (sd.photo) embedPhotoInCell(sd.photo, wsSdl, 2, 37, 140, 90);
        }

        const outBuffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        const outName = `Al-Mutahida_DFL_${log.dflNum}_${state.activeDate}.xlsx`;
        a.href = URL.createObjectURL(blob);
        a.download = outName;
        a.click();
        showToast(`✅ تم تنزيل ${outName} بالصور المدمجة!`);
    } catch (err) {
        alert('حدث خطأ أثناء توليد الإكسيل: ' + err.message);
    }
}

function exportGeminiWeatherPrompt() {
    const site = getSite(); const log = getDayLog(); const dayEn = getDayNameEn(state.activeDate);
    const promptTxt = `مرحباً Gemini،
أحتاج منك مساعدتي في إكمال البيانات التحليلية لتقرير DFL-${log.dflNum} لموقع (${site.name}) بتاريخ ${state.activeDate} (${dayEn}):
1. اجلب لي حالة الطقس لمدينة الحلة بتاريخ ${state.activeDate} (الأحوال، درجة الحرارة الصغرى، العظمى، سرعة الرياح km/h، نسبة الرطوبة %) بصيغة جدول جاهز للنسخ إلى الصف 13 من الـ DFL.
2. راجع مسودة تقرير قائد الفريق (OAR) التالية وحسّن صياغتها الإدارية باللغتين الإنجليزية والعربية:
- OBS: ${log.oar.obs || 'لا يوجد'}
- ANA: ${log.oar.ana || 'لا يوجد'}
- REC: ${log.oar.rec || 'لا يوجد'}`;

    openModal(`
        <h3 class="card-title">🤖 أمر الطقس والتحليل لـ Gemini (خفيف بدون صور)</h3>
        <textarea id="gmLightBox" class="inp" rows="9" readonly style="font-size:12px;">${esc(promptTxt)}</textarea>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="navigator.clipboard.writeText(document.getElementById('gmLightBox').value);showToast('📋 تم النسخ!')">📋 نسخ النص</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}

/* ================= Camera, Gallery & Voice Dictation ================= */
function openPhotoSourceChoice(type, ctx) {
    pendingPhotoCtx = { type, ctx };
    openModal(`
        <h3 class="card-title">📸 إرفاق صورة توثيقية</h3>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="closeModal();triggerFileInp('camFileInput')">📸 الكاميرا</button>
            <button class="btn btn-green" onclick="closeModal();triggerFileInp('galFileInput')">🖼️ الاستوديو</button>
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="closeModal()">إلغاء</button>
    `);
}
function triggerFileInp(id) { const el = document.getElementById(id); el.value = ''; el.click(); }

function onPhotoSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !pendingPhotoCtx) return;
    const { type, ctx } = pendingPhotoCtx;
    pendingPhotoCtx = null;

    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const maxDim = state.company.photoQuality === 'original' ? Math.max(img.width, img.height) : 1600;
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                else { w = Math.round(w * maxDim / h); h = maxDim; }
            }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d');
            g.drawImage(img, 0, 0, w, h);

            const fs = Math.max(26, Math.round(Math.max(w, h * 0.7) * 0.032));
            const barH = Math.round(fs * 2.4);
            g.fillStyle = 'rgba(15,23,42,0.86)';
            g.fillRect(0, h - barH, w, barH);
            g.fillStyle = '#22c55e';
            g.fillRect(0, h - barH, w, 5);
            g.fillStyle = '#fde047';
            g.font = `bold ${fs}px sans-serif`;
            g.fillText(`${getSite().name.split('/')[0].trim()} | ${state.activeDate} | DFL-${getDayLog().dflNum}`, 20, h - Math.round(barH * 0.35));

            const dataUrl = c.toDataURL('image/jpeg', 0.88);
            const log = getDayLog();
            if (type === 'task') log.tasks[ctx].photo = dataUrl;
            else if (type === 'meter') log.meters[ctx].photo = dataUrl;
            else if (type === 'issue') getSite().issues[ctx].photo = dataUrl;
            else if (type === 'ir_temp' || type === 'sdl_temp') { tempModalPhoto = dataUrl; showToast('📸 تم إرفاق الصورة للنموذج'); return; }
            else if (type === 'plant') {
                const z = getSite().inventory.find(x => x.id === activeInvZoneId);
                const p = z ? z.plants[ctx.pIdx] : null;
                const ent = p ? (p.entries || []).find(x => x.id === ctx.entryId) : null;
                if (ent) ent.photo = dataUrl;
            }
            saveState(); renderAll(); showToast('📸 تم حفظ الصورة وختم البيانات');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function startDictation(targetId, onDone) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('⚠️ المتصفح لا يدعم الإملاء الصوتي المباشر، استخدم مايكروفون الكيبورد'); return; }
    const rec = new SR();
    rec.lang = 'ar-IQ';
    rec.interimResults = false;
    showToast('🎤 تحدث الآن...');
    rec.onresult = e => {
        const text = e.results[0][0].transcript;
        const el = document.getElementById(targetId);
        if (el) {
            el.value = (el.value ? el.value + ' ' : '') + text;
            if (onDone) onDone(el.value);
        }
        showToast('✓ تم تحويل الصوت إلى نص');
    };
    rec.onerror = () => showToast('⚠️ تعذر التقاط الصوت');
    rec.start();
}

/* ================= Settings, New Site & Backup ================= */
function openNewSiteModal() {
    openModal(`
        <h3 class="card-title">🏗️ إضافة موقع جديد للشركة</h3>
        <label class="lbl">اسم الموقع (عربي / إنجليزي):</label>
        <input id="nsName" class="inp" placeholder="مثلاً: Al-Kufa Project / مشروع الكوفة">
        <label class="lbl">رقم DFL البدائي:</label>
        <input type="number" id="nsDfl" class="inp" value="1">
        <label class="lbl">المناطق (مفصولة بفاصلة):</label>
        <input id="nsZones" class="inp" value="Z1, Z2, Z3, Z4, Nursery, Admin">
        <div class="grid-2">
            <button class="btn btn-green" onclick="createNewSite()">إنشاء الموقع</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function createNewSite() {
    const name = document.getElementById('nsName').value.trim();
    if (!name) return;
    const id = 'site_' + Date.now();
    const zones = document.getElementById('nsZones').value.split(',').map(s => s.trim()).filter(Boolean);
    state.sites[id] = {
        id, name, nextDfl: parseInt(document.getElementById('nsDfl').value) || 1,
        zones: zones.length ? zones : ['Z1', 'عام / General'],
        meters: [{ id: 'm_' + Date.now(), name: 'Main Water Meter', lastReading: 0 }],
        gauges: [{ id: 'g_' + Date.now(), name: 'Main-PWG', normal: 2.0 }],
        plan: {}, inventory: [], issues: [], stopMarker: null, lastInvAction: null, logs: {}
    };
    state.activeSiteId = id; activeInvZoneId = null; getDayLog();
    closeModal(); saveState(); renderAll(); showToast('✓ تم إنشاء الموقع: ' + name);
}

function openSettingsModal() {
    openModal(`
        <h3 class="card-title">⚙️ إعدادات الشركة والتطبيق</h3>
        <label class="lbl">قائد الفريق (Team Lead):</label>
        <input id="stTl" class="inp" value="${esc(state.company.teamLead)}">
        <label class="lbl">المشرف (Supervisor Ref):</label>
        <input id="stSup" class="inp" value="${esc(state.company.supervisor || 'Maitham Ibrahim')}">
        <div class="grid-2">
            <div>
                <label class="lbl">وحدة الأطوال:</label>
                <select id="stUnit" class="inp">
                    <option value="م" ${state.company.heightUnit === 'م' ? 'selected' : ''}>المتر (م)</option>
                    <option value="سم" ${state.company.heightUnit === 'سم' ? 'selected' : ''}>السنتيمتر (سم)</option>
                </select>
            </div>
            <div>
                <label class="lbl">أجر العامل الخارجي (IQD):</label>
                <input type="number" id="stRate" class="inp" value="${state.company.outsideRate}">
            </div>
        </div>
        <button class="btn btn-blue btn-full" onclick="closeModal();openTemplateUploadModal()">📄 تحديث قالب الـ DFL الفارغ</button>
        <button class="btn btn-outline btn-full" style="color:var(--red);" onclick="purgeOldPhotos()">🧹 تنظيف الصور الأقدم من 30 يوم</button>
        <div class="grid-2">
            <button class="btn btn-green" onclick="saveSettings()">حفظ</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}
function saveSettings() {
    state.company.teamLead = document.getElementById('stTl').value.trim();
    state.company.supervisor = document.getElementById('stSup').value.trim();
    state.company.heightUnit = document.getElementById('stUnit').value;
    state.company.outsideRate = parseFloat(document.getElementById('stRate').value) || 25000;
    closeModal(); saveState(); renderAll(); showToast('✓ تم حفظ الإعدادات');
}
function purgeOldPhotos() {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    Object.values(state.sites).forEach(s => {
        Object.entries(s.logs).forEach(([d, l]) => {
            if (d < cutoff) { l.tasks.forEach(t => t.photo = null); l.meters.forEach(m => m.photo = null); }
        });
        s.inventory.forEach(z => z.plants.forEach(p => (p.entries || []).forEach(e => { if (e.date < cutoff) e.photo = null; })));
    });
    saveState(); showToast('🧹 تم حذف الصور القديمة مع بقاء كل الأرقام والسجلات');
}

function downloadFullBackup() {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TFF_FullBackup_${state.activeDate}.json`;
    a.click();
}
function triggerBackupRestore() { const i = document.getElementById('backupFileInput'); i.value = ''; i.click(); }
function onBackupFileLoaded(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
        try {
            const parsed = JSON.parse(ev.target.result);
            if (parsed && parsed.sites) { state = parsed; saveState(); renderAll(); showToast('✓ تم استيراد النسخة الاحتياطية'); }
        } catch { showToast('⚠️ ملف غير صالح'); }
    };
    r.readAsText(f);
}

function openModal(html) { document.getElementById('genericModalBody').innerHTML = html; document.getElementById('genericModal').classList.add('active'); }
function closeModal() { document.getElementById('genericModal').classList.remove('active'); }

window.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    getDayLog();
    renderAll();
});
