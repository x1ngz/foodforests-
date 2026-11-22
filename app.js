/* ==========================================================================
   منصة غابات الغذاء (The Food Forests) - نظام العمليات الميدانية المتكامل
   ========================================================================== */

const DB_NAME = 'TFF_FOS_DB_V1';
const DB_STORE = 'state';
let db = null, saveTimer = null, pendingPhotoCtx = null, activeInvZoneId = null, activeEntryPrompt = null;

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
    { name: 'Transport E3W', cat: 'Equipment / معدة', qty: 1, cond: 'Good / جيد' },
    { name: 'Garden broom (مكنسة حدائق)', cat: 'Tool / أداة', qty: 1, cond: 'Good / جيد' },
    { name: 'Grass Trimmer / Lawn Mower (آلة جز عشب)', cat: 'Equipment / معدة', qty: 2, cond: 'Good / جيد' },
    { name: 'Gardening gloves (كفوف حدائق)', cat: 'Tool / أداة', qty: 3, cond: 'Good / جيد' },
    { name: 'اكياس نفايات', cat: 'Material / مادة', qty: 5, cond: 'Good / جيد' }
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
        shift: 'Morning Shift',
        outsideRate: 25000,
        heightUnit: 'م',
        photoQuality: 'original',
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
            lastInvAction: null,
            logs: {}
        }
    }
};

/* ================= IndexedDB Storage ================= */
function initDB() {
    return new Promise(resolve => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore(DB_STORE);
        req.onsuccess = e => {
            db = e.target.result;
            const tx = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get('root');
            tx.onsuccess = () => {
                if (tx.result && tx.result.sites) state = tx.result;
                resolve();
            };
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

function getSite() { return state.sites[state.activeSiteId] || Object.values(state.sites)[0]; }

function getDayLog(dateStr = state.activeDate) {
    const site = getSite();
    if (!site.logs[dateStr]) {
        const sortedDates = Object.keys(site.logs).sort();
        const prevDate = sortedDates.filter(d => d < dateStr).pop();
        const prevLog = prevDate ? site.logs[prevDate] : null;
        site.logs[dateStr] = {
            dflNum: site.nextDfl++,
            attendance: state.company.staffPool.map((s, idx) => ({
                id: 'w_' + idx, name: s.name, type: s.type,
                status: 'Present / حاضر', tIn: s.tIn || '08:00', tOut: s.tOut || '16:00', ot: 0, note: ''
            })),
            tasks: [],
            meters: site.meters.map(m => {
                const prevM = prevLog && prevLog.meters ? prevLog.meters.find(x => x.id === m.id) : null;
                const startVal = prevM && prevM.curr !== '' && prevM.curr != null ? prevM.curr : (m.lastReading || 0);
                return { id: m.id, name: m.name, status: 'working', prev: startVal, curr: '', visual: 'Clear / صافية', note: '', photo: null };
            }),
            gauges: site.gauges.map(g => ({ id: g.id, name: g.name, normal: g.normal, val: '', note: '' })),
            moisture: [1, 2, 3, 4, 5].map(n => ({ id: n, zone: '', pct: '', note: '' })),
            perf: { status: 'جيد', duration: '', notes: '' },
            tools: [],
            oar: { obs: '', ana: '', rec: '' }
        };
        saveState();
    }
    return site.logs[dateStr];
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

    // Site Selector
    const sel = document.getElementById('siteSelect');
    sel.innerHTML = Object.values(state.sites).map(s => `<option value="${s.id}" ${s.id === site.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('') +
        `<option value="__NEW__">+ إضافة موقع جديد للشركة</option>`;

    document.getElementById('dateInput').value = state.activeDate;
    document.getElementById('dayBadge').textContent = dayEn;
    document.getElementById('planDayLabel').textContent = dayEn;
    document.getElementById('dflNumInput').value = log.dflNum;

    // Datalists
    document.getElementById('globalZonesList').innerHTML = site.zones.map(z => `<option value="${esc(z)}">`).join('');
    document.getElementById('globalTasksList').innerHTML = state.company.customTasks.map(t => `<option value="${esc(t)}">`).join('');
    document.getElementById('globalToolsList').innerHTML = state.company.customTools.map(t => `<option value="${esc(t)}">`).join('');
    const pNames = new Set(Object.keys(state.company.speciesDict));
    site.inventory.forEach(z => z.plants.forEach(p => pNames.add(p.name)));
    document.getElementById('globalPlantsList').innerHTML = Array.from(pNames).map(n => `<option value="${esc(n)}">`).join('');

    // Meter Reminder Check (Shift start/end or unphotographed working meter)
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

function onDateChange(val) {
    if (!val) return;
    state.activeDate = val;
    getDayLog(val);
    saveState();
    renderAll();
}

function onDflNumChange(val) {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) {
        getDayLog().dflNum = n;
        getSite().nextDfl = Math.max(getSite().nextDfl, n + 1);
        saveState();
    }
}

function onSiteSelectChange(val) {
    if (val === '__NEW__') {
        openNewSiteModal();
        renderAll();
        return;
    }
    state.activeSiteId = val;
    activeInvZoneId = null;
    getDayLog();
    saveState();
    renderAll();
    showToast('📍 تم التبديل إلى: ' + getSite().name);
}

/* ================= TAB 1: Attendance ================= */
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
                <div>
                    <div style="font-weight:bold;font-size:13px;">${esc(w.name.split('/')[1] || w.name)}</div>
                    <div style="font-size:10px;color:var(--muted);">${esc(w.type)}</div>
                </div>
                <div class="att-pills">
                    <button class="att-pill ${isPres ? 'st-present' : ''}" onclick="setWorkerAtt(${idx},'Present / حاضر')">حاضر</button>
                    <button class="att-pill ${isLate ? 'st-late' : ''}" onclick="setWorkerAtt(${idx},'Late / متأخر')">متأخر</button>
                    <button class="att-pill ${isAbs ? 'st-absent' : ''}" onclick="setWorkerAtt(${idx},'Absent / غائب')">غائب</button>
                </div>
            </div>
            ${!isAbs ? `
            <div class="worker-sub">
                <span>دخول: <input class="time-mini" value="${esc(w.tIn)}" onchange="updateWorkerField(${idx},'tIn',this.value)"></span>
                <span>خروج: <input class="time-mini" value="${esc(w.tOut)}" onchange="updateWorkerField(${idx},'tOut',this.value)"></span>
                <span>OT: <input type="number" step="0.5" class="time-mini" style="width:46px;" value="${w.ot || 0}" onchange="updateWorkerField(${idx},'ot',this.value)"></span>
            </div>` : ''}
        </div>`;
    }).join('');
}

function setWorkerAtt(idx, st) { getDayLog().attendance[idx].status = st; saveState(); renderAttendance(getDayLog()); }
function updateWorkerField(idx, k, v) { getDayLog().attendance[idx][k] = v; saveState(); renderAttendance(getDayLog()); }
function markAllPresent() { getDayLog().attendance.forEach(w => w.status = 'Present / حاضر'); saveState(); renderAttendance(getDayLog()); showToast('✓ تم تسجيل الجميع حاضرين'); }
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
        <div class="grid-2">
            <button class="btn btn-green" onclick="confirmAddWorker()">إضافة</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function confirmAddWorker() {
    const name = document.getElementById('newWName').value.trim();
    const type = document.getElementById('newWType').value;
    if (!name) return;
    const tOut = type.includes('Employee') ? '17:00' : '16:00';
    getDayLog().attendance.push({ id: 'w_' + Date.now(), name, type, status: 'Present / حاضر', tIn: '08:00', tOut, ot: 0, note: '' });
    if (!state.company.staffPool.some(s => s.name === name)) state.company.staffPool.push({ name, type, tIn: '08:00', tOut });
    closeModal(); saveState(); renderAttendance(getDayLog()); showToast('✓ تمت إضافة ' + name);
}

/* ================= TAB 2: Tasks & Irrigation ================= */
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
            tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية', photo: null
        });
    });
    saveState(); renderTasks(log); showToast(`⚡ تم تحميل ${planItems.length} مهام ري ليوم ${dayEn}`);
}

function renderTasks(log) {
    const el = document.getElementById('tasksContainer');
    if (log.tasks.length === 0) {
        el.innerHTML = `<div class="card" style="text-align:center;color:var(--muted);padding:24px;">💧 اضغط على زر تحميل خطة الري أعلاه أو أضف مهمة جديدة</div>`;
        return;
    }
    el.innerHTML = log.tasks.map((t, idx) => {
        const isDone = t.status.includes('Completed');
        const isProg = t.status.includes('Progress');
        const isBlock = t.status.includes('Blocked') || t.status.includes('Not Started');
        const wNames = t.workers && t.workers.length ? t.workers.join(' / ') : 'تعيين عمال...';
        return `
        <div class="card task-box ${isBlock ? 'is-blocked' : (isDone ? 'is-done' : '')}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;">
                <div style="font-weight:bold;font-size:14px;">${esc(t.task.split('/')[1] || t.task)}</div>
                <span class="zone-pill">📍 ${esc(t.zones)}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);margin:4px 0 8px 0;">${esc(t.desc)}</div>
            <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;">
                <span class="chip" onclick="editTaskDuration(${idx})">⏱️ ${esc(t.dur)}</span>
                <span class="chip" onclick="openAssignWorkersModal(${idx})">👷 ${esc(wNames)} (${t.workers ? t.workers.length : 0})</span>
                <span class="chip" onclick="capturePhoto('task', ${idx})">📸 ${t.photo ? 'تم التصوير ✓' : 'صورة'}</span>
                <span class="chip" style="color:var(--red);" onclick="deleteTask(${idx})">🗑️</span>
            </div>

            ${t.isTanker ? `
            <div class="tanker-banner">
                <span>🚚 التنكر: ${t.tankerLiters ? `${Number(t.tankerLiters).toLocaleString()} L | ${t.tankerPpm || '-'} ppm` : 'لم تُسجل الكمية بعد'}</span>
                <button class="btn btn-blue btn-sm" onclick="openTankerModal(${idx})">تسجيل الكمية</button>
            </div>` : ''}

            <div class="st-bar">
                <button class="st-btn ${isDone ? 'on-done' : ''}" onclick="setTaskStatus(${idx},'Completed / مكتمل')">مكتمل</button>
                <button class="st-btn ${isProg ? 'on-prog' : ''}" onclick="setTaskStatus(${idx},'In Progress / جاري')">جاري</button>
                <button class="st-btn ${isBlock ? 'on-block' : ''}" onclick="setTaskStatus(${idx},'Blocked / متوقف')">متوقف / لم يبدأ</button>
            </div>

            ${isBlock ? `
            <div class="block-drawer">
                <label class="lbl" style="color:var(--red);">سبب التوقف (يظهر في DFL و OAR):</label>
                <input class="inp" style="margin-bottom:6px;background:white;" value="${esc(t.note)}" placeholder="اكتب السبب..." onchange="updateTaskNote(${idx}, this.value)">
                <div>
                    <span class="chip" onclick="setTaskNoteChip(${idx}, 'Not included in the current irrigation plan for today')">غير مشمول بخطة اليوم</span>
                    <span class="chip" onclick="setTaskNoteChip(${idx}, 'Blocked due to leak/break in drip/main supply pipe')">كسر/تسريب أنبوب</span>
                    <span class="chip" onclick="setTaskNoteChip(${idx}, 'Blocked due to soil preparation and excavation works')">أعمال حفريات/تربة</span>
                    <span class="chip" onclick="setTaskNoteChip(${idx}, 'Water tanker was not provided')">عدم توفر حوضية</span>
                </div>
            </div>` : `
            <input class="inp" style="margin-top:8px;margin-bottom:0;font-size:12px;padding:6px 8px;" value="${esc(t.note)}" placeholder="ملاحظة إضافية للمهمة..." onchange="updateTaskNote(${idx}, this.value)">`}
        </div>`;
    }).join('');
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
            <div>
                <label class="lbl">المدة:</label>
                <input id="mTaskDur" class="inp" value="1:00 hr">
            </div>
            <div style="display:flex;align-items:center;padding-top:14px;">
                <label style="font-size:12px;font-weight:bold;"><input type="checkbox" id="mTaskTanker"> تتضمن ري بالتنكر 🚚</label>
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
        customRawTask: isStandard ? '' : rawTask,
        zones, dur, status: 'Completed / مكتمل', workers: [], note: '',
        isTanker, tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية', photo: null
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
    const selected = Array.from(document.querySelectorAll('.wk-chk:checked')).map(c => c.value);
    getDayLog().tasks[tIdx].workers = selected;
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
            <button class="btn btn-blue" onclick="saveTankerData(${tIdx})">حفظ في DFL</button>
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
        const formatted = `${t.tankerPpm ? t.tankerPpm + ' ppm \\ ' : ''}${Number(t.tankerLiters).toLocaleString()} L`;
        t.note = formatted;
    }
    closeModal(); saveState(); renderTasks(getDayLog()); renderReadingsAndTools(getDayLog()); showToast('🚚 تم تسجيل بيانات التنكر');
}

/* ================= TAB 3: Readings & Tools ================= */
function jumpToMeters() { switchTab('tools'); window.scrollTo(0, 0); }

function renderReadingsAndTools(log) {
    const totalTankerL = log.tasks.reduce((sum, t) => sum + (parseFloat(t.tankerLiters) || 0), 0);
    const anyFaulty = log.meters.some(m => m.status === 'faulty');

    document.getElementById('tankerSummaryBox').innerHTML = (totalTankerL > 0 || anyFaulty) ? `
        <div class="tanker-banner" style="margin-bottom:10px;">
            <span>🚚 إجمالي مياه التنكر اليوم: ${totalTankerL.toLocaleString()} لتر (${(totalTankerL / 1000).toFixed(1)} m³)</span>
            ${anyFaulty ? `<span style="color:var(--red);">⚠️ يوجد عداد عاطل</span>` : ''}
        </div>` : '';

    document.getElementById('metersContainer').innerHTML = log.meters.map((m, idx) => {
        const isFaulty = m.status === 'faulty';
        const usage = (!isFaulty && m.curr !== '' && !isNaN(parseFloat(m.curr))) ? (parseFloat(m.curr) - parseFloat(m.prev || 0)).toFixed(2) : '-';
        return `
        <div class="meter-card ${isFaulty ? 'faulty' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <b style="font-size:13px;">${esc(m.name)}</b>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-sm ${!isFaulty ? 'btn-green' : 'btn-outline'}" onclick="setMeterStatus(${idx},'working')">شغال</button>
                    <button class="btn btn-sm ${isFaulty ? 'btn-red' : 'btn-outline'}" onclick="setMeterStatus(${idx},'faulty')">عاطل</button>
                    <button class="btn btn-sm btn-blue" onclick="capturePhoto('meter', ${idx})">📸 ${m.photo ? '✓' : ''}</button>
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
            <div style="font-size:12px;font-weight:bold;">${esc(g.name)}</div>
            <div style="font-size:10px;color:var(--muted);margin-bottom:5px;">الطبيعي: ${g.normal} bar</div>
            <input type="number" step="0.1" class="inp" style="margin:0;padding:6px;text-align:center;font-weight:bold;" value="${esc(g.val)}" placeholder="bar" onchange="updateGaugeVal(${idx}, this.value)">
        </div>`;
    }).join('');

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
                <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteTool(${idx})">✕</button>
            </div>`).join('');
}

function setMeterStatus(idx, st) { getDayLog().meters[idx].status = st; saveState(); renderReadingsAndTools(getDayLog()); }
function updateMeterField(idx, k, v) {
    getDayLog().meters[idx][k] = v;
    if (k === 'curr' && v !== '') getSite().meters[idx].lastReading = parseFloat(v);
    saveState(); renderReadingsAndTools(getDayLog());
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
function addCustomGauge() {
    const name = prompt('اسم مقياس الضغط الجديد (مثلاً: D1-PWG):');
    if (!name) return;
    const id = 'g_' + Date.now();
    getSite().gauges.push({ id, name, normal: 2.0 });
    getDayLog().gauges.push({ id, name, normal: 2.0, val: '', note: '' });
    saveState(); renderReadingsAndTools(getDayLog());
}
function updatePerfField(k, v) { getDayLog().perf[k] = v; saveState(); }
function updateMoisture(idx, k, v) { getDayLog().moisture[idx][k] = v; saveState(); }
function copyYesterdayTools() {
    const site = getSite();
    const prevDate = Object.keys(site.logs).sort().filter(d => d < state.activeDate).pop();
    const sourceTools = (prevDate && site.logs[prevDate].tools.length) ? site.logs[prevDate].tools : DEFAULT_TOOLS;
    getDayLog().tools = JSON.parse(JSON.stringify(sourceTools));
    saveState(); renderReadingsAndTools(getDayLog()); showToast('📋 تم نسخ قائمة الأدوات');
}
function openToolModal() {
    openModal(`
        <h3 class="card-title">🧰 إضافة معدة / أداة / مادة</h3>
        <label class="lbl">الاسم (اختر أو اكتب أي مادة حرة):</label>
        <input id="tlName" list="globalToolsList" class="inp" placeholder="مثلاً: اكياس نفايات أو منقطات...">
        <div class="grid-2">
            <div>
                <label class="lbl">الفئة:</label>
                <select id="tlCat" class="inp">
                    <option value="Equipment / معدة">Equipment / معدة</option>
                    <option value="Tool / أداة">Tool / أداة</option>
                    <option value="Material / مادة">Material / مادة</option>
                </select>
            </div>
            <div>
                <label class="lbl">الكمية:</label>
                <input type="number" id="tlQty" class="inp" value="1">
            </div>
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
    getDayLog().tools.push({
        name, cat: document.getElementById('tlCat').value,
        qty: parseFloat(document.getElementById('tlQty').value) || 1,
        cond: document.getElementById('tlCond').value
    });
    if (!state.company.customTools.includes(name)) state.company.customTools.push(name);
    closeModal(); saveState(); renderReadingsAndTools(getDayLog());
}
function deleteTool(idx) { getDayLog().tools.splice(idx, 1); saveState(); renderReadingsAndTools(getDayLog()); }

/* ================= TAB 4: Plant Inventory & Health ================= */
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
            </div>
            <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="undoLastInv()">↩️ تراجع</button>
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

    // Alphabet Scroller
    const letters = ['أ','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','هـ','و','ي'];
    alphaBox.innerHTML = `<div class="alpha-bar">${letters.map(l => `<div class="alpha-ch has" onclick="jumpAlpha('${l}')">${l}</div>`).join('')}</div>`;

    invBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:6px;">
            <button class="btn btn-blue btn-sm" onclick="exitInvZone()">➡️ المناطق</button>
            <b>📍 ${esc(zone.name)} (${zone.plants.length})</b>
            <button class="btn btn-outline btn-sm" onclick="sortZonePlants()">🔤 ترتيب</button>
        </div>
        ${zone.plants.map((p, pIdx) => {
            const total = Object.values(p.counts).reduce((a, b) => a + (b || 0), 0);
            const hArr = (p.entries || []).map(e => parseFloat(e.height)).filter(n => !isNaN(n) && n > 0);
            const avgH = hArr.length ? (hArr.reduce((a, b) => a + b, 0) / hArr.length).toFixed(2) : null;
            return `
            <div class="plant-box" id="pbox_${p.id}">
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <input list="globalPlantsList" class="inp" style="margin:0;font-weight:bold;font-size:15px;" value="${esc(p.name)}" onchange="renameInvPlant(${pIdx}, this.value)">
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
                                    <button class="btn btn-blue btn-sm" onclick="capturePhoto('plant', {pIdx:${pIdx}, entryId:'${activeEntryPrompt.entryId}'})">📸</button>
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
    getSite().inventory.push(z);
    activeInvZoneId = z.id;
    closeModal(); saveState(); renderAll();
}
function deleteInvZone(id) { if (confirm('حذف المنطقة؟')) { getSite().inventory = getSite().inventory.filter(z => z.id !== id); saveState(); renderInventory(getSite()); } }
function enterInvZone(id) { activeInvZoneId = id; activeEntryPrompt = null; renderAll(); }
function exitInvZone() { activeInvZoneId = null; activeEntryPrompt = null; renderAll(); }
function sortZonePlants() {
    const z = getSite().inventory.find(x => x.id === activeInvZoneId);
    if (z) { z.plants.sort((a, b) => a.name.localeCompare(b.name, 'ar')); saveState(); renderInventory(getSite()); }
}
function jumpAlpha(ch) {
    const z = getSite().inventory.find(x => x.id === activeInvZoneId);
    if (!z) return;
    const target = z.plants.find(p => (p.name || '').trim().startsWith(ch));
    if (target) document.getElementById('pbox_' + target.id)?.scrollIntoView({ behavior: 'smooth' });
}
function addInvPlant() {
    const z = getSite().inventory.find(x => x.id === activeInvZoneId);
    if (!z) return;
    z.plants.push({ id: 'p_' + Date.now(), name: 'نبات ' + (z.plants.length + 1), counts: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 }, entries: [], note: '' });
    saveState(); renderInventory(getSite());
}
function renameInvPlant(pIdx, val) {
    const z = getSite().inventory.find(x => x.id === activeInvZoneId);
    if (z) { z.plants[pIdx].name = val; saveState(); }
}
function deleteInvPlant(pIdx) {
    const z = getSite().inventory.find(x => x.id === activeInvZoneId);
    if (z && confirm('حذف النبات؟')) { z.plants.splice(pIdx, 1); saveState(); renderInventory(getSite()); }
}
function updateInvPlantNote(pIdx, val) {
    const z = getSite().inventory.find(x => x.id === activeInvZoneId);
    if (z) { z.plants[pIdx].note = val; saveState(); }
}
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
        for (let i = p.entries.length - 1; i >= 0; i--) {
            if (p.entries[i].condId === cId) { p.entries.splice(i, 1); break; }
        }
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
    const site = getSite();
    const la = site.lastInvAction;
    if (!la) return;
    const z = site.inventory.find(x => x.id === la.zoneId);
    const p = z ? z.plants.find(x => x.id === la.plantId) : null;
    if (p && p.counts[la.condId] > 0) {
        p.counts[la.condId]--;
        for (let i = (p.entries || []).length - 1; i >= 0; i--) {
            if (p.entries[i].condId === la.condId) { p.entries.splice(i, 1); break; }
        }
    }
    site.lastInvAction = null;
    activeEntryPrompt = null;
    saveState(); renderInventory(site); showToast('↩️ تم التراجع');
}

/* ================= TAB 5: Issues, OAR & Gemini Export ================= */
function renderExportAndIssues(site, log) {
    const issEl = document.getElementById('issuesContainer');
    issEl.innerHTML = site.issues.length === 0
        ? `<div style="font-size:12px;color:var(--muted);text-align:center;padding:10px;">لا توجد مشاكل أو انحرافات مسجلة</div>`
        : site.issues.map((iss, idx) => {
            const isOpen = iss.status === 'Open';
            return `
            <div class="meter-card ${isOpen ? 'faulty' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <b style="font-size:12px;">${esc(iss.code)} | 📍 ${esc(iss.zone)} (${esc(iss.severity)})</b>
                    <span class="badge" style="background:${isOpen ? '#fee2e2' : '#dcfce7'};color:${isOpen ? '#b91c1c' : '#166534'};">${isOpen ? 'مفتوحة Open' : 'محلولة Resolved'}</span>
                </div>
                <div style="font-size:12px;margin:5px 0;">${esc(iss.desc)}</div>
                <div style="display:flex;gap:5px;">
                    ${isOpen ? `<button class="btn btn-green btn-sm" onclick="resolveIssue(${idx})">✓ إغلاق المشكلة</button>` : ''}
                    <button class="btn btn-outline btn-sm" onclick="capturePhoto('issue', ${idx})">📸 ${iss.photo ? 'تم التوثيق ✓' : 'صورة'}</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteIssue(${idx})">✕</button>
                </div>
            </div>`;
        }).join('');

    document.getElementById('oarObs').value = log.oar.obs || '';
    document.getElementById('oarAna').value = log.oar.ana || '';
    document.getElementById('oarRec').value = log.oar.rec || '';
}

function openIssueModal() {
    openModal(`
        <h3 class="card-title">⚠️ تسجيل مشكلة / انحراف ميداني</h3>
        <label class="lbl">المنطقة:</label>
        <input id="issZone" list="globalZonesList" class="inp" placeholder="مثلاً: B1 أو E2">
        <label class="lbl">درجة الخطورة:</label>
        <select id="issSev" class="inp">
            <option value="Medium / متوسط">Medium / متوسط</option>
            <option value="High / عالي">High / عالي</option>
            <option value="Critical / حرج">Critical / حرج</option>
            <option value="Low / منخفض">Low / منخفض</option>
        </select>
        <label class="lbl">وصف المشكلة:</label>
        <textarea id="issDesc" class="inp" rows="3" placeholder="مثلاً: كسر في الأنبوب الرئيسي بسبب أعمال الحفر..."></textarea>
        <div class="grid-2">
            <button class="btn btn-red" onclick="saveNewIssue()">حفظ المشكلة</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function saveNewIssue() {
    const site = getSite();
    const zone = document.getElementById('issZone').value.trim() || 'عام / General';
    const severity = document.getElementById('issSev').value;
    const desc = document.getElementById('issDesc').value.trim();
    if (!desc) return;
    const code = 'ISS-' + String(site.issues.length + 1).padStart(2, '0');
    site.issues.unshift({ id: 'i_' + Date.now(), code, date: state.activeDate, zone, severity, desc, status: 'Open', resolvedDate: '', photo: null });
    closeModal(); saveState(); renderExportAndIssues(site, getDayLog()); showToast('⚠️ تم تسجيل المشكلة ' + code);
}
function resolveIssue(idx) {
    const iss = getSite().issues[idx];
    iss.status = 'Resolved';
    iss.resolvedDate = state.activeDate;
    saveState(); renderExportAndIssues(getSite(), getDayLog()); showToast('✓ تم إغلاق المشكلة ' + iss.code);
}
function deleteIssue(idx) { getSite().issues.splice(idx, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }
function saveOarFields() {
    const log = getDayLog();
    log.oar.obs = document.getElementById('oarObs').value;
    log.oar.ana = document.getElementById('oarAna').value;
    log.oar.rec = document.getElementById('oarRec').value;
    saveState();
}

function autoGenerateOAR() {
    const site = getSite();
    const log = getDayLog();
    const blocked = log.tasks.filter(t => t.status.includes('Blocked') || t.status.includes('Not Started'))
        .map(t => `${t.zones}: ${t.note || t.desc}`);
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

function exportTodayForGemini() {
    const site = getSite();
    const log = getDayLog();
    const dayEn = getDayNameEn(state.activeDate);
    const photos = [];

    const addPhotoRef = (b64, section, desc) => {
        if (!b64) return '';
        const id = 'PHOTO_' + String(photos.length + 1).padStart(2, '0') + '.jpg';
        photos.push({ fileName: id, section, description: desc, base64: b64 });
        return id;
    };

    const tasksExport = log.tasks.map(t => ({
        day: dayEn,
        task: t.task,
        briefDescription: t.desc,
        zone: t.zones,
        time: t.dur,
        workersCount: (t.workers || []).length || 1,
        status: t.status,
        notes: t.note,
        workersAssigned: (t.workers || []).join(' / '),
        imageRef: addPhotoRef(t.photo, 'Section 3 - Tasks', `${t.task} - ${t.zones}`)
    }));

    const metersExport = log.meters.map(m => ({
        name: m.name,
        status: m.status,
        visualQuality: m.visual,
        prevReading: m.status === 'working' ? m.prev : 'Faulty',
        currReading: m.status === 'working' ? m.curr : 'Faulty',
        notes: m.status === 'faulty' ? `Faulty Meter: ${m.note}` : m.note,
        imageRef: addPhotoRef(m.photo, 'Section 5 - Site Readings', `Water Meter: ${m.name}`)
    }));

    const plantsHealthToday = [];
    site.inventory.forEach(z => {
        z.plants.forEach(p => {
            const todayEntries = (p.entries || []).filter(e => e.date === state.activeDate);
            const affectedEntries = todayEntries.filter(e => e.condId !== 'c1');
            if (affectedEntries.length > 0) {
                const firstAff = affectedEntries[0];
                const cObj = HEALTH_CONDITIONS.find(c => c.id === firstAff.condId);
                const photoEntry = affectedEntries.find(e => e.photo) || todayEntries.find(e => e.photo);
                plantsHealthToday.push({
                    plantName: p.name,
                    scientificName: state.company.speciesDict[p.name] || '',
                    healthStatusDFL: cObj ? cObj.dfl : 'متوسط',
                    visibleSigns: `${cObj ? cObj.name : ''} (العدد اليوم: ${affectedEntries.length})${firstAff.height ? ' - الطول: ' + firstAff.height + state.company.heightUnit : ''}${p.note ? ' - ' + p.note : ''}`,
                    zone: z.name,
                    imageRef: addPhotoRef(photoEntry ? photoEntry.photo : null, 'Section 6 - Plants Health', `${p.name} (${z.name})`)
                });
            }
        });
    });

    const issuesExport = site.issues.filter(i => i.status === 'Open' || i.date === state.activeDate || i.resolvedDate === state.activeDate)
        .map(i => ({
            code: i.code,
            zone: i.zone,
            severity: i.severity,
            status: i.status,
            description: `${i.code} [${i.zone}] (${i.status}): ${i.desc}`,
            imageRef: addPhotoRef(i.photo, 'Section 6 - Incidents', `${i.code} - ${i.zone}`)
        }));

    const payload = {
        system: 'The Food Forests — Field Operations Export for Gemini DFL',
        metadata: {
            entity: 'The Food Forests (TFF)',
            siteName: site.name,
            formId: log.dflNum,
            date: state.activeDate,
            day: dayEn,
            teamLead: state.company.teamLead,
            shift: state.company.shift,
            outsideWorkerRateIQD: state.company.outsideRate
        },
        section2_attendance: log.attendance,
        section3_tasks: tasksExport,
        section4_equipment: log.tools,
        section5_siteReadings: {
            moisture5A: log.moisture.filter(m => m.zone || m.pct),
            waterMeters5B: metersExport,
            irrigationPerformance5C: log.perf,
            barGauges5D: log.gauges
        },
        section6_plantsHealth: plantsHealthToday,
        section7_incidentsAndIssues: issuesExport,
        section8_photoReferences: photos.map((p, i) => ({ index: i + 1, fileName: p.fileName, section: p.section, description: p.description })),
        section9_teamLeadOAR: log.oar,
        embeddedPhotosBase64: photos
    };

    const fileName = `TFF_DFL${log.dflNum}_${site.id}_${state.activeDate}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();

    const geminiPrompt = `مرحباً Gemini،
مرفق لك ملفان لتعبئة تقرير العمل اليومي الميداني (DFL):
1. قالب الـ DFL الفارغ (Excel).
2. ملف بيانات اليوم المصدّر من التطبيق (${fileName}).

المطلوب تنفيذه بدقة عبر Python داخل القالب الأصلي نفسه (In-Place) دون تغيير نوع الخط أو الحدود أو القوائم المنسدلة أو الخلايا المدمجة:
- حدّث Metadata: Form ID = ${log.dflNum}، Site Name = "${site.name}"، Date = ${state.activeDate}، Day = ${dayEn}، Team Lead = "${state.company.teamLead}".
- القسم 1 (Weather): اجلب طقس مدينة الحلة لتاريخ ${state.activeDate} واملأ درجات الحرارة والرياح والرطوبة.
- القسم 2 (Attendance): املأ كادر اليوم من section2_attendance.
- القسم 3 (Tasks): املأ المهام من section3_tasks (واحترم الدمج المنطقي للمناطق والمدد المتطابقة).
- القسم 4 (Equipment): املأ المعدات والمواد من section4_equipment.
- القسم 5 (Site Readings): املأ الرطوبة، العدادات، أداء الري، ومقاييس الضغط من section5_siteReadings.
- القسم 6 (Plants Health): املأ النباتات المتأثرة من section6_plantsHealth.
- القسم 7 (Incidents & Deviations): املأ المشاكل المفتوحة واليومية من section7_incidentsAndIssues.
- القسم 8 (Photo References): املأ مراجع الصور من section8_photoReferences، واستخرج الصور من embeddedPhotosBase64 في ملف .zip بأسمائها المطابقة.
- القسم 9 (Team Lead OAR): اكتب OBS و ANA و REC من section9_teamLeadOAR.
- أخفِ (Hide) الصفوف الاحتياطية الفارغة في كل قسم ولا تحذفها حتى لا تتأثر الخلايا المدمجة، ثم أعطني رابط تحميل ملف الإكسيل النهائي + ملف الصور المضغوط.`;

    openModal(`
        <h3 class="card-title">🤖 جاهز للتعبئة في Gemini!</h3>
        <p style="font-size:12px;color:var(--muted);line-height:1.5;">تم تنزيل ملف <b>${esc(fileName)}</b>. افتح <b>محادثة جديدة</b> في Gemini، ارفع هذا الملف مع قالب الـ DFL الفارغ، والصق النص التالي:</p>
        <textarea id="gmPromptBox" class="inp" rows="9" readonly style="font-size:12px;">${esc(geminiPrompt)}</textarea>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="copyGmPrompt()">📋 نسخ الأمر</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}
function copyGmPrompt() {
    navigator.clipboard.writeText(document.getElementById('gmPromptBox').value);
    showToast('📋 تم نسخ الأمر! الصقه في محادثة Gemini الجديدة');
}

/* ================= Camera & Watermark ================= */
function capturePhoto(type, ctx) {
    pendingPhotoCtx = { type, ctx };
    const inp = document.getElementById('camFileInput');
    inp.value = '';
    inp.click();
}
function onPhotoSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !pendingPhotoCtx) return;
    const { type, ctx } = pendingPhotoCtx;
    pendingPhotoCtx = null;

    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            const isOrig = state.company.photoQuality === 'original';
            const maxDim = isOrig ? Math.max(img.width, img.height) : 2048;
            let w = img.width, h = img.height;
            if (!isOrig && (w > maxDim || h > maxDim)) {
                if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
                else { w = Math.round(w * maxDim / h); h = maxDim; }
            }
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d');
            g.drawImage(img, 0, 0, w, h);

            const fs = Math.max(32, Math.round(Math.max(w, h * 0.7) * 0.032));
            const barH = Math.round(fs * 2.4);
            g.fillStyle = 'rgba(15,23,42,0.86)';
            g.fillRect(0, h - barH, w, barH);
            g.fillStyle = '#22c55e';
            g.fillRect(0, h - barH, w, 6);
            g.fillStyle = '#fde047';
            g.font = `bold ${fs}px sans-serif`;
            g.fillText(`${getSite().name.split('/')[0].trim()} | ${state.activeDate} | DFL-${getDayLog().dflNum}`, 24, h - Math.round(barH * 0.35));

            const dataUrl = c.toDataURL('image/jpeg', 0.92);
            const log = getDayLog();
            if (type === 'task') log.tasks[ctx].photo = dataUrl;
            else if (type === 'meter') log.meters[ctx].photo = dataUrl;
            else if (type === 'issue') getSite().issues[ctx].photo = dataUrl;
            else if (type === 'plant') {
                const z = getSite().inventory.find(x => x.id === activeInvZoneId);
                const p = z ? z.plants[ctx.pIdx] : null;
                const ent = p ? (p.entries || []).find(x => x.id === ctx.entryId) : null;
                if (ent) ent.photo = dataUrl;
            }
            saveState(); renderAll(); showToast('📸 تم التقاط الصورة وختم البيانات');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
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
        id, name,
        nextDfl: parseInt(document.getElementById('nsDfl').value) || 1,
        zones: zones.length ? zones : ['Z1', 'عام / General'],
        meters: [{ id: 'm_' + Date.now(), name: 'Main Water Meter', lastReading: 0 }],
        gauges: [{ id: 'g_' + Date.now(), name: 'Main-PWG', normal: 2.0 }],
        plan: {}, inventory: [], issues: [], lastInvAction: null, logs: {}
    };
    state.activeSiteId = id;
    activeInvZoneId = null;
    getDayLog();
    closeModal(); saveState(); renderAll(); showToast('✓ تم إنشاء الموقع: ' + name);
}

function openSettingsModal() {
    openModal(`
        <h3 class="card-title">⚙️ إعدادات الشركة والتطبيق</h3>
        <label class="lbl">قائد الفريق (Team Lead):</label>
        <input id="stTl" class="inp" value="${esc(state.company.teamLead)}">
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
        <label class="lbl">جودة الصور:</label>
        <select id="stQual" class="inp">
            <option value="original" ${state.company.photoQuality === 'original' ? 'selected' : ''}>الدقة الأصلية الكاملة (Original)</option>
            <option value="uhd" ${state.company.photoQuality === 'uhd' ? 'selected' : ''}>فائقة الوضوح (2048px)</option>
        </select>
        <button class="btn btn-outline btn-full" style="color:var(--red);" onclick="purgeOldPhotos()">🧹 تنظيف الصور الأقدم من 30 يوم (لتخفيف الذاكرة)</button>
        <div class="grid-2">
            <button class="btn btn-green" onclick="saveSettings()">حفظ</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}
function saveSettings() {
    state.company.teamLead = document.getElementById('stTl').value.trim();
    state.company.heightUnit = document.getElementById('stUnit').value;
    state.company.outsideRate = parseFloat(document.getElementById('stRate').value) || 25000;
    state.company.photoQuality = document.getElementById('stQual').value;
    closeModal(); saveState(); renderAll(); showToast('✓ تم حفظ الإعدادات');
}
function purgeOldPhotos() {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    Object.values(state.sites).forEach(s => {
        Object.entries(s.logs).forEach(([d, l]) => {
            if (d < cutoff) {
                l.tasks.forEach(t => t.photo = null);
                l.meters.forEach(m => m.photo = null);
            }
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
            if (parsed && parsed.sites) {
                state = parsed;
                saveState(); renderAll(); showToast('✓ تم استيراد النسخة الاحتياطية');
            }
        } catch { showToast('⚠️ ملف غير صالح'); }
    };
    r.readAsText(f);
}

function openModal(html) {
    document.getElementById('genericModalBody').innerHTML = html;
    document.getElementById('genericModal').classList.add('active');
}
function closeModal() { document.getElementById('genericModal').classList.remove('active'); }

window.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    getDayLog();
    renderAll();
});
