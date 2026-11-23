
/* ==========================================================================
   منصة غابات الغذاء (The Food Forests) - النظام الميداني المتكامل V8
   - المؤقت الحي + تعديل ساعة البداية + الاستراحة + رادار الري + كشف المستحقات
   ========================================================================== */

const DB_NAME = 'TFF_FOS_DB_V8';
const DB_STORE = 'state';
let db = null, saveTimer = null, pendingPhotoCtx = null, activeInvZoneId = null, activeEntryPrompt = null;
let undoStack = [];
let tempModalPhotos = [];
let invFilterState = 'all';
let lastUsedHeight = null;
let radarExpanded = false;

const TANKER_FULL_CAPACITY = 24000;
const DURATION_OPTIONS = [
    '0:10 hr', '0:15 hr', '0:20 hr', '0:30 hr', '0:45 hr',
    '1:00 hr', '1:15 hr', '1:30 hr', '2:00 hr', '2:30 hr',
    '3:00 hr', '4:00 hr', '5:00 hr', '6:00 hr'
];
const MASTER_ZONES = ['OL1','OL2','OR1','OR2','AL1','AL2','AR1','AR2','AR3','AR4','AR5','B1','B2','B3','B4','C1','C2','C3','C4','E1','E2','D1','H1','H2','H3','H4','H5','OH','Admin','Nursery','AC','W','عام / General'];
const MASTER_TASKS = [
    'Irrigation  /  ري المنطقة', 'Pruning  /  تقليم الأشجار', 'Weeding  /  إزالة الأعشاب',
    'Fertilizing  /  تسميد', 'Planting  /  زراعة وتشتيل', 'Harvesting  /  حصاد',
    'Soil Preparation  /  تحضير التربة', 'Pest Control  /  رش المبيدات أو العلاج',
    'Inspection  /  فحص ومراقبة', 'Cleaning  /  جمع النفايات وتنظيف الموقع',
    'Equipment Maintenance  /  صيانة المعدات', 'Main Line & Equipment Maintenance  /  صيانة الأنابيب الرئيسية والمعدات',
    'Water System Check  /  فحص نظام الري', 'Meter Reading  /  قراءة العدادات', 'Other  /  أخرى'
];
const IRR_DESC_PRESETS = [
    { label: 'Drip only', text: 'Drip only', dur: '1:00 hr' },
    { label: 'Sprinklers only', text: 'Sprinklers only', dur: '0:10 hr' },
    { label: 'Hose (spray gun)', text: 'Hose with multi-outlet spray gun', dur: '0:30 hr' },
    { label: 'Seedlings hose', text: 'Irrigate seedlings using a hose with multi-outlet spray gun', dur: '0:30 hr' },
    { label: 'Water tanker', text: 'Irrigating the area using a water tanker', dur: '1:00 hr' }
];
const QUICK_NOTE_PHRASES = [
    { label: 'كسر أنبوب رئيسي', text: 'Main supply pipe break / كسر في أنبوب التغذية الرئيسي' },
    { label: 'تسريب أنبوب تنقيط', text: 'Drip line leak / تسريب في أنبوب التنقيط' },
    { label: 'عطل صمام / قفل', text: 'Valve malfunction / عطل في صمام الري' },
    { label: 'أعمال حفريات', text: 'Blocked due to excavation works / متوقف بسبب أعمال الحفريات' },
    { label: 'عدم توفر حوضية', text: 'Water tanker was not provided / عدم توفر حوضية مياه' }
];
const DICTATION_CORRECTIONS = [
    [/عيري بيك|يري بيك|اير بيك|عيري بايب/gi, 'irrigation pipe'],
    [/سبلاي بايب|سبلاي بيك/gi, 'supply pipe'],
    [/درب لاين|دريب لاين/gi, 'drip line'],
    [/سبرنكلر|سبريكلر/gi, 'sprinklers'],
    [/تانكر|تنكر/gi, 'water tanker'],
    [/فالف|فلف/gi, 'valve']
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
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'B3', dur: '0:15 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Sprinklers only', zones: 'B4', dur: '0:10 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'Admin', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Sunday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'D1', dur: '1:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'E1, E2, H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Monday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'AR5, C3, OL2, OR2', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'AL2, AC', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Water System Check  /  فحص نظام الري', desc: 'Routine line inspection, valve checks, filter cleaning', zones: 'عام / General', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Tuesday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'B1, B2, C4', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'W', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'B3', dur: '0:15 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Sprinklers only', zones: 'B4', dur: '0:10 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'C1, C2', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Wednesday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'D1', dur: '1:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'E1, E2, H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'Admin', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Thursday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'AR5, C3, OL2, OR2', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'AL2, AC', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Water System Check  /  فحص نظام الري', desc: 'Routine line inspection, valve checks, filter cleaning', zones: 'عام / General', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Friday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'W', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'C1, C2', dur: '1:00 hr' },
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
            logs: {}
        }
    }
};

/* ================= IndexedDB, Silent Auto-Migration & Normalization ================= */
function initDB() {
    return new Promise(resolve => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
        };
        req.onsuccess = async e => {
            db = e.target.result;
            let loaded = false;
            await new Promise(r => {
                const tx = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get('root');
                tx.onsuccess = () => { if (tx.result && tx.result.sites) { state = tx.result; loaded = true; } r(); };
                tx.onerror = () => r();
            });
            if (!loaded) {
                for (let i = 7; i >= 1; i--) {
                    const oldDbName = 'TFF_FOS_DB_V' + i;
                    const oldReq = indexedDB.open(oldDbName);
                    try {
                        const oldRes = await new Promise(r => {
                            oldReq.onsuccess = ev => {
                                const odb = ev.target.result;
                                if (!odb.objectStoreNames.contains(DB_STORE)) { r(null); return; }
                                const otx = odb.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get('root');
                                otx.onsuccess = () => r(otx.result);
                                otx.onerror = () => r(null);
                            };
                            oldReq.onerror = () => r(null);
                        });
                        if (oldRes && oldRes.sites) {
                            state = oldRes;
                            saveState();
                            break;
                        }
                    } catch {}
                }
            }
            resolve();
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

function ensurePhotosArr(obj) {
    if (!obj) return [];
    if (!Array.isArray(obj.photos)) {
        obj.photos = obj.photo ? [obj.photo] : [];
        delete obj.photo;
    }
    return obj.photos;
}

function getDayLog(dateStr = state.activeDate) {
    const site = getSite();
    if (!site.logs[dateStr]) {
        const sortedDates = Object.keys(site.logs).sort();
        const prevDate = sortedDates.filter(d => d < dateStr).pop();
        const prevLog = prevDate ? site.logs[prevDate] : null;
        site.logs[dateStr] = {
            dflNum: site.nextDfl++,
            attendance: state.company.staffPool.map((s, idx) => ({
                id: 'w_' + idx + '_' + Date.now(), name: s.name, type: s.type,
                status: 'Present / حاضر', tIn: s.tIn || '08:00', tOut: s.tOut || '16:00', ot: 0, note: ''
            })),
            tasks: [],
            meters: site.meters.map(m => {
                const prevM = prevLog && prevLog.meters ? prevLog.meters.find(x => x.id === m.id) : null;
                const startVal = prevM && prevM.curr !== '' && prevM.curr != null ? prevM.curr : (m.lastReading || 0);
                return { id: m.id, name: m.name, status: 'working', prev: startVal, curr: '', visual: 'Clear / صافية', note: '', photos: [] };
            }),
            gauges: site.gauges.map(g => ({ id: g.id, name: g.name, normal: g.normal, val: '', note: '' })),
            machinery: { pumpHrs: '', genHrs: '', fuelL: '' },
            moisture: [1, 2, 3, 4, 5].map(n => ({ id: n, zone: '', pct: '', note: '' })),
            perf: { status: 'جيد', duration: '', zonesIrrigated: '', zonesManualEdit: false, pressureNotes: '', notes: '' },
            tools: [],
            incidents: [],
            sdls: [],
            secHistory: { att: [], tasks: [], tools: [], inv: [], issues: [] },
            oar: { obs: '', ana: '', rec: '' }
        };
        saveState();
    }
    const l = site.logs[dateStr];
    if (!l.secHistory) l.secHistory = { att: [], tasks: [], tools: [], inv: [], issues: [] };
    ['att', 'tasks', 'tools', 'inv', 'issues'].forEach(k => { if (!l.secHistory[k]) l.secHistory[k] = []; });
    if (!l.machinery) l.machinery = { pumpHrs: '', genHrs: '', fuelL: '' };
    if (!l.incidents) l.incidents = [];
    if (!l.sdls) l.sdls = [];
    if (!l.perf) l.perf = { status: 'جيد', duration: '', zonesIrrigated: '', zonesManualEdit: false, pressureNotes: '', notes: '' };
    l.tasks.forEach(t => ensurePhotosArr(t));
    l.meters.forEach(m => ensurePhotosArr(m));
    site.issues.forEach(i => ensurePhotosArr(i));
    return l;
}

/* ================= Live Elapsed Timer, Retroactive Start Time & Pause/Break ================= */
function getTaskNetElapsedMs(t, nowMs = Date.now()) {
    if (!t.startTimeMs) return 0;
    const endPoint = t.pausedAtMs ? t.pausedAtMs : nowMs;
    const pausedMs = t.pausedTotalMs || 0;
    return Math.max(0, endPoint - t.startTimeMs - pausedMs);
}

function formatMsAsHrMin(ms) {
    const totalMins = Math.floor(ms / 60000);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}:${String(m).padStart(2, '0')} hr`;
}

function formatTime24FromMs(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function openRetroStartTimeModal(tIdx) {
    const t = getDayLog().tasks[tIdx];
    const currentHHMM = formatTime24FromMs(t.startTimeMs || Date.now());
    openModal(`
        <h3 class="card-title">🕒 تعديل وقت بداية المهمة (${esc(t.zones)})</h3>
        <p style="font-size:12px;color:var(--muted);">حدد الساعة الفعلية التي بدأ بها العمال العمل في هذه المنطقة (حتى لو كنت بعيداً عنهم وقتها):</p>
        <input type="time" id="retroTimeInp" class="inp" style="font-size:16px;font-weight:bold;text-align:center;" value="${currentHHMM}">
        <div style="margin-bottom:8px;">
            <span class="chip" onclick="shiftRetroMins(-30)">-30 دقيقة</span>
            <span class="chip" onclick="shiftRetroMins(-60)">-1 ساعة</span>
            <span class="chip" onclick="shiftRetroMins(-120)">-2 ساعة</span>
        </div>
        <div class="grid-2">
            <button class="btn btn-green" onclick="saveRetroStartTime(${tIdx})">اعتماد وقت البداية</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}

function shiftRetroMins(deltaMins) {
    const inp = document.getElementById('retroTimeInp');
    if (!inp || !inp.value) return;
    const [hh, mm] = inp.value.split(':').map(Number);
    const d = new Date();
    d.setHours(hh, mm + deltaMins, 0, 0);
    inp.value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function saveRetroStartTime(tIdx) {
    const val = document.getElementById('retroTimeInp').value;
    if (!val) return;
    const [hh, mm] = val.split(':').map(Number);
    const baseDate = new Date(state.activeDate + 'T00:00:00');
    baseDate.setHours(hh, mm, 0, 0);
    pushUndo('تعديل وقت بداية مهمة');
    const t = getDayLog().tasks[tIdx];
    t.startTimeMs = baseDate.getTime();
    t.pausedTotalMs = 0;
    t.pausedAtMs = null;
    if (!t.status.includes('Progress')) t.status = 'In Progress / جاري';
    logSectionHistory('tasks', 'edit', `ضبط بداية ${t.zones} على ${val}`, { taskId: t.id });
    closeModal(); saveState(); renderTasks(getDayLog()); checkTaskTimers();
    showToast(`🕒 تم ضبط وقت البداية على ${val}`);
}

function toggleTaskPause(tIdx) {
    pushUndo('إيقاف/استئناف مؤقت مهمة');
    const t = getDayLog().tasks[tIdx];
    const now = Date.now();
    if (!t.startTimeMs) t.startTimeMs = now;
    if (t.pausedAtMs) {
        t.pausedTotalMs = (t.pausedTotalMs || 0) + (now - t.pausedAtMs);
        t.pausedAtMs = null;
        showToast('▶️ تم استئناف العمل والمؤقت');
    } else {
        t.pausedAtMs = now;
        showToast('⏸️ تم إيقاف المؤقت مؤقتاً (وقت استراحة)');
    }
    saveState(); renderTasks(getDayLog());
}

function updateLiveTimersDomOnly() {
    const log = getDayLog();
    const now = Date.now();
    document.querySelectorAll('[data-live-task-id]').forEach(el => {
        const tid = el.getAttribute('data-live-task-id');
        const t = log.tasks.find(x => x.id === tid);
        if (t && t.status.includes('Progress') && t.startTimeMs) {
            const netStr = formatMsAsHrMin(getTaskNetElapsedMs(t, now));
            el.textContent = t.pausedAtMs ? `⏸️ متوقف للاستراحة (${netStr})` : `⏱️ مستمر منذ ${netStr}`;
        }
    });
}
setInterval(updateLiveTimersDomOnly, 20000);

/* ================= Zone Thirst Radar (Last Irrigated Tracker) ================= */
function computeZoneThirstData() {
    const site = getSite();
    const activeMs = new Date(state.activeDate + 'T12:00:00').getTime();
    const sortedDates = Object.keys(site.logs).filter(d => d <= state.activeDate).sort();
    const lastIrrMap = {};

    sortedDates.forEach(dStr => {
        const dl = site.logs[dStr];
        (dl.tasks || []).forEach(t => {
            if (t.task.includes('Irrigation') && t.status.includes('Completed')) {
                (t.zones || '').split(',').map(z => z.trim()).filter(Boolean).forEach(z => {
                    lastIrrMap[z] = dStr;
                });
            }
        });
    });

    const targetZones = site.zones.filter(z => !z.includes('عام'));
    const list = targetZones.map(z => {
        const lastDate = lastIrrMap[z] || null;
        let daysAgo = null;
        if (lastDate) {
            const dMs = new Date(lastDate + 'T12:00:00').getTime();
            daysAgo = Math.max(0, Math.round((activeMs - dMs) / 86400000));
        }
        return { zone: z, lastDate, daysAgo };
    });

    list.sort((a, b) => {
        const scoreA = a.daysAgo === null ? 999 : a.daysAgo;
        const scoreB = b.daysAgo === null ? 999 : b.daysAgo;
        return scoreB - scoreA;
    });
    return list;
}

function renderZoneThirstRadar() {
    const box = document.getElementById('zoneRadarContainer');
    if (!box) return;
    const list = computeZoneThirstData();
    const critCount = list.filter(x => x.daysAgo !== null && x.daysAgo >= 3).length;
    const displayList = radarExpanded ? list : list.slice(0, 8);

    box.innerHTML = `
    <div class="radar-box">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
            <b style="font-size:12px;color:var(--text);">🌡️ رادار ري المناطق ${critCount > 0 ? `<span style="color:var(--red);">(${critCount} متأخرة 3+ أيام)</span>` : ''}</b>
            <button class="btn btn-outline btn-sm" style="padding:2px 7px;" onclick="radarExpanded=!radarExpanded;renderZoneThirstRadar()">${radarExpanded ? 'طي ▲' : `عرض الكل (${list.length}) ▼`}</button>
        </div>
        <div class="radar-grid">
            ${displayList.map(item => {
                let cls = 'radar-none', label = 'لم تُروَ';
                if (item.daysAgo === 0) { cls = 'radar-fresh'; label = 'اليوم'; }
                else if (item.daysAgo === 1) { cls = 'radar-warn'; label = 'أمس'; }
                else if (item.daysAgo === 2) { cls = 'radar-warn'; label = 'منذ يومين'; }
                else if (item.daysAgo !== null && item.daysAgo >= 3) { cls = 'radar-crit'; label = `منذ ${item.daysAgo} أيام`; }
                return `<span class="radar-pill ${cls}" onclick="quickIrrigateFromRadar('${esc(item.zone)}')" title="اضغط لإنشاء مهمة ري لـ ${esc(item.zone)}">📍 ${esc(item.zone)}: ${label}</span>`;
            }).join('')}
        </div>
    </div>`;
}

function quickIrrigateFromRadar(zoneName) {
    openModal(`
        <h3 class="card-title">💧 ري سريع لمنطقة (${esc(zoneName)})</h3>
        <p style="font-size:12px;color:var(--muted);">اختر نوع الري لإضافته مباشرة إلى مهام اليوم:</p>
        <div style="display:flex;flex-direction:column;gap:6px;">
            ${IRR_DESC_PRESETS.map(pr => `
                <button class="btn btn-outline" style="justify-content:space-between;" onclick="confirmRadarTask('${esc(zoneName)}', '${esc(pr.text)}', '${pr.dur}')">
                    <span>${pr.label}</span><span style="color:var(--blue);">${pr.dur}</span>
                </button>
            `).join('')}
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="closeModal()">إلغاء</button>
    `);
}

function confirmRadarTask(zoneName, desc, dur) {
    pushUndo('إضافة مهمة من الرادار: ' + zoneName);
    const tid = 't_' + Date.now();
    const isTk = desc.toLowerCase().includes('tanker');
    getDayLog().tasks.unshift({
        id: tid, task: 'Irrigation  /  ري المنطقة', desc, zones: zoneName, dur,
        status: 'Not Started / لم يبدأ', workers: [], note: '',
        isTanker: isTk, tankerCapacity: isTk ? TANKER_FULL_CAPACITY : '', tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية', tankerTrips: 1,
        agroName: '', agroDose: '', photos: [], startTimeMs: null, pausedTotalMs: 0, pausedAtMs: null
    });
    logSectionHistory('tasks', 'add', `من الرادار: ${zoneName} (${desc})`, { taskId: tid });
    closeModal(); saveState(); renderTasks(getDayLog()); showToast(`✓ أُضيفت مهمة ري ${zoneName}`);
}

/* ================= Cumulative Outside Worker Payroll Summary ================= */
function openPayrollModal() {
    const startDefault = state.activeDate.slice(0, 8) + '01';
    openModal(`
        <h3 class="card-title">💰 كشف مستحقات العمال الخارجيين التراكمي</h3>
        <div class="grid-2">
            <div><label class="lbl">من تاريخ:</label><input type="date" id="payFrom" class="inp" value="${startDefault}" onchange="refreshPayrollTable()"></div>
            <div><label class="lbl">إلى تاريخ:</label><input type="date" id="payTo" class="inp" value="${state.activeDate}" onchange="refreshPayrollTable()"></div>
        </div>
        <div id="payrollResultBox"></div>
        <button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="closeModal()">إغلاق</button>
    `);
    refreshPayrollTable();
}

function refreshPayrollTable() {
    const site = getSite();
    const fromD = document.getElementById('payFrom').value;
    const toD = document.getElementById('payTo').value;
    const rate = parseFloat(state.company.outsideRate) || 25000;
    const summary = {};

    Object.entries(site.logs).forEach(([dStr, dl]) => {
        if ((fromD && dStr < fromD) || (toD && dStr > toD)) return;
        (dl.attendance || []).forEach(w => {
            const key = w.name.trim();
            if (!summary[key]) summary[key] = { name: key, type: w.type, days: 0, absent: 0, ot: 0 };
            if (!w.status.includes('Absent')) {
                summary[key].days++;
                summary[key].ot += (parseFloat(w.ot) || 0);
            } else {
                summary[key].absent++;
            }
        });
    });

    const rows = Object.values(summary);
    let totalOutsideIQD = 0;
    const lines = rows.map(r => {
        const isOut = r.type.includes('Outside');
        const pay = isOut ? r.days * rate : 0;
        totalOutsideIQD += pay;
        return { ...r, isOut, pay };
    });

    const waText = `💰 كشف حضور ومستحقات (${site.name.split('/')[0].trim()})
الفترة: ${fromD} إلى ${toD}
` +
        lines.map(r => `• ${r.name.split('/')[1] || r.name}: ${r.days} يوم | OT: ${r.ot}h` + (r.isOut ? ` | المستحق: ${r.pay.toLocaleString()} IQD` : ' (موظف)')).join('
') +
        `

الإجمالي للعمالة الخارجية: ${totalOutsideIQD.toLocaleString()} IQD`;

    document.getElementById('payrollResultBox').innerHTML = `
        <div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;padding:6px;margin-bottom:8px;background:#f8fafc;">
            ${lines.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:12px;">لا توجد بيانات ضمن هذه الفترة</div>' :
            lines.map(r => `
                <div style="padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:12px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <b>${esc(r.name.split('/')[1] || r.name)}</b>
                        <div style="font-size:10.5px;color:var(--muted);">حضور: ${r.days} يوم | غياب: ${r.absent} | OT: ${r.ot}h</div>
                    </div>
                    <div style="font-weight:bold;color:${r.isOut ? 'var(--primary-dark)' : 'var(--blue)'};">
                        ${r.isOut ? r.pay.toLocaleString() + ' IQD' : 'موظف ثابت'}
                    </div>
                </div>
            `).join('')}
        </div>
        <div style="font-weight:bold;font-size:13px;color:var(--primary-dark);margin-bottom:8px;text-align:center;">
            إجمالي مستحقات العمالة الخارجية: ${totalOutsideIQD.toLocaleString()} IQD
        </div>
        <div class="grid-2">
            <button class="btn btn-green btn-sm" onclick="navigator.clipboard.writeText(${JSON.stringify(waText)});showToast('📋 تم نسخ كشف المستحقات!')">📋 نسخ الكشف</button>
            <button class="btn btn-blue btn-sm" onclick="exportPayrollCSV('${fromD}', '${toD}')">📥 تصدير CSV</button>
        </div>
    `;
}

function exportPayrollCSV(fromD, toD) {
    const site = getSite();
    const rate = parseFloat(state.company.outsideRate) || 25000;
    const summary = {};
    Object.entries(site.logs).forEach(([dStr, dl]) => {
        if ((fromD && dStr < fromD) || (toD && dStr > toD)) return;
        (dl.attendance || []).forEach(w => {
            if (!summary[w.name]) summary[w.name] = { name: w.name, type: w.type, days: 0, absent: 0, ot: 0 };
            if (!w.status.includes('Absent')) { summary[w.name].days++; summary[w.name].ot += (parseFloat(w.ot) || 0); }
            else summary[w.name].absent++;
        });
    });
    let csv = '﻿Worker Name,Type,Days Present,Days Absent,Overtime Hrs,Daily Rate IQD,Total Due IQD
';
    Object.values(summary).forEach(r => {
        const isOut = r.type.includes('Outside');
        csv += `"${r.name}","${r.type}",${r.days},${r.absent},${r.ot},${isOut ? rate : 0},${isOut ? r.days * rate : 0}
`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `Payroll_${site.id}_${fromD}_to_${toD}.csv`;
    a.click();
}

/* ================= UI Utilities: Quick Clear, Auto-Grow, Custom Time ================= */
function quickClearField(elId, callback) {
    const el = document.getElementById(elId);
    if (el) {
        el.value = '';
        if (el.tagName === 'TEXTAREA') autoGrow(el);
        if (callback) callback('');
    }
}

function autoGrow(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(58, el.scrollHeight) + 'px';
}

function triggerAllAutoGrows() {
    document.querySelectorAll('textarea.auto-grow').forEach(autoGrow);
}

function buildDurationSelectHtml(currentVal, selectId, onChangeExpr) {
    const val = currentVal || '1:00 hr';
    const hasCustom = val && !DURATION_OPTIONS.includes(val);
    return `
        <select id="${selectId}" class="inp" style="margin:0;flex:1;" onchange="${onChangeExpr}">
            ${hasCustom ? `<option value="${esc(val)}" selected>${esc(val)} (مخصص)</option>` : ''}
            ${DURATION_OPTIONS.map(d => `<option value="${d}" ${val === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
    `;
}

function openCustomTimeModal(targetType, targetIdx, targetInputId = '') {
    openModal(`
        <h3 class="card-title">⏱️ إدخال وقت مخصص</h3>
        <div class="grid-2">
            <div><label class="lbl">الساعات (Hours):</label><input type="number" id="ctHrs" class="inp" min="0" max="24" value="0"></div>
            <div><label class="lbl">الدقائق (Minutes):</label><input type="number" id="ctMins" class="inp" min="0" max="59" step="5" value="25"></div>
        </div>
        <div style="margin-bottom:8px;">
            <span class="chip" onclick="document.getElementById('ctHrs').value=0;document.getElementById('ctMins').value=10;">10 د</span>
            <span class="chip" onclick="document.getElementById('ctHrs').value=0;document.getElementById('ctMins').value=20;">20 د</span>
            <span class="chip" onclick="document.getElementById('ctHrs').value=0;document.getElementById('ctMins').value=40;">40 د</span>
            <span class="chip" onclick="document.getElementById('ctHrs').value=1;document.getElementById('ctMins').value=15;">1:15 س</span>
            <span class="chip" onclick="document.getElementById('ctHrs').value=2;document.getElementById('ctMins').value=30;">2:30 س</span>
        </div>
        <div class="grid-2">
            <button class="btn btn-green" onclick="applyCustomTime('${targetType}', ${targetIdx}, '${targetInputId}')">اعتماد الوقت</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}

function applyCustomTime(targetType, targetIdx, targetInputId) {
    const h = Math.max(0, parseInt(document.getElementById('ctHrs').value) || 0);
    const m = Math.max(0, Math.min(59, parseInt(document.getElementById('ctMins').value) || 0));
    const formatted = `${h}:${String(m).padStart(2, '0')} hr`;
    closeModal();

    if (targetType === 'task_card') {
        pushUndo('تعديل وقت مهمة مخصص');
        const t = getDayLog().tasks[targetIdx];
        t.dur = formatted;
        logSectionHistory('tasks', 'edit', `وقت ${t.zones}: ${formatted}`, { taskId: t.id });
        saveState(); renderTasks(getDayLog());
    } else if (targetType === 'perf') {
        getDayLog().perf.duration = (h + m / 60).toFixed(2);
        saveState(); renderReadingsAndTools(getDayLog());
    } else if (targetType === 'select_el' && targetInputId) {
        const sel = document.getElementById(targetInputId);
        if (sel) {
            const opt = document.createElement('option');
            opt.value = formatted; opt.textContent = formatted + ' (مخصص)'; opt.selected = true;
            sel.insertBefore(opt, sel.firstChild);
            sel.value = formatted;
        }
    }
    showToast('⏱️ تم ضبط الوقت: ' + formatted);
}

/* ================= Two-Way Linked Section History & Global Undo ================= */
function pushUndo(actionLabel) {
    try {
        const snap = JSON.stringify(state);
        undoStack.push({ label: actionLabel, snap });
        if (undoStack.length > 20) undoStack.shift();
        const btn = document.getElementById('globalUndoBtn');
        if (btn) btn.disabled = false;
    } catch {}
}

function globalUndo() {
    if (!undoStack.length) { showToast('لا توجد خطوة سابقة للتراجع'); return; }
    const last = undoStack.pop();
    state = JSON.parse(last.snap);
    const btn = document.getElementById('globalUndoBtn');
    if (btn) btn.disabled = undoStack.length === 0;
    saveState();
    renderAll();
    showToast('↩️ تم التراجع عن: ' + last.label);
}

function logSectionHistory(secKey, actionType, summary, refData = {}) {
    const log = getDayLog();
    const timeStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    log.secHistory[secKey].unshift({
        hid: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        time: timeStr,
        actionType,
        summary,
        ref: refData
    });
    if (log.secHistory[secKey].length > 50) log.secHistory[secKey].pop();
}

function renderStickySectionHistory(secKey, containerId, labelTitle) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const log = getDayLog();
    const site = getSite();
    const list = log.secHistory[secKey] || [];
    const latest = list[0];

    if (!latest) {
        box.innerHTML = `
        <div class="sticky-sec-bar empty-bar">
            <div class="sticky-sec-info" style="color:var(--muted);">🕒 سجل ${labelTitle}: لا توجد حركات مسجلة بعد</div>
            <div class="sticky-sec-actions">
                ${secKey === 'inv' ? `<button class="btn btn-outline btn-sm" onclick="setStopMarker()">🎀 علامة</button>` : ''}
                <button class="btn btn-outline btn-sm" onclick="openSectionHistoryModal('${secKey}', '${labelTitle}')">📜 السجل (0)</button>
            </div>
        </div>`;
        return;
    }

    box.innerHTML = `
    <div class="sticky-sec-bar">
        <div class="sticky-sec-info">
            <div class="sticky-sec-title">🕒 آخر حركة في ${labelTitle} (${esc(latest.time)}):</div>
            <div style="font-weight:bold;color:var(--text);">${esc(latest.summary)}</div>
            ${secKey === 'inv' && site.stopMarker ? `<div style="color:var(--red);font-size:10.5px;font-weight:bold;">🎀 علامة التوقف: ${esc(site.stopMarker)}</div>` : ''}
        </div>
        <div class="sticky-sec-actions">
            ${secKey === 'inv' ? `<button class="btn btn-outline btn-sm" onclick="setStopMarker()">🎀</button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="editHistoryItem('${secKey}', '${latest.hid}')" title="تعديل">✏️</button>
            <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteHistoryItem('${secKey}', '${latest.hid}')" title="حذف من السجل والقسم">🗑️</button>
            <button class="btn btn-blue btn-sm" onclick="openSectionHistoryModal('${secKey}', '${labelTitle}')">📜 (${list.length})</button>
        </div>
    </div>`;
}

function openSectionHistoryModal(secKey, labelTitle) {
    const list = getDayLog().secHistory[secKey] || [];
    openModal(`
        <h3 class="card-title">📜 سجل وملخص ${labelTitle} (${list.length})</h3>
        <p style="font-size:11px;color:var(--muted);margin-top:0;">الحذف أو التعديل من هنا ينعكس مباشرة على بيانات القسم والتقرير النهائي:</p>
        <div style="max-height:330px;overflow-y:auto;margin-bottom:10px;">
            ${list.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:15px;">السجل فارغ</div>' :
            list.map(h => `
                <div class="meter-card" style="padding:8px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
                    <div style="flex:1;">
                        <div style="font-size:10px;color:var(--blue);font-weight:bold;">${esc(h.time)}</div>
                        <div style="font-size:12px;font-weight:bold;">${esc(h.summary)}</div>
                    </div>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-outline btn-sm" onclick="closeModal();editHistoryItem('${secKey}', '${h.hid}')">✏️</button>
                        <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteHistoryItem('${secKey}', '${h.hid}', true, '${labelTitle}')">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-outline btn-full" onclick="closeModal()">إغلاق</button>
    `);
}

function deleteHistoryItem(secKey, hid, reopenModal = false, labelTitle = '') {
    const site = getSite();
    const log = getDayLog();
    const list = log.secHistory[secKey] || [];
    const hIdx = list.findIndex(x => x.hid === hid);
    if (hIdx === -1) return;
    const item = list[hIdx];
    pushUndo('حذف من سجل ' + secKey);

    const ref = item.ref || {};
    if (secKey === 'tasks' && ref.taskId) {
        log.tasks = log.tasks.filter(t => t.id !== ref.taskId);
        syncIrrigatedZonesFromTasks(false);
    } else if (secKey === 'inv' && ref.zoneId && ref.plantId) {
        const z = site.inventory.find(x => x.id === ref.zoneId);
        const p = z ? z.plants.find(x => x.id === ref.plantId) : null;
        if (p) {
            if (ref.condId && p.counts[ref.condId] > 0) p.counts[ref.condId]--;
            if (ref.entryId && p.entries) p.entries = p.entries.filter(e => e.id !== ref.entryId);
        }
    } else if (secKey === 'att' && ref.workerId) {
        if (item.actionType === 'add') log.attendance = log.attendance.filter(w => w.id !== ref.workerId);
        else { const w = log.attendance.find(x => x.id === ref.workerId); if (w) w.status = 'Present / حاضر'; }
    } else if (secKey === 'tools') {
        if (ref.toolIdx != null && log.tools[ref.toolIdx]) log.tools.splice(ref.toolIdx, 1);
        else if (ref.meterId) { const m = log.meters.find(x => x.id === ref.meterId); if (m) m.curr = ''; }
        else if (ref.gaugeId) { const g = log.gauges.find(x => x.id === ref.gaugeId); if (g) g.val = ''; }
    } else if (secKey === 'issues' && ref.issueId) {
        site.issues = site.issues.filter(i => i.id !== ref.issueId);
    }

    list.splice(hIdx, 1);
    saveState();
    renderAll();
    showToast('🗑️ تم حذف السجل وإلغاء العملية من القسم');
    if (reopenModal) openSectionHistoryModal(secKey, labelTitle);
}

function editHistoryItem(secKey, hid) {
    const site = getSite();
    const log = getDayLog();
    const item = (log.secHistory[secKey] || []).find(x => x.hid === hid);
    if (!item) return;
    const ref = item.ref || {};

    if (secKey === 'tasks' && ref.taskId) {
        const tIdx = log.tasks.findIndex(t => t.id === ref.taskId);
        if (tIdx === -1) { showToast('المهمة محذوفة مسبقاً'); return; }
        const t = log.tasks[tIdx];
        openModal(`
            <h3 class="card-title">✏️ تعديل المهمة من السجل</h3>
            <label class="lbl">المناطق:</label><input id="ehZones" class="inp" value="${esc(t.zones)}">
            <label class="lbl">الوصف المختصر:</label><textarea id="ehDesc" class="inp auto-grow" rows="2">${esc(t.desc)}</textarea>
            <div class="grid-2">
                <div><label class="lbl">المدة:</label><input id="ehDur" class="inp" value="${esc(t.dur)}"></div>
                <div><label class="lbl">الحالة:</label>
                    <select id="ehSt" class="inp">
                        <option value="Completed / مكتمل" ${t.status.includes('Completed')?'selected':''}>مكتمل</option>
                        <option value="In Progress / جاري" ${t.status.includes('Progress')?'selected':''}>جاري</option>
                        <option value="Not Started / لم يبدأ" ${t.status.includes('Not Started')?'selected':''}>لم يبدأ</option>
                        <option value="Blocked / متوقف" ${t.status.includes('Blocked')?'selected':''}>متوقف</option>
                    </select>
                </div>
            </div>
            <label class="lbl">ملاحظات:</label><textarea id="ehNote" class="inp auto-grow" rows="2">${esc(t.note || '')}</textarea>
            <div class="grid-2"><button class="btn btn-green" onclick="saveEditedTaskHistory(${tIdx}, '${hid}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
        `);
    } else if (secKey === 'inv' && ref.zoneId && ref.plantId) {
        const z = site.inventory.find(x => x.id === ref.zoneId);
        const p = z ? z.plants.find(x => x.id === ref.plantId) : null;
        const ent = p && ref.entryId ? (p.entries || []).find(e => e.id === ref.entryId) : null;
        if (!p || !ent) { showToast('القيد غير موجود'); return; }
        openModal(`
            <h3 class="card-title">✏️ تعديل قيد الجرد (${esc(p.name)})</h3>
            <label class="lbl">الحالة الصحية:</label>
            <select id="ehCond" class="inp">${HEALTH_CONDITIONS.map(c => `<option value="${c.id}" ${ent.condId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
            <label class="lbl">الطول (${state.company.heightUnit}):</label>
            <input type="number" step="any" id="ehHeight" class="inp" value="${ent.height || ''}">
            <div class="grid-2"><button class="btn btn-green" onclick="saveEditedInvHistory('${ref.zoneId}','${ref.plantId}','${ref.entryId}','${hid}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
        `);
    } else if (secKey === 'att' && ref.workerId) {
        const wIdx = log.attendance.findIndex(w => w.id === ref.workerId);
        if (wIdx !== -1) editWorkerModal(wIdx);
    } else if (secKey === 'tools') {
        if (ref.meterId) {
            const mIdx = log.meters.findIndex(m => m.id === ref.meterId);
            if (mIdx !== -1) {
                const v = prompt('تعديل القراءة الحالية للعداد:', log.meters[mIdx].curr);
                if (v !== null) { updateMeterField(mIdx, 'curr', v); item.summary = `تحديث عداد ${log.meters[mIdx].name}: ${v}`; saveState(); renderAll(); }
            }
        } else if (ref.toolIdx != null && log.tools[ref.toolIdx]) {
            editToolQty(ref.toolIdx);
        }
    } else if (secKey === 'issues' && ref.issueId) {
        const iss = site.issues.find(i => i.id === ref.issueId);
        if (iss) {
            const d = prompt('تعديل وصف المشكلة:', iss.desc);
            if (d !== null && d.trim()) { iss.desc = d.trim(); item.summary = `${iss.code} [${iss.zone}]: ${iss.desc}`; saveState(); renderAll(); }
        }
    }
}

function saveEditedTaskHistory(tIdx, hid) {
    pushUndo('تعديل مهمة من السجل');
    const log = getDayLog();
    const t = log.tasks[tIdx];
    t.zones = document.getElementById('ehZones').value.trim() || t.zones;
    t.desc = document.getElementById('ehDesc').value.trim();
    t.dur = document.getElementById('ehDur').value.trim() || t.dur;
    t.status = document.getElementById('ehSt').value;
    t.note = document.getElementById('ehNote').value.trim();
    const hItem = log.secHistory.tasks.find(x => x.hid === hid);
    if (hItem) hItem.summary = `${t.status.split('/')[1] || t.status}: ${t.zones} (${t.desc})`;
    syncIrrigatedZonesFromTasks(false);
    closeModal(); saveState(); renderAll(); showToast('✓ تم تحديث المهمة والسجل');
}

function saveEditedInvHistory(zoneId, plantId, entryId, hid) {
    pushUndo('تعديل جرد من السجل');
    const site = getSite();
    const z = site.inventory.find(x => x.id === zoneId);
    const p = z ? z.plants.find(x => x.id === plantId) : null;
    const ent = p ? (p.entries || []).find(e => e.id === entryId) : null;
    if (p && ent) {
        const newCond = document.getElementById('ehCond').value;
        const newH = parseFloat(document.getElementById('ehHeight').value);
        if (ent.condId !== newCond) {
            if (p.counts[ent.condId] > 0) p.counts[ent.condId]--;
            p.counts[newCond] = (p.counts[newCond] || 0) + 1;
            ent.condId = newCond;
        }
        ent.height = (!isNaN(newH) && newH > 0) ? newH : null;
        const cObj = HEALTH_CONDITIONS.find(c => c.id === newCond);
        const hItem = getDayLog().secHistory.inv.find(x => x.hid === hid);
        if (hItem) {
            hItem.ref.condId = newCond;
            hItem.summary = `${z.name} | ${p.name} — ${cObj ? cObj.name : ''} ${ent.height ? `(${ent.height} ${state.company.heightUnit})` : ''}`;
        }
    }
    closeModal(); saveState(); renderAll(); showToast('✓ تم تحديث الجرد والسجل');
}

/* ================= Helpers ================= */
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

function applySpellAndDictationGuard(rawText) {
    let fixed = String(rawText || '');
    let changed = false;
    DICTATION_CORRECTIONS.forEach(([regex, replacement]) => {
        if (regex.test(fixed)) {
            fixed = fixed.replace(regex, replacement);
            changed = true;
        }
    });
    return { text: fixed, changed };
}

/* ================= Timer Alert Bar ================= */
function checkTaskTimers() {
    const log = getDayLog();
    let hasAlert = false;
    let msgs = [];
    const nowMs = Date.now();

    log.tasks.forEach(t => {
        if (t.status.includes('Progress') && t.startTimeMs && !t.pausedAtMs) {
            const elapMins = getTaskNetElapsedMs(t, nowMs) / 60000;
            let targetMins = 60;
            const m = String(t.dur || '').match(/(\d+):(\d+)/);
            if (m) targetMins = parseInt(m[1]) * 60 + parseInt(m[2]);
            
            if (elapMins >= targetMins) {
                hasAlert = true;
                msgs.push(`⚠️ انتهى وقت (${t.zones}) منذ ${Math.floor(elapMins - targetMins)} دقيقة!`);
            }
        }
    });

    const bar = document.getElementById('timerAlertBar');
    if (hasAlert && bar) {
        bar.innerHTML = `<div>${msgs.join('<br>')}</div><button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="switchTab('tasks');window.scrollTo(0,0)">إغلاق الصمام</button>`;
        bar.classList.add('show');
    } else if (bar) {
        bar.classList.remove('show');
    }
}
setInterval(checkTaskTimers, 60000);

/* ================= Auto-Sync Irrigated Zones & Hours ================= */
function syncIrrigatedZonesFromTasks(force = false) {
    const log = getDayLog();
    if (!force && log.perf.zonesManualEdit) return;
    const completedIrrZones = [];
    log.tasks.forEach(t => {
        if (t.task.includes('Irrigation') && t.status.includes('Completed')) {
            (t.zones || '').split(',').map(z => z.trim()).filter(Boolean).forEach(z => {
                if (!completedIrrZones.includes(z)) completedIrrZones.push(z);
            });
        }
    });
    log.perf.zonesIrrigated = completedIrrZones.join(', ');
    if (force) {
        log.perf.zonesManualEdit = false;
        saveState();
        renderReadingsAndTools(log);
        showToast('🔄 تم تحديث المناطق المروية من المهام المكتملة');
    }
}

function calcIrrigationHoursFromTasks() {
    const log = getDayLog();
    let totalMins = 0;
    log.tasks.forEach(t => {
        if (t.task.includes('Irrigation') && t.status.includes('Completed')) {
            const m = String(t.dur || '').match(/(\d+):(\d+)/);
            if (m) totalMins += parseInt(m[1]) * 60 + parseInt(m[2]);
        }
    });
    const hrs = (totalMins / 60).toFixed(1);
    log.perf.duration = hrs;
    saveState();
    renderReadingsAndTools(log);
    showToast(`⏱️ إجمالي ساعات الري المكتملة: ${hrs} ساعة`);
}

/* ================= Rendering & Navigation ================= */
function renderAll() {
    const site = getSite();
    const log = getDayLog();
    const dayEn = getDayNameEn(state.activeDate);

    syncIrrigatedZonesFromTasks(false);

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
    const missingMeterPhoto = log.meters.some(m => ensurePhotosArr(m).length === 0);
    document.getElementById('meterReminderBar').classList.toggle('show', isShiftEdge && missingMeterPhoto);

    document.body.classList.toggle('alpha-pad', state.activeTab === 'inv' && activeInvZoneId !== null);

    renderAttendance(log);
    renderTasks(log);
    renderReadingsAndTools(log);
    renderInventory(site);
    renderExportAndIssues(site, log);
    checkTaskTimers();
    setTimeout(triggerAllAutoGrows, 20);
}

function switchTab(tabId) {
    state.activeTab = tabId;
    if (tabId === 'tools') syncIrrigatedZonesFromTasks(false);
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.body.classList.toggle('alpha-pad', tabId === 'inv' && activeInvZoneId !== null);
    if (tabId === 'tools') renderReadingsAndTools(getDayLog());
    if (tabId === 'tasks') { renderTasks(getDayLog()); checkTaskTimers(); }
    setTimeout(triggerAllAutoGrows, 20);
}

function onDateChange(val) { if (!val) return; state.activeDate = val; getDayLog(val); saveState(); renderAll(); }
function onDflNumChange(val) {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) { pushUndo('تعديل رقم DFL'); getDayLog().dflNum = n; getSite().nextDfl = Math.max(getSite().nextDfl, n + 1); saveState(); }
}
function onSiteSelectChange(val) {
    if (val === '__NEW__') { openNewSiteModal(); renderAll(); return; }
    state.activeSiteId = val; activeInvZoneId = null; getDayLog(); saveState(); renderAll();
    showToast('📍 تم التبديل إلى: ' + getSite().name);
}

/* ================= Full Archive Modal ================= */
function openFullArchiveModal() {
    const site = getSite();
    const allDates = Object.keys(site.logs).sort().reverse();
    openModal(`
        <h3 class="card-title">📅 أرشيف أيام (${esc(site.name.split('/')[0])})</h3>
        <div style="max-height:320px;overflow-y:auto;margin-bottom:10px;">
            ${allDates.map(d => {
                const dl = site.logs[d];
                const pres = (dl.attendance || []).filter(w => !w.status.includes('Absent')).length;
                const tkL = (dl.tasks || []).reduce((s, t) => s + (parseFloat(t.tankerLiters) || 0), 0);
                return `
                <div class="meter-card" style="padding:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="jumpToArchiveDate('${d}')">
                    <div>
                        <b style="font-size:12px;">📅 ${d} — DFL-${dl.dflNum}</b>
                        <div style="font-size:10px;color:var(--muted);">الحضور: ${pres} | المهام: ${(dl.tasks||[]).length} | تنكر: ${tkL.toLocaleString()} L</div>
                    </div>
                    <span class="btn btn-blue btn-sm">فتح</span>
                </div>`;
            }).join('')}
        </div>
        <button class="btn btn-outline btn-full" onclick="closeModal()">إغلاق</button>
    `);
}
function jumpToArchiveDate(d) { state.activeDate = d; closeModal(); saveState(); renderAll(); showToast('📅 تم فتح سجل يوم ' + d); }

/* ================= TAB 1: Attendance ================= */
function renderAttendance(log) {
    renderStickySectionHistory('att', 'stickyHist-att', 'الحضور');
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

function setWorkerAtt(idx, st) {
    pushUndo('تغيير حالة حضور');
    const w = getDayLog().attendance[idx];
    w.status = st;
    logSectionHistory('att', 'status', `${w.name.split('/')[1] || w.name}: ${st.split('/')[1] || st}`, { workerId: w.id });
    saveState(); renderAttendance(getDayLog());
}
function updateWorkerField(idx, k, v) { pushUndo('تعديل وقت/أوفرتايم عامل'); getDayLog().attendance[idx][k] = v; saveState(); renderAttendance(getDayLog()); }
function markAllPresent() {
    pushUndo('تسجيل الجميع حاضرين');
    getDayLog().attendance.forEach(w => w.status = 'Present / حاضر');
    logSectionHistory('att', 'bulk', 'تسجيل جميع الكادر حاضرين', {});
    saveState(); renderAttendance(getDayLog()); showToast('✓ تم تسجيل الجميع حاضرين');
}
function deleteWorkerFromToday(idx) {
    if (confirm('حذف العامل من قائمة اليوم؟')) {
        pushUndo('حذف عامل من اليوم');
        const w = getDayLog().attendance[idx];
        getDayLog().attendance.splice(idx, 1);
        logSectionHistory('att', 'delete', `حذف من اليوم: ${w.name.split('/')[1] || w.name}`, {});
        saveState(); renderAttendance(getDayLog());
    }
}
function copyYesterdayCrew() {
    const site = getSite();
    const prevDate = Object.keys(site.logs).sort().filter(d => d < state.activeDate).pop();
    if (!prevDate || !site.logs[prevDate].attendance.length) { showToast('⚠️ لا يوجد سجل كادر سابق'); return; }
    pushUndo('نسخ كادر الأمس');
    getDayLog().attendance = JSON.parse(JSON.stringify(site.logs[prevDate].attendance)).map((w, i) => ({
        ...w, id: 'w_' + i + '_' + Date.now(), ot: 0, note: ''
    }));
    logSectionHistory('att', 'copy', 'نسخ كادر الأمس بالكامل', {});
    saveState(); renderAttendance(getDayLog()); showToast('📋 تم نسخ كادر الأمس');
}
function editWorkerModal(idx) {
    const w = getDayLog().attendance[idx];
    openModal(`
        <h3 class="card-title">✏️ تعديل بيانات العامل</h3>
        <label class="lbl">الاسم:</label><input id="edWName" class="inp" value="${esc(w.name)}">
        <label class="lbl">نوع التوظيف:</label>
        <select id="edWType" class="inp">
            <option value="Employee  /  موظف" ${w.type.includes('Employee') ? 'selected' : ''}>Employee / موظف</option>
            <option value="Outside Worker  /  عامل خارجي" ${w.type.includes('Outside') ? 'selected' : ''}>Outside Worker / عامل خارجي</option>
            <option value="Intern  /  متدرب" ${w.type.includes('Intern') ? 'selected' : ''}>Intern / متدرب</option>
        </select>
        <label class="lbl">ملاحظة:</label><input id="edWNote" class="inp" value="${esc(w.note || '')}">
        <div class="grid-2"><button class="btn btn-green" onclick="saveEditWorker(${idx})">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveEditWorker(idx) {
    pushUndo('تعديل بيانات عامل');
    const w = getDayLog().attendance[idx];
    w.name = document.getElementById('edWName').value.trim() || w.name;
    w.type = document.getElementById('edWType').value;
    w.note = document.getElementById('edWNote').value.trim();
    logSectionHistory('att', 'edit', `تعديل بيانات: ${w.name.split('/')[1] || w.name}`, { workerId: w.id });
    closeModal(); saveState(); renderAttendance(getDayLog());
}
function promptAddWorker() {
    openModal(`
        <h3 class="card-title">👷 إضافة عامل خارجي / موظف</h3>
        <label class="lbl">الاسم الكامل:</label><input id="newWName" class="inp" placeholder="اكتب اسم العامل...">
        <label class="lbl">نوع التوظيف:</label>
        <select id="newWType" class="inp">
            <option value="Outside Worker  /  عامل خارجي">Outside Worker / عامل خارجي</option>
            <option value="Employee  /  موظف">Employee / موظف</option>
            <option value="Intern  /  متدرب">Intern / متدرب</option>
        </select>
        <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:10px;"><input type="checkbox" id="newWSavePool" checked> تثبيت في القائمة الدائمة للشركة</label>
        <div class="grid-2"><button class="btn btn-green" onclick="confirmAddWorker()">إضافة</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function confirmAddWorker() {
    const name = document.getElementById('newWName').value.trim();
    const type = document.getElementById('newWType').value;
    if (!name) return;
    pushUndo('إضافة عامل: ' + name);
    const tOut = type.includes('Employee') ? '17:00' : '16:00';
    const wid = 'w_' + Date.now();
    getDayLog().attendance.push({ id: wid, name, type, status: 'Present / حاضر', tIn: '08:00', tOut, ot: 0, note: '' });
    if (document.getElementById('newWSavePool').checked && !state.company.staffPool.some(s => s.name === name)) {
        state.company.staffPool.push({ name, type, tIn: '08:00', tOut });
    }
    logSectionHistory('att', 'add', `إضافة عامل: ${name}`, { workerId: wid });
    closeModal(); saveState(); renderAttendance(getDayLog()); showToast('✓ تمت إضافة ' + name);
}

/* ================= TAB 2: Tasks, 4 Statuses, Live Timer, Copy Prev Workers, Radar ================= */
function moveTaskUp(idx) {
    if (idx === 0) return;
    pushUndo('ترتيب مهمة لأعلى');
    const tasks = getDayLog().tasks;
    [tasks[idx - 1], tasks[idx]] = [tasks[idx], tasks[idx - 1]];
    saveState(); renderTasks(getDayLog());
}
function moveTaskDown(idx) {
    const tasks = getDayLog().tasks;
    if (idx === tasks.length - 1) return;
    pushUndo('ترتيب مهمة لأسفل');
    [tasks[idx], tasks[idx + 1]] = [tasks[idx + 1], tasks[idx]];
    saveState(); renderTasks(getDayLog());
}

function copyWorkersFromPrevTask(idx) {
    if (idx <= 0) return;
    const tasks = getDayLog().tasks;
    const prev = tasks[idx - 1];
    if (!prev || !prev.workers || !prev.workers.length) {
        showToast('⚠️ المهمة السابقة لا تحتوي على عمال معيّنين');
        return;
    }
    pushUndo('نسخ عمال المهمة السابقة');
    tasks[idx].workers = [...prev.workers];
    logSectionHistory('tasks', 'workers', `نسخ عمال (${prev.workers.join(' / ')}) إلى ${tasks[idx].zones}`, { taskId: tasks[idx].id });
    saveState(); renderTasks(getDayLog());
    showToast(`👥 تم تعيين (${prev.workers.join(' / ')}) للمهمة`);
}

function loadSiteIrrigationPlan() {
    const site = getSite();
    const log = getDayLog();
    const dayEn = getDayNameEn(state.activeDate);
    const planItems = (site.plan && site.plan[dayEn]) || [];
    if (planItems.length === 0) { showToast('⚠️ لا توجد خطة ري مسجلة لهذا اليوم'); return; }
    pushUndo('تحميل خطة ري ' + dayEn);
    planItems.forEach((item, i) => {
        const isTk = !!item.isTanker || (item.desc || '').toLowerCase().includes('tanker');
        log.tasks.push({
            id: 't_' + Date.now() + '_' + i,
            task: item.task, desc: item.desc, zones: item.zones, dur: item.dur || '1:00 hr',
            status: 'Not Started / لم يبدأ', workers: [], note: '',
            isTanker: isTk, tankerCapacity: isTk ? TANKER_FULL_CAPACITY : '', tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية', tankerTrips: 1,
            agroName: '', agroDose: '', photos: [], startTimeMs: null, pausedTotalMs: 0, pausedAtMs: null
        });
    });
    logSectionHistory('tasks', 'plan', `تحميل خطة ري ${dayEn} (${planItems.length} مهام لم تبدأ)`, {});
    syncIrrigatedZonesFromTasks(false);
    saveState(); renderTasks(log); showToast(`⚡ تم تحميل ${planItems.length} مهام ري ليوم ${dayEn}`);
}

function quickAddNonIrrTask(taskName, desc, dur) {
    pushUndo('إضافة مهمة: ' + desc);
    const tid = 't_' + Date.now();
    getDayLog().tasks.push({
        id: tid, task: taskName, desc, zones: 'عام / General', dur,
        status: 'Completed / مكتمل', workers: [], note: '',
        isTanker: false, tankerCapacity: '', tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية', tankerTrips: 1,
        agroName: '', agroDose: '', photos: [], startTimeMs: null, pausedTotalMs: 0, pausedAtMs: null
    });
    logSectionHistory('tasks', 'add', `مكتمل: عام / General (${desc})`, { taskId: tid });
    saveState(); renderTasks(getDayLog()); showToast('✓ تمت إضافة المهمة');
}

function renderTasksQueue(log) {
    const qBox = document.getElementById('tasksQueueContainer');
    if (!qBox) return;
    
    const inProg = log.tasks.map((t, i) => ({ t, i })).filter(x => x.t.status.includes('Progress'));
    const notSt = log.tasks.map((t, i) => ({ t, i })).filter(x => x.t.status.includes('Not Started'));
    
    if (inProg.length === 0 && notSt.length === 0) {
        qBox.innerHTML = '';
        return;
    }
    
    let html = `<div class="queue-banner">`;
    if (inProg.length > 0) {
        html += `<div style="font-weight:bold;color:var(--blue);margin-bottom:6px;font-size:12px;">🔵 جاري الآن (${inProg.length}):</div>`;
        inProg.forEach(x => {
            const startStr = x.t.startTimeMs ? formatTime24FromMs(x.t.startTimeMs) : 'الآن';
            const netStr = formatMsAsHrMin(getTaskNetElapsedMs(x.t));
            html += `
            <div class="queue-item">
                <div style="font-size:12px;flex:1;">
                    <b>${esc(x.t.zones)}</b> — ${esc(x.t.desc)}<br>
                    <span class="live-timer-pill ${x.t.pausedAtMs ? 'is-paused' : ''}" onclick="openRetroStartTimeModal(${x.i})">
                        ▶️ بدأ: ${startStr} ✏️ | <span data-live-task-id="${x.t.id}">${x.t.pausedAtMs ? `⏸️ استراحة (${netStr})` : `⏱️ مستمر منذ ${netStr}`}</span>
                    </span>
                </div>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-outline btn-sm" onclick="toggleTaskPause(${x.i})">${x.t.pausedAtMs ? '▶️' : '⏸️'}</button>
                    <button class="btn btn-green btn-sm" onclick="setTaskStatus(${x.i}, 'Completed / مكتمل')">✓ إكمال</button>
                </div>
            </div>`;
        });
    }
    
    if (notSt.length > 0) {
        if (inProg.length > 0) html += `<hr style="border-top:1px dashed #fcd34d;margin:8px 0;">`;
        html += `<div style="font-weight:bold;color:var(--muted);margin-bottom:6px;font-size:12px;">⏳ القادم (${notSt.length}):</div>`;
        notSt.forEach(x => {
            html += `
            <div class="queue-item">
                <div style="font-size:12px;color:var(--muted);"><b>${esc(x.t.zones)}</b> — ${esc(x.t.desc)}</div>
                <button class="btn btn-blue btn-sm" onclick="setTaskStatus(${x.i}, 'In Progress / جاري')">▶️ ابدأ</button>
            </div>`;
        });
    }
    html += `</div>`;
    qBox.innerHTML = html;
}

function renderTasks(log) {
    renderStickySectionHistory('tasks', 'stickyHist-tasks', 'المهام');
    renderTasksQueue(log);
    renderZoneThirstRadar();

    const el = document.getElementById('tasksContainer');
    if (log.tasks.length === 0) {
        el.innerHTML = `<div class="card" style="text-align:center;color:var(--muted);padding:24px;">💧 اضغط على زر خطة الري أعلاه أو أضف مهمة جديدة</div>`;
        return;
    }
    el.innerHTML = log.tasks.map((t, idx) => {
        const isDone = t.status.includes('Completed');
        const isProg = t.status.includes('Progress');
        const isNotSt = t.status.includes('Not Started');
        const isBlock = t.status.includes('Blocked');
        const zoneList = (t.zones || '').split(',').map(s => s.trim()).filter(Boolean);
        const canSplit = zoneList.length > 1;
        const wNames = t.workers && t.workers.length ? t.workers.join(' / ') : 'عمال...';
        const isAgro = t.task.includes('Fertilizing') || t.task.includes('Pest Control');
        const isIrr = t.task.includes('Irrigation');
        const photos = ensurePhotosArr(t);
        const prevHasWorkers = idx > 0 && log.tasks[idx - 1] && (log.tasks[idx - 1].workers || []).length > 0;

        const capVal = parseFloat(t.tankerCapacity) || 0;
        const dispVal = parseFloat(t.tankerLiters) || 0;
        const remVal = capVal > 0 ? Math.max(0, capVal - dispVal) : null;
        const trips = t.tankerTrips || 1;

        let cardClass = 'task-box';
        if (isBlock) cardClass += ' is-blocked';
        else if (isNotSt) cardClass += ' is-notstarted';
        else if (isDone) cardClass += ' is-done';

        return `
        <div class="card ${cardClass}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:6px;">
                <div style="display:flex;gap:3px;">
                    <div class="sort-controls">
                        <button class="sort-btn" onclick="moveTaskUp(${idx})">▲</button>
                        <button class="sort-btn" onclick="moveTaskDown(${idx})">▼</button>
                    </div>
                    <div style="font-weight:bold;font-size:14px;padding-top:2px;">${esc(t.task.split('/')[1] || t.task)}</div>
                </div>
                <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                    <span class="zone-pill" onclick="openZonePickerModal(${idx})">📍 ${esc(t.zones)} ✏️</span>
                    ${canSplit ? `<button class="btn btn-orange btn-sm" onclick="splitTaskZones(${idx})">✂️ تفريق</button>` : ''}
                </div>
            </div>

            ${isProg ? `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;margin-bottom:7px;flex-wrap:wrap;">
                <span class="live-timer-pill ${t.pausedAtMs ? 'is-paused' : ''}" onclick="openRetroStartTimeModal(${idx})">
                    ▶️ بدأ: ${formatTime24FromMs(t.startTimeMs || Date.now())} ✏️ | <span data-live-task-id="${t.id}">${t.pausedAtMs ? `⏸️ متوقف للاستراحة (${formatMsAsHrMin(getTaskNetElapsedMs(t))})` : `⏱️ مستمر منذ ${formatMsAsHrMin(getTaskNetElapsedMs(t))}`}</span>
                </span>
                <button class="btn btn-outline btn-sm" style="padding:2px 7px;" onclick="toggleTaskPause(${idx})">${t.pausedAtMs ? '▶️ استئناف' : '⏸️ استراحة'}</button>
            </div>` : ''}

            <!-- Auto-Expanding Brief Description + Quick Clear -->
            <label class="lbl">الوصف المختصر (قابل للتعديل دائماً):</label>
            <div class="inp-wrap" style="margin-bottom:5px;">
                <textarea id="tdesc_${idx}" class="inp auto-grow" rows="2" style="background:white;" placeholder="اكتب الوصف المختصر..." oninput="autoGrow(this)" onchange="updateTaskDesc(${idx}, this.value)">${esc(t.desc)}</textarea>
                <button class="clr-btn top-align" onclick="quickClearField('tdesc_${idx}', () => updateTaskDesc(${idx}, ''))">✕</button>
            </div>
            ${isIrr ? `
            <div style="margin-bottom:6px;">
                ${IRR_DESC_PRESETS.map(pr => `<span class="chip ${t.desc === pr.text ? 'active' : ''}" onclick="applyIrrPreset(${idx}, '${esc(pr.text)}', '${pr.dur}')">${pr.label}</span>`).join('')}
            </div>` : ''}

            <!-- Duration Dropdown + Custom Time Button + Workers + Copy Prev Workers + Photos -->
            <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:4px;">
                <div style="display:inline-flex;align-items:center;gap:3px;background:#f1f5f9;border:1px solid var(--border);border-radius:99px;padding:2px 6px;">
                    <span style="font-size:11px;">⏱️</span>
                    <select style="border:none;background:transparent;font-size:11px;font-weight:bold;color:var(--text);" onchange="updateTaskDurationSelect(${idx}, this.value)">
                        ${!DURATION_OPTIONS.includes(t.dur) ? `<option value="${esc(t.dur)}" selected>${esc(t.dur)}</option>` : ''}
                        ${DURATION_OPTIONS.map(d => `<option value="${d}" ${t.dur === d ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                    <button class="btn btn-blue btn-sm" style="padding:1px 6px;font-size:10px;border-radius:99px;" onclick="openCustomTimeModal('task_card', ${idx})">مخصص</button>
                </div>
                <span class="chip" onclick="openAssignWorkersModal(${idx})">👷 ${esc(wNames)} (${t.workers ? t.workers.length : 0})</span>
                ${prevHasWorkers ? `<span class="chip" style="color:var(--blue);border-color:#bae6fd;" onclick="copyWorkersFromPrevTask(${idx})">👥 نفس عمال السابقة</span>` : ''}
                <span class="chip" onclick="openPhotoSourceChoice('task', ${idx})">📸 +صورة (${photos.length})</span>
                <span class="chip" onclick="duplicateTask(${idx})" title="نسخ المهمة">📋</span>
                <span class="chip" style="color:var(--red);" onclick="deleteTask(${idx})" title="حذف">🗑️</span>
            </div>

            <!-- Multi-Photo Thumbnails Strip -->
            ${photos.length > 0 ? `
            <div class="photo-strip">
                ${photos.map((pUrl, pI) => `
                    <div class="photo-item-wrap">
                        <img src="${pUrl}" class="photo-thumb" onclick="previewSinglePhoto('${pUrl}')">
                        <button class="photo-del-badge" onclick="removePhotoFromItem('task', ${idx}, ${pI})">✕</button>
                    </div>
                `).join('')}
            </div>` : ''}

            <!-- Tanker Pre-Start Capacity & Post-Finish Dispensed Amount -->
            ${t.isTanker ? `
            <div class="tanker-banner">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
                    <span>🚚 سعة التنكر قبل البدء: <b>${capVal ? capVal.toLocaleString() + ' L' : 'غير محددة'}</b> ${trips > 1 ? `(نقلة #${trips})` : ''}</span>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-outline btn-sm" style="background:white;padding:2px 6px;" onclick="refillTankerTrip(${idx})">🔄 إعادة تعبئة</button>
                        <button class="btn btn-outline btn-sm" style="background:white;" onclick="openTankerPreModal(${idx})">⚙️ السعة</button>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>💧 المصروف: <b>${dispVal ? dispVal.toLocaleString() + ' L' : '0 L'}</b> ${remVal !== null ? `| المتبقي: <b>${remVal.toLocaleString()} L</b>` : ''} ${t.tankerPpm ? `| ${t.tankerPpm} ppm` : ''}</span>
                    <button class="btn btn-blue btn-sm" onclick="openTankerFinishModal(${idx})">✓ الصرف</button>
                </div>
            </div>` : ''}

            ${isAgro ? `
            <div class="agro-banner">
                <span>🧪 المادة: ${t.agroName ? `${esc(t.agroName)} (${esc(t.agroDose)})` : 'سجل اسم السماد/المبيد والجرعة'}</span>
                <button class="btn btn-green btn-sm" onclick="openAgroModal(${idx})">الجرعة</button>
            </div>` : ''}

            <!-- 4 Separate Status Buttons -->
            <div class="st-bar">
                <button class="st-btn ${isDone ? 'on-done' : ''}" onclick="setTaskStatus(${idx},'Completed / مكتمل')">مكتمل</button>
                <button class="st-btn ${isProg ? 'on-prog' : ''}" onclick="setTaskStatus(${idx},'In Progress / جاري')">جاري</button>
                <button class="st-btn ${isNotSt ? 'on-notst' : ''}" onclick="setTaskStatus(${idx},'Not Started / لم يبدأ')">لم يبدأ</button>
                <button class="st-btn ${isBlock ? 'on-block' : ''}" onclick="setTaskStatus(${idx},'Blocked / متوقف')">متوقف</button>
            </div>

            ${isBlock ? `
            <div class="block-drawer">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;gap:4px;flex-wrap:wrap;">
                    <label class="lbl" style="color:var(--red);margin:0;font-size:12px;">🛑 سبب التوقف (إلزامي):</label>
                    <div style="display:flex;gap:4px;">
                        ${isIrr ? `<button class="btn btn-blue btn-sm" style="padding:2px 6px;font-size:10px;" onclick="createReplacementTankerTask(${idx})">🚚 تعويض تنكر</button>` : ''}
                        <button class="btn btn-red btn-sm" style="padding:2px 6px;font-size:10px;" onclick="escalateTaskToIssue(${idx})">🚨 تصعيد مشكلة</button>
                    </div>
                </div>
                <div style="display:flex;gap:4px;margin-bottom:6px;">
                    <div class="inp-wrap" style="margin:0;flex:1;">
                        <textarea id="tnote_${idx}" class="inp auto-grow blocked-note-box" rows="2" placeholder="اكتب سبب التوقف بوضوح..." oninput="autoGrow(this)" onchange="updateTaskNote(${idx}, this.value)">${esc(t.note)}</textarea>
                        <button class="clr-btn top-align" onclick="quickClearField('tnote_${idx}', () => updateTaskNote(${idx}, ''))">✕</button>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="startDictation('tnote_${idx}', v => updateTaskNote(${idx}, v))">🎤</button>
                </div>
                <div>
                    ${QUICK_NOTE_PHRASES.map(q => `<span class="chip" onclick="setTaskNoteChip(${idx}, '${esc(q.text)}')">${q.label}</span>`).join('')}
                </div>
            </div>` : `
            <div style="display:flex;gap:4px;margin-top:8px;">
                <div class="inp-wrap" style="margin:0;flex:1;">
                    <textarea id="tnote_${idx}" class="inp auto-grow" rows="2" style="font-size:12.5px;" placeholder="${isNotSt ? 'لم يبدأ — بانتظار التنفيذ...' : 'ملاحظة إضافية للمهمة...'}" oninput="autoGrow(this)" onchange="updateTaskNote(${idx}, this.value)">${esc(t.note)}</textarea>
                    <button class="clr-btn top-align" onclick="quickClearField('tnote_${idx}', () => updateTaskNote(${idx}, ''))">✕</button>
                </div>
                <button class="btn btn-outline btn-sm" onclick="startDictation('tnote_${idx}', v => updateTaskNote(${idx}, v))">🎤</button>
            </div>`}
        </div>`;
    }).join('');
    setTimeout(triggerAllAutoGrows, 15);
}

function updateTaskDurationSelect(idx, val) {
    pushUndo('تعديل مدة مهمة');
    const t = getDayLog().tasks[idx];
    t.dur = val;
    logSectionHistory('tasks', 'edit', `مدة ${t.zones}: ${val}`, { taskId: t.id });
    saveState(); renderTasks(getDayLog());
}

function updateTaskDesc(idx, val) {
    pushUndo('تعديل وصف مهمة');
    const t = getDayLog().tasks[idx];
    const res = applySpellAndDictationGuard(val);
    t.desc = res.text;
    t.isTanker = t.desc.toLowerCase().includes('tanker');
    if (t.isTanker && !t.tankerCapacity) { t.tankerCapacity = TANKER_FULL_CAPACITY; t.tankerTrips = 1; }
    logSectionHistory('tasks', 'edit', `تعديل وصف ${t.zones}: ${t.desc}`, { taskId: t.id });
    saveState(); renderTasks(getDayLog());
}
function applyIrrPreset(idx, txt, dur) {
    pushUndo('تغيير نوع الري');
    const t = getDayLog().tasks[idx];
    t.desc = txt; t.dur = dur;
    t.isTanker = txt.toLowerCase().includes('tanker');
    if (t.isTanker && !t.tankerCapacity) { t.tankerCapacity = TANKER_FULL_CAPACITY; t.tankerTrips = 1; }
    logSectionHistory('tasks', 'edit', `${t.zones}: ${txt}`, { taskId: t.id });
    saveState(); renderTasks(getDayLog());
}
function splitTaskZones(idx) {
    const log = getDayLog();
    const t = log.tasks[idx];
    const zones = (t.zones || '').split(',').map(s => s.trim()).filter(Boolean);
    if (zones.length <= 1) return;
    pushUndo('تفريق مناطق مهمة');
    const expanded = zones.map((z, i) => ({
        ...JSON.parse(JSON.stringify(t)),
        id: 't_' + Date.now() + '_' + i,
        zones: z,
        photos: i === 0 ? ensurePhotosArr(t) : [],
        startTimeMs: null, pausedTotalMs: 0, pausedAtMs: null
    }));
    log.tasks.splice(idx, 1, ...expanded);
    logSectionHistory('tasks', 'split', `تفريق ${t.zones} إلى ${zones.length} بطاقات مستقلة`, {});
    saveState(); renderTasks(log); showToast(`✂️ تم تفريق المهمة إلى ${zones.length} مناطق`);
}
function duplicateTask(idx) {
    pushUndo('نسخ مهمة');
    const log = getDayLog();
    const copy = JSON.parse(JSON.stringify(log.tasks[idx]));
    copy.id = 't_' + Date.now();
    copy.photos = [];
    copy.startTimeMs = null;
    copy.pausedTotalMs = 0;
    copy.pausedAtMs = null;
    log.tasks.splice(idx + 1, 0, copy);
    logSectionHistory('tasks', 'add', `نسخ مهمة: ${copy.zones} (${copy.desc})`, { taskId: copy.id });
    saveState(); renderTasks(log); showToast('📋 تم نسخ المهمة');
}
function createReplacementTankerTask(idx) {
    pushUndo('إنشاء مهمة تنكر بديلة');
    const log = getDayLog();
    const orig = log.tasks[idx];
    const tid = 't_' + Date.now();
    log.tasks.splice(idx + 1, 0, {
        id: tid,
        task: 'Irrigation  /  ري المنطقة',
        desc: 'Irrigating the area using a water tanker',
        zones: orig.zones,
        dur: '1:00 hr',
        status: 'Not Started / لم يبدأ',
        workers: [...(orig.workers || [])],
        note: '',
        isTanker: true,
        tankerCapacity: TANKER_FULL_CAPACITY,
        tankerLiters: '',
        tankerPpm: '',
        tankerVisual: 'Clear / صافية',
        tankerTrips: 1,
        agroName: '', agroDose: '', photos: [], startTimeMs: null, pausedTotalMs: 0, pausedAtMs: null
    });
    logSectionHistory('tasks', 'add', `تعويض تنكر لـ ${orig.zones} (24,000 L)`, { taskId: tid });
    syncIrrigatedZonesFromTasks(false);
    saveState(); renderTasks(log); showToast(`🚚 تم إنشاء مهمة تنكر بديلة لمنطقة ${orig.zones}`);
}
function refillTankerTrip(idx) {
    pushUndo('إعادة تعبئة التنكر');
    const t = getDayLog().tasks[idx];
    t.tankerTrips = (t.tankerTrips || 1) + 1;
    t.tankerCapacity = TANKER_FULL_CAPACITY;
    t.tankerLiters = '';
    t.note = '';
    logSectionHistory('tasks', 'tanker', `تعبئة نقلة #${t.tankerTrips} لـ ${t.zones}`, { taskId: t.id });
    saveState(); renderTasks(getDayLog()); showToast(`🔄 تم تسجيل نقلة #${t.tankerTrips} بسعة 24,000 لتر`);
}

function openZonePickerModal(tIdx) {
    const site = getSite();
    const t = getDayLog().tasks[tIdx];
    const current = new Set((t.zones || '').split(',').map(s => s.trim()).filter(Boolean));
    openModal(`
        <h3 class="card-title">📍 تعديل مناطق المهمة</h3>
        <div style="max-height:220px;overflow-y:auto;margin-bottom:10px;border:1px solid var(--border);border-radius:8px;padding:8px;">
            ${site.zones.map(z => `<span class="chip ${current.has(z) ? 'active' : ''}" onclick="this.classList.toggle('active')" data-z="${esc(z)}">${esc(z)}</span>`).join('')}
        </div>
        <label class="lbl">أو اكتب مناطق مخصصة (مفصولة بفاصلة):</label>
        <div class="inp-wrap">
            <input id="customZonesInp" class="inp" value="${esc(t.zones)}">
            <button class="clr-btn" onclick="quickClearField('customZonesInp')">✕</button>
        </div>
        <div class="grid-2"><button class="btn btn-green" onclick="savePickedZones(${tIdx})">تحديث</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
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
    if (val) {
        pushUndo('تعديل مناطق مهمة');
        const t = getDayLog().tasks[tIdx];
        t.zones = val;
        logSectionHistory('tasks', 'edit', `تعديل مناطق إلى: ${val}`, { taskId: t.id });
    }
    syncIrrigatedZonesFromTasks(false);
    closeModal(); saveState(); renderTasks(getDayLog());
}

function setTaskStatus(idx, st) {
    pushUndo('تغيير حالة مهمة');
    const t = getDayLog().tasks[idx];
    const oldSt = t.status;
    t.status = st;
    const now = Date.now();
    
    if (st.includes('Progress') && !oldSt.includes('Progress')) {
        t.startTimeMs = now;
        t.pausedTotalMs = 0;
        t.pausedAtMs = null;
        showToast('▶️ تم بدء المؤقت الحي للمهمة');
    } else if (st.includes('Completed') && oldSt.includes('Progress') && t.startTimeMs) {
        const netMs = getTaskNetElapsedMs(t, now);
        t.dur = formatMsAsHrMin(netMs);
        t.startTimeMs = null;
        t.pausedTotalMs = 0;
        t.pausedAtMs = null;
        showToast(`⏹️ اكتملت — المدة الفعلية: ${t.dur}`);
    } else if (!st.includes('Progress')) {
        t.startTimeMs = null;
        t.pausedTotalMs = 0;
        t.pausedAtMs = null;
    }

    logSectionHistory('tasks', 'status', `${st.split('/')[1] || st}: ${t.zones} (${t.desc})`, { taskId: t.id });
    syncIrrigatedZonesFromTasks(false);
    saveState(); renderTasks(getDayLog());
}

function updateTaskNote(idx, v) {
    const t = getDayLog().tasks[idx];
    const res = applySpellAndDictationGuard(v);
    t.note = res.text;
    if (res.changed) showToast('✨ تم تصحيح المصطلح الإنجليزي تلقائياً');
    saveState(); renderTasks(getDayLog());
}
function setTaskNoteChip(idx, v) { pushUndo('تعديل سبب توقف'); getDayLog().tasks[idx].note = v; saveState(); renderTasks(getDayLog()); }
function deleteTask(idx) {
    pushUndo('حذف مهمة');
    const t = getDayLog().tasks[idx];
    getDayLog().tasks.splice(idx, 1);
    logSectionHistory('tasks', 'delete', `حذف مهمة: ${t.zones} (${t.desc})`, {});
    syncIrrigatedZonesFromTasks(false);
    saveState(); renderTasks(getDayLog());
}
function escalateTaskToIssue(idx) {
    const t = getDayLog().tasks[idx];
    const site = getSite();
    const code = 'ISS-' + String(site.issues.length + 1).padStart(2, '0');
    const iid = 'i_' + Date.now();
    site.issues.unshift({ id: iid, code, date: state.activeDate, zone: t.zones, severity: 'High', desc: `${t.desc}: ${t.note || 'توقف الري'}`, status: 'Open', resolvedDate: '', photos: [...ensurePhotosArr(t)] });
    logSectionHistory('issues', 'add', `تصعيد ${code} [${t.zones}]: ${t.note || t.desc}`, { issueId: iid });
    saveState(); renderExportAndIssues(site, getDayLog()); showToast(`🚨 تم تصعيد العطل إلى متتبع المشاكل (${code})`);
}

function openTaskModal() {
    openModal(`
        <h3 class="card-title">📋 إضافة مهمة جديدة</h3>
        <label class="lbl">نوع المهمة:</label>
        <div class="inp-wrap">
            <input id="mTaskType" list="globalTasksList" class="inp" value="Irrigation  /  ري المنطقة">
            <button class="clr-btn" onclick="quickClearField('mTaskType')">✕</button>
        </div>
        <label class="lbl">وصف مختصر:</label>
        <div class="inp-wrap" style="margin-bottom:5px;">
            <textarea id="mTaskDesc" class="inp auto-grow" rows="2" placeholder="مثلاً: Drip only أو تفاصيل العمل..."></textarea>
            <button class="clr-btn top-align" onclick="quickClearField('mTaskDesc')">✕</button>
        </div>
        <div style="margin-bottom:6px;">
            ${IRR_DESC_PRESETS.map(pr => `<span class="chip" onclick="document.getElementById('mTaskDesc').value='${esc(pr.text)}';document.getElementById('mTaskDurSel').value='${pr.dur}';document.getElementById('mTaskTanker').checked=${pr.text.includes('tanker')};">${pr.label}</span>`).join('')}
        </div>
        <label class="lbl">المنطقة / المناطق:</label>
        <div class="inp-wrap">
            <input id="mTaskZones" list="globalZonesList" class="inp" placeholder="مثلاً: AR5 أو B1, B2">
            <button class="clr-btn" onclick="quickClearField('mTaskZones')">✕</button>
        </div>
        <div class="grid-2">
            <div>
                <label class="lbl">المدة:</label>
                <div style="display:flex;gap:4px;">
                    ${buildDurationSelectHtml('1:00 hr', 'mTaskDurSel', '')}
                    <button class="btn btn-outline btn-sm" style="height:37px;" onclick="openCustomTimeModal('select_el', 0, 'mTaskDurSel')">⏱️</button>
                </div>
            </div>
            <div style="display:flex;align-items:center;padding-top:14px;">
                <label style="font-size:12px;font-weight:bold;"><input type="checkbox" id="mTaskTanker"> ري بالتنكر 🚚 (24,000 L)</label>
            </div>
        </div>
        <div class="grid-2" style="margin-top:8px;"><button class="btn btn-green" onclick="saveNewTask()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveNewTask() {
    const rawTask = document.getElementById('mTaskType').value.trim() || 'Other  /  أخرى';
    const desc = applySpellAndDictationGuard(document.getElementById('mTaskDesc').value.trim()).text;
    const zones = document.getElementById('mTaskZones').value.trim() || 'عام / General';
    const dur = document.getElementById('mTaskDurSel').value || '1:00 hr';
    const isTanker = document.getElementById('mTaskTanker').checked || desc.toLowerCase().includes('tanker');
    const isStandard = MASTER_TASKS.includes(rawTask);
    const finalDesc = isStandard ? desc : (desc ? `${rawTask} — ${desc}` : rawTask);
    const tid = 't_' + Date.now();
    pushUndo('إضافة مهمة: ' + zones);
    getDayLog().tasks.push({
        id: tid,
        task: isStandard ? rawTask : 'Other  /  أخرى',
        desc: finalDesc,
        zones, dur, status: 'Not Started / لم يبدأ', workers: [], note: '',
        isTanker, tankerCapacity: isTanker ? TANKER_FULL_CAPACITY : '', tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية', tankerTrips: 1,
        agroName: '', agroDose: '', photos: [], startTimeMs: null, pausedTotalMs: 0, pausedAtMs: null
    });
    logSectionHistory('tasks', 'add', `إضافة مهمة: ${zones} (${finalDesc})`, { taskId: tid });
    syncIrrigatedZonesFromTasks(false);
    closeModal(); saveState(); renderTasks(getDayLog()); showToast('✓ تمت إضافة المهمة لقائمة القادم');
}

function openAssignWorkersModal(tIdx) {
    const log = getDayLog();
    const task = log.tasks[tIdx];
    const presentWorkers = log.attendance.filter(w => !w.status.includes('Absent'));
    openModal(`
        <h3 class="card-title">👷 تحديد العمال المنفذين</h3>
        <button class="btn btn-blue btn-full" style="margin-bottom:8px;" onclick="document.querySelectorAll('.wk-chk').forEach(c=>c.checked=true)">👥 الفريق بالكامل (Team)</button>
        <div style="margin-bottom:10px;">
            ${presentWorkers.map(w => {
                const shortName = (w.name.split('/')[1] || w.name).trim();
                const checked = task.workers.includes(shortName) || task.workers.includes('Team');
                const tCnt = log.tasks.filter(t => (t.workers||[]).includes(shortName) || (t.workers||[]).includes('Team')).length;
                return `<label style="display:block;padding:8px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:bold;">
                    <input type="checkbox" class="wk-chk" value="${esc(shortName)}" ${checked ? 'checked' : ''}> ${esc(shortName)} <span style="font-size:10px;color:var(--muted);">(${tCnt} مهام)</span>
                </label>`;
            }).join('')}
        </div>
        <div class="grid-2"><button class="btn btn-green" onclick="saveAssignedWorkers(${tIdx})">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveAssignedWorkers(tIdx) {
    pushUndo('تعيين عمال لمهمة');
    const t = getDayLog().tasks[tIdx];
    const chks = Array.from(document.querySelectorAll('.wk-chk:checked'));
    const allCnt = document.querySelectorAll('.wk-chk').length;
    if (chks.length === allCnt && allCnt > 1) {
        t.workers = ['Team'];
    } else {
        t.workers = chks.map(c => c.value);
    }
    logSectionHistory('tasks', 'workers', `عمال ${t.zones}: ${t.workers.join(' / ')}`, { taskId: t.id });
    closeModal(); saveState(); renderTasks(getDayLog());
}

/* ================= Tanker Pre-Start (24,000 L Capacity) & Finish Dispensed Modals ================= */
function getPreviousTankerRemaining(currentIdx) {
    const tasks = getDayLog().tasks;
    for (let i = currentIdx - 1; i >= 0; i--) {
        const pt = tasks[i];
        if (pt.isTanker && parseFloat(pt.tankerCapacity) > 0) {
            const rem = parseFloat(pt.tankerCapacity) - (parseFloat(pt.tankerLiters) || 0);
            if (rem > 0) return rem;
        }
    }
    return null;
}

function openTankerPreModal(tIdx) {
    const t = getDayLog().tasks[tIdx];
    const prevRem = getPreviousTankerRemaining(tIdx);
    openModal(`
        <h3 class="card-title">🚚 سعة التنكر قبل البدء (السعة الكاملة 24,000 L)</h3>
        <p style="font-size:12px;color:var(--muted);">حدد كمية الماء المتوفرة داخل الحوضية قبل بدء ري منطقة <b>${esc(t.zones)}</b>:</p>
        <div style="margin-bottom:8px;">
            <span class="chip" onclick="document.getElementById('tkCap').value=24000">كامل (24,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkCap').value=18000">ثلاثة أرباع (18,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkCap').value=12000">نصف (12,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkCap').value=6000">ربع (6,000 L)</span>
            ${prevRem ? `<span class="chip active" onclick="document.getElementById('tkCap').value=${prevRem}">المتبقي من السابق (${prevRem.toLocaleString()} L)</span>` : ''}
        </div>
        <div class="inp-wrap">
            <input type="number" id="tkCap" class="inp" value="${esc(t.tankerCapacity || 24000)}" placeholder="أدخل السعة باللتر...">
            <button class="clr-btn" onclick="quickClearField('tkCap')">✕</button>
        </div>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="saveTankerPreCapacity(${tIdx})">حفظ السعة</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function saveTankerPreCapacity(tIdx) {
    pushUndo('تحديد سعة التنكر قبل البدء');
    const t = getDayLog().tasks[tIdx];
    t.tankerCapacity = parseFloat(document.getElementById('tkCap').value) || 0;
    logSectionHistory('tasks', 'tanker', `سعة التنكر لـ ${t.zones}: ${t.tankerCapacity.toLocaleString()} L`, { taskId: t.id });
    closeModal(); saveState(); renderTasks(getDayLog());
}

function openTankerFinishModal(tIdx) {
    const t = getDayLog().tasks[tIdx];
    const cap = parseFloat(t.tankerCapacity) || 24000;
    openModal(`
        <h3 class="card-title">💧 تسجيل كمية الصرف عند الانتهاء</h3>
        <p style="font-size:12px;color:var(--muted);">السعة المسجلة قبل البدء: <b>${cap.toLocaleString()} L</b></p>
        <label class="lbl">الكمية المصروفة فعلياً (لتر):</label>
        <div style="margin-bottom:8px;">
            <span class="chip" onclick="document.getElementById('tkDisp').value=${cap}">صرف كامل السعة (${cap.toLocaleString()} L)</span>
            <span class="chip" onclick="document.getElementById('tkDisp').value=18000">ثلاثة أرباع (18,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkDisp').value=12000">نصف (12,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkDisp').value=6000">ربع (6,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkDisp').value=10000">10,000 L</span>
        </div>
        <div class="inp-wrap">
            <input type="number" id="tkDisp" class="inp" value="${esc(t.tankerLiters || cap)}" placeholder="كمية الصرف باللتر...">
            <button class="clr-btn" onclick="quickClearField('tkDisp')">✕</button>
        </div>
        <label class="lbl">الملوحة (PPM):</label>
        <div class="inp-wrap">
            <input type="number" id="tkPpm" class="inp" value="${esc(t.tankerPpm)}" placeholder="مثلاً: 780">
            <button class="clr-btn" onclick="quickClearField('tkPpm')">✕</button>
        </div>
        <label class="lbl">نقاوة الماء:</label>
        <select id="tkVis" class="inp">
            <option value="Clear / صافية" ${t.tankerVisual === 'Clear / صافية' ? 'selected' : ''}>Clear / صافية</option>
            <option value="Turbid / عكرة" ${t.tankerVisual === 'Turbid / عكرة' ? 'selected' : ''}>Turbid / عكرة</option>
            <option value="Sediment / رواسب" ${t.tankerVisual === 'Sediment / رواسب' ? 'selected' : ''}>Sediment / رواسب</option>
        </select>
        <div class="grid-2"><button class="btn btn-green" onclick="saveTankerDispensed(${tIdx})">اعتماد الصرف</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveTankerDispensed(tIdx) {
    pushUndo('تسجيل كمية صرف التنكر');
    const t = getDayLog().tasks[tIdx];
    if (!t.tankerCapacity) t.tankerCapacity = TANKER_FULL_CAPACITY;
    t.tankerLiters = parseFloat(document.getElementById('tkDisp').value) || 0;
    t.tankerPpm = document.getElementById('tkPpm').value.trim();
    t.tankerVisual = document.getElementById('tkVis').value;
    if (t.tankerLiters > 0) {
        t.note = `${t.tankerPpm ? t.tankerPpm + ' ppm \ ' : ''}${Number(t.tankerLiters).toLocaleString()} L`;
        logSectionHistory('tasks', 'tanker', `صرف تنكر ${t.zones}: ${t.note}`, { taskId: t.id });
    }
    closeModal(); saveState(); renderTasks(getDayLog()); renderReadingsAndTools(getDayLog());
}

function openAgroModal(tIdx) {
    const t = getDayLog().tasks[tIdx];
    openModal(`
        <h3 class="card-title">🧪 سجل الأسمدة والمبيدات</h3>
        <label class="lbl">اسم السماد أو المبيد:</label>
        <div class="inp-wrap"><input id="agName" class="inp" value="${esc(t.agroName)}" placeholder="مثلاً: NPK 20-20-20"><button class="clr-btn" onclick="quickClearField('agName')">✕</button></div>
        <label class="lbl">الكمية / الجرعة:</label>
        <div class="inp-wrap"><input id="agDose" class="inp" value="${esc(t.agroDose)}" placeholder="مثلاً: 2 كغم"><button class="clr-btn" onclick="quickClearField('agDose')">✕</button></div>
        <div class="grid-2"><button class="btn btn-green" onclick="saveAgroData(${tIdx})">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveAgroData(tIdx) {
    pushUndo('تسجيل جرعة سماد/مبيد');
    const t = getDayLog().tasks[tIdx];
    t.agroName = document.getElementById('agName').value.trim();
    t.agroDose = document.getElementById('agDose').value.trim();
    if (t.agroName) {
        t.note = `المادة: ${t.agroName} (${t.agroDose})`;
        getDayLog().tools.push({ name: t.agroName, cat: 'Materials / مادة', qty: 1, cond: 'Good / جيد', note: t.agroDose });
        logSectionHistory('tasks', 'agro', `تسميد/علاج ${t.zones}: ${t.agroName}`, { taskId: t.id });
    }
    closeModal(); saveState(); renderTasks(getDayLog()); renderReadingsAndTools(getDayLog());
}

function openPlanEditorModal() {
    const site = getSite();
    const dayEn = getDayNameEn(state.activeDate);
    const items = (site.plan && site.plan[dayEn]) || [];
    openModal(`
        <h3 class="card-title">🗓️ تعديل خطة الري ليوم (${dayEn})</h3>
        <div style="max-height:180px;overflow-y:auto;margin-bottom:10px;">
            ${items.map((it, i) => `
                <div class="meter-card" style="padding:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <b style="font-size:12px;">${esc(it.zones)} — ${esc(it.dur)}</b>
                        <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="removePlanItem('${dayEn}', ${i})">🗑️</button>
                    </div>
                    <div style="font-size:11px;color:var(--muted);">${esc(it.desc)}</div>
                </div>
            `).join('') || '<div style="font-size:12px;color:var(--muted);">لا توجد مهام مجدولة</div>'}
        </div>
        <label class="lbl">إضافة بند ليوم ${dayEn}:</label>
        <input id="plZones" list="globalZonesList" class="inp" placeholder="المناطق (مثلاً: B1, B2)">
        <input id="plDesc" class="inp" placeholder="الوصف (مثلاً: Drip only)">
        <div class="grid-2">
            <div>
                <label class="lbl">المدة:</label>
                <div style="display:flex;gap:4px;">
                    ${buildDurationSelectHtml('1:00 hr', 'plDurSel', '')}
                    <button class="btn btn-outline btn-sm" style="height:37px;" onclick="openCustomTimeModal('select_el', 0, 'plDurSel')">⏱️</button>
                </div>
            </div>
            <div style="display:flex;align-items:center;padding-top:14px;"><label style="font-size:12px;font-weight:bold;"><input type="checkbox" id="plTanker"> تنكر 🚚</label></div>
        </div>
        <div class="grid-2" style="margin-top:8px;"><button class="btn btn-green" onclick="addPlanItem('${dayEn}')">+ إضافة</button><button class="btn btn-outline" onclick="closeModal()">إغلاق</button></div>
    `);
}
function addPlanItem(dayEn) {
    const site = getSite();
    if (!site.plan) site.plan = {};
    if (!site.plan[dayEn]) site.plan[dayEn] = [];
    const zones = document.getElementById('plZones').value.trim();
    if (!zones) return;
    site.plan[dayEn].push({ task: 'Irrigation  /  ري المنطقة', desc: document.getElementById('plDesc').value.trim() || 'Drip only', zones, dur: document.getElementById('plDurSel').value || '1:00 hr', isTanker: document.getElementById('plTanker').checked });
    saveState(); openPlanEditorModal();
}
function removePlanItem(dayEn, idx) { getSite().plan[dayEn].splice(idx, 1); saveState(); openPlanEditorModal(); }

/* ================= TAB 3: Readings, Separated Moisture (5A) & Perf (5C), Tools ================= */
function jumpToMeters() { switchTab('tools'); window.scrollTo(0, 0); }

function renderReadingsAndTools(log) {
    renderStickySectionHistory('tools', 'stickyHist-tools', 'القراءات والأدوات');
    document.getElementById('moistureContainer').innerHTML = log.moisture.map((mo, idx) => `
        <div style="display:flex;gap:5px;margin-bottom:5px;">
            <input list="globalZonesList" class="inp" style="margin:0;padding:6px;flex:1;" value="${esc(mo.zone)}" placeholder="المنطقة ${mo.id}" onchange="updateMoisture(${idx},'zone',this.value)">
            <input type="number" class="inp" style="margin:0;padding:6px;width:72px;" value="${esc(mo.pct)}" placeholder="%" onchange="updateMoisture(${idx},'pct',this.value)">
            <input class="inp" style="margin:0;padding:6px;flex:1;" value="${esc(mo.note || '')}" placeholder="ملاحظة" onchange="updateMoisture(${idx},'note',this.value)">
        </div>
    `).join('');

    let totalTankerL = 0; let totalTrips = 0;
    log.tasks.forEach(t => { if (parseFloat(t.tankerLiters) > 0) { totalTankerL += parseFloat(t.tankerLiters); totalTrips += (t.tankerTrips || 1); } });
    
    const anyFaulty = log.meters.some(m => m.status === 'faulty');
    document.getElementById('tankerSummaryBox').innerHTML = (totalTankerL > 0 || anyFaulty) ? `
        <div class="tanker-banner" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>🚚 الإجمالي: ${totalTankerL.toLocaleString()} L (${(totalTankerL / 1000).toFixed(1)} m³) | ${totalTrips} نقلات</span>
            ${anyFaulty ? `<span style="color:var(--red);">⚠️ عداد عاطل</span>` : ''}
        </div>` : '';

    document.getElementById('metersContainer').innerHTML = log.meters.map((m, idx) => {
        const isFaulty = m.status === 'faulty';
        const usage = (!isFaulty && m.curr !== '' && !isNaN(parseFloat(m.curr))) ? (parseFloat(m.curr) - parseFloat(m.prev || 0)).toFixed(2) : '-';
        const mPhotos = ensurePhotosArr(m);
        return `
        <div class="meter-card ${isFaulty ? 'faulty' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:4px;flex-wrap:wrap;">
                <b style="font-size:13px;" onclick="renameMeter(${idx})">${esc(m.name)} ✏️</b>
                <div style="display:flex;gap:3px;">
                    <button class="btn btn-sm ${!isFaulty ? 'btn-green' : 'btn-outline'}" onclick="setMeterStatus(${idx},'working')">شغال</button>
                    <button class="btn btn-sm ${isFaulty ? 'btn-red' : 'btn-outline'}" onclick="setMeterStatus(${idx},'faulty')">عاطل</button>
                    <button class="btn btn-sm btn-blue" onclick="openPhotoSourceChoice('meter', ${idx})">📸 (${mPhotos.length})</button>
                    <button class="btn btn-sm btn-outline" onclick="clearMeterReading(${idx})" title="مسح القراءة">🧹</button>
                    <button class="btn btn-sm btn-outline" style="color:var(--red);" onclick="deleteMeter(${idx})" title="حذف">🗑️</button>
                </div>
            </div>
            ${!isFaulty ? `
            <div class="grid-2" style="font-size:12px;">
                <div><label class="lbl">السابق:</label><input type="number" class="inp" style="margin:0;padding:6px;" value="${esc(m.prev)}" onchange="updateMeterField(${idx},'prev',this.value)"></div>
                <div><label class="lbl">الحالي (الاستهلاك: ${usage} m³):</label><input type="number" class="inp" style="margin:0;padding:6px;" value="${esc(m.curr)}" onchange="updateMeterField(${idx},'curr',this.value)"></div>
            </div>` : `
            <input class="inp" style="margin:0;background:white;font-size:12px;" value="${esc(m.note)}" placeholder="وصف عطل العداد..." onchange="updateMeterField(${idx},'note',this.value)">`}
            ${mPhotos.length > 0 ? `
            <div class="photo-strip">
                ${mPhotos.map((pUrl, pI) => `
                    <div class="photo-item-wrap">
                        <img src="${pUrl}" class="photo-thumb" onclick="previewSinglePhoto('${pUrl}')">
                        <button class="photo-del-badge" onclick="removePhotoFromItem('meter', ${idx}, ${pI})">✕</button>
                    </div>
                `).join('')}
            </div>` : ''}
        </div>`;
    }).join('');

    document.getElementById('irrigatedZonesInput').value = log.perf.zonesIrrigated || '';
    document.getElementById('sysStatusSelect').value = log.perf.status || 'جيد';

    const durSel = document.getElementById('sysDurationSelect');
    const curDur = log.perf.duration || '';
    const perfOpts = ['', '0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '6.0'];
    durSel.innerHTML = (curDur && !perfOpts.includes(String(curDur)) ? `<option value="${esc(curDur)}" selected>${esc(curDur)} س</option>` : '') +
        perfOpts.map(v => `<option value="${v}" ${String(curDur) === v ? 'selected' : ''}>${v ? v + ' ساعة' : 'اختر المدة...'}</option>`).join('');

    document.getElementById('pressureNotesInput').value = log.perf.pressureNotes || '';
    document.getElementById('sysNotesInput').value = log.perf.notes || '';

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

function onSysDurationSelect(val) { updatePerfField('duration', val); }
function setMeterStatus(idx, st) {
    pushUndo('تغيير حالة عداد');
    const m = getDayLog().meters[idx];
    m.status = st;
    logSectionHistory('tools', 'meter', `حالة عداد ${m.name}: ${st === 'working' ? 'شغال' : 'عاطل'}`, { meterId: m.id });
    saveState(); renderReadingsAndTools(getDayLog());
}
function updateMeterField(idx, k, v) {
    pushUndo('تحديث قراءة عداد');
    const m = getDayLog().meters[idx];
    m[k] = v;
    if (k === 'curr' && v !== '' && getSite().meters[idx]) getSite().meters[idx].lastReading = parseFloat(v);
    logSectionHistory('tools', 'meter', `قراءة ${m.name}: ${v}`, { meterId: m.id });
    saveState(); renderReadingsAndTools(getDayLog());
}
function clearMeterReading(idx) { pushUndo('مسح قراءة عداد'); getDayLog().meters[idx].curr = ''; getDayLog().meters[idx].photos = []; saveState(); renderReadingsAndTools(getDayLog()); showToast('🧹 تم مسح قراءة العداد'); }
function renameMeter(idx) {
    const n = prompt('تعديل اسم العداد:', getDayLog().meters[idx].name);
    if (n && n.trim()) { pushUndo('تعديل اسم عداد'); getDayLog().meters[idx].name = n.trim(); if (getSite().meters[idx]) getSite().meters[idx].name = n.trim(); saveState(); renderReadingsAndTools(getDayLog()); }
}
function deleteMeter(idx) {
    if (confirm('حذف هذا العداد نهائياً من الموقع؟')) { pushUndo('حذف عداد'); getDayLog().meters.splice(idx, 1); getSite().meters.splice(idx, 1); saveState(); renderReadingsAndTools(getDayLog()); showToast('🗑️ تم حذف العداد'); }
}
function addCustomMeter() {
    const name = prompt('اسم عداد المياه الجديد:');
    if (!name) return;
    pushUndo('إضافة عداد: ' + name);
    const id = 'm_' + Date.now();
    getSite().meters.push({ id, name, lastReading: 0 });
    getDayLog().meters.push({ id, name, status: 'working', prev: 0, curr: '', visual: 'Clear / صافية', note: '', photos: [] });
    logSectionHistory('tools', 'meter', `إضافة عداد: ${name}`, { meterId: id });
    saveState(); renderReadingsAndTools(getDayLog());
}
function updateGaugeVal(idx, v) {
    pushUndo('تحديث قراءة مقياس ضغط');
    const g = getDayLog().gauges[idx];
    g.val = v;
    logSectionHistory('tools', 'gauge', `ضغط ${g.name}: ${v} bar`, { gaugeId: g.id });
    saveState(); renderReadingsAndTools(getDayLog());
}
function deleteGauge(idx) { if (confirm('حذف مقياس الضغط؟')) { pushUndo('حذف مقياس ضغط'); getDayLog().gauges.splice(idx, 1); getSite().gauges.splice(idx, 1); saveState(); renderReadingsAndTools(getDayLog()); } }
function addCustomGauge() {
    const name = prompt('اسم مقياس الضغط الجديد:');
    if (!name) return;
    pushUndo('إضافة مقياس: ' + name);
    const id = 'g_' + Date.now();
    getSite().gauges.push({ id, name, normal: 2.0 });
    getDayLog().gauges.push({ id, name, normal: 2.0, val: '', note: '' });
    saveState(); renderReadingsAndTools(getDayLog());
}
function updateMachinery(k, v) { getDayLog().machinery[k] = v; saveState(); }
function updatePerfField(k, v) {
    const log = getDayLog();
    const res = applySpellAndDictationGuard(v);
    log.perf[k] = res.text;
    if (k === 'zonesIrrigated') log.perf.zonesManualEdit = true;
    saveState();
}
function setPerfNotePreset(txt) { getDayLog().perf.notes = txt; saveState(); renderReadingsAndTools(getDayLog()); }
function updateMoisture(idx, k, v) { getDayLog().moisture[idx][k] = v; saveState(); }
function copyYesterdayTools() {
    const site = getSite();
    const prevDate = Object.keys(site.logs).sort().filter(d => d < state.activeDate).pop();
    const sourceTools = (prevDate && site.logs[prevDate].tools.length) ? site.logs[prevDate].tools : DEFAULT_TOOLS;
    pushUndo('نسخ أدوات الأمس');
    getDayLog().tools = JSON.parse(JSON.stringify(sourceTools));
    logSectionHistory('tools', 'copy', `نسخ ${sourceTools.length} معدات/أدوات`, {});
    saveState(); renderReadingsAndTools(getDayLog()); showToast('📋 تم نسخ قائمة الأدوات');
}
function clearTodayTools() { if (confirm('مسح جميع الأدوات المسجلة اليوم؟')) { pushUndo('مسح أدوات اليوم'); getDayLog().tools = []; saveState(); renderReadingsAndTools(getDayLog()); } }
function editToolQty(idx) {
    const q = prompt('الكمية الجديدة:', getDayLog().tools[idx].qty);
    if (q !== null && !isNaN(parseFloat(q))) { pushUndo('تعديل كمية أداة'); getDayLog().tools[idx].qty = parseFloat(q); saveState(); renderReadingsAndTools(getDayLog()); }
}
function openToolModal() {
    openModal(`
        <h3 class="card-title">🧰 إضافة معدة / أداة / مادة</h3>
        <label class="lbl">الاسم:</label>
        <div class="inp-wrap"><input id="tlName" list="globalToolsList" class="inp" placeholder="مثلاً: اكياس نفايات..."><button class="clr-btn" onclick="quickClearField('tlName')">✕</button></div>
        <div class="grid-2">
            <div><label class="lbl">الفئة:</label><select id="tlCat" class="inp"><option value="Equipment / معدة">Equipment / معدة</option><option value="Tool / أداة">Tool / أداة</option><option value="Materials / مادة">Materials / مادة</option></select></div>
            <div><label class="lbl">الكمية:</label><input type="number" id="tlQty" class="inp" value="1"></div>
        </div>
        <label class="lbl">الحالة:</label>
        <select id="tlCond" class="inp"><option value="Good / جيد">Good / جيد</option><option value="Needs Maintenance / يحتاج صيانة">Needs Maintenance</option><option value="Out of Service / خارج الخدمة">Out of Service</option></select>
        <div class="grid-2"><button class="btn btn-green" onclick="saveNewTool()">إضافة</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveNewTool() {
    const name = document.getElementById('tlName').value.trim();
    if (!name) return;
    pushUndo('إضافة أداة: ' + name);
    const qty = parseFloat(document.getElementById('tlQty').value) || 1;
    const tIdx = getDayLog().tools.length;
    getDayLog().tools.push({ name, cat: document.getElementById('tlCat').value, qty, cond: document.getElementById('tlCond').value, note: '' });
    if (!state.company.customTools.includes(name)) state.company.customTools.push(name);
    logSectionHistory('tools', 'add', `إضافة أداة: ${name} (×${qty})`, { toolIdx: tIdx });
    closeModal(); saveState(); renderReadingsAndTools(getDayLog());
}
function deleteTool(idx) { pushUndo('حذف أداة'); getDayLog().tools.splice(idx, 1); saveState(); renderReadingsAndTools(getDayLog()); }

/* ================= TAB 4: Plant Inventory, Multi-Photo, Filters & Standalone Excel ================= */
function setInvFilter(val) {
    invFilterState = val;
    document.querySelectorAll('.inv-filter-bar .chip').forEach(c => c.classList.remove('active'));
    const el = document.getElementById('f_' + val);
    if(el) el.classList.add('active');
    renderInventory(getSite());
}

function renderInventory(site) {
    renderStickySectionHistory('inv', 'stickyHist-inv', 'الجرد');
    const invBox = document.getElementById('invContainer');
    const alphaBox = document.getElementById('alphaScroller');

    if (!activeInvZoneId) {
        alphaBox.innerHTML = '';
        invBox.innerHTML = `
            <div class="card">
                <div class="card-head">
                    <h3 class="card-title">🌿 مناطق الجرد (${site.inventory.length})</h3>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-blue btn-sm" onclick="openInventoryMasterSummary()">📊 ملخص الجرد</button>
                        <button class="btn btn-green btn-sm" onclick="addInvZone()">+ منطقة</button>
                    </div>
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

    let filteredPlants = zone.plants;
    if (invFilterState === 'warn') {
        filteredPlants = zone.plants.filter(p => Object.keys(p.counts).some(k => k !== 'c1' && p.counts[k] > 0));
    } else if (invFilterState === 'today') {
        filteredPlants = zone.plants.filter(p => (p.entries||[]).some(e => e.date === state.activeDate));
    }

    invBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-blue btn-sm" onclick="exitInvZone()">➡️ المناطق</button>
            <b>📍 ${esc(zone.name)} (${zone.plants.length})</b>
            <div style="display:flex;gap:4px;">
                <button class="btn btn-outline btn-sm" onclick="copySpeciesFromZone()">📋 نسخ أصناف</button>
                <button class="btn btn-outline btn-sm" onclick="sortZonePlants()">🔤</button>
            </div>
        </div>
        ${filteredPlants.length === 0 ? `<div style="text-align:center;color:var(--muted);padding:20px;">لا توجد نباتات تطابق الفلتر الحالي</div>` : ''}
        ${filteredPlants.map(p => {
            const pIdx = zone.plants.findIndex(x => x.id === p.id);
            const total = Object.values(p.counts).reduce((a, b) => a + (b || 0), 0);
            const hArr = (p.entries || []).map(e => parseFloat(e.height)).filter(n => !isNaN(n) && n > 0);
            const avgH = hArr.length ? (hArr.reduce((a, b) => a + b, 0) / hArr.length).toFixed(2) : null;
            const todayPhotoCnt = (p.entries || []).filter(e => e.date === state.activeDate).reduce((s, e) => s + ensurePhotosArr(e).length, 0);
            return `
            <div class="plant-box" id="pbox_${p.id}">
                <div style="display:flex;gap:4px;margin-bottom:8px;">
                    <input list="globalPlantsList" class="inp" style="margin:0;font-weight:bold;font-size:15px;" value="${esc(p.name)}" onchange="renameInvPlant(${pIdx}, this.value)">
                    <button class="btn btn-outline btn-sm" onclick="openPlantSeqLogModal(${pIdx})">📜 (${(p.entries || []).length})</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteInvPlant(${pIdx})">✕</button>
                </div>
                <div style="font-size:12px;color:var(--blue);font-weight:bold;margin-bottom:8px;">
                    الإجمالي: ${total} ${avgH ? `| 📏 متوسط الطول: ${avgH} ${unit}` : ''} | 📸 صور اليوم: ${todayPhotoCnt}
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
                                <b style="font-size:12px;">📏 الطول (${unit}) وصور #${activeEntryPrompt.seq}:</b>
                                <div style="display:flex;gap:4px;">
                                    <button class="btn btn-blue btn-sm" onclick="openPhotoSourceChoice('plant', {pIdx:${pIdx}, entryId:'${activeEntryPrompt.entryId}'})">📸 +صورة</button>
                                    <button class="btn btn-outline btn-sm" onclick="activeEntryPrompt=null;renderInventory(getSite())">✕</button>
                                </div>
                            </div>
                            <div style="display:flex;gap:4px;flex-wrap:wrap;">
                                <input type="number" step="any" class="inp" style="width:75px;margin:0;padding:5px;text-align:center;" placeholder="${unit}" oninput="setPlantEntryHeight(${pIdx},'${activeEntryPrompt.entryId}',this.value)">
                                ${lastUsedHeight ? `<button class="chip" style="color:var(--purple);border-color:var(--purple);" onclick="setPlantEntryHeight(${pIdx},'${activeEntryPrompt.entryId}',${lastUsedHeight})">تكرار ${lastUsedHeight}</button>` : ''}
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

function openInventoryMasterSummary() {
    const site = getSite();
    let grandTotal = 0;
    const condTotals = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 };
    const zoneLines = [];

    site.inventory.forEach(z => {
        let zSum = 0;
        const pDetails = z.plants.map(p => {
            const pSum = Object.values(p.counts).reduce((a, b) => a + (b || 0), 0);
            zSum += pSum;
            grandTotal += pSum;
            HEALTH_CONDITIONS.forEach(c => { condTotals[c.id] += (p.counts[c.id] || 0); });
            return `${p.name}: ${pSum}`;
        });
        if (zSum > 0) zoneLines.push(`📍 ${z.name} (${zSum}): ${pDetails.join(' | ')}`);
    });

    const summaryText = `🌿 ملخص جرد (${site.name.split('/')[0].trim()}) — ${state.activeDate}
` +
        `الإجمالي الكلي: ${grandTotal} شجرة/نبتة
` +
        HEALTH_CONDITIONS.map(c => `• ${c.name}: ${condTotals[c.id]}`).join('
') +
        (site.stopMarker ? `
🎀 علامة التوقف: ${site.stopMarker}` : '') +
        `

تفصيل المناطق:
` + zoneLines.join('
');

    openModal(`
        <h3 class="card-title">📊 ملخص الجرد الشامل (${grandTotal})</h3>
        <div class="grid-3" style="margin-bottom:10px;">
            ${HEALTH_CONDITIONS.map(c => `<div style="background:${c.color};padding:6px;border-radius:8px;text-align:center;font-size:11px;font-weight:bold;">${c.name}<br><span style="font-size:15px;">${condTotals[c.id]}</span></div>`).join('')}
        </div>
        <textarea id="invSumBox" class="inp" rows="7" readonly style="font-size:11.5px;">${esc(summaryText)}</textarea>
        <div class="grid-2">
            <button class="btn btn-green" onclick="navigator.clipboard.writeText(document.getElementById('invSumBox').value);showToast('📋 تم نسخ ملخص الجرد!')">📋 نسخ الملخص</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}

function setStopMarker() { const site = getSite(); const m = prompt('مكان علامة التوقف الميداني:', site.stopMarker || ''); if (m !== null) { site.stopMarker = m.trim(); saveState(); renderInventory(site); } }
function copySpeciesFromZone() {
    const site = getSite();
    const otherZones = site.inventory.filter(z => z.id !== activeInvZoneId && z.plants.length > 0);
    if (!otherZones.length) { showToast('⚠️ لا توجد مناطق أخرى تحتوي على أصناف'); return; }
    openModal(`
        <h3 class="card-title">📋 نسخ قائمة الأصناف من منطقة سابقة</h3>
        <select id="copySrcZone" class="inp">${otherZones.map(z => `<option value="${z.id}">${esc(z.name)} (${z.plants.length})</option>`).join('')}</select>
        <div class="grid-2"><button class="btn btn-green" onclick="confirmCopySpecies()">نسخ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function confirmCopySpecies() {
    const site = getSite();
    const src = site.inventory.find(z => z.id === document.getElementById('copySrcZone').value);
    const dst = site.inventory.find(z => z.id === activeInvZoneId);
    if (src && dst) {
        pushUndo('نسخ أصناف إلى ' + dst.name);
        src.plants.forEach((p, i) => {
            if (!dst.plants.some(x => x.name === p.name)) dst.plants.push({ id: 'p_' + Date.now() + '_' + i, name: p.name, counts: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 }, entries: [], note: '' });
        });
        saveState(); renderInventory(site); showToast('📋 تم نسخ الأصناف');
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
            ${entries.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:15px;">لا توجد قيود</div>' :
            entries.map((e, i) => {
                const cObj = HEALTH_CONDITIONS.find(c => c.id === e.condId);
                const ePhotos = ensurePhotosArr(e);
                return `
                <div class="meter-card" style="padding:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div><b>#${i + 1} — ${cObj ? cObj.name : ''}</b><div style="font-size:11px;color:var(--muted);">${esc(e.date)} ${e.height ? `| ${e.height} ${state.company.heightUnit}` : ''}</div></div>
                        <button class="btn btn-outline btn-sm" onclick="openPhotoSourceChoice('plant', {pIdx:${pIdx}, entryId:'${e.id}'})">📸 +صورة (${ePhotos.length})</button>
                    </div>
                    ${ePhotos.length > 0 ? `<div class="photo-strip">${ePhotos.map((u, pI) => `<div class="photo-item-wrap"><img src="${u}" class="photo-thumb" onclick="previewSinglePhoto('${u}')"><button class="photo-del-badge" onclick="removePhotoFromItem('plant', {pIdx:${pIdx}, entryId:'${e.id}'}, ${pI})">✕</button></div>`).join('')}</div>` : ''}
                </div>`;
            }).join('')}
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:10px;" onclick="closeModal()">إغلاق</button>
    `);
}
function addInvZone() {
    openModal(`
        <h3 class="card-title">📍 إضافة منطقة للجرد</h3>
        <div class="inp-wrap"><input id="izName" list="globalZonesList" class="inp" placeholder="مثلاً: AR5"><button class="clr-btn" onclick="quickClearField('izName')">✕</button></div>
        <div class="grid-2"><button class="btn btn-green" onclick="confirmAddInvZone()">دخول</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function confirmAddInvZone() {
    const name = document.getElementById('izName').value.trim();
    if (!name) return;
    pushUndo('إضافة منطقة جرد: ' + name);
    const z = { id: 'z_' + Date.now(), name, plants: [] };
    getSite().inventory.push(z); activeInvZoneId = z.id;
    closeModal(); saveState(); renderAll();
}
function deleteInvZone(id) { if (confirm('حذف المنطقة؟')) { pushUndo('حذف منطقة جرد'); getSite().inventory = getSite().inventory.filter(z => z.id !== id); saveState(); renderInventory(getSite()); } }
function enterInvZone(id) { activeInvZoneId = id; activeEntryPrompt = null; renderAll(); }
function exitInvZone() { activeInvZoneId = null; activeEntryPrompt = null; renderAll(); }
function sortZonePlants() { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z) { z.plants.sort((a, b) => a.name.localeCompare(b.name, 'ar')); saveState(); renderInventory(getSite()); } }
function jumpAlpha(ch) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (!z) return; const t = z.plants.find(p => (p.name || '').trim().startsWith(ch)); if (t) document.getElementById('pbox_' + t.id)?.scrollIntoView({ behavior: 'smooth' }); }
function addInvPlant() { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (!z) return; pushUndo('إضافة صنف نبات'); z.plants.push({ id: 'p_' + Date.now(), name: 'نبات ' + (z.plants.length + 1), counts: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 }, entries: [], note: '' }); saveState(); renderInventory(getSite()); }
function renameInvPlant(pIdx, val) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z) { z.plants[pIdx].name = val; saveState(); } }
function deleteInvPlant(pIdx) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z && confirm('حذف النبات؟')) { pushUndo('حذف صنف نبات'); z.plants.splice(pIdx, 1); saveState(); renderInventory(getSite()); } }
function updateInvPlantNote(pIdx, val) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z) { z.plants[pIdx].note = val; saveState(); } }

function changePlantCount(pIdx, cId, delta) {
    const site = getSite();
    const z = site.inventory.find(x => x.id === activeInvZoneId);
    const p = z.plants[pIdx];
    const cur = p.counts[cId] || 0;
    if (cur + delta < 0) return;
    pushUndo(`جرد ${p.name} (${delta > 0 ? '+1' : '-1'})`);
    p.counts[cId] = cur + delta;
    if (!p.entries) p.entries = [];
    const cObj = HEALTH_CONDITIONS.find(c => c.id === cId);
    if (delta > 0) {
        const entryId = 'e_' + Date.now();
        const entry = { id: entryId, date: state.activeDate, condId: cId, height: null, photos: [] };
        p.entries.push(entry);
        logSectionHistory('inv', 'add', `${z.name} | ${p.name} — ${cObj.name} (+1)`, { zoneId: z.id, plantId: p.id, condId: cId, entryId });
        activeEntryPrompt = { plantId: p.id, condId: cId, entryId, seq: p.entries.length };
    } else {
        for (let i = p.entries.length - 1; i >= 0; i--) { if (p.entries[i].condId === cId) { p.entries.splice(i, 1); break; } }
        logSectionHistory('inv', 'dec', `${z.name} | ${p.name} — ${cObj.name} (-1)`, {});
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
    if (ent) {
        ent.height = (!isNaN(num) && num > 0) ? num : null;
        if (ent.height) lastUsedHeight = ent.height;
    }
    const latestInvH = (getDayLog().secHistory.inv || [])[0];
    if (latestInvH && latestInvH.ref && latestInvH.ref.entryId === entryId) {
        const cObj = HEALTH_CONDITIONS.find(c => c.id === ent.condId);
        latestInvH.summary = `${z.name} | ${p.name} — ${cObj ? cObj.name : ''} ${ent.height ? `(${ent.height} ${state.company.heightUnit})` : ''}`;
    }
    saveState(); renderInventory(site);
}

/* ================= Standalone Inventory Excel Export ================= */
async function exportInventoryStandaloneExcel() {
    if (typeof ExcelJS === 'undefined') { showToast('⚠️ مكتبة ExcelJS غير محملة'); return; }
    showToast('⏳ جاري بناء إكسيل الجرد بالصور...');
    const site = getSite();
    const wb = new ExcelJS.Workbook();
    
    const sumWs = wb.addWorksheet('ملخص الجرد', { views: [{ rightToLeft: true }] });
    const sumHeaders = ['المنطقة', 'النبات', 'الإجمالي', ...HEALTH_CONDITIONS.map(c => c.name), 'متوسط الطول', 'ملاحظات', 'علامة التوقف'];
    sumWs.addRow(sumHeaders).font = { bold: true };
    sumWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    
    let gTot = 0;
    site.inventory.forEach(z => {
        z.plants.forEach(p => {
            const tot = Object.values(p.counts).reduce((a, b) => a + (b || 0), 0);
            if (tot === 0) return;
            gTot += tot;
            const hArr = (p.entries || []).map(e => parseFloat(e.height)).filter(n => !isNaN(n) && n > 0);
            const avgH = hArr.length ? (hArr.reduce((a, b) => a + b, 0) / hArr.length).toFixed(2) : '';
            const row = [z.name, p.name, tot];
            HEALTH_CONDITIONS.forEach(c => row.push(p.counts[c.id] || 0));
            row.push(avgH, p.note || '', site.stopMarker || '');
            sumWs.addRow(row);
        });
    });
    sumWs.addRow(['الإجمالي الكلي', '', gTot]);
    sumWs.columns.forEach(c => c.width = 15);

    const entWs = wb.addWorksheet('سجل الترتيب والصور', { views: [{ rightToLeft: true }] });
    entWs.addRow(['المنطقة', 'النبات', 'التسلسل', 'التاريخ', 'الحالة الصحية', 'الطول المقاس', 'الصورة']).font = { bold: true };
    entWs.columns.forEach((c, i) => { c.width = i === 6 ? 22 : 15; });
    entWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };

    let rIdx = 2;
    site.inventory.forEach(z => {
        z.plants.forEach(p => {
            (p.entries || []).forEach((e, i) => {
                const cObj = HEALTH_CONDITIONS.find(c => c.id === e.condId);
                const rowObj = entWs.addRow([z.name, p.name, `#${i+1}`, e.date, cObj ? cObj.name : '', e.height || '', '']);
                rowObj.height = 70;
                const ePhotos = ensurePhotosArr(e);
                if (ePhotos.length > 0) {
                    try {
                        const imgId = wb.addImage({ base64: ePhotos[0], extension: 'jpeg' });
                        entWs.addImage(imgId, { tl: { col: 6.1, row: rIdx - 0.9 }, ext: { width: 120, height: 80 } });
                    } catch {}
                }
                rIdx++;
            });
        });
    });

    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TFF_Inventory_${site.id}_${state.activeDate}.xlsx`;
    a.click();
    showToast(`✅ تم تنزيل إكسيل الجرد بالصور!`);
}

/* ================= TAB 5: Issues, IR, SDL, OAR & Precision Gemini Export ================= */
function renderExportAndIssues(site, log) {
    renderStickySectionHistory('issues', 'stickyHist-issues', 'المشاكل والحوادث');
    const { photos } = collectTodayPhotos();
    const cntEl = document.getElementById('todayPhotoCount');
    if (cntEl) cntEl.textContent = photos.length;

    document.getElementById('issuesContainer').innerHTML = site.issues.length === 0
        ? `<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px;">لا توجد مشاكل مفتوحة</div>`
        : site.issues.map((iss, idx) => {
            const isOpen = iss.status === 'Open';
            const iPhotos = ensurePhotosArr(iss);
            return `
            <div class="meter-card ${isOpen ? 'faulty' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <b style="font-size:12px;">${esc(iss.code)} | 📍 ${esc(iss.zone)} (${esc(iss.severity)})</b>
                    <span class="badge" style="background:${isOpen ? '#fee2e2' : '#dcfce7'};color:${isOpen ? '#b91c1c' : '#166534'};">${isOpen ? 'Open' : 'Resolved'}</span>
                </div>
                <div style="font-size:12px;margin:5px 0;">${esc(iss.desc)}</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    ${isOpen ? `<button class="btn btn-green btn-sm" onclick="resolveIssue(${idx})">✓ إغلاق</button>` : ''}
                    <button class="btn btn-outline btn-sm" onclick="openPhotoSourceChoice('issue', ${idx})">📸 +صورة (${iPhotos.length})</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteIssue(${idx})">✕</button>
                </div>
                ${iPhotos.length > 0 ? `<div class="photo-strip">${iPhotos.map((u, pI) => `<div class="photo-item-wrap"><img src="${u}" class="photo-thumb" onclick="previewSinglePhoto('${u}')"><button class="photo-del-badge" onclick="removePhotoFromItem('issue', ${idx}, ${pI})">✕</button></div>`).join('')}</div>` : ''}
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
        <label class="lbl">المنطقة:</label>
        <div class="inp-wrap"><input id="issZone" list="globalZonesList" class="inp" placeholder="مثلاً: B1"><button class="clr-btn" onclick="quickClearField('issZone')">✕</button></div>
        <label class="lbl">درجة الخطورة:</label><select id="issSev" class="inp"><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option><option value="Low">Low</option></select>
        <label class="lbl">وصف المشكلة:</label>
        <div class="inp-wrap"><textarea id="issDesc" class="inp auto-grow" rows="3"></textarea><button class="clr-btn top-align" onclick="quickClearField('issDesc')">✕</button></div>
        <div class="grid-2"><button class="btn btn-red" onclick="saveNewIssue()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveNewIssue() {
    const site = getSite();
    const desc = applySpellAndDictationGuard(document.getElementById('issDesc').value.trim()).text;
    if (!desc) return;
    pushUndo('تسجيل مشكلة ميدانية');
    const code = 'ISS-' + String(site.issues.length + 1).padStart(2, '0');
    const zone = document.getElementById('issZone').value.trim() || 'General';
    const iid = 'i_' + Date.now();
    site.issues.unshift({ id: iid, code, date: state.activeDate, zone, severity: document.getElementById('issSev').value, desc, status: 'Open', resolvedDate: '', photos: [] });
    logSectionHistory('issues', 'add', `${code} [${zone}]: ${desc}`, { issueId: iid });
    closeModal(); saveState(); renderExportAndIssues(site, getDayLog());
}
function resolveIssue(idx) {
    pushUndo('إغلاق مشكلة');
    const iss = getSite().issues[idx];
    iss.status = 'Resolved'; iss.resolvedDate = state.activeDate;
    logSectionHistory('issues', 'resolve', `إغلاق ${iss.code} [${iss.zone}]`, { issueId: iss.id });
    saveState(); renderExportAndIssues(getSite(), getDayLog());
}
function deleteIssue(idx) { pushUndo('حذف مشكلة'); getSite().issues.splice(idx, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }

function openIncidentModal() {
    tempModalPhotos = [];
    openModal(`
        <h3 class="card-title">🚨 نموذج تقرير حادث (Incident Report)</h3>
        <div class="grid-2">
            <div><label class="lbl">وقت الحادث:</label><input type="time" id="irTime" class="inp" value="10:30"></div>
            <div><label class="lbl">الموقع / المنطقة:</label><input id="irZone" list="globalZonesList" class="inp" placeholder="B1"></div>
        </div>
        <div class="grid-2">
            <div><label class="lbl">نوع الحادث:</label><input id="irType" class="inp" placeholder="كسر أنبوب / إصابة"></div>
            <div><label class="lbl">الخطورة:</label><select id="irSev" class="inp"><option value="Minor / طفيف">Minor / طفيف</option><option value="Moderate / متوسط">Moderate / متوسط</option><option value="Major / كبير">Major / كبير</option><option value="Critical / حرج">Critical / حرج</option></select></div>
        </div>
        <label class="lbl">الأشخاص المتورطون:</label><input id="irPersons" class="inp">
        <label class="lbl">ماذا حدث (التسلسل):</label><textarea id="irTimeline" class="inp auto-grow" rows="2"></textarea>
        <label class="lbl">الإجراء الفوري المتخذ:</label><textarea id="irAction" class="inp auto-grow" rows="2"></textarea>
        <div class="grid-2">
            <div><label class="lbl">رعاية طبية؟</label><select id="irMed" class="inp"><option value="No / لا">No / لا</option><option value="Yes / نعم">Yes / نعم</option></select></div>
            <div style="padding-top:16px;display:flex;gap:4px;">
                <button class="btn btn-blue btn-sm" style="flex:1;" onclick="triggerInlineModalPhoto('camFileInput')">📸 كاميرا</button>
                <button class="btn btn-green btn-sm" style="flex:1;" onclick="triggerInlineModalPhoto('galFileInput')">🖼️ استوديو</button>
            </div>
        </div>
        <div id="inlineModalPhotoStrip" class="photo-strip" style="margin-bottom:8px;"></div>
        <div class="grid-2"><button class="btn btn-orange" onclick="saveIncident()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveIncident() {
    pushUndo('إضافة تقرير حادث');
    const log = getDayLog();
    const code = 'IR-' + String(log.incidents.length + 1).padStart(3, '0');
    const zone = document.getElementById('irZone').value.trim() || 'General';
    log.incidents.push({
        code, time: document.getElementById('irTime').value, zone,
        type: document.getElementById('irType').value.trim(), severity: document.getElementById('irSev').value,
        persons: document.getElementById('irPersons').value.trim(), timeline: document.getElementById('irTimeline').value.trim(),
        action: document.getElementById('irAction').value.trim(), medical: document.getElementById('irMed').value, photos: [...tempModalPhotos]
    });
    logSectionHistory('issues', 'ir', `تقرير حادث ${code} [${zone}]`, {});
    tempModalPhotos = []; closeModal(); saveState(); renderExportAndIssues(getSite(), log); showToast('🚨 تم حفظ تقرير الحادث ' + code);
}
function deleteIncident(i) { pushUndo('حذف تقرير حادث'); getDayLog().incidents.splice(i, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }

function openSdlModal() {
    tempModalPhotos = [];
    openModal(`
        <h3 class="card-title">📑 سجل انحراف موقع (Site Deviation Log)</h3>
        <label class="lbl">موضوع الانحراف:</label><input id="sdlSub" class="inp" placeholder="مثلاً: أعمال حفر المقاول">
        <div class="grid-2">
            <div><label class="lbl">المنطقة:</label><input id="sdlZone" list="globalZonesList" class="inp"></div>
            <div><label class="lbl">الخطورة:</label><select id="sdlSev" class="inp"><option value="Moderate / متوسط">Moderate / متوسط</option><option value="Major / كبير">Major / كبير</option><option value="Critical / حرج">Critical / حرج</option><option value="Minor / طفيف">Minor / طفيف</option></select></div>
        </div>
        <div class="grid-2">
            <div><label class="lbl">نوع الانحراف:</label><input id="sdlType" class="inp"></div>
            <div><label class="lbl">الطرف المسؤول:</label><input id="sdlParty" class="inp"></div>
        </div>
        <label class="lbl">الملاحظة (OBS):</label><textarea id="sdlObs" class="inp auto-grow" rows="2"></textarea>
        <label class="lbl">التحليل (ANA):</label><textarea id="sdlAna" class="inp auto-grow" rows="2"></textarea>
        <label class="lbl">التوصية (REC):</label><textarea id="sdlRec" class="inp auto-grow" rows="2"></textarea>
        <div class="grid-2" style="margin-bottom:6px;">
            <button class="btn btn-blue btn-sm" onclick="triggerInlineModalPhoto('camFileInput')">📸 كاميرا</button>
            <button class="btn btn-green btn-sm" onclick="triggerInlineModalPhoto('galFileInput')">🖼️ استوديو</button>
        </div>
        <div id="inlineModalPhotoStrip" class="photo-strip" style="margin-bottom:8px;"></div>
        <div class="grid-2"><button class="btn btn-purple" onclick="saveSdl()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveSdl() {
    pushUndo('إضافة سجل انحراف');
    const log = getDayLog();
    const code = 'SDL-' + String(log.sdls.length + 1).padStart(3, '0');
    const zone = document.getElementById('sdlZone').value.trim() || 'General';
    log.sdls.push({
        code, subject: document.getElementById('sdlSub').value.trim(), zone,
        severity: document.getElementById('sdlSev').value, type: document.getElementById('sdlType').value.trim(),
        party: document.getElementById('sdlParty').value.trim(), obs: document.getElementById('sdlObs').value.trim(),
        ana: document.getElementById('sdlAna').value.trim(), rec: document.getElementById('sdlRec').value.trim(), photos: [...tempModalPhotos]
    });
    logSectionHistory('issues', 'sdl', `سجل انحراف ${code} [${zone}]`, {});
    tempModalPhotos = []; closeModal(); saveState(); renderExportAndIssues(getSite(), log); showToast('📑 تم حفظ سجل الانحراف ' + code);
}
function deleteSdl(i) { pushUndo('حذف سجل انحراف'); getDayLog().sdls.splice(i, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }

function saveOarFields() {
    const log = getDayLog();
    log.oar.obs = applySpellAndDictationGuard(document.getElementById('oarObs').value).text;
    log.oar.ana = applySpellAndDictationGuard(document.getElementById('oarAna').value).text;
    log.oar.rec = applySpellAndDictationGuard(document.getElementById('oarRec').value).text;
    saveState();
}

function autoGenerateOAR() {
    pushUndo('توليد OAR ذكي');
    const site = getSite(); const log = getDayLog();
    const blocked = log.tasks.filter(t => t.status.includes('Blocked')).map(t => `${t.zones}: ${t.note || t.desc}`);
    const faultyMeters = log.meters.filter(m => m.status === 'faulty').map(m => `${m.name} (${m.note || 'عاطل'})`);
    const lowGauges = log.gauges.filter(g => g.val !== '' && parseFloat(g.val) < g.normal).map(g => `${g.name} (${g.val} bar)`);
    const openIssues = site.issues.filter(i => i.status === 'Open').map(i => `${i.code} [${i.zone}]: ${i.desc}`);
    const totalTanker = log.tasks.reduce((s, t) => s + (parseFloat(t.tankerLiters) || 0), 0);

    const obsParts = [];
    if (blocked.length) obsParts.push(`توقف الري في: ${blocked.join('؛ ')}.`);
    if (faultyMeters.length) obsParts.push(`عدادات مياه عاطلة: ${faultyMeters.join('، ')}.`);
    if (totalTanker > 0) obsParts.push(`تم تعويض الري بالتنكر بكمية إجمالية ${totalTanker.toLocaleString()} لتر.`);
    if (lowGauges.length) obsParts.push(`انخفاض ضغط في المقاييس: ${lowGauges.join('، ')}.`);
    if (openIssues.length) obsParts.push(`مشاكل ميدانية مفتوحة: ${openIssues.join('؛ ')}.`);

    log.oar.obs = obsParts.join('
') || 'سارت الأعمال الميدانية والري وفق الخطة المقررة بدون معوقات.';
    log.oar.ana = (blocked.length || openIssues.length || faultyMeters.length)
        ? 'الأسباب الرئيسية تعود إلى الأعطال الفنية في خطوط الشبكة/العدادات أو أعمال الموقع الجارية.'
        : 'استقرار ضغط الشبكة والتزام الكادر بتوزيع المهام اليومية.';
    log.oar.rec = (blocked.length || openIssues.length || faultyMeters.length)
        ? 'توجيه فريق الصيانة لمعالجة التسريبات والعدادات العاطلة وتأمين حوضيات المياه للمناطق المتأثرة.'
        : 'الاستمرار على نفس جدول الري والمتابعة الدورية.';

    saveState(); renderExportAndIssues(site, log); triggerAllAutoGrows(); showToast('🔄 تم توليد مسودة OAR تلقائياً');
}

function generateWhatsAppBrief() {
    const site = getSite();
    const log = getDayLog();
    const pres = log.attendance.filter(w => !w.status.includes('Absent')).length;
    const totalTk = log.tasks.reduce((s, t) => s + (parseFloat(t.tankerLiters) || 0), 0);
    const blocked = log.tasks.filter(t => t.status.includes('Blocked')).map(t => t.zones).join(', ');
    const txt = `*ملخص الوردية - ${site.name.split('/')[0].trim()}*
` +
        `📅 التاريخ: ${state.activeDate}
` +
        `📑 DFL-${log.dflNum}
` +
        `👷 الحضور: ${pres} / ${log.attendance.length}
` +
        `💧 التنكر: ${totalTk.toLocaleString()} L
` +
        (blocked ? `🛑 مناطق متوقفة: ${blocked}
` : '') +
        `✅ حالة الشبكة: ${log.perf.status}`;
    
    if (navigator.share) {
        navigator.share({ title: 'ملخص الوردية', text: txt }).catch(()=>{});
    } else {
        navigator.clipboard.writeText(txt);
        showToast('📋 تم نسخ الملخص للواتساب');
    }
}

function openTablePreviewModal() {
    const log = getDayLog();
    const { taskPhotoRefs } = collectTodayPhotos();
    openModal(`
        <h3 class="card-title">👁️ معاينة شكل المهام في الـ DFL</h3>
        <div style="max-height:300px;overflow-y:auto;font-size:11px;">
            <table style="width:100%;border-collapse:collapse;text-align:center;" border="1">
                <tr style="background:#e2e8f0;font-weight:bold;"><td>Task</td><td>Desc</td><td>Zone</td><td>Time</td><td>St</td><td>Photos</td></tr>
                ${log.tasks.map((t, i) => `<tr><td>${t.task.split('/')[0]}</td><td>${t.desc}</td><td>${t.zones}</td><td>${t.dur}</td><td>${t.status.split('/')[0]}</td><td style="color:var(--blue);">${taskPhotoRefs[i] || '-'}</td></tr>`).join('')}
            </table>
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:10px;" onclick="closeModal()">إغلاق</button>
    `);
}

/* ================= Multi-Photo Collector, Gallery & ZIP Download ================= */
function collectTodayPhotos() {
    const site = getSite();
    const log = getDayLog();
    const photos = [];
    const regArr = (arr, section, desc) => {
        const names = [];
        (arr || []).forEach(b64 => {
            if (!b64) return;
            const fname = `PHOTO_${String(photos.length + 1).padStart(2, '0')}.jpg`;
            photos.push({ fileName: fname, section, description: desc, dataUrl: b64 });
            names.push(fname);
        });
        return names.join(' / ');
    };

    const taskPhotoRefs = log.tasks.map(t => regArr(ensurePhotosArr(t), 'Section 3 - Tasks', `${t.task} - ${t.zones}`));
    const meterPhotoRefs = log.meters.map(m => regArr(ensurePhotosArr(m), 'Section 5B - Water Meters', m.name));
    const sickPlants = [];
    site.inventory.forEach(z => z.plants.forEach(p => {
        const todayEntries = (p.entries || []).filter(e => e.date === state.activeDate);
        const aff = todayEntries.filter(e => e.condId !== 'c1');
        if (aff.length > 0) {
            const cObj = HEALTH_CONDITIONS.find(c => c.id === aff[0].condId);
            const allEntPhotos = [];
            todayEntries.forEach(e => ensurePhotosArr(e).forEach(u => allEntPhotos.push(u)));
            const ref = regArr(allEntPhotos, 'Section 6 - Plants Health', `${p.name} (${z.name})`);
            sickPlants.push({
                plantName: p.name,
                scientificName: state.company.speciesDict[p.name] || '',
                healthStatusDFL: cObj ? cObj.dfl : 'متوسط',
                visibleSigns: `${cObj ? cObj.name : ''} (${aff.length})${p.note ? ' - ' + p.note : ''}`,
                zone: z.name,
                imageRef: ref
            });
        }
    }));
    const activeIssues = site.issues.filter(i => i.status === 'Open' || i.date === state.activeDate);
    const issuePhotoRefs = activeIssues.map(i => regArr(ensurePhotosArr(i), 'Section 7 - Issues', `${i.code} - ${i.zone}`));
    log.incidents.forEach(ir => regArr(ensurePhotosArr(ir), 'Incident Report', `${ir.code} - ${ir.zone}`));
    log.sdls.forEach(sd => regArr(ensurePhotosArr(sd), 'Site Deviation Log', `${sd.code} - ${sd.zone}`));

    return { photos, taskPhotoRefs, meterPhotoRefs, sickPlants, activeIssues, issuePhotoRefs };
}

async function downloadTodayPhotosZip() {
    const { photos } = collectTodayPhotos();
    if (!photos.length) { showToast('⚠️ لا توجد صور ملتقطة اليوم'); return; }
    if (typeof JSZip === 'undefined') {
        photos.forEach((p, idx) => setTimeout(() => { const a = document.createElement('a'); a.href = p.dataUrl; a.download = p.fileName; a.click(); }, idx * 250));
        return;
    }
    showToast('⏳ جاري ضغط الصور في ملف ZIP...');
    const zip = new JSZip();
    photos.forEach(p => {
        const base64Data = p.dataUrl.split(',')[1];
        zip.file(p.fileName, base64Data, { base64: true });
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TFF_Photos_DFL${getDayLog().dflNum}_${state.activeDate}.zip`;
    a.click();
    showToast(`📦 تم تنزيل ${photos.length} صور في ملف ZIP واحد!`);
}

function openTodayPhotosGallery() {
    const { photos } = collectTodayPhotos();
    openModal(`
        <h3 class="card-title">🖼️ معرض صور اليوم (${photos.length})</h3>
        <div style="max-height:360px;overflow-y:auto;">
            ${photos.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:20px;">لا توجد صور مسجلة اليوم</div>' :
            photos.map(p => `
                <div class="meter-card" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;">
                    <img src="${p.dataUrl}" class="photo-thumb" onclick="previewSinglePhoto('${p.dataUrl}')">
                    <div style="flex:1;">
                        <b style="font-size:12px;color:var(--blue);">${esc(p.fileName)}</b>
                        <div style="font-size:11px;font-weight:bold;">${esc(p.section)}</div>
                        <div style="font-size:10.5px;color:var(--muted);">${esc(p.description)}</div>
                    </div>
                    <a href="${p.dataUrl}" download="${esc(p.fileName)}" class="btn btn-outline btn-sm">📥</a>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="closeModal()">إغلاق</button>
    `);
}

function previewSinglePhoto(url) {
    openModal(`
        <img src="${url}" style="width:100%;border-radius:10px;display:block;margin-bottom:10px;">
        <button class="btn btn-outline btn-full" onclick="closeModal()">إغلاق المعاينة</button>
    `);
}

/* ================= Lightweight JSON Export + Ultra-Strict Gemini Prompt ================= */
function runPreExportCheck() {
    const log = getDayLog();
    const warnings = [];
    if (log.meters.some(m => m.status === 'working' && m.curr === '')) warnings.push('• توجد قراءة عداد شغال غير مدخلة.');
    if (log.meters.some(m => ensurePhotosArr(m).length === 0)) warnings.push('• لم تُلتقط صورة عداد المياه اليوم.');
    if (log.tasks.some(t => t.status.includes('Blocked') && !t.note.trim())) warnings.push('• توجد مهمة متوقفة بدون كتابة سبب التوقف.');
    if (log.tasks.some(t => t.status.includes('Blocked')) && !log.oar.obs) warnings.push('• توجد مهام متوقفة ولم يُملأ تقرير OAR بعد.');
    if (log.tasks.some(t => t.status.includes('Progress'))) warnings.push('• توجد مهام جارية لم تُكتمل بعد.');

    if (warnings.length > 0) {
        openModal(`
            <h3 class="card-title">🔍 تنبيهات ما قبل التصدير</h3>
            <div style="font-size:12px;color:#92400e;background:#fef3c7;padding:10px;border-radius:8px;margin-bottom:10px;line-height:1.6;">${warnings.join('<br>')}</div>
            <div class="grid-2"><button class="btn btn-green" onclick="closeModal();exportLightweightDFL()">تصدير على أي حال</button><button class="btn btn-outline" onclick="closeModal()">مراجعة</button></div>
        `);
    } else {
        exportLightweightDFL();
    }
}

function exportLightweightDFL() {
    const site = getSite();
    const log = getDayLog();
    const dayEn = getDayNameEn(state.activeDate);
    syncIrrigatedZonesFromTasks(false);

    const { photos, taskPhotoRefs, meterPhotoRefs, sickPlants, activeIssues, issuePhotoRefs } = collectTodayPhotos();
    const rowOffset = Math.max(0, log.attendance.length - 5);
    const presentCount = log.attendance.filter(w => !w.status.includes('Absent')).length;

    let totalTankerL = 0; let totalTrips = 0;
    log.tasks.forEach(t => { if (parseFloat(t.tankerLiters) > 0) { totalTankerL += parseFloat(t.tankerLiters); totalTrips += (t.tankerTrips || 1); } });
    
    const machNote = (log.machinery.pumpHrs || log.machinery.genHrs || log.machinery.fuelL)
        ? ` | Pump: ${log.machinery.pumpHrs || 0}h, Gen: ${log.machinery.genHrs || 0}h, Fuel: ${log.machinery.fuelL || 0}L` : '';
    const tankerNote = totalTankerL > 0 ? ` | Tanker Total: ${totalTankerL.toLocaleString()} L (${totalTrips} Trips)` : '';

    const lightPayload = {
        templateVersion: 'V03_Clean',
        rowOffsetForExtraWorkers: rowOffset,
        presentWorkersCountToday: presentCount,
        metadata: {
            F5_formId: log.dflNum,
            F6_siteName: site.name,
            B7_date: state.activeDate,
            F7_day: dayEn,
            B8_teamLead: state.company.teamLead,
            B9_shift: state.company.shift,
            F9_supervisor: state.company.supervisor || 'Maitham Ibrahim',
            B10_outsideWorkerRateIQD: state.company.outsideRate
        },
        section2_attendance: log.attendance.map((w, idx) => ({
            seq: idx + 1,
            name: w.name,
            type: w.type,
            status: w.status,
            timeIn: w.status.includes('Absent') ? '' : w.tIn,
            timeOut: w.status.includes('Absent') ? '' : w.tOut,
            overtimeHrs: parseFloat(w.ot) || 0,
            notes: w.note || ''
        })),
        section3_tasks: log.tasks.map((t, idx) => {
            const wList = t.workers || [];
            const isTeam = wList.includes('Team');
            const wCount = isTeam ? presentCount : (wList.length > 0 ? wList.length : 1);
            const wStr = isTeam ? 'Team' : wList.join(' / ');
            return {
                task: t.task,
                briefDescription: t.desc,
                zonesList: (t.zones || 'عام / General').split(',').map(s => s.trim()).filter(Boolean),
                time: t.dur,
                workersCount: wCount,
                status: t.status,
                notes: t.note || '',
                workersAssigned: wStr,
                imageRef: taskPhotoRefs[idx] || ''
            };
        }),
        section4_equipment: log.tools,
        section5_siteReadings: {
            moisture5A: log.moisture.filter(m => m.zone || m.pct),
            waterMeters5B: log.meters.map((m, idx) => ({
                name: m.name,
                status: m.status,
                visualQuality: m.visual,
                prevReading: m.status === 'working' ? (parseFloat(m.prev) || 0) : 'Faulty',
                currReading: m.status === 'working' ? (m.curr !== '' ? parseFloat(m.curr) : '') : 'Faulty',
                notes: m.status === 'faulty' ? `Faulty Meter: ${m.note || 'عاطل'}` : (m.note || ''),
                imageRef: meterPhotoRefs[idx] || ''
            })),
            irrigationPerformance5C: {
                B83_systemStatus: log.perf.status,
                E83_durationHrs: log.perf.duration,
                B84_zonesIrrigated: log.perf.zonesIrrigated,
                E84_pressureNotes: log.perf.pressureNotes || '',
                B85_performanceNotes: (log.perf.notes || '') + tankerNote + machNote
            },
            barGauges5D: log.gauges
        },
        section6_plantsHealth: sickPlants,
        section7_incidentsAndIssues: activeIssues.map((iss, idx) => ({
            code: iss.code,
            description: `${iss.code} [${iss.zone}] (${iss.status}): ${iss.desc}`,
            severity: iss.severity,
            imageRef: issuePhotoRefs[idx] || ''
        })),
        section8_photoReferences: photos.map((p, i) => ({
            seq: i + 1,
            fileName: p.fileName,
            section: p.section,
            description: p.description
        })),
        section9_teamLeadOAR: {
            OBS: log.oar.obs || '',
            ANA: log.oar.ana || '',
            REC: log.oar.rec || ''
        },
        section10_signOff: {
            A_teamLead: `Team Lead Name  /  اسم قائد الفريق: ${state.company.teamLead}`,
            H_dateTime: `Date & Time  /  التاريخ والوقت: ${state.activeDate}`
        },
        incidentReportsSheet: log.incidents.map(({ photos: _p, ...r }) => r),
        siteDeviationLogSheet: log.sdls.map(({ photos: _p, ...r }) => r)
    };

    const fname = `TFF_Light_DFL${log.dflNum}_${state.activeDate}.json`;
    const blob = new Blob([JSON.stringify(lightPayload, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();

    const hardenedPrompt = `أنت خبير أتمتة التقارير الميدانية لشركة غابات الغذاء (The Food Forests).
مرفق لك:
1. قالب Excel النظيف (Al-Mutahida_DFL_V03_Clean.xlsx).
2. ملف بيانات اليوم الخفيف (${fname}).
(وإذا أرفقت لك ملف الصور ZIP ففك ضغطه وازرع كل صورة داخل خليتها حسب اسمها المرجعي).

اكتب ونفّذ كود Python (باستخدام openpyxl مع copy من مكتبة copy) لتعبئة ورقة 'Daily Field Log' مباشرة (In-Place) مع الالتزام الصارم بجميع قواعد التصميم والألوان والدمج التالية:

### القاعدة 0: الحفاظ المطلق على ألوان وخطوط وحدود قالب الـ DFL الأصلية (ممنوع تغيير أي لون!)
- لا تغيّر لون أي خلفية خلية (Fill) أو لون خط (Font Color) أو ترويسة قسم في القالب نهائياً!
- ألوان القالب الأصلية هي: عمود التسلسل A باللون الرمادي الفاتح (#ECEFF1)، خلايا الإدخال باللون الكريمي (#FFFDF0) أو الأصفر الفاتح (#FFFDE7)، وخلايا أداء الري باللون الأخضر الفاتح (#E8F5E9).
- عند إدراج أي صفوف جديدة أو دمج خلايا: انسخ التنسيق الأصلي للخلية (copy(src.fill), copy(src.font), copy(src.border), copy(src.alignment)) حتى لا يتحول أي صف إلى اللون الأبيض أو يفقد حدوده.

### القاعدة 1: إزاحة الصفوف للعمالة الإضافية (offset = ${rowOffset})
- القالب يحتوي على 5 صفوف للحضور (صفوف 18 إلى 22).
- إذا كان rowOffsetForExtraWorkers > 0:
  * أدرج ${rowOffset} صفوف عند الصف 23 (ws.insert_rows(23, ${rowOffset})) قبل كتابة أي بيانات أسفل صف 22.
  * لكل صف مضاف (23 إلى ${22 + rowOffset}): اضبط ارتفاع الصف على 42.75، وانسخ التنسيق الأصلي (fill, font, border, alignment) من صف 22 لكل عمود من A إلى K، وادمج H{r}:K{r}.
- أضف offset = ${rowOffset} إلى أرقام صفوف جميع الأقسام من القسم 3 حتى القسم 10.

### القاعدة 2: البيانات التعريفية (Metadata) — تعبئة كاملة
- F5 = ${log.dflNum} | F6 = "${site.name}" | B7 = "${state.activeDate}" | F7 = "${dayEn}" | B8 = "${state.company.teamLead}" | B9 = "${state.company.shift}" | F9 = "${state.company.supervisor || 'Maitham Ibrahim'}" | B10 = ${state.company.outsideRate}

### القاعدة 3: القسم 1 (Weather — صف 13)
- ابحث عن طقس مدينة الحلة لتاريخ ${state.activeDate} واملأ B13 (الأحوال)، C13 (الصغرى رقم)، D13 (العظمى رقم)، E13 (الرياح)، F13 (الرطوبة % رقم أو اتركها فارغة — ممنوع وضع رمز '-').

### القاعدة 4: القسم 2 (Attendance — صفوف 18 إلى ${17 + log.attendance.length})
- املأ section2_attendance، وأخفِ أي صف فارغ متبقٍ حتى صف 22.

### القاعدة 5: القسم 3 (Tasks — يبدأ من صف ${27 + rowOffset} حتى ${59 + rowOffset}) — دمج الساعات والمناطق المتزامنة والعمال بدقة!
1. **تفريق المناطق (منطقة واحدة لكل صف):** إذا كانت المهمة تحتوي عدة مناطق (مثل ["B1", "B2", "B4"])، أفردها في صفوف متتالية بحيث يأخذ كل صف منطقة واحدة فقط في العمود D (Zone).
2. **دمج الساعات والمناطق التي اشتغلت بنفس الوقت (Simultaneous / Consecutive Grouping):**
   - اجمع الصفوف المتتالية التي تشترك في نفس (المهمة Task + الوصف Brief Description + الوقت Time + العمال Workers Assigned + عدد العمال Workers #).
   - ادمج عمودياً عبر هذه الصفوف المتشابهة الأعمدة التالية فقط:
     * **A (`#`)**، **B (`Task`)**، **C (`Brief Description`)**، **E (`Time / الوقت` — لأنها اشتغلت بنفس الوقت والمدة)**، **F (`Workers #`)**، و**K (`Worker(s) Assigned`)**.
   - **ممنوع منعاً باتاً** دمج العمود **D (`Zone`)** أو العمود **G (`Status`)** أو عمود الملاحظات **H:J (`Notes`)** عمودياً! أبقِ H{r}:J{r} مدمجاً أفقياً لكل صف على حدة فقط حتى تظهر حالة وملاحظة كل منطقة بوضوح.
   - عند دمج أي نطاق عمودي (مثل E28:E32)، تأكد من الاحتفاظ بنفس لون الخلية الأصلي (#FFFDF0، و#ECEFF1 للعمود A) وتوسيط النص عمودياً وأفقياً (horizontal='center', vertical='center', wrap_text=True) مع الحفاظ على الحدود الخارجية والداخلية.
3. **دقة العمال وعدد العمال (Columns F & K):**
   - العمود **F (`Workers #`)** يجب أن يكون رقماً صحيحاً يطابق عدد المنفذين الفعليين (إذا كان المنفذ "Team" فاكتب عدد الحضور اليوم = ${presentCount}، وإذا كان اسمين فـ 2، ولا تكتب 0 لمهمة منجزة).
   - العمود **K (`Worker(s) Assigned`)**: اكتب "Team" إذا نفذها الفريق بالكامل، أو افصل الأسماء بـ ' / ' (مثال: حسين مرتضى عبد / نوار عنيد جبر).
4. **مرجع الصور (Column L):** اكتب اسم ملف الصورة المرجعي مثل 'PHOTO_01.jpg' فقط إذا وُجد، واتركه فارغاً تماماً إذا لم توجد صورة (ممنوع كتابة Yes أو No).
5. أخفِ جميع الصفوف الفارغة المتبقية في هذا القسم (ws.row_dimensions[r].hidden = True) دون حذفها.

### القاعدة 6: الأقسام 4 و 5 و 6 و 7 و 8 (مُزاحة بمقدار offset = ${rowOffset} مع الحفاظ على ألوانها)
- القسم 4 (المعدات، يبدأ من ${64 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
- القسم 5A (الرطوبة، ${71 + rowOffset}..${75 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
- القسم 5B (العدادات، ${79 + rowOffset}..${80 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
- القسم 5C (أداء الري): B${83 + rowOffset} (الحالة)، E${83 + rowOffset} (المدة)، B${84 + rowOffset} (المناطق المروية)، E${84 + rowOffset} (ملاحظات الضغط)، B${85 + rowOffset} (ملاحظات الأداء).
- القسم 5D (مقاييس الضغط، ${89 + rowOffset}..${94 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
- القسم 6 (صحة النبات، ${98 + rowOffset}..${102 + rowOffset}) والقسم 7 (الحوادث، ${106 + rowOffset}..${109 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
- القسم 8 (مراجع الصور، ${113 + rowOffset}..${118 + rowOffset}): املأ section8_photoReferences وأخفِ الصفوف الفارغة.

### القاعدة 7: القسم 9 (OAR) والقسم 10 (Sign-off) + أوراق IR/SDL
- اكتب OBS في A${123 + rowOffset}، ANA في A${125 + rowOffset}، REC في A${127 + rowOffset}.
- اكتب اسم قائد الفريق في A${131 + rowOffset} والتاريخ في H${131 + rowOffset}.
- إذا وجدت بيانات في incidentReportsSheet أو siteDeviationLogSheet فاملأ أوراقها المخصصة في نفس الملف بنفس ألوانها الأصلية.

احفظ الملف بصيغة .xlsx وقدّم رابط التحميل مباشرة.`;

    openModal(`
        <h3 class="card-title">🤖 تم تنزيل ملف اليوم الخفيف بنجاح!</h3>
        <p style="font-size:12px;color:var(--muted);line-height:1.5;">
            تم تنزيل <b>${esc(fname)}</b> (حجم خفيف بدون صور ثقيلة).<br>
            افتح <b>محادثة جديدة</b> في Gemini، ارفع <code>Al-Mutahida_DFL_V03_Clean.xlsx</code> مع هذا الملف، والصق الأمر الدقيق التالي:
        </p>
        <textarea id="gmHardPrompt" class="inp" rows="9" readonly style="font-size:11.5px;">${esc(hardenedPrompt)}</textarea>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="navigator.clipboard.writeText(document.getElementById('gmHardPrompt').value);showToast('📋 تم نسخ الأمر الدقيق!')">📋 نسخ الأمر</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}

/* ================= Camera, Multi-Gallery & Voice Dictation ================= */
function openPhotoSourceChoice(type, ctx) {
    pendingPhotoCtx = { type, ctx };
    openModal(`
        <h3 class="card-title">📸 إرفاق صورة أو أكثر</h3>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="closeModal();triggerFileInp('camFileInput')">📸 التقاط بالكاميرا</button>
            <button class="btn btn-green" onclick="closeModal();triggerFileInp('galFileInput')">🖼️ اختيار من الاستوديو</button>
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="closeModal()">إلغاء</button>
    `);
}
function triggerInlineModalPhoto(inpId) {
    pendingPhotoCtx = { type: 'inline_modal', ctx: 0 };
    triggerFileInp(inpId);
}
function triggerFileInp(id) { const el = document.getElementById(id); el.value = ''; el.click(); }

function stampSingleFile(file) {
    return new Promise(resolve => {
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

                resolve(c.toDataURL('image/jpeg', 0.88));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function onPhotoSelected(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !pendingPhotoCtx) return;
    const { type, ctx } = pendingPhotoCtx;
    pendingPhotoCtx = null;

    showToast(`⏳ جاري معالجة وختم ${files.length} صورة...`);
    const stampedUrls = [];
    for (const f of files) {
        stampedUrls.push(await stampSingleFile(f));
    }

    if (type === 'inline_modal') {
        tempModalPhotos.push(...stampedUrls);
        const strip = document.getElementById('inlineModalPhotoStrip');
        if (strip) strip.innerHTML = tempModalPhotos.map(u => `<img src="${u}" class="photo-thumb">`).join('');
        showToast(`📸 تم إرفاق ${stampedUrls.length} صورة للنموذج`);
        return;
    }

    const log = getDayLog();
    pushUndo(`إرفاق ${stampedUrls.length} صورة`);
    if (type === 'task') {
        ensurePhotosArr(log.tasks[ctx]).push(...stampedUrls);
        logSectionHistory('tasks', 'photo', `إرفاق ${stampedUrls.length} صورة: ${log.tasks[ctx].zones}`, { taskId: log.tasks[ctx].id });
    } else if (type === 'meter') {
        ensurePhotosArr(log.meters[ctx]).push(...stampedUrls);
        logSectionHistory('tools', 'photo', `صورة عداد: ${log.meters[ctx].name}`, { meterId: log.meters[ctx].id });
    } else if (type === 'issue') {
        ensurePhotosArr(getSite().issues[ctx]).push(...stampedUrls);
        logSectionHistory('issues', 'photo', `صورة مشكلة: ${getSite().issues[ctx].code}`, { issueId: getSite().issues[ctx].id });
    } else if (type === 'plant') {
        const z = getSite().inventory.find(x => x.id === activeInvZoneId);
        const p = z ? z.plants[ctx.pIdx] : null;
        const ent = p ? (p.entries || []).find(x => x.id === ctx.entryId) : null;
        if (ent) ensurePhotosArr(ent).push(...stampedUrls);
    }
    saveState(); renderAll(); showToast(`📸 تم حفظ وختم ${stampedUrls.length} صورة بنجاح`);
}

function removePhotoFromItem(type, idx, photoIdx) {
    pushUndo('حذف صورة');
    const log = getDayLog();
    if (type === 'task') ensurePhotosArr(log.tasks[idx]).splice(photoIdx, 1);
    else if (type === 'meter') ensurePhotosArr(log.meters[idx]).splice(photoIdx, 1);
    else if (type === 'issue') ensurePhotosArr(getSite().issues[idx]).splice(photoIdx, 1);
    else if (type === 'plant') {
        const { pIdx, entryId } = idx;
        const z = getSite().inventory.find(x => x.id === activeInvZoneId);
        const p = z ? z.plants[pIdx] : null;
        const ent = p ? (p.entries || []).find(e => e.id === entryId) : null;
        if (ent) ensurePhotosArr(ent).splice(photoIdx, 1);
    }
    saveState(); renderAll(); showToast('🗑️ تم حذف الصورة');
}

function startDictation(targetId, onDone) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('⚠️ المتصفح لا يدعم الإملاء الصوتي المباشر، استخدم مايكروفون الكيبورد'); return; }
    const rec = new SR();
    rec.lang = 'ar-IQ';
    rec.interimResults = false;
    showToast('🎤 تحدث الآن...');
    rec.onresult = e => {
        const raw = e.results[0][0].transcript;
        const { text, changed } = applySpellAndDictationGuard(raw);
        const el = document.getElementById(targetId);
        if (el) {
            el.value = (el.value ? el.value + ' ' : '') + text;
            if (el.tagName === 'TEXTAREA') autoGrow(el);
            if (onDone) onDone(el.value);
        }
        showToast(changed ? `✨ تم التحويل والتصحيح: ${text}` : `✓ تم التحويل: ${text}`);
    };
    rec.onerror = () => showToast('⚠️ تعذر التقاط الصوت');
    rec.start();
}

/* ================= Settings, Staff/Zones Manager, New Site & Backup ================= */
function openNewSiteModal() {
    openModal(`
        <h3 class="card-title">🏗️ إضافة موقع جديد للشركة</h3>
        <label class="lbl">اسم الموقع (عربي / إنجليزي):</label><div class="inp-wrap"><input id="nsName" class="inp" placeholder="مثلاً: Al-Kufa Project"><button class="clr-btn" onclick="quickClearField('nsName')">✕</button></div>
        <label class="lbl">رقم DFL البدائي:</label><input type="number" id="nsDfl" class="inp" value="1">
        <label class="lbl">المناطق (مفصولة بفاصلة):</label><div class="inp-wrap"><input id="nsZones" class="inp" value="Z1, Z2, Z3, Z4, Nursery, Admin"><button class="clr-btn" onclick="quickClearField('nsZones')">✕</button></div>
        <div class="grid-2"><button class="btn btn-green" onclick="createNewSite()">إنشاء</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
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
        plan: {}, inventory: [], issues: [], stopMarker: null, logs: {}
    };
    state.activeSiteId = id; activeInvZoneId = null; getDayLog();
    closeModal(); saveState(); renderAll(); showToast('✓ تم إنشاء الموقع: ' + name);
}

function openSettingsModal() {
    const site = getSite();
    openModal(`
        <h3 class="card-title">⚙️ إعدادات الشركة والموقع</h3>
        <label class="lbl">قائد الفريق (Team Lead):</label><div class="inp-wrap"><input id="stTl" class="inp" value="${esc(state.company.teamLead)}"><button class="clr-btn" onclick="quickClearField('stTl')">✕</button></div>
        <label class="lbl">المشرف (Supervisor Ref):</label><div class="inp-wrap"><input id="stSup" class="inp" value="${esc(state.company.supervisor || 'Maitham Ibrahim')}"><button class="clr-btn" onclick="quickClearField('stSup')">✕</button></div>
        <div class="grid-2">
            <div><label class="lbl">وحدة الأطوال:</label><select id="stUnit" class="inp"><option value="م" ${state.company.heightUnit === 'م' ? 'selected' : ''}>المتر (م)</option><option value="سم" ${state.company.heightUnit === 'سم' ? 'selected' : ''}>السنتيمتر (سم)</option></select></div>
            <div><label class="lbl">أجر العامل الخارجي:</label><input type="number" id="stRate" class="inp" value="${state.company.outsideRate}"></div>
        </div>
        <label class="lbl">مناطق الموقع الحالي (مفصولة بفاصلة):</label>
        <div class="inp-wrap">
            <textarea id="stSiteZones" class="inp auto-grow" rows="2">${esc(site.zones.join(', '))}</textarea>
            <button class="clr-btn top-align" onclick="quickClearField('stSiteZones')">✕</button>
        </div>
        <button class="btn btn-blue btn-full" onclick="openStaffPoolManager()">👷 إدارة القائمة الدائمة للكادر (${state.company.staffPool.length})</button>
        <button class="btn btn-outline btn-full" style="color:var(--red);" onclick="purgeOldPhotos()">🧹 تنظيف الصور الأقدم من 30 يوم</button>
        <div class="grid-2"><button class="btn btn-green" onclick="saveSettings()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إغلاق</button></div>
    `);
}
function saveSettings() {
    state.company.teamLead = document.getElementById('stTl').value.trim();
    state.company.supervisor = document.getElementById('stSup').value.trim();
    state.company.heightUnit = document.getElementById('stUnit').value;
    state.company.outsideRate = parseFloat(document.getElementById('stRate').value) || 25000;
    const zArr = document.getElementById('stSiteZones').value.split(',').map(s => s.trim()).filter(Boolean);
    if (zArr.length) getSite().zones = zArr;
    closeModal(); saveState(); renderAll(); showToast('✓ تم حفظ الإعدادات');
}
function openStaffPoolManager() {
    openModal(`
        <h3 class="card-title">👷 القائمة الدائمة للكادر</h3>
        <div style="max-height:260px;overflow-y:auto;margin-bottom:10px;">
            ${state.company.staffPool.map((s, i) => `
                <div class="meter-card" style="padding:7px;display:flex;justify-content:space-between;align-items:center;">
                    <div><b style="font-size:12px;">${esc(s.name)}</b><div style="font-size:10px;color:var(--muted);">${esc(s.type)}</div></div>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="removeStaffFromPool(${i})">حذف</button>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-outline btn-full" onclick="openSettingsModal()">رجوع للإعدادات</button>
    `);
}
function removeStaffFromPool(i) { state.company.staffPool.splice(i, 1); saveState(); openStaffPoolManager(); }

function purgeOldPhotos() {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    Object.values(state.sites).forEach(s => {
        Object.entries(s.logs).forEach(([d, l]) => { if (d < cutoff) { l.tasks.forEach(t => t.photos = []); l.meters.forEach(m => m.photos = []); } });
        s.inventory.forEach(z => z.plants.forEach(p => (p.entries || []).forEach(e => { if (e.date < cutoff) e.photos = []; })));
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

function openModal(html) { document.getElementById('genericModalBody').innerHTML = html; document.getElementById('genericModal').classList.add('active'); setTimeout(triggerAllAutoGrows, 20); }
function closeModal() { document.getElementById('genericModal').classList.remove('active'); }

window.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    getDayLog();
    renderAll();
});

const DB_NAME = 'TFF_FOS_DB_V7';
const DB_STORE = 'state';
let db = null, saveTimer = null, pendingPhotoCtx = null, activeInvZoneId = null, activeEntryPrompt = null;
let undoStack = [];
let tempModalPhotos = [];
let invFilterState = 'all';
let lastUsedHeight = null;
let activeTimers = {};

const TANKER_FULL_CAPACITY = 24000;
const DURATION_OPTIONS = [
    '0:10 hr', '0:15 hr', '0:20 hr', '0:30 hr', '0:45 hr',
    '1:00 hr', '1:15 hr', '1:30 hr', '2:00 hr', '2:30 hr',
    '3:00 hr', '4:00 hr', '5:00 hr', '6:00 hr'
];
const MASTER_ZONES = ['OL1','OL2','OR1','OR2','AL1','AL2','AR1','AR2','AR3','AR4','AR5','B1','B2','B3','B4','C1','C2','C3','C4','E1','E2','D1','H1','H2','H3','H4','H5','OH','Admin','Nursery','AC','W','عام / General'];
const MASTER_TASKS = [
    'Irrigation  /  ري المنطقة', 'Pruning  /  تقليم الأشجار', 'Weeding  /  إزالة الأعشاب',
    'Fertilizing  /  تسميد', 'Planting  /  زراعة وتشتيل', 'Harvesting  /  حصاد',
    'Soil Preparation  /  تحضير التربة', 'Pest Control  /  رش المبيدات أو العلاج',
    'Inspection  /  فحص ومراقبة', 'Cleaning  /  جمع النفايات وتنظيف الموقع',
    'Equipment Maintenance  /  صيانة المعدات', 'Main Line & Equipment Maintenance  /  صيانة الأنابيب الرئيسية والمعدات',
    'Water System Check  /  فحص نظام الري', 'Meter Reading  /  قراءة العدادات', 'Other  /  أخرى'
];
const IRR_DESC_PRESETS = [
    { label: 'Drip only', text: 'Drip only', dur: '1:00 hr' },
    { label: 'Sprinklers only', text: 'Sprinklers only', dur: '0:10 hr' },
    { label: 'Hose (spray gun)', text: 'Hose with multi-outlet spray gun', dur: '0:30 hr' },
    { label: 'Seedlings hose', text: 'Irrigate seedlings using a hose with multi-outlet spray gun', dur: '0:30 hr' },
    { label: 'Water tanker', text: 'Irrigating the area using a water tanker', dur: '1:00 hr' }
];
const QUICK_NOTE_PHRASES = [
    { label: 'كسر أنبوب رئيسي', text: 'Main supply pipe break / كسر في أنبوب التغذية الرئيسي' },
    { label: 'تسريب أنبوب تنقيط', text: 'Drip line leak / تسريب في أنبوب التنقيط' },
    { label: 'عطل صمام / قفل', text: 'Valve malfunction / عطل في صمام الري' },
    { label: 'أعمال حفريات', text: 'Blocked due to excavation works / متوقف بسبب أعمال الحفريات' },
    { label: 'عدم توفر حوضية', text: 'Water tanker was not provided / عدم توفر حوضية مياه' }
];
const DICTATION_CORRECTIONS = [
    [/عيري بيك|يري بيك|اير بيك|عيري بايب/gi, 'irrigation pipe'],
    [/سبلاي بايب|سبلاي بيك/gi, 'supply pipe'],
    [/درب لاين|دريب لاين/gi, 'drip line'],
    [/سبرنكلر|سبريكلر/gi, 'sprinklers'],
    [/تانكر|تنكر/gi, 'water tanker'],
    [/فالف|فلف/gi, 'valve']
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
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'B3', dur: '0:15 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Sprinklers only', zones: 'B4', dur: '0:10 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'Admin', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Sunday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'D1', dur: '1:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'E1, E2, H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Monday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'AR5, C3, OL2, OR2', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'AL2, AC', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Water System Check  /  فحص نظام الري', desc: 'Routine line inspection, valve checks, filter cleaning', zones: 'عام / General', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Tuesday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'B1, B2, C4', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'W', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'B3', dur: '0:15 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Sprinklers only', zones: 'B4', dur: '0:10 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'C1, C2', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Wednesday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'D1', dur: '1:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'E1, E2, H1, H2, H3, H4, H5', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Hose with multi-outlet spray gun', zones: 'Admin', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Thursday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigating the area using a water tanker', zones: 'AR5, C3, OL2, OR2', dur: '2:00 hr', isTanker: true },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'AL2, AC', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Water System Check  /  فحص نظام الري', desc: 'Routine line inspection, valve checks, filter cleaning', zones: 'عام / General', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'H5', dur: '0:30 hr' }
    ],
    Friday: [
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'W', dur: '1:00 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Irrigate seedlings using a hose with multi-outlet spray gun', zones: 'E1', dur: '0:30 hr' },
        { task: 'Irrigation  /  ري المنطقة', desc: 'Drip only', zones: 'C1, C2', dur: '1:00 hr' },
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
        staffPool: [...DEFAULT_STAFF],
        customTasks: [...MASTER_TASKS],
        customTools: ['Transport E3W', 'Garden broom (مكنسة حدائق)', 'Grass Trimmer / Lawn Mower (آلة / أداة جز عشب)', 'Gardening gloves (كفوف حدائق)', 'اكياس نفايات'],
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
            logs: {}
        }
    }
};

/* ================= IndexedDB, Silent Auto-Migration & Normalization ================= */
function initDB() {
    return new Promise(resolve => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
        };
        req.onsuccess = async e => {
            db = e.target.result;
            let loaded = false;
            // First try current DB
            await new Promise(r => {
                const tx = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get('root');
                tx.onsuccess = () => { if (tx.result && tx.result.sites) { state = tx.result; loaded = true; } r(); };
                tx.onerror = () => r();
            });
            // Silent Auto-Migration from older DBs (V1 to V6) if current is empty
            if (!loaded) {
                for (let i = 6; i >= 1; i--) {
                    const oldDbName = 'TFF_FOS_DB_V' + i;
                    const oldReq = indexedDB.open(oldDbName);
                    try {
                        const oldRes = await new Promise((r, rej) => {
                            oldReq.onsuccess = ev => {
                                const odb = ev.target.result;
                                if (!odb.objectStoreNames.contains(DB_STORE)) { r(null); return; }
                                const otx = odb.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get('root');
                                otx.onsuccess = () => r(otx.result);
                                otx.onerror = () => r(null);
                            };
                            oldReq.onerror = () => r(null);
                        });
                        if (oldRes && oldRes.sites) {
                            state = oldRes;
                            saveState(); // Save into V7 immediately
                            console.log('✅ Migrated from', oldDbName);
                            break;
                        }
                    } catch {}
                }
            }
            resolve();
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

function ensurePhotosArr(obj) {
    if (!obj) return [];
    if (!Array.isArray(obj.photos)) {
        obj.photos = obj.photo ? [obj.photo] : [];
        delete obj.photo;
    }
    return obj.photos;
}

function getDayLog(dateStr = state.activeDate) {
    const site = getSite();
    if (!site.logs[dateStr]) {
        const sortedDates = Object.keys(site.logs).sort();
        const prevDate = sortedDates.filter(d => d < dateStr).pop();
        const prevLog = prevDate ? site.logs[prevDate] : null;
        site.logs[dateStr] = {
            dflNum: site.nextDfl++,
            attendance: state.company.staffPool.map((s, idx) => ({
                id: 'w_' + idx + '_' + Date.now(), name: s.name, type: s.type,
                status: 'Present / حاضر', tIn: s.tIn || '08:00', tOut: s.tOut || '16:00', ot: 0, note: ''
            })),
            tasks: [],
            meters: site.meters.map(m => {
                const prevM = prevLog && prevLog.meters ? prevLog.meters.find(x => x.id === m.id) : null;
                const startVal = prevM && prevM.curr !== '' && prevM.curr != null ? prevM.curr : (m.lastReading || 0);
                return { id: m.id, name: m.name, status: 'working', prev: startVal, curr: '', visual: 'Clear / صافية', note: '', photos: [] };
            }),
            gauges: site.gauges.map(g => ({ id: g.id, name: g.name, normal: g.normal, val: '', note: '' })),
            machinery: { pumpHrs: '', genHrs: '', fuelL: '' },
            moisture: [1, 2, 3, 4, 5].map(n => ({ id: n, zone: '', pct: '', note: '' })),
            perf: { status: 'جيد', duration: '', zonesIrrigated: '', zonesManualEdit: false, pressureNotes: '', notes: '' },
            tools: [],
            incidents: [],
            sdls: [],
            secHistory: { att: [], tasks: [], tools: [], inv: [], issues: [] },
            oar: { obs: '', ana: '', rec: '' }
        };
        saveState();
    }
    const l = site.logs[dateStr];
    if (!l.secHistory) l.secHistory = { att: [], tasks: [], tools: [], inv: [], issues: [] };
    ['att', 'tasks', 'tools', 'inv', 'issues'].forEach(k => { if (!l.secHistory[k]) l.secHistory[k] = []; });
    if (!l.machinery) l.machinery = { pumpHrs: '', genHrs: '', fuelL: '' };
    if (!l.incidents) l.incidents = [];
    if (!l.sdls) l.sdls = [];
    if (!l.perf) l.perf = { status: 'جيد', duration: '', zonesIrrigated: '', zonesManualEdit: false, pressureNotes: '', notes: '' };
    l.tasks.forEach(t => ensurePhotosArr(t));
    l.meters.forEach(m => ensurePhotosArr(m));
    site.issues.forEach(i => ensurePhotosArr(i));
    return l;
}

/* ================= UI Utilities: Quick Clear, Auto-Grow, Custom Time ================= */
function quickClearField(elId, callback) {
    const el = document.getElementById(elId);
    if (el) {
        el.value = '';
        if (el.tagName === 'TEXTAREA') autoGrow(el);
        if (callback) callback('');
    }
}

function autoGrow(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(58, el.scrollHeight) + 'px';
}

function triggerAllAutoGrows() {
    document.querySelectorAll('textarea.auto-grow').forEach(autoGrow);
}

function buildDurationSelectHtml(currentVal, selectId, onChangeExpr) {
    const val = currentVal || '1:00 hr';
    const hasCustom = val && !DURATION_OPTIONS.includes(val);
    return `
        <select id="${selectId}" class="inp" style="margin:0;flex:1;" onchange="${onChangeExpr}">
            ${hasCustom ? `<option value="${esc(val)}" selected>${esc(val)} (مخصص)</option>` : ''}
            ${DURATION_OPTIONS.map(d => `<option value="${d}" ${val === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
    `;
}

function openCustomTimeModal(targetType, targetIdx, targetInputId = '') {
    openModal(`
        <h3 class="card-title">⏱️ إدخال وقت مخصص</h3>
        <div class="grid-2">
            <div>
                <label class="lbl">الساعات (Hours):</label>
                <input type="number" id="ctHrs" class="inp" min="0" max="24" value="0">
            </div>
            <div>
                <label class="lbl">الدقائق (Minutes):</label>
                <input type="number" id="ctMins" class="inp" min="0" max="59" step="5" value="25">
            </div>
        </div>
        <div style="margin-bottom:8px;">
            <span class="chip" onclick="document.getElementById('ctHrs').value=0;document.getElementById('ctMins').value=10;">10 د</span>
            <span class="chip" onclick="document.getElementById('ctHrs').value=0;document.getElementById('ctMins').value=20;">20 د</span>
            <span class="chip" onclick="document.getElementById('ctHrs').value=0;document.getElementById('ctMins').value=40;">40 د</span>
            <span class="chip" onclick="document.getElementById('ctHrs').value=1;document.getElementById('ctMins').value=15;">1:15 س</span>
            <span class="chip" onclick="document.getElementById('ctHrs').value=2;document.getElementById('ctMins').value=30;">2:30 س</span>
        </div>
        <div class="grid-2">
            <button class="btn btn-green" onclick="applyCustomTime('${targetType}', ${targetIdx}, '${targetInputId}')">اعتماد الوقت</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}

function applyCustomTime(targetType, targetIdx, targetInputId) {
    const h = Math.max(0, parseInt(document.getElementById('ctHrs').value) || 0);
    const m = Math.max(0, Math.min(59, parseInt(document.getElementById('ctMins').value) || 0));
    const formatted = `${h}:${String(m).padStart(2, '0')} hr`;
    closeModal();

    if (targetType === 'task_card') {
        pushUndo('تعديل وقت مهمة مخصص');
        const t = getDayLog().tasks[targetIdx];
        t.dur = formatted;
        logSectionHistory('tasks', 'edit', `وقت ${t.zones}: ${formatted}`, { taskId: t.id });
        saveState(); renderTasks(getDayLog());
    } else if (targetType === 'perf') {
        const hrsDec = (h + m / 60).toFixed(2);
        getDayLog().perf.duration = hrsDec;
        saveState(); renderReadingsAndTools(getDayLog());
    } else if (targetType === 'select_el' && targetInputId) {
        const sel = document.getElementById(targetInputId);
        if (sel) {
            const opt = document.createElement('option');
            opt.value = formatted; opt.textContent = formatted + ' (مخصص)'; opt.selected = true;
            sel.insertBefore(opt, sel.firstChild);
            sel.value = formatted;
        }
    }
    showToast('⏱️ تم ضبط الوقت: ' + formatted);
}

/* ================= Two-Way Linked Section History & Global Undo ================= */
function pushUndo(actionLabel) {
    try {
        const snap = JSON.stringify(state);
        undoStack.push({ label: actionLabel, snap });
        if (undoStack.length > 20) undoStack.shift();
        const btn = document.getElementById('globalUndoBtn');
        if (btn) btn.disabled = false;
    } catch {}
}

function globalUndo() {
    if (!undoStack.length) { showToast('لا توجد خطوة سابقة للتراجع'); return; }
    const last = undoStack.pop();
    state = JSON.parse(last.snap);
    const btn = document.getElementById('globalUndoBtn');
    if (btn) btn.disabled = undoStack.length === 0;
    saveState();
    renderAll();
    showToast('↩️ تم التراجع عن: ' + last.label);
}

function logSectionHistory(secKey, actionType, summary, refData = {}) {
    const log = getDayLog();
    const timeStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    log.secHistory[secKey].unshift({
        hid: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        time: timeStr,
        actionType,
        summary,
        ref: refData
    });
    if (log.secHistory[secKey].length > 50) log.secHistory[secKey].pop();
}

function renderStickySectionHistory(secKey, containerId, labelTitle) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const log = getDayLog();
    const site = getSite();
    const list = log.secHistory[secKey] || [];
    const latest = list[0];

    if (!latest) {
        box.innerHTML = `
        <div class="sticky-sec-bar empty-bar">
            <div class="sticky-sec-info" style="color:var(--muted);">🕒 سجل ${labelTitle}: لا توجد حركات مسجلة بعد</div>
            <div class="sticky-sec-actions">
                ${secKey === 'inv' ? `<button class="btn btn-outline btn-sm" onclick="setStopMarker()">🎀 علامة</button>` : ''}
                <button class="btn btn-outline btn-sm" onclick="openSectionHistoryModal('${secKey}', '${labelTitle}')">📜 السجل (0)</button>
            </div>
        </div>`;
        return;
    }

    box.innerHTML = `
    <div class="sticky-sec-bar">
        <div class="sticky-sec-info">
            <div class="sticky-sec-title">🕒 آخر حركة في ${labelTitle} (${esc(latest.time)}):</div>
            <div style="font-weight:bold;color:var(--text);">${esc(latest.summary)}</div>
            ${secKey === 'inv' && site.stopMarker ? `<div style="color:var(--red);font-size:10.5px;font-weight:bold;">🎀 علامة التوقف: ${esc(site.stopMarker)}</div>` : ''}
        </div>
        <div class="sticky-sec-actions">
            ${secKey === 'inv' ? `<button class="btn btn-outline btn-sm" onclick="setStopMarker()">🎀</button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="editHistoryItem('${secKey}', '${latest.hid}')" title="تعديل">✏️</button>
            <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteHistoryItem('${secKey}', '${latest.hid}')" title="حذف من السجل والقسم">🗑️</button>
            <button class="btn btn-blue btn-sm" onclick="openSectionHistoryModal('${secKey}', '${labelTitle}')">📜 (${list.length})</button>
        </div>
    </div>`;
}

function openSectionHistoryModal(secKey, labelTitle) {
    const list = getDayLog().secHistory[secKey] || [];
    openModal(`
        <h3 class="card-title">📜 سجل وملخص ${labelTitle} (${list.length})</h3>
        <p style="font-size:11px;color:var(--muted);margin-top:0;">الحذف أو التعديل من هنا ينعكس مباشرة على بيانات القسم والتقرير النهائي:</p>
        <div style="max-height:330px;overflow-y:auto;margin-bottom:10px;">
            ${list.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:15px;">السجل فارغ</div>' :
            list.map(h => `
                <div class="meter-card" style="padding:8px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
                    <div style="flex:1;">
                        <div style="font-size:10px;color:var(--blue);font-weight:bold;">${esc(h.time)}</div>
                        <div style="font-size:12px;font-weight:bold;">${esc(h.summary)}</div>
                    </div>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-outline btn-sm" onclick="closeModal();editHistoryItem('${secKey}', '${h.hid}')">✏️</button>
                        <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteHistoryItem('${secKey}', '${h.hid}', true, '${labelTitle}')">🗑️</button>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-outline btn-full" onclick="closeModal()">إغلاق</button>
    `);
}

function deleteHistoryItem(secKey, hid, reopenModal = false, labelTitle = '') {
    const site = getSite();
    const log = getDayLog();
    const list = log.secHistory[secKey] || [];
    const hIdx = list.findIndex(x => x.hid === hid);
    if (hIdx === -1) return;
    const item = list[hIdx];
    pushUndo('حذف من سجل ' + secKey);

    const ref = item.ref || {};
    if (secKey === 'tasks' && ref.taskId) {
        log.tasks = log.tasks.filter(t => t.id !== ref.taskId);
        syncIrrigatedZonesFromTasks(false);
    } else if (secKey === 'inv' && ref.zoneId && ref.plantId) {
        const z = site.inventory.find(x => x.id === ref.zoneId);
        const p = z ? z.plants.find(x => x.id === ref.plantId) : null;
        if (p) {
            if (ref.condId && p.counts[ref.condId] > 0) p.counts[ref.condId]--;
            if (ref.entryId && p.entries) p.entries = p.entries.filter(e => e.id !== ref.entryId);
        }
    } else if (secKey === 'att' && ref.workerId) {
        if (item.actionType === 'add') log.attendance = log.attendance.filter(w => w.id !== ref.workerId);
        else { const w = log.attendance.find(x => x.id === ref.workerId); if (w) w.status = 'Present / حاضر'; }
    } else if (secKey === 'tools') {
        if (ref.toolIdx != null && log.tools[ref.toolIdx]) log.tools.splice(ref.toolIdx, 1);
        else if (ref.meterId) { const m = log.meters.find(x => x.id === ref.meterId); if (m) m.curr = ''; }
        else if (ref.gaugeId) { const g = log.gauges.find(x => x.id === ref.gaugeId); if (g) g.val = ''; }
    } else if (secKey === 'issues' && ref.issueId) {
        site.issues = site.issues.filter(i => i.id !== ref.issueId);
    }

    list.splice(hIdx, 1);
    saveState();
    renderAll();
    showToast('🗑️ تم حذف السجل وإلغاء العملية من القسم');
    if (reopenModal) openSectionHistoryModal(secKey, labelTitle);
}

function editHistoryItem(secKey, hid) {
    const site = getSite();
    const log = getDayLog();
    const item = (log.secHistory[secKey] || []).find(x => x.hid === hid);
    if (!item) return;
    const ref = item.ref || {};

    if (secKey === 'tasks' && ref.taskId) {
        const tIdx = log.tasks.findIndex(t => t.id === ref.taskId);
        if (tIdx === -1) { showToast('المهمة محذوفة مسبقاً'); return; }
        const t = log.tasks[tIdx];
        openModal(`
            <h3 class="card-title">✏️ تعديل المهمة من السجل</h3>
            <label class="lbl">المناطق:</label><input id="ehZones" class="inp" value="${esc(t.zones)}">
            <label class="lbl">الوصف المختصر:</label><textarea id="ehDesc" class="inp auto-grow" rows="2">${esc(t.desc)}</textarea>
            <div class="grid-2">
                <div><label class="lbl">المدة:</label><input id="ehDur" class="inp" value="${esc(t.dur)}"></div>
                <div><label class="lbl">الحالة:</label>
                    <select id="ehSt" class="inp">
                        <option value="Completed / مكتمل" ${t.status.includes('Completed')?'selected':''}>مكتمل</option>
                        <option value="In Progress / جاري" ${t.status.includes('Progress')?'selected':''}>جاري</option>
                        <option value="Not Started / لم يبدأ" ${t.status.includes('Not Started')?'selected':''}>لم يبدأ</option>
                        <option value="Blocked / متوقف" ${t.status.includes('Blocked')?'selected':''}>متوقف</option>
                    </select>
                </div>
            </div>
            <label class="lbl">ملاحظات:</label><textarea id="ehNote" class="inp auto-grow" rows="2">${esc(t.note || '')}</textarea>
            <div class="grid-2"><button class="btn btn-green" onclick="saveEditedTaskHistory(${tIdx}, '${hid}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
        `);
    } else if (secKey === 'inv' && ref.zoneId && ref.plantId) {
        const z = site.inventory.find(x => x.id === ref.zoneId);
        const p = z ? z.plants.find(x => x.id === ref.plantId) : null;
        const ent = p && ref.entryId ? (p.entries || []).find(e => e.id === ref.entryId) : null;
        if (!p || !ent) { showToast('القيد غير موجود'); return; }
        openModal(`
            <h3 class="card-title">✏️ تعديل قيد الجرد (${esc(p.name)})</h3>
            <label class="lbl">الحالة الصحية:</label>
            <select id="ehCond" class="inp">${HEALTH_CONDITIONS.map(c => `<option value="${c.id}" ${ent.condId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
            <label class="lbl">الطول (${state.company.heightUnit}):</label>
            <input type="number" step="any" id="ehHeight" class="inp" value="${ent.height || ''}">
            <div class="grid-2"><button class="btn btn-green" onclick="saveEditedInvHistory('${ref.zoneId}','${ref.plantId}','${ref.entryId}','${hid}')">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
        `);
    } else if (secKey === 'att' && ref.workerId) {
        const wIdx = log.attendance.findIndex(w => w.id === ref.workerId);
        if (wIdx !== -1) editWorkerModal(wIdx);
    } else if (secKey === 'tools') {
        if (ref.meterId) {
            const mIdx = log.meters.findIndex(m => m.id === ref.meterId);
            if (mIdx !== -1) {
                const v = prompt('تعديل القراءة الحالية للعداد:', log.meters[mIdx].curr);
                if (v !== null) { updateMeterField(mIdx, 'curr', v); item.summary = `تحديث عداد ${log.meters[mIdx].name}: ${v}`; saveState(); renderAll(); }
            }
        } else if (ref.toolIdx != null && log.tools[ref.toolIdx]) {
            editToolQty(ref.toolIdx);
        }
    } else if (secKey === 'issues' && ref.issueId) {
        const iss = site.issues.find(i => i.id === ref.issueId);
        if (iss) {
            const d = prompt('تعديل وصف المشكلة:', iss.desc);
            if (d !== null && d.trim()) { iss.desc = d.trim(); item.summary = `${iss.code} [${iss.zone}]: ${iss.desc}`; saveState(); renderAll(); }
        }
    }
}

function saveEditedTaskHistory(tIdx, hid) {
    pushUndo('تعديل مهمة من السجل');
    const log = getDayLog();
    const t = log.tasks[tIdx];
    t.zones = document.getElementById('ehZones').value.trim() || t.zones;
    t.desc = document.getElementById('ehDesc').value.trim();
    t.dur = document.getElementById('ehDur').value.trim() || t.dur;
    t.status = document.getElementById('ehSt').value;
    t.note = document.getElementById('ehNote').value.trim();
    const hItem = log.secHistory.tasks.find(x => x.hid === hid);
    if (hItem) hItem.summary = `${t.status.split('/')[1] || t.status}: ${t.zones} (${t.desc})`;
    syncIrrigatedZonesFromTasks(false);
    closeModal(); saveState(); renderAll(); showToast('✓ تم تحديث المهمة والسجل');
}

function saveEditedInvHistory(zoneId, plantId, entryId, hid) {
    pushUndo('تعديل جرد من السجل');
    const site = getSite();
    const z = site.inventory.find(x => x.id === zoneId);
    const p = z ? z.plants.find(x => x.id === plantId) : null;
    const ent = p ? (p.entries || []).find(e => e.id === entryId) : null;
    if (p && ent) {
        const newCond = document.getElementById('ehCond').value;
        const newH = parseFloat(document.getElementById('ehHeight').value);
        if (ent.condId !== newCond) {
            if (p.counts[ent.condId] > 0) p.counts[ent.condId]--;
            p.counts[newCond] = (p.counts[newCond] || 0) + 1;
            ent.condId = newCond;
        }
        ent.height = (!isNaN(newH) && newH > 0) ? newH : null;
        const cObj = HEALTH_CONDITIONS.find(c => c.id === newCond);
        const hItem = getDayLog().secHistory.inv.find(x => x.hid === hid);
        if (hItem) {
            hItem.ref.condId = newCond;
            hItem.summary = `${z.name} | ${p.name} — ${cObj ? cObj.name : ''} ${ent.height ? `(${ent.height} ${state.company.heightUnit})` : ''}`;
        }
    }
    closeModal(); saveState(); renderAll(); showToast('✓ تم تحديث الجرد والسجل');
}

/* ================= Helpers ================= */
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

function applySpellAndDictationGuard(rawText) {
    let fixed = String(rawText || '');
    let changed = false;
    DICTATION_CORRECTIONS.forEach(([regex, replacement]) => {
        if (regex.test(fixed)) {
            fixed = fixed.replace(regex, replacement);
            changed = true;
        }
    });
    return { text: fixed, changed };
}

/* ================= Timer Alert Bar ================= */
function checkTaskTimers() {
    const log = getDayLog();
    let hasAlert = false;
    let msgs = [];
    const nowMs = Date.now();

    log.tasks.forEach(t => {
        if (t.status.includes('Progress') && t.startTimeMs) {
            const elapMins = (nowMs - t.startTimeMs) / 60000;
            let targetMins = 60;
            const m = String(t.dur || '').match(/(\d+):(\d+)/);
            if (m) targetMins = parseInt(m[1]) * 60 + parseInt(m[2]);
            
            if (elapMins >= targetMins) {
                hasAlert = true;
                msgs.push(`⚠️ انتهى وقت (${t.zones}) منذ ${Math.floor(elapMins - targetMins)} دقيقة!`);
            }
        }
    });

    const bar = document.getElementById('timerAlertBar');
    if (hasAlert && bar) {
        bar.innerHTML = `<div>${msgs.join('<br>')}</div><button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="switchTab('tasks');window.scrollTo(0,0)">إغلاق الصمام</button>`;
        bar.classList.add('show');
    } else if (bar) {
        bar.classList.remove('show');
    }
}
setInterval(checkTaskTimers, 60000);

/* ================= Auto-Sync Irrigated Zones & Hours ================= */
function syncIrrigatedZonesFromTasks(force = false) {
    const log = getDayLog();
    if (!force && log.perf.zonesManualEdit) return;
    const completedIrrZones = [];
    log.tasks.forEach(t => {
        if (t.task.includes('Irrigation') && t.status.includes('Completed')) {
            (t.zones || '').split(',').map(z => z.trim()).filter(Boolean).forEach(z => {
                if (!completedIrrZones.includes(z)) completedIrrZones.push(z);
            });
        }
    });
    log.perf.zonesIrrigated = completedIrrZones.join(', ');
    if (force) {
        log.perf.zonesManualEdit = false;
        saveState();
        renderReadingsAndTools(log);
        showToast('🔄 تم تحديث المناطق المروية من المهام المكتملة');
    }
}

function calcIrrigationHoursFromTasks() {
    const log = getDayLog();
    let totalMins = 0;
    log.tasks.forEach(t => {
        if (t.task.includes('Irrigation') && t.status.includes('Completed')) {
            const m = String(t.dur || '').match(/(\d+):(\d+)/);
            if (m) totalMins += parseInt(m[1]) * 60 + parseInt(m[2]);
        }
    });
    const hrs = (totalMins / 60).toFixed(1);
    log.perf.duration = hrs;
    saveState();
    renderReadingsAndTools(log);
    showToast(`⏱️ إجمالي ساعات الري المكتملة: ${hrs} ساعة`);
}

/* ================= Rendering & Navigation ================= */
function renderAll() {
    const site = getSite();
    const log = getDayLog();
    const dayEn = getDayNameEn(state.activeDate);

    syncIrrigatedZonesFromTasks(false);

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
    const missingMeterPhoto = log.meters.some(m => ensurePhotosArr(m).length === 0);
    document.getElementById('meterReminderBar').classList.toggle('show', isShiftEdge && missingMeterPhoto);

    document.body.classList.toggle('alpha-pad', state.activeTab === 'inv' && activeInvZoneId !== null);

    renderAttendance(log);
    renderTasks(log);
    renderReadingsAndTools(log);
    renderInventory(site);
    renderExportAndIssues(site, log);
    checkTaskTimers();
    setTimeout(triggerAllAutoGrows, 20);
}

function switchTab(tabId) {
    state.activeTab = tabId;
    if (tabId === 'tools') syncIrrigatedZonesFromTasks(false);
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    document.getElementById('tab-' + tabId).classList.add('active');
    document.body.classList.toggle('alpha-pad', tabId === 'inv' && activeInvZoneId !== null);
    if (tabId === 'tools') renderReadingsAndTools(getDayLog());
    if (tabId === 'tasks') checkTaskTimers();
    setTimeout(triggerAllAutoGrows, 20);
}

function onDateChange(val) { if (!val) return; state.activeDate = val; getDayLog(val); saveState(); renderAll(); }
function onDflNumChange(val) {
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) { pushUndo('تعديل رقم DFL'); getDayLog().dflNum = n; getSite().nextDfl = Math.max(getSite().nextDfl, n + 1); saveState(); }
}
function onSiteSelectChange(val) {
    if (val === '__NEW__') { openNewSiteModal(); renderAll(); return; }
    state.activeSiteId = val; activeInvZoneId = null; getDayLog(); saveState(); renderAll();
    showToast('📍 تم التبديل إلى: ' + getSite().name);
}

/* ================= Full Archive Modal ================= */
function openFullArchiveModal() {
    const site = getSite();
    const allDates = Object.keys(site.logs).sort().reverse();
    openModal(`
        <h3 class="card-title">📅 أرشيف أيام (${esc(site.name.split('/')[0])})</h3>
        <div style="max-height:320px;overflow-y:auto;margin-bottom:10px;">
            ${allDates.map(d => {
                const dl = site.logs[d];
                const pres = (dl.attendance || []).filter(w => !w.status.includes('Absent')).length;
                const tkL = (dl.tasks || []).reduce((s, t) => s + (parseFloat(t.tankerLiters) || 0), 0);
                return `
                <div class="meter-card" style="padding:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="jumpToArchiveDate('${d}')">
                    <div>
                        <b style="font-size:12px;">📅 ${d} — DFL-${dl.dflNum}</b>
                        <div style="font-size:10px;color:var(--muted);">الحضور: ${pres} | المهام: ${(dl.tasks||[]).length} | تنكر: ${tkL.toLocaleString()} L</div>
                    </div>
                    <span class="btn btn-blue btn-sm">فتح</span>
                </div>`;
            }).join('')}
        </div>
        <button class="btn btn-outline btn-full" onclick="closeModal()">إغلاق</button>
    `);
}
function jumpToArchiveDate(d) { state.activeDate = d; closeModal(); saveState(); renderAll(); showToast('📅 تم فتح سجل يوم ' + d); }

/* ================= TAB 1: Attendance ================= */
function renderAttendance(log) {
    renderStickySectionHistory('att', 'stickyHist-att', 'الحضور');
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

function setWorkerAtt(idx, st) {
    pushUndo('تغيير حالة حضور');
    const w = getDayLog().attendance[idx];
    w.status = st;
    logSectionHistory('att', 'status', `${w.name.split('/')[1] || w.name}: ${st.split('/')[1] || st}`, { workerId: w.id });
    saveState(); renderAttendance(getDayLog());
}
function updateWorkerField(idx, k, v) { pushUndo('تعديل وقت/أوفرتايم عامل'); getDayLog().attendance[idx][k] = v; saveState(); renderAttendance(getDayLog()); }
function markAllPresent() {
    pushUndo('تسجيل الجميع حاضرين');
    getDayLog().attendance.forEach(w => w.status = 'Present / حاضر');
    logSectionHistory('att', 'bulk', 'تسجيل جميع الكادر حاضرين', {});
    saveState(); renderAttendance(getDayLog()); showToast('✓ تم تسجيل الجميع حاضرين');
}
function deleteWorkerFromToday(idx) {
    if (confirm('حذف العامل من قائمة اليوم؟')) {
        pushUndo('حذف عامل من اليوم');
        const w = getDayLog().attendance[idx];
        getDayLog().attendance.splice(idx, 1);
        logSectionHistory('att', 'delete', `حذف من اليوم: ${w.name.split('/')[1] || w.name}`, {});
        saveState(); renderAttendance(getDayLog());
    }
}
function copyYesterdayCrew() {
    const site = getSite();
    const prevDate = Object.keys(site.logs).sort().filter(d => d < state.activeDate).pop();
    if (!prevDate || !site.logs[prevDate].attendance.length) { showToast('⚠️ لا يوجد سجل كادر سابق'); return; }
    pushUndo('نسخ كادر الأمس');
    getDayLog().attendance = JSON.parse(JSON.stringify(site.logs[prevDate].attendance)).map((w, i) => ({
        ...w, id: 'w_' + i + '_' + Date.now(), ot: 0, note: ''
    }));
    logSectionHistory('att', 'copy', 'نسخ كادر الأمس بالكامل', {});
    saveState(); renderAttendance(getDayLog()); showToast('📋 تم نسخ كادر الأمس');
}
function editWorkerModal(idx) {
    const w = getDayLog().attendance[idx];
    openModal(`
        <h3 class="card-title">✏️ تعديل بيانات العامل</h3>
        <label class="lbl">الاسم:</label><input id="edWName" class="inp" value="${esc(w.name)}">
        <label class="lbl">نوع التوظيف:</label>
        <select id="edWType" class="inp">
            <option value="Employee  /  موظف" ${w.type.includes('Employee') ? 'selected' : ''}>Employee / موظف</option>
            <option value="Outside Worker  /  عامل خارجي" ${w.type.includes('Outside') ? 'selected' : ''}>Outside Worker / عامل خارجي</option>
            <option value="Intern  /  متدرب" ${w.type.includes('Intern') ? 'selected' : ''}>Intern / متدرب</option>
        </select>
        <label class="lbl">ملاحظة:</label><input id="edWNote" class="inp" value="${esc(w.note || '')}">
        <div class="grid-2"><button class="btn btn-green" onclick="saveEditWorker(${idx})">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveEditWorker(idx) {
    pushUndo('تعديل بيانات عامل');
    const w = getDayLog().attendance[idx];
    w.name = document.getElementById('edWName').value.trim() || w.name;
    w.type = document.getElementById('edWType').value;
    w.note = document.getElementById('edWNote').value.trim();
    logSectionHistory('att', 'edit', `تعديل بيانات: ${w.name.split('/')[1] || w.name}`, { workerId: w.id });
    closeModal(); saveState(); renderAttendance(getDayLog());
}
function promptAddWorker() {
    openModal(`
        <h3 class="card-title">👷 إضافة عامل خارجي / موظف</h3>
        <label class="lbl">الاسم الكامل:</label><input id="newWName" class="inp" placeholder="اكتب اسم العامل...">
        <label class="lbl">نوع التوظيف:</label>
        <select id="newWType" class="inp">
            <option value="Outside Worker  /  عامل خارجي">Outside Worker / عامل خارجي</option>
            <option value="Employee  /  موظف">Employee / موظف</option>
            <option value="Intern  /  متدرب">Intern / متدرب</option>
        </select>
        <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:10px;"><input type="checkbox" id="newWSavePool" checked> تثبيت في القائمة الدائمة للشركة</label>
        <div class="grid-2"><button class="btn btn-green" onclick="confirmAddWorker()">إضافة</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function confirmAddWorker() {
    const name = document.getElementById('newWName').value.trim();
    const type = document.getElementById('newWType').value;
    if (!name) return;
    pushUndo('إضافة عامل: ' + name);
    const tOut = type.includes('Employee') ? '17:00' : '16:00';
    const wid = 'w_' + Date.now();
    getDayLog().attendance.push({ id: wid, name, type, status: 'Present / حاضر', tIn: '08:00', tOut, ot: 0, note: '' });
    if (document.getElementById('newWSavePool').checked && !state.company.staffPool.some(s => s.name === name)) {
        state.company.staffPool.push({ name, type, tIn: '08:00', tOut });
    }
    logSectionHistory('att', 'add', `إضافة عامل: ${name}`, { workerId: wid });
    closeModal(); saveState(); renderAttendance(getDayLog()); showToast('✓ تمت إضافة ' + name);
}

/* ================= TAB 2: Tasks, 4 Statuses, Tanker (24,000L Pre/Post), Multi-Photo, Timers, Queue ================= */
function moveTaskUp(idx) {
    if (idx === 0) return;
    pushUndo('ترتيب مهمة لأعلى');
    const tasks = getDayLog().tasks;
    [tasks[idx - 1], tasks[idx]] = [tasks[idx], tasks[idx - 1]];
    saveState(); renderTasks(getDayLog());
}
function moveTaskDown(idx) {
    const tasks = getDayLog().tasks;
    if (idx === tasks.length - 1) return;
    pushUndo('ترتيب مهمة لأسفل');
    [tasks[idx], tasks[idx + 1]] = [tasks[idx + 1], tasks[idx]];
    saveState(); renderTasks(getDayLog());
}

function loadSiteIrrigationPlan() {
    const site = getSite();
    const log = getDayLog();
    const dayEn = getDayNameEn(state.activeDate);
    const planItems = (site.plan && site.plan[dayEn]) || [];
    if (planItems.length === 0) { showToast('⚠️ لا توجد خطة ري مسجلة لهذا اليوم'); return; }
    pushUndo('تحميل خطة ري ' + dayEn);
    planItems.forEach((item, i) => {
        const isTk = !!item.isTanker || (item.desc || '').toLowerCase().includes('tanker');
        log.tasks.push({
            id: 't_' + Date.now() + '_' + i,
            task: item.task, desc: item.desc, zones: item.zones, dur: item.dur || '1:00 hr',
            status: 'Not Started / لم يبدأ', workers: [], note: '',
            isTanker: isTk, tankerCapacity: isTk ? TANKER_FULL_CAPACITY : '', tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية', tankerTrips: 1,
            agroName: '', agroDose: '', photos: [], startTimeMs: null, actualDuration: ''
        });
    });
    logSectionHistory('tasks', 'plan', `تحميل خطة ري ${dayEn} (${planItems.length} مهام لم تبدأ)`, {});
    syncIrrigatedZonesFromTasks(false);
    saveState(); renderTasks(log); showToast(`⚡ تم تحميل ${planItems.length} مهام ري ليوم ${dayEn}`);
}

function quickAddNonIrrTask(taskName, desc, dur) {
    pushUndo('إضافة مهمة: ' + desc);
    const tid = 't_' + Date.now();
    getDayLog().tasks.push({
        id: tid, task: taskName, desc, zones: 'عام / General', dur,
        status: 'Completed / مكتمل', workers: [], note: '',
        isTanker: false, tankerCapacity: '', tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية', tankerTrips: 1,
        agroName: '', agroDose: '', photos: [], startTimeMs: null, actualDuration: ''
    });
    logSectionHistory('tasks', 'add', `مكتمل: عام / General (${desc})`, { taskId: tid });
    saveState(); renderTasks(getDayLog()); showToast('✓ تمت إضافة المهمة');
}

function renderTasksQueue(log) {
    const qBox = document.getElementById('tasksQueueContainer');
    if (!qBox) return;
    
    const inProg = log.tasks.map((t, i) => ({ t, i })).filter(x => x.t.status.includes('Progress'));
    const notSt = log.tasks.map((t, i) => ({ t, i })).filter(x => x.t.status.includes('Not Started'));
    
    if (inProg.length === 0 && notSt.length === 0) {
        qBox.innerHTML = '';
        return;
    }
    
    let html = `<div class="queue-banner">`;
    if (inProg.length > 0) {
        html += `<div style="font-weight:bold;color:var(--blue);margin-bottom:6px;font-size:12px;">🔵 جاري الآن (${inProg.length}):</div>`;
        inProg.forEach(x => {
            const startStr = x.t.startTimeMs ? new Date(x.t.startTimeMs).toLocaleTimeString('ar-IQ', {hour:'2-digit', minute:'2-digit'}) : 'الآن';
            html += `
            <div class="queue-item">
                <div style="font-size:12px;"><b>${esc(x.t.zones)}</b> — ${esc(x.t.desc)} <br><span class="q-timer">▶️ بدأ: ${startStr}</span></div>
                <button class="btn btn-green btn-sm" onclick="setTaskStatus(${x.i}, 'Completed / مكتمل')">✓ إكمال</button>
            </div>`;
        });
    }
    
    if (notSt.length > 0) {
        if (inProg.length > 0) html += `<hr style="border-top:1px dashed #fcd34d;margin:8px 0;">`;
        html += `<div style="font-weight:bold;color:var(--muted);margin-bottom:6px;font-size:12px;">⏳ القادم (${notSt.length}):</div>`;
        notSt.forEach(x => {
            html += `
            <div class="queue-item">
                <div style="font-size:12px;color:var(--muted);"><b>${esc(x.t.zones)}</b> — ${esc(x.t.desc)}</div>
                <button class="btn btn-blue btn-sm" onclick="setTaskStatus(${x.i}, 'In Progress / جاري')">▶️ ابدأ</button>
            </div>`;
        });
    }
    html += `</div>`;
    qBox.innerHTML = html;
}

function renderTasks(log) {
    renderStickySectionHistory('tasks', 'stickyHist-tasks', 'المهام');
    renderTasksQueue(log);

    const el = document.getElementById('tasksContainer');
    if (log.tasks.length === 0) {
        el.innerHTML = `<div class="card" style="text-align:center;color:var(--muted);padding:24px;">💧 اضغط على زر خطة الري أعلاه أو أضف مهمة جديدة</div>`;
        return;
    }
    el.innerHTML = log.tasks.map((t, idx) => {
        const isDone = t.status.includes('Completed');
        const isProg = t.status.includes('Progress');
        const isNotSt = t.status.includes('Not Started');
        const isBlock = t.status.includes('Blocked');
        const zoneList = (t.zones || '').split(',').map(s => s.trim()).filter(Boolean);
        const canSplit = zoneList.length > 1;
        const wNames = t.workers && t.workers.length ? t.workers.join(' / ') : 'عمال...';
        const isAgro = t.task.includes('Fertilizing') || t.task.includes('Pest Control');
        const isIrr = t.task.includes('Irrigation');
        const photos = ensurePhotosArr(t);

        const capVal = parseFloat(t.tankerCapacity) || 0;
        const dispVal = parseFloat(t.tankerLiters) || 0;
        const remVal = capVal > 0 ? Math.max(0, capVal - dispVal) : null;
        const trips = t.tankerTrips || 1;

        let cardClass = 'task-box';
        if (isBlock) cardClass += ' is-blocked';
        else if (isNotSt) cardClass += ' is-notstarted';
        else if (isDone) cardClass += ' is-done';

        return `
        <div class="card ${cardClass}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:6px;">
                <div style="display:flex;gap:3px;">
                    <div class="sort-controls">
                        <button class="sort-btn" onclick="moveTaskUp(${idx})">▲</button>
                        <button class="sort-btn" onclick="moveTaskDown(${idx})">▼</button>
                    </div>
                    <div style="font-weight:bold;font-size:14px;padding-top:2px;">${esc(t.task.split('/')[1] || t.task)}</div>
                </div>
                <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end;">
                    <span class="zone-pill" onclick="openZonePickerModal(${idx})">📍 ${esc(t.zones)} ✏️</span>
                    ${canSplit ? `<button class="btn btn-orange btn-sm" onclick="splitTaskZones(${idx})">✂️ تفريق</button>` : ''}
                </div>
            </div>

            <!-- Auto-Expanding Brief Description + Quick Clear -->
            <label class="lbl">الوصف المختصر (قابل للتعديل دائماً):</label>
            <div class="inp-wrap" style="margin-bottom:5px;">
                <textarea id="tdesc_${idx}" class="inp auto-grow" rows="2" style="background:white;" placeholder="اكتب الوصف المختصر..." oninput="autoGrow(this)" onchange="updateTaskDesc(${idx}, this.value)">${esc(t.desc)}</textarea>
                <button class="clr-btn top-align" onclick="quickClearField('tdesc_${idx}', () => updateTaskDesc(${idx}, ''))">✕</button>
            </div>
            ${isIrr ? `
            <div style="margin-bottom:6px;">
                ${IRR_DESC_PRESETS.map(pr => `<span class="chip ${t.desc === pr.text ? 'active' : ''}" onclick="applyIrrPreset(${idx}, '${esc(pr.text)}', '${pr.dur}')">${pr.label}</span>`).join('')}
            </div>` : ''}

            <!-- Duration Dropdown + Custom Time Button + Workers + Photos -->
            <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:4px;">
                <div style="display:inline-flex;align-items:center;gap:3px;background:#f1f5f9;border:1px solid var(--border);border-radius:99px;padding:2px 6px;">
                    <span style="font-size:11px;">⏱️</span>
                    <select style="border:none;background:transparent;font-size:11px;font-weight:bold;color:var(--text);" onchange="updateTaskDurationSelect(${idx}, this.value)">
                        ${!DURATION_OPTIONS.includes(t.dur) ? `<option value="${esc(t.dur)}" selected>${esc(t.dur)}</option>` : ''}
                        ${DURATION_OPTIONS.map(d => `<option value="${d}" ${t.dur === d ? 'selected' : ''}>${d}</option>`).join('')}
                    </select>
                    <button class="btn btn-blue btn-sm" style="padding:1px 6px;font-size:10px;border-radius:99px;" onclick="openCustomTimeModal('task_card', ${idx})">مخصص</button>
                </div>
                <span class="chip" onclick="openAssignWorkersModal(${idx})">👷 ${esc(wNames)} (${t.workers ? t.workers.length : 0})</span>
                <span class="chip" onclick="openPhotoSourceChoice('task', ${idx})">📸 +صورة (${photos.length})</span>
                <span class="chip" onclick="duplicateTask(${idx})" title="نسخ المهمة">📋</span>
                <span class="chip" style="color:var(--red);" onclick="deleteTask(${idx})" title="حذف">🗑️</span>
            </div>

            <!-- Multi-Photo Thumbnails Strip -->
            ${photos.length > 0 ? `
            <div class="photo-strip">
                ${photos.map((pUrl, pI) => `
                    <div class="photo-item-wrap">
                        <img src="${pUrl}" class="photo-thumb" onclick="previewSinglePhoto('${pUrl}')">
                        <button class="photo-del-badge" onclick="removePhotoFromItem('task', ${idx}, ${pI})">✕</button>
                    </div>
                `).join('')}
            </div>` : ''}

            <!-- Tanker Pre-Start Capacity & Post-Finish Dispensed Amount -->
            ${t.isTanker ? `
            <div class="tanker-banner">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:6px;">
                    <span>🚚 سعة التنكر قبل البدء: <b>${capVal ? capVal.toLocaleString() + ' L' : 'غير محددة'}</b> ${trips > 1 ? `(نقلة #${trips})` : ''}</span>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-outline btn-sm" style="background:white;padding:2px 6px;" onclick="refillTankerTrip(${idx})">🔄 إعادة تعبئة</button>
                        <button class="btn btn-outline btn-sm" style="background:white;" onclick="openTankerPreModal(${idx})">⚙️ السعة</button>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;">
                    <span>💧 المصروف: <b>${dispVal ? dispVal.toLocaleString() + ' L' : '0 L'}</b> ${remVal !== null ? `| المتبقي: <b>${remVal.toLocaleString()} L</b>` : ''} ${t.tankerPpm ? `| ${t.tankerPpm} ppm` : ''}</span>
                    <button class="btn btn-blue btn-sm" onclick="openTankerFinishModal(${idx})">✓ الصرف</button>
                </div>
            </div>` : ''}

            ${isAgro ? `
            <div class="agro-banner">
                <span>🧪 المادة: ${t.agroName ? `${esc(t.agroName)} (${esc(t.agroDose)})` : 'سجل اسم السماد/المبيد والجرعة'}</span>
                <button class="btn btn-green btn-sm" onclick="openAgroModal(${idx})">الجرعة</button>
            </div>` : ''}

            <!-- 4 Separate Status Buttons -->
            <div class="st-bar">
                <button class="st-btn ${isDone ? 'on-done' : ''}" onclick="setTaskStatus(${idx},'Completed / مكتمل')">مكتمل</button>
                <button class="st-btn ${isProg ? 'on-prog' : ''}" onclick="setTaskStatus(${idx},'In Progress / جاري')">جاري</button>
                <button class="st-btn ${isNotSt ? 'on-notst' : ''}" onclick="setTaskStatus(${idx},'Not Started / لم يبدأ')">لم يبدأ</button>
                <button class="st-btn ${isBlock ? 'on-block' : ''}" onclick="setTaskStatus(${idx},'Blocked / متوقف')">متوقف</button>
            </div>

            ${isBlock ? `
            <div class="block-drawer">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;gap:4px;flex-wrap:wrap;">
                    <label class="lbl" style="color:var(--red);margin:0;font-size:12px;">🛑 سبب التوقف (إلزامي):</label>
                    <div style="display:flex;gap:4px;">
                        ${isIrr ? `<button class="btn btn-blue btn-sm" style="padding:2px 6px;font-size:10px;" onclick="createReplacementTankerTask(${idx})">🚚 تعويض تنكر</button>` : ''}
                        <button class="btn btn-red btn-sm" style="padding:2px 6px;font-size:10px;" onclick="escalateTaskToIssue(${idx})">🚨 تصعيد مشكلة</button>
                    </div>
                </div>
                <div style="display:flex;gap:4px;margin-bottom:6px;">
                    <div class="inp-wrap" style="margin:0;flex:1;">
                        <textarea id="tnote_${idx}" class="inp auto-grow blocked-note-box" rows="2" placeholder="اكتب سبب التوقف بوضوح..." oninput="autoGrow(this)" onchange="updateTaskNote(${idx}, this.value)">${esc(t.note)}</textarea>
                        <button class="clr-btn top-align" onclick="quickClearField('tnote_${idx}', () => updateTaskNote(${idx}, ''))">✕</button>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="startDictation('tnote_${idx}', v => updateTaskNote(${idx}, v))">🎤</button>
                </div>
                <div>
                    ${QUICK_NOTE_PHRASES.map(q => `<span class="chip" onclick="setTaskNoteChip(${idx}, '${esc(q.text)}')">${q.label}</span>`).join('')}
                </div>
            </div>` : `
            <div style="display:flex;gap:4px;margin-top:8px;">
                <div class="inp-wrap" style="margin:0;flex:1;">
                    <textarea id="tnote_${idx}" class="inp auto-grow" rows="2" style="font-size:12.5px;" placeholder="${isNotSt ? 'لم يبدأ — غير مشمول بخطة اليوم...' : 'ملاحظة إضافية للمهمة...'}" oninput="autoGrow(this)" onchange="updateTaskNote(${idx}, this.value)">${esc(t.note)}</textarea>
                    <button class="clr-btn top-align" onclick="quickClearField('tnote_${idx}', () => updateTaskNote(${idx}, ''))">✕</button>
                </div>
                <button class="btn btn-outline btn-sm" onclick="startDictation('tnote_${idx}', v => updateTaskNote(${idx}, v))">🎤</button>
            </div>`}
        </div>`;
    }).join('');
    setTimeout(triggerAllAutoGrows, 15);
}

function updateTaskDurationSelect(idx, val) {
    pushUndo('تعديل مدة مهمة');
    const t = getDayLog().tasks[idx];
    t.dur = val;
    logSectionHistory('tasks', 'edit', `مدة ${t.zones}: ${val}`, { taskId: t.id });
    saveState(); renderTasks(getDayLog());
}

function updateTaskDesc(idx, val) {
    pushUndo('تعديل وصف مهمة');
    const t = getDayLog().tasks[idx];
    const res = applySpellAndDictationGuard(val);
    t.desc = res.text;
    t.isTanker = t.desc.toLowerCase().includes('tanker');
    if (t.isTanker && !t.tankerCapacity) { t.tankerCapacity = TANKER_FULL_CAPACITY; t.tankerTrips = 1; }
    logSectionHistory('tasks', 'edit', `تعديل وصف ${t.zones}: ${t.desc}`, { taskId: t.id });
    saveState(); renderTasks(getDayLog());
}
function applyIrrPreset(idx, txt, dur) {
    pushUndo('تغيير نوع الري');
    const t = getDayLog().tasks[idx];
    t.desc = txt; t.dur = dur;
    t.isTanker = txt.toLowerCase().includes('tanker');
    if (t.isTanker && !t.tankerCapacity) { t.tankerCapacity = TANKER_FULL_CAPACITY; t.tankerTrips = 1; }
    logSectionHistory('tasks', 'edit', `${t.zones}: ${txt}`, { taskId: t.id });
    saveState(); renderTasks(getDayLog());
}
function splitTaskZones(idx) {
    const log = getDayLog();
    const t = log.tasks[idx];
    const zones = (t.zones || '').split(',').map(s => s.trim()).filter(Boolean);
    if (zones.length <= 1) return;
    pushUndo('تفريق مناطق مهمة');
    const expanded = zones.map((z, i) => ({
        ...JSON.parse(JSON.stringify(t)),
        id: 't_' + Date.now() + '_' + i,
        zones: z,
        photos: i === 0 ? ensurePhotosArr(t) : [],
        startTimeMs: null
    }));
    log.tasks.splice(idx, 1, ...expanded);
    logSectionHistory('tasks', 'split', `تفريق ${t.zones} إلى ${zones.length} بطاقات مستقلة`, {});
    saveState(); renderTasks(log); showToast(`✂️ تم تفريق المهمة إلى ${zones.length} مناطق`);
}
function duplicateTask(idx) {
    pushUndo('نسخ مهمة');
    const log = getDayLog();
    const copy = JSON.parse(JSON.stringify(log.tasks[idx]));
    copy.id = 't_' + Date.now();
    copy.photos = [];
    copy.startTimeMs = null;
    log.tasks.splice(idx + 1, 0, copy);
    logSectionHistory('tasks', 'add', `نسخ مهمة: ${copy.zones} (${copy.desc})`, { taskId: copy.id });
    saveState(); renderTasks(log); showToast('📋 تم نسخ المهمة');
}
function createReplacementTankerTask(idx) {
    pushUndo('إنشاء مهمة تنكر بديلة');
    const log = getDayLog();
    const orig = log.tasks[idx];
    const tid = 't_' + Date.now();
    log.tasks.splice(idx + 1, 0, {
        id: tid,
        task: 'Irrigation  /  ري المنطقة',
        desc: 'Irrigating the area using a water tanker',
        zones: orig.zones,
        dur: '1:00 hr',
        status: 'Not Started / لم يبدأ',
        workers: [...(orig.workers || [])],
        note: '',
        isTanker: true,
        tankerCapacity: TANKER_FULL_CAPACITY,
        tankerLiters: '',
        tankerPpm: '',
        tankerVisual: 'Clear / صافية',
        tankerTrips: 1,
        agroName: '', agroDose: '', photos: [], startTimeMs: null, actualDuration: ''
    });
    logSectionHistory('tasks', 'add', `تعويض تنكر لـ ${orig.zones} (24,000 L)`, { taskId: tid });
    syncIrrigatedZonesFromTasks(false);
    saveState(); renderTasks(log); showToast(`🚚 تم إنشاء مهمة تنكر بديلة لمنطقة ${orig.zones}`);
}
function refillTankerTrip(idx) {
    pushUndo('إعادة تعبئة التنكر');
    const t = getDayLog().tasks[idx];
    t.tankerTrips = (t.tankerTrips || 1) + 1;
    t.tankerCapacity = TANKER_FULL_CAPACITY;
    t.tankerLiters = '';
    t.note = '';
    logSectionHistory('tasks', 'tanker', `تعبئة نقلة #${t.tankerTrips} لـ ${t.zones}`, { taskId: t.id });
    saveState(); renderTasks(getDayLog()); showToast(`🔄 تم تسجيل نقلة #${t.tankerTrips} بسعة 24,000 لتر`);
}

function openZonePickerModal(tIdx) {
    const site = getSite();
    const t = getDayLog().tasks[tIdx];
    const current = new Set((t.zones || '').split(',').map(s => s.trim()).filter(Boolean));
    openModal(`
        <h3 class="card-title">📍 تعديل مناطق المهمة</h3>
        <div style="max-height:220px;overflow-y:auto;margin-bottom:10px;border:1px solid var(--border);border-radius:8px;padding:8px;">
            ${site.zones.map(z => `<span class="chip ${current.has(z) ? 'active' : ''}" onclick="this.classList.toggle('active')" data-z="${esc(z)}">${esc(z)}</span>`).join('')}
        </div>
        <label class="lbl">أو اكتب مناطق مخصصة (مفصولة بفاصلة):</label>
        <div class="inp-wrap">
            <input id="customZonesInp" class="inp" value="${esc(t.zones)}">
            <button class="clr-btn" onclick="quickClearField('customZonesInp')">✕</button>
        </div>
        <div class="grid-2"><button class="btn btn-green" onclick="savePickedZones(${tIdx})">تحديث</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
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
    if (val) {
        pushUndo('تعديل مناطق مهمة');
        const t = getDayLog().tasks[tIdx];
        t.zones = val;
        logSectionHistory('tasks', 'edit', `تعديل مناطق إلى: ${val}`, { taskId: t.id });
    }
    syncIrrigatedZonesFromTasks(false);
    closeModal(); saveState(); renderTasks(getDayLog());
}

function setTaskStatus(idx, st) {
    pushUndo('تغيير حالة مهمة');
    const t = getDayLog().tasks[idx];
    const oldSt = t.status;
    t.status = st;
    const now = Date.now();
    
    if (st.includes('Progress') && !oldSt.includes('Progress')) {
        t.startTimeMs = now;
        showToast('▶️ تم بدء المؤقت للمهمة');
    } else if (st.includes('Completed') && oldSt.includes('Progress') && t.startTimeMs) {
        const diffMins = Math.floor((now - t.startTimeMs) / 60000);
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        t.dur = `${h}:${String(m).padStart(2, '0')} hr`;
        t.startTimeMs = null;
        showToast(`⏹️ اكتملت بعد ${diffMins} دقيقة`);
    } else if (!st.includes('Progress')) {
        t.startTimeMs = null;
    }

    if (st.includes('Not Started') && (!t.note || t.note === 'Not included in the current irrigation plan for today')) {
        t.note = '';
    } else if (st.includes('Not Started') && t.note) {
        t.note = ''; 
    }

    logSectionHistory('tasks', 'status', `${st.split('/')[1] || st}: ${t.zones} (${t.desc})`, { taskId: t.id });
    syncIrrigatedZonesFromTasks(false);
    saveState(); renderTasks(getDayLog());
}

function updateTaskNote(idx, v) {
    const t = getDayLog().tasks[idx];
    const res = applySpellAndDictationGuard(v);
    t.note = res.text;
    if (res.changed) showToast('✨ تم تصحيح المصطلح الإنجليزي تلقائياً');
    saveState(); renderTasks(getDayLog());
}
function setTaskNoteChip(idx, v) { pushUndo('تعديل سبب توقف'); getDayLog().tasks[idx].note = v; saveState(); renderTasks(getDayLog()); }
function deleteTask(idx) {
    pushUndo('حذف مهمة');
    const t = getDayLog().tasks[idx];
    getDayLog().tasks.splice(idx, 1);
    logSectionHistory('tasks', 'delete', `حذف مهمة: ${t.zones} (${t.desc})`, {});
    syncIrrigatedZonesFromTasks(false);
    saveState(); renderTasks(getDayLog());
}

function openTaskModal() {
    openModal(`
        <h3 class="card-title">📋 إضافة مهمة جديدة</h3>
        <label class="lbl">نوع المهمة:</label>
        <div class="inp-wrap">
            <input id="mTaskType" list="globalTasksList" class="inp" value="Irrigation  /  ري المنطقة">
            <button class="clr-btn" onclick="quickClearField('mTaskType')">✕</button>
        </div>
        <label class="lbl">وصف مختصر:</label>
        <div class="inp-wrap" style="margin-bottom:5px;">
            <textarea id="mTaskDesc" class="inp auto-grow" rows="2" placeholder="مثلاً: Drip only أو تفاصيل العمل..."></textarea>
            <button class="clr-btn top-align" onclick="quickClearField('mTaskDesc')">✕</button>
        </div>
        <div style="margin-bottom:6px;">
            ${IRR_DESC_PRESETS.map(pr => `<span class="chip" onclick="document.getElementById('mTaskDesc').value='${esc(pr.text)}';document.getElementById('mTaskDurSel').value='${pr.dur}';document.getElementById('mTaskTanker').checked=${pr.text.includes('tanker')};">${pr.label}</span>`).join('')}
        </div>
        <label class="lbl">المنطقة / المناطق:</label>
        <div class="inp-wrap">
            <input id="mTaskZones" list="globalZonesList" class="inp" placeholder="مثلاً: AR5 أو B1, B2">
            <button class="clr-btn" onclick="quickClearField('mTaskZones')">✕</button>
        </div>
        <div class="grid-2">
            <div>
                <label class="lbl">المدة:</label>
                <div style="display:flex;gap:4px;">
                    ${buildDurationSelectHtml('1:00 hr', 'mTaskDurSel', '')}
                    <button class="btn btn-outline btn-sm" style="height:37px;" onclick="openCustomTimeModal('select_el', 0, 'mTaskDurSel')">⏱️</button>
                </div>
            </div>
            <div style="display:flex;align-items:center;padding-top:14px;">
                <label style="font-size:12px;font-weight:bold;"><input type="checkbox" id="mTaskTanker"> ري بالتنكر 🚚 (24,000 L)</label>
            </div>
        </div>
        <div class="grid-2" style="margin-top:8px;"><button class="btn btn-green" onclick="saveNewTask()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveNewTask() {
    const rawTask = document.getElementById('mTaskType').value.trim() || 'Other  /  أخرى';
    const desc = applySpellAndDictationGuard(document.getElementById('mTaskDesc').value.trim()).text;
    const zones = document.getElementById('mTaskZones').value.trim() || 'عام / General';
    const dur = document.getElementById('mTaskDurSel').value || '1:00 hr';
    const isTanker = document.getElementById('mTaskTanker').checked || desc.toLowerCase().includes('tanker');
    const isStandard = MASTER_TASKS.includes(rawTask);
    const finalDesc = isStandard ? desc : (desc ? `${rawTask} — ${desc}` : rawTask);
    const tid = 't_' + Date.now();
    pushUndo('إضافة مهمة: ' + zones);
    getDayLog().tasks.push({
        id: tid,
        task: isStandard ? rawTask : 'Other  /  أخرى',
        desc: finalDesc,
        zones, dur, status: 'Not Started / لم يبدأ', workers: [], note: '',
        isTanker, tankerCapacity: isTanker ? TANKER_FULL_CAPACITY : '', tankerLiters: '', tankerPpm: '', tankerVisual: 'Clear / صافية', tankerTrips: 1,
        agroName: '', agroDose: '', photos: [], startTimeMs: null
    });
    logSectionHistory('tasks', 'add', `إضافة مهمة: ${zones} (${finalDesc})`, { taskId: tid });
    syncIrrigatedZonesFromTasks(false);
    closeModal(); saveState(); renderTasks(getDayLog()); showToast('✓ تمت إضافة المهمة لقائمة القادم');
}

function openAssignWorkersModal(tIdx) {
    const log = getDayLog();
    const task = log.tasks[tIdx];
    const presentWorkers = log.attendance.filter(w => !w.status.includes('Absent'));
    openModal(`
        <h3 class="card-title">👷 تحديد العمال المنفذين</h3>
        <button class="btn btn-blue btn-full" style="margin-bottom:8px;" onclick="document.querySelectorAll('.wk-chk').forEach(c=>c.checked=true)">👥 الفريق بالكامل (Team)</button>
        <div style="margin-bottom:10px;">
            ${presentWorkers.map(w => {
                const shortName = (w.name.split('/')[1] || w.name).trim();
                const checked = task.workers.includes(shortName) || task.workers.includes('Team');
                const tCnt = log.tasks.filter(t => (t.workers||[]).includes(shortName)).length;
                return `<label style="display:block;padding:8px;border-bottom:1px solid #f1f5f9;font-size:13px;font-weight:bold;">
                    <input type="checkbox" class="wk-chk" value="${esc(shortName)}" ${checked ? 'checked' : ''}> ${esc(shortName)} <span style="font-size:10px;color:var(--muted);">(${tCnt} مهام)</span>
                </label>`;
            }).join('')}
        </div>
        <div class="grid-2"><button class="btn btn-green" onclick="saveAssignedWorkers(${tIdx})">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveAssignedWorkers(tIdx) {
    pushUndo('تعيين عمال لمهمة');
    const t = getDayLog().tasks[tIdx];
    const chks = Array.from(document.querySelectorAll('.wk-chk:checked'));
    const allCnt = document.querySelectorAll('.wk-chk').length;
    if (chks.length === allCnt && allCnt > 1) {
        t.workers = ['Team'];
    } else {
        t.workers = chks.map(c => c.value);
    }
    logSectionHistory('tasks', 'workers', `عمال ${t.zones}: ${t.workers.join(' / ')}`, { taskId: t.id });
    closeModal(); saveState(); renderTasks(getDayLog());
}

/* ================= Tanker Pre-Start (24,000 L Capacity) & Finish Dispensed Modals ================= */
function getPreviousTankerRemaining(currentIdx) {
    const tasks = getDayLog().tasks;
    for (let i = currentIdx - 1; i >= 0; i--) {
        const pt = tasks[i];
        if (pt.isTanker && parseFloat(pt.tankerCapacity) > 0) {
            const rem = parseFloat(pt.tankerCapacity) - (parseFloat(pt.tankerLiters) || 0);
            if (rem > 0) return rem;
        }
    }
    return null;
}

function openTankerPreModal(tIdx) {
    const t = getDayLog().tasks[tIdx];
    const prevRem = getPreviousTankerRemaining(tIdx);
    openModal(`
        <h3 class="card-title">🚚 سعة التنكر قبل البدء (السعة الكاملة 24,000 L)</h3>
        <p style="font-size:12px;color:var(--muted);">حدد كمية الماء المتوفرة داخل الحوضية قبل بدء ري منطقة <b>${esc(t.zones)}</b>:</p>
        <div style="margin-bottom:8px;">
            <span class="chip" onclick="document.getElementById('tkCap').value=24000">كامل (24,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkCap').value=18000">ثلاثة أرباع (18,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkCap').value=12000">نصف (12,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkCap').value=6000">ربع (6,000 L)</span>
            ${prevRem ? `<span class="chip active" onclick="document.getElementById('tkCap').value=${prevRem}">المتبقي من السابق (${prevRem.toLocaleString()} L)</span>` : ''}
        </div>
        <div class="inp-wrap">
            <input type="number" id="tkCap" class="inp" value="${esc(t.tankerCapacity || 24000)}" placeholder="أدخل السعة باللتر...">
            <button class="clr-btn" onclick="quickClearField('tkCap')">✕</button>
        </div>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="saveTankerPreCapacity(${tIdx})">حفظ السعة</button>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `);
}
function saveTankerPreCapacity(tIdx) {
    pushUndo('تحديد سعة التنكر قبل البدء');
    const t = getDayLog().tasks[tIdx];
    t.tankerCapacity = parseFloat(document.getElementById('tkCap').value) || 0;
    logSectionHistory('tasks', 'tanker', `سعة التنكر لـ ${t.zones}: ${t.tankerCapacity.toLocaleString()} L`, { taskId: t.id });
    closeModal(); saveState(); renderTasks(getDayLog());
}

function openTankerFinishModal(tIdx) {
    const t = getDayLog().tasks[tIdx];
    const cap = parseFloat(t.tankerCapacity) || 24000;
    openModal(`
        <h3 class="card-title">💧 تسجيل كمية الصرف عند الانتهاء</h3>
        <p style="font-size:12px;color:var(--muted);">السعة المسجلة قبل البدء: <b>${cap.toLocaleString()} L</b></p>
        <label class="lbl">الكمية المصروفة فعلياً (لتر):</label>
        <div style="margin-bottom:8px;">
            <span class="chip" onclick="document.getElementById('tkDisp').value=${cap}">صرف كامل السعة (${cap.toLocaleString()} L)</span>
            <span class="chip" onclick="document.getElementById('tkDisp').value=18000">ثلاثة أرباع (18,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkDisp').value=12000">نصف (12,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkDisp').value=6000">ربع (6,000 L)</span>
            <span class="chip" onclick="document.getElementById('tkDisp').value=10000">10,000 L</span>
        </div>
        <div class="inp-wrap">
            <input type="number" id="tkDisp" class="inp" value="${esc(t.tankerLiters || cap)}" placeholder="كمية الصرف باللتر...">
            <button class="clr-btn" onclick="quickClearField('tkDisp')">✕</button>
        </div>
        <label class="lbl">الملوحة (PPM):</label>
        <div class="inp-wrap">
            <input type="number" id="tkPpm" class="inp" value="${esc(t.tankerPpm)}" placeholder="مثلاً: 780">
            <button class="clr-btn" onclick="quickClearField('tkPpm')">✕</button>
        </div>
        <label class="lbl">نقاوة الماء:</label>
        <select id="tkVis" class="inp">
            <option value="Clear / صافية" ${t.tankerVisual === 'Clear / صافية' ? 'selected' : ''}>Clear / صافية</option>
            <option value="Turbid / عكرة" ${t.tankerVisual === 'Turbid / عكرة' ? 'selected' : ''}>Turbid / عكرة</option>
            <option value="Sediment / رواسب" ${t.tankerVisual === 'Sediment / رواسب' ? 'selected' : ''}>Sediment / رواسب</option>
        </select>
        <div class="grid-2"><button class="btn btn-green" onclick="saveTankerDispensed(${tIdx})">اعتماد الصرف</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveTankerDispensed(tIdx) {
    pushUndo('تسجيل كمية صرف التنكر');
    const t = getDayLog().tasks[tIdx];
    if (!t.tankerCapacity) t.tankerCapacity = TANKER_FULL_CAPACITY;
    t.tankerLiters = parseFloat(document.getElementById('tkDisp').value) || 0;
    t.tankerPpm = document.getElementById('tkPpm').value.trim();
    t.tankerVisual = document.getElementById('tkVis').value;
    if (t.tankerLiters > 0) {
        t.note = `${t.tankerPpm ? t.tankerPpm + ' ppm \\ ' : ''}${Number(t.tankerLiters).toLocaleString()} L`;
        logSectionHistory('tasks', 'tanker', `صرف تنكر ${t.zones}: ${t.note}`, { taskId: t.id });
    }
    closeModal(); saveState(); renderTasks(getDayLog()); renderReadingsAndTools(getDayLog());
}

function openAgroModal(tIdx) {
    const t = getDayLog().tasks[tIdx];
    openModal(`
        <h3 class="card-title">🧪 سجل الأسمدة والمبيدات</h3>
        <label class="lbl">اسم السماد أو المبيد:</label>
        <div class="inp-wrap"><input id="agName" class="inp" value="${esc(t.agroName)}" placeholder="مثلاً: NPK 20-20-20"><button class="clr-btn" onclick="quickClearField('agName')">✕</button></div>
        <label class="lbl">الكمية / الجرعة:</label>
        <div class="inp-wrap"><input id="agDose" class="inp" value="${esc(t.agroDose)}" placeholder="مثلاً: 2 كغم"><button class="clr-btn" onclick="quickClearField('agDose')">✕</button></div>
        <div class="grid-2"><button class="btn btn-green" onclick="saveAgroData(${tIdx})">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveAgroData(tIdx) {
    pushUndo('تسجيل جرعة سماد/مبيد');
    const t = getDayLog().tasks[tIdx];
    t.agroName = document.getElementById('agName').value.trim();
    t.agroDose = document.getElementById('agDose').value.trim();
    if (t.agroName) {
        t.note = `المادة: ${t.agroName} (${t.agroDose})`;
        getDayLog().tools.push({ name: t.agroName, cat: 'Materials / مادة', qty: 1, cond: 'Good / جيد', note: t.agroDose });
        logSectionHistory('tasks', 'agro', `تسميد/علاج ${t.zones}: ${t.agroName}`, { taskId: t.id });
    }
    closeModal(); saveState(); renderTasks(getDayLog()); renderReadingsAndTools(getDayLog());
}

function openPlanEditorModal() {
    const site = getSite();
    const dayEn = getDayNameEn(state.activeDate);
    const items = (site.plan && site.plan[dayEn]) || [];
    openModal(`
        <h3 class="card-title">🗓️ تعديل خطة الري ليوم (${dayEn})</h3>
        <div style="max-height:180px;overflow-y:auto;margin-bottom:10px;">
            ${items.map((it, i) => `
                <div class="meter-card" style="padding:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <b style="font-size:12px;">${esc(it.zones)} — ${esc(it.dur)}</b>
                        <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="removePlanItem('${dayEn}', ${i})">🗑️</button>
                    </div>
                    <div style="font-size:11px;color:var(--muted);">${esc(it.desc)}</div>
                </div>
            `).join('') || '<div style="font-size:12px;color:var(--muted);">لا توجد مهام مجدولة</div>'}
        </div>
        <label class="lbl">إضافة بند ليوم ${dayEn}:</label>
        <input id="plZones" list="globalZonesList" class="inp" placeholder="المناطق (مثلاً: B1, B2)">
        <input id="plDesc" class="inp" placeholder="الوصف (مثلاً: Drip only)">
        <div class="grid-2">
            <div>
                <label class="lbl">المدة:</label>
                <div style="display:flex;gap:4px;">
                    ${buildDurationSelectHtml('1:00 hr', 'plDurSel', '')}
                    <button class="btn btn-outline btn-sm" style="height:37px;" onclick="openCustomTimeModal('select_el', 0, 'plDurSel')">⏱️</button>
                </div>
            </div>
            <div style="display:flex;align-items:center;padding-top:14px;"><label style="font-size:12px;font-weight:bold;"><input type="checkbox" id="plTanker"> تنكر 🚚</label></div>
        </div>
        <div class="grid-2" style="margin-top:8px;"><button class="btn btn-green" onclick="addPlanItem('${dayEn}')">+ إضافة</button><button class="btn btn-outline" onclick="closeModal()">إغلاق</button></div>
    `);
}
function addPlanItem(dayEn) {
    const site = getSite();
    if (!site.plan) site.plan = {};
    if (!site.plan[dayEn]) site.plan[dayEn] = [];
    const zones = document.getElementById('plZones').value.trim();
    if (!zones) return;
    site.plan[dayEn].push({ task: 'Irrigation  /  ري المنطقة', desc: document.getElementById('plDesc').value.trim() || 'Drip only', zones, dur: document.getElementById('plDurSel').value || '1:00 hr', isTanker: document.getElementById('plTanker').checked });
    saveState(); openPlanEditorModal();
}
function removePlanItem(dayEn, idx) { getSite().plan[dayEn].splice(idx, 1); saveState(); openPlanEditorModal(); }

/* ================= TAB 3: Readings, Separated Moisture (5A) & Perf (5C), Tools ================= */
function jumpToMeters() { switchTab('tools'); window.scrollTo(0, 0); }

function renderReadingsAndTools(log) {
    renderStickySectionHistory('tools', 'stickyHist-tools', 'القراءات والأدوات');
    document.getElementById('moistureContainer').innerHTML = log.moisture.map((mo, idx) => `
        <div style="display:flex;gap:5px;margin-bottom:5px;">
            <input list="globalZonesList" class="inp" style="margin:0;padding:6px;flex:1;" value="${esc(mo.zone)}" placeholder="المنطقة ${mo.id}" onchange="updateMoisture(${idx},'zone',this.value)">
            <input type="number" class="inp" style="margin:0;padding:6px;width:72px;" value="${esc(mo.pct)}" placeholder="%" onchange="updateMoisture(${idx},'pct',this.value)">
            <input class="inp" style="margin:0;padding:6px;flex:1;" value="${esc(mo.note || '')}" placeholder="ملاحظة" onchange="updateMoisture(${idx},'note',this.value)">
        </div>
    `).join('');

    let totalTankerL = 0; let totalTrips = 0;
    log.tasks.forEach(t => { if (parseFloat(t.tankerLiters) > 0) { totalTankerL += parseFloat(t.tankerLiters); totalTrips += (t.tankerTrips || 1); } });
    
    const anyFaulty = log.meters.some(m => m.status === 'faulty');
    document.getElementById('tankerSummaryBox').innerHTML = (totalTankerL > 0 || anyFaulty) ? `
        <div class="tanker-banner" style="margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">
            <span>🚚 الإجمالي: ${totalTankerL.toLocaleString()} L (${(totalTankerL / 1000).toFixed(1)} m³) | ${totalTrips} نقلات</span>
            ${anyFaulty ? `<span style="color:var(--red);">⚠️ عداد عاطل</span>` : ''}
        </div>` : '';

    document.getElementById('metersContainer').innerHTML = log.meters.map((m, idx) => {
        const isFaulty = m.status === 'faulty';
        const usage = (!isFaulty && m.curr !== '' && !isNaN(parseFloat(m.curr))) ? (parseFloat(m.curr) - parseFloat(m.prev || 0)).toFixed(2) : '-';
        const mPhotos = ensurePhotosArr(m);
        return `
        <div class="meter-card ${isFaulty ? 'faulty' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:4px;flex-wrap:wrap;">
                <b style="font-size:13px;" onclick="renameMeter(${idx})">${esc(m.name)} ✏️</b>
                <div style="display:flex;gap:3px;">
                    <button class="btn btn-sm ${!isFaulty ? 'btn-green' : 'btn-outline'}" onclick="setMeterStatus(${idx},'working')">شغال</button>
                    <button class="btn btn-sm ${isFaulty ? 'btn-red' : 'btn-outline'}" onclick="setMeterStatus(${idx},'faulty')">عاطل</button>
                    <button class="btn btn-sm btn-blue" onclick="openPhotoSourceChoice('meter', ${idx})">📸 (${mPhotos.length})</button>
                    <button class="btn btn-sm btn-outline" onclick="clearMeterReading(${idx})" title="مسح القراءة">🧹</button>
                    <button class="btn btn-sm btn-outline" style="color:var(--red);" onclick="deleteMeter(${idx})" title="حذف">🗑️</button>
                </div>
            </div>
            ${!isFaulty ? `
            <div class="grid-2" style="font-size:12px;">
                <div><label class="lbl">السابق:</label><input type="number" class="inp" style="margin:0;padding:6px;" value="${esc(m.prev)}" onchange="updateMeterField(${idx},'prev',this.value)"></div>
                <div><label class="lbl">الحالي (الاستهلاك: ${usage} m³):</label><input type="number" class="inp" style="margin:0;padding:6px;" value="${esc(m.curr)}" onchange="updateMeterField(${idx},'curr',this.value)"></div>
            </div>` : `
            <input class="inp" style="margin:0;background:white;font-size:12px;" value="${esc(m.note)}" placeholder="وصف عطل العداد..." onchange="updateMeterField(${idx},'note',this.value)">`}
            ${mPhotos.length > 0 ? `
            <div class="photo-strip">
                ${mPhotos.map((pUrl, pI) => `
                    <div class="photo-item-wrap">
                        <img src="${pUrl}" class="photo-thumb" onclick="previewSinglePhoto('${pUrl}')">
                        <button class="photo-del-badge" onclick="removePhotoFromItem('meter', ${idx}, ${pI})">✕</button>
                    </div>
                `).join('')}
            </div>` : ''}
        </div>`;
    }).join('');

    document.getElementById('irrigatedZonesInput').value = log.perf.zonesIrrigated || '';
    document.getElementById('sysStatusSelect').value = log.perf.status || 'جيد';

    const durSel = document.getElementById('sysDurationSelect');
    const curDur = log.perf.duration || '';
    const perfOpts = ['', '0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '6.0'];
    durSel.innerHTML = (curDur && !perfOpts.includes(String(curDur)) ? `<option value="${esc(curDur)}" selected>${esc(curDur)} س</option>` : '') +
        perfOpts.map(v => `<option value="${v}" ${String(curDur) === v ? 'selected' : ''}>${v ? v + ' ساعة' : 'اختر المدة...'}</option>`).join('');

    document.getElementById('pressureNotesInput').value = log.perf.pressureNotes || '';
    document.getElementById('sysNotesInput').value = log.perf.notes || '';

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

function onSysDurationSelect(val) { updatePerfField('duration', val); }
function setMeterStatus(idx, st) {
    pushUndo('تغيير حالة عداد');
    const m = getDayLog().meters[idx];
    m.status = st;
    logSectionHistory('tools', 'meter', `حالة عداد ${m.name}: ${st === 'working' ? 'شغال' : 'عاطل'}`, { meterId: m.id });
    saveState(); renderReadingsAndTools(getDayLog());
}
function updateMeterField(idx, k, v) {
    pushUndo('تحديث قراءة عداد');
    const m = getDayLog().meters[idx];
    m[k] = v;
    if (k === 'curr' && v !== '' && getSite().meters[idx]) getSite().meters[idx].lastReading = parseFloat(v);
    logSectionHistory('tools', 'meter', `قراءة ${m.name}: ${v}`, { meterId: m.id });
    saveState(); renderReadingsAndTools(getDayLog());
}
function clearMeterReading(idx) { pushUndo('مسح قراءة عداد'); getDayLog().meters[idx].curr = ''; getDayLog().meters[idx].photos = []; saveState(); renderReadingsAndTools(getDayLog()); showToast('🧹 تم مسح قراءة العداد'); }
function renameMeter(idx) {
    const n = prompt('تعديل اسم العداد:', getDayLog().meters[idx].name);
    if (n && n.trim()) { pushUndo('تعديل اسم عداد'); getDayLog().meters[idx].name = n.trim(); if (getSite().meters[idx]) getSite().meters[idx].name = n.trim(); saveState(); renderReadingsAndTools(getDayLog()); }
}
function deleteMeter(idx) {
    if (confirm('حذف هذا العداد نهائياً من الموقع؟')) { pushUndo('حذف عداد'); getDayLog().meters.splice(idx, 1); getSite().meters.splice(idx, 1); saveState(); renderReadingsAndTools(getDayLog()); showToast('🗑️ تم حذف العداد'); }
}
function addCustomMeter() {
    const name = prompt('اسم عداد المياه الجديد:');
    if (!name) return;
    pushUndo('إضافة عداد: ' + name);
    const id = 'm_' + Date.now();
    getSite().meters.push({ id, name, lastReading: 0 });
    getDayLog().meters.push({ id, name, status: 'working', prev: 0, curr: '', visual: 'Clear / صافية', note: '', photos: [] });
    logSectionHistory('tools', 'meter', `إضافة عداد: ${name}`, { meterId: id });
    saveState(); renderReadingsAndTools(getDayLog());
}
function updateGaugeVal(idx, v) {
    pushUndo('تحديث قراءة مقياس ضغط');
    const g = getDayLog().gauges[idx];
    g.val = v;
    logSectionHistory('tools', 'gauge', `ضغط ${g.name}: ${v} bar`, { gaugeId: g.id });
    saveState(); renderReadingsAndTools(getDayLog());
}
function deleteGauge(idx) { if (confirm('حذف مقياس الضغط؟')) { pushUndo('حذف مقياس ضغط'); getDayLog().gauges.splice(idx, 1); getSite().gauges.splice(idx, 1); saveState(); renderReadingsAndTools(getDayLog()); } }
function addCustomGauge() {
    const name = prompt('اسم مقياس الضغط الجديد:');
    if (!name) return;
    pushUndo('إضافة مقياس: ' + name);
    const id = 'g_' + Date.now();
    getSite().gauges.push({ id, name, normal: 2.0 });
    getDayLog().gauges.push({ id, name, normal: 2.0, val: '', note: '' });
    saveState(); renderReadingsAndTools(getDayLog());
}
function updateMachinery(k, v) { getDayLog().machinery[k] = v; saveState(); }
function updatePerfField(k, v) {
    const log = getDayLog();
    const res = applySpellAndDictationGuard(v);
    log.perf[k] = res.text;
    if (k === 'zonesIrrigated') log.perf.zonesManualEdit = true;
    saveState();
}
function setPerfNotePreset(txt) { getDayLog().perf.notes = txt; saveState(); renderReadingsAndTools(getDayLog()); }
function updateMoisture(idx, k, v) { getDayLog().moisture[idx][k] = v; saveState(); }
function copyYesterdayTools() {
    const site = getSite();
    const prevDate = Object.keys(site.logs).sort().filter(d => d < state.activeDate).pop();
    const sourceTools = (prevDate && site.logs[prevDate].tools.length) ? site.logs[prevDate].tools : DEFAULT_TOOLS;
    pushUndo('نسخ أدوات الأمس');
    getDayLog().tools = JSON.parse(JSON.stringify(sourceTools));
    logSectionHistory('tools', 'copy', `نسخ ${sourceTools.length} معدات/أدوات`, {});
    saveState(); renderReadingsAndTools(getDayLog()); showToast('📋 تم نسخ قائمة الأدوات');
}
function clearTodayTools() { if (confirm('مسح جميع الأدوات المسجلة اليوم؟')) { pushUndo('مسح أدوات اليوم'); getDayLog().tools = []; saveState(); renderReadingsAndTools(getDayLog()); } }
function editToolQty(idx) {
    const q = prompt('الكمية الجديدة:', getDayLog().tools[idx].qty);
    if (q !== null && !isNaN(parseFloat(q))) { pushUndo('تعديل كمية أداة'); getDayLog().tools[idx].qty = parseFloat(q); saveState(); renderReadingsAndTools(getDayLog()); }
}
function openToolModal() {
    openModal(`
        <h3 class="card-title">🧰 إضافة معدة / أداة / مادة</h3>
        <label class="lbl">الاسم:</label>
        <div class="inp-wrap"><input id="tlName" list="globalToolsList" class="inp" placeholder="مثلاً: اكياس نفايات..."><button class="clr-btn" onclick="quickClearField('tlName')">✕</button></div>
        <div class="grid-2">
            <div><label class="lbl">الفئة:</label><select id="tlCat" class="inp"><option value="Equipment / معدة">Equipment / معدة</option><option value="Tool / أداة">Tool / أداة</option><option value="Materials / مادة">Materials / مادة</option></select></div>
            <div><label class="lbl">الكمية:</label><input type="number" id="tlQty" class="inp" value="1"></div>
        </div>
        <label class="lbl">الحالة:</label>
        <select id="tlCond" class="inp"><option value="Good / جيد">Good / جيد</option><option value="Needs Maintenance / يحتاج صيانة">Needs Maintenance</option><option value="Out of Service / خارج الخدمة">Out of Service</option></select>
        <div class="grid-2"><button class="btn btn-green" onclick="saveNewTool()">إضافة</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveNewTool() {
    const name = document.getElementById('tlName').value.trim();
    if (!name) return;
    pushUndo('إضافة أداة: ' + name);
    const qty = parseFloat(document.getElementById('tlQty').value) || 1;
    const tIdx = getDayLog().tools.length;
    getDayLog().tools.push({ name, cat: document.getElementById('tlCat').value, qty, cond: document.getElementById('tlCond').value, note: '' });
    if (!state.company.customTools.includes(name)) state.company.customTools.push(name);
    logSectionHistory('tools', 'add', `إضافة أداة: ${name} (×${qty})`, { toolIdx: tIdx });
    closeModal(); saveState(); renderReadingsAndTools(getDayLog());
}
function deleteTool(idx) { pushUndo('حذف أداة'); getDayLog().tools.splice(idx, 1); saveState(); renderReadingsAndTools(getDayLog()); }

/* ================= TAB 4: Plant Inventory, Multi-Photo, Filters & Master Summary ================= */
function setInvFilter(val) {
    invFilterState = val;
    document.querySelectorAll('.inv-filter-bar .chip').forEach(c => c.classList.remove('active'));
    const el = document.getElementById('f_' + val);
    if(el) el.classList.add('active');
    renderInventory(getSite());
}

function renderInventory(site) {
    renderStickySectionHistory('inv', 'stickyHist-inv', 'الجرد');
    const invBox = document.getElementById('invContainer');
    const alphaBox = document.getElementById('alphaScroller');

    if (!activeInvZoneId) {
        alphaBox.innerHTML = '';
        invBox.innerHTML = `
            <div class="card">
                <div class="card-head">
                    <h3 class="card-title">🌿 مناطق الجرد (${site.inventory.length})</h3>
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn-blue btn-sm" onclick="openInventoryMasterSummary()">📊 ملخص الجرد</button>
                        <button class="btn btn-green btn-sm" onclick="addInvZone()">+ منطقة</button>
                    </div>
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

    let filteredPlants = zone.plants;
    if (invFilterState === 'warn') {
        filteredPlants = zone.plants.filter(p => Object.keys(p.counts).some(k => k !== 'c1' && p.counts[k] > 0));
    } else if (invFilterState === 'today') {
        filteredPlants = zone.plants.filter(p => (p.entries||[]).some(e => e.date === state.activeDate));
    }

    invBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-blue btn-sm" onclick="exitInvZone()">➡️ المناطق</button>
            <b>📍 ${esc(zone.name)} (${zone.plants.length})</b>
            <div style="display:flex;gap:4px;">
                <button class="btn btn-outline btn-sm" onclick="copySpeciesFromZone()">📋 نسخ أصناف</button>
                <button class="btn btn-outline btn-sm" onclick="sortZonePlants()">🔤</button>
            </div>
        </div>
        ${filteredPlants.length === 0 ? `<div style="text-align:center;color:var(--muted);padding:20px;">لا توجد نباتات تطابق الفلتر الحالي</div>` : ''}
        ${filteredPlants.map(p => {
            const pIdx = zone.plants.findIndex(x => x.id === p.id);
            const total = Object.values(p.counts).reduce((a, b) => a + (b || 0), 0);
            const hArr = (p.entries || []).map(e => parseFloat(e.height)).filter(n => !isNaN(n) && n > 0);
            const avgH = hArr.length ? (hArr.reduce((a, b) => a + b, 0) / hArr.length).toFixed(2) : null;
            const todayPhotoCnt = (p.entries || []).filter(e => e.date === state.activeDate).reduce((s, e) => s + ensurePhotosArr(e).length, 0);
            return `
            <div class="plant-box" id="pbox_${p.id}">
                <div style="display:flex;gap:4px;margin-bottom:8px;">
                    <input list="globalPlantsList" class="inp" style="margin:0;font-weight:bold;font-size:15px;" value="${esc(p.name)}" onchange="renameInvPlant(${pIdx}, this.value)">
                    <button class="btn btn-outline btn-sm" onclick="openPlantSeqLogModal(${pIdx})">📜 (${(p.entries || []).length})</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteInvPlant(${pIdx})">✕</button>
                </div>
                <div style="font-size:12px;color:var(--blue);font-weight:bold;margin-bottom:8px;">
                    الإجمالي: ${total} ${avgH ? `| 📏 متوسط الطول: ${avgH} ${unit}` : ''} | 📸 صور اليوم: ${todayPhotoCnt}
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
                                <b style="font-size:12px;">📏 الطول (${unit}) وصور #${activeEntryPrompt.seq}:</b>
                                <div style="display:flex;gap:4px;">
                                    <button class="btn btn-blue btn-sm" onclick="openPhotoSourceChoice('plant', {pIdx:${pIdx}, entryId:'${activeEntryPrompt.entryId}'})">📸 +صورة</button>
                                    <button class="btn btn-outline btn-sm" onclick="activeEntryPrompt=null;renderInventory(getSite())">✕</button>
                                </div>
                            </div>
                            <div style="display:flex;gap:4px;flex-wrap:wrap;">
                                <input type="number" step="any" class="inp" style="width:75px;margin:0;padding:5px;text-align:center;" placeholder="${unit}" oninput="setPlantEntryHeight(${pIdx},'${activeEntryPrompt.entryId}',this.value)">
                                ${lastUsedHeight ? `<button class="chip" style="color:var(--purple);border-color:var(--purple);" onclick="setPlantEntryHeight(${pIdx},'${activeEntryPrompt.entryId}',${lastUsedHeight})">تكرار ${lastUsedHeight}</button>` : ''}
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

function openInventoryMasterSummary() {
    const site = getSite();
    let grandTotal = 0;
    const condTotals = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 };
    const zoneLines = [];

    site.inventory.forEach(z => {
        let zSum = 0;
        const pDetails = z.plants.map(p => {
            const pSum = Object.values(p.counts).reduce((a, b) => a + (b || 0), 0);
            zSum += pSum;
            grandTotal += pSum;
            HEALTH_CONDITIONS.forEach(c => { condTotals[c.id] += (p.counts[c.id] || 0); });
            return `${p.name}: ${pSum}`;
        });
        if (zSum > 0) zoneLines.push(`📍 ${z.name} (${zSum}): ${pDetails.join(' | ')}`);
    });

    const summaryText = `🌿 ملخص جرد (${site.name.split('/')[0].trim()}) — ${state.activeDate}\n` +
        `الإجمالي الكلي: ${grandTotal} شجرة/نبتة\n` +
        HEALTH_CONDITIONS.map(c => `• ${c.name}: ${condTotals[c.id]}`).join('\n') +
        (site.stopMarker ? `\n🎀 علامة التوقف: ${site.stopMarker}` : '') +
        `\n\nتفصيل المناطق:\n` + zoneLines.join('\n');

    openModal(`
        <h3 class="card-title">📊 ملخص الجرد الشامل (${grandTotal})</h3>
        <div class="grid-3" style="margin-bottom:10px;">
            ${HEALTH_CONDITIONS.map(c => `<div style="background:${c.color};padding:6px;border-radius:8px;text-align:center;font-size:11px;font-weight:bold;">${c.name}<br><span style="font-size:15px;">${condTotals[c.id]}</span></div>`).join('')}
        </div>
        <textarea id="invSumBox" class="inp" rows="7" readonly style="font-size:11.5px;">${esc(summaryText)}</textarea>
        <div class="grid-2">
            <button class="btn btn-green" onclick="navigator.clipboard.writeText(document.getElementById('invSumBox').value);showToast('📋 تم نسخ ملخص الجرد!')">📋 نسخ الملخص</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}

function setStopMarker() { const site = getSite(); const m = prompt('مكان علامة التوقف الميداني:', site.stopMarker || ''); if (m !== null) { site.stopMarker = m.trim(); saveState(); renderInventory(site); } }
function copySpeciesFromZone() {
    const site = getSite();
    const otherZones = site.inventory.filter(z => z.id !== activeInvZoneId && z.plants.length > 0);
    if (!otherZones.length) { showToast('⚠️ لا توجد مناطق أخرى تحتوي على أصناف'); return; }
    openModal(`
        <h3 class="card-title">📋 نسخ قائمة الأصناف من منطقة سابقة</h3>
        <select id="copySrcZone" class="inp">${otherZones.map(z => `<option value="${z.id}">${esc(z.name)} (${z.plants.length})</option>`).join('')}</select>
        <div class="grid-2"><button class="btn btn-green" onclick="confirmCopySpecies()">نسخ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function confirmCopySpecies() {
    const site = getSite();
    const src = site.inventory.find(z => z.id === document.getElementById('copySrcZone').value);
    const dst = site.inventory.find(z => z.id === activeInvZoneId);
    if (src && dst) {
        pushUndo('نسخ أصناف إلى ' + dst.name);
        src.plants.forEach((p, i) => {
            if (!dst.plants.some(x => x.name === p.name)) dst.plants.push({ id: 'p_' + Date.now() + '_' + i, name: p.name, counts: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 }, entries: [], note: '' });
        });
        saveState(); renderInventory(site); showToast('📋 تم نسخ الأصناف');
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
            ${entries.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:15px;">لا توجد قيود</div>' :
            entries.map((e, i) => {
                const cObj = HEALTH_CONDITIONS.find(c => c.id === e.condId);
                const ePhotos = ensurePhotosArr(e);
                return `
                <div class="meter-card" style="padding:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div><b>#${i + 1} — ${cObj ? cObj.name : ''}</b><div style="font-size:11px;color:var(--muted);">${esc(e.date)} ${e.height ? `| ${e.height} ${state.company.heightUnit}` : ''}</div></div>
                        <button class="btn btn-outline btn-sm" onclick="openPhotoSourceChoice('plant', {pIdx:${pIdx}, entryId:'${e.id}'})">📸 +صورة (${ePhotos.length})</button>
                    </div>
                    ${ePhotos.length > 0 ? `<div class="photo-strip">${ePhotos.map((u, pI) => `<div class="photo-item-wrap"><img src="${u}" class="photo-thumb" onclick="previewSinglePhoto('${u}')"><button class="photo-del-badge" onclick="removePhotoFromItem('plant', {pIdx:${pIdx}, entryId:'${e.id}'}, ${pI})">✕</button></div>`).join('')}</div>` : ''}
                </div>`;
            }).join('')}
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:10px;" onclick="closeModal()">إغلاق</button>
    `);
}
function addInvZone() {
    openModal(`
        <h3 class="card-title">📍 إضافة منطقة للجرد</h3>
        <div class="inp-wrap"><input id="izName" list="globalZonesList" class="inp" placeholder="مثلاً: AR5"><button class="clr-btn" onclick="quickClearField('izName')">✕</button></div>
        <div class="grid-2"><button class="btn btn-green" onclick="confirmAddInvZone()">دخول</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function confirmAddInvZone() {
    const name = document.getElementById('izName').value.trim();
    if (!name) return;
    pushUndo('إضافة منطقة جرد: ' + name);
    const z = { id: 'z_' + Date.now(), name, plants: [] };
    getSite().inventory.push(z); activeInvZoneId = z.id;
    closeModal(); saveState(); renderAll();
}
function deleteInvZone(id) { if (confirm('حذف المنطقة؟')) { pushUndo('حذف منطقة جرد'); getSite().inventory = getSite().inventory.filter(z => z.id !== id); saveState(); renderInventory(getSite()); } }
function enterInvZone(id) { activeInvZoneId = id; activeEntryPrompt = null; renderAll(); }
function exitInvZone() { activeInvZoneId = null; activeEntryPrompt = null; renderAll(); }
function sortZonePlants() { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z) { z.plants.sort((a, b) => a.name.localeCompare(b.name, 'ar')); saveState(); renderInventory(getSite()); } }
function jumpAlpha(ch) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (!z) return; const t = z.plants.find(p => (p.name || '').trim().startsWith(ch)); if (t) document.getElementById('pbox_' + t.id)?.scrollIntoView({ behavior: 'smooth' }); }
function addInvPlant() { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (!z) return; pushUndo('إضافة صنف نبات'); z.plants.push({ id: 'p_' + Date.now(), name: 'نبات ' + (z.plants.length + 1), counts: { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 }, entries: [], note: '' }); saveState(); renderInventory(getSite()); }
function renameInvPlant(pIdx, val) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z) { z.plants[pIdx].name = val; saveState(); } }
function deleteInvPlant(pIdx) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z && confirm('حذف النبات؟')) { pushUndo('حذف صنف نبات'); z.plants.splice(pIdx, 1); saveState(); renderInventory(getSite()); } }
function updateInvPlantNote(pIdx, val) { const z = getSite().inventory.find(x => x.id === activeInvZoneId); if (z) { z.plants[pIdx].note = val; saveState(); } }

function changePlantCount(pIdx, cId, delta) {
    const site = getSite();
    const z = site.inventory.find(x => x.id === activeInvZoneId);
    const p = z.plants[pIdx];
    const cur = p.counts[cId] || 0;
    if (cur + delta < 0) return;
    pushUndo(`جرد ${p.name} (${delta > 0 ? '+1' : '-1'})`);
    p.counts[cId] = cur + delta;
    if (!p.entries) p.entries = [];
    const cObj = HEALTH_CONDITIONS.find(c => c.id === cId);
    if (delta > 0) {
        const entryId = 'e_' + Date.now();
        const entry = { id: entryId, date: state.activeDate, condId: cId, height: null, photos: [] };
        p.entries.push(entry);
        logSectionHistory('inv', 'add', `${z.name} | ${p.name} — ${cObj.name} (+1)`, { zoneId: z.id, plantId: p.id, condId: cId, entryId });
        activeEntryPrompt = { plantId: p.id, condId: cId, entryId, seq: p.entries.length };
    } else {
        for (let i = p.entries.length - 1; i >= 0; i--) { if (p.entries[i].condId === cId) { p.entries.splice(i, 1); break; } }
        logSectionHistory('inv', 'dec', `${z.name} | ${p.name} — ${cObj.name} (-1)`, {});
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
    if (ent) {
        ent.height = (!isNaN(num) && num > 0) ? num : null;
        if (ent.height) lastUsedHeight = ent.height;
    }
    const latestInvH = (getDayLog().secHistory.inv || [])[0];
    if (latestInvH && latestInvH.ref && latestInvH.ref.entryId === entryId) {
        const cObj = HEALTH_CONDITIONS.find(c => c.id === ent.condId);
        latestInvH.summary = `${z.name} | ${p.name} — ${cObj ? cObj.name : ''} ${ent.height ? `(${ent.height} ${state.company.heightUnit})` : ''}`;
    }
    saveState(); renderInventory(site);
}

/* ================= Standalone Inventory Excel Export ================= */
async function exportInventoryStandaloneExcel() {
    if (typeof ExcelJS === 'undefined') { showToast('⚠️ مكتبة ExcelJS غير محملة'); return; }
    showToast('⏳ جاري بناء إكسيل الجرد بالصور...');
    const site = getSite();
    const wb = new ExcelJS.Workbook();
    
    // 1. Summary Sheet
    const sumWs = wb.addWorksheet('ملخص الجرد', { views: [{ rightToLeft: true }] });
    const sumHeaders = ['المنطقة', 'النبات', 'الإجمالي', ...HEALTH_CONDITIONS.map(c => c.name), 'متوسط الطول', 'ملاحظات', 'علامة التوقف'];
    sumWs.addRow(sumHeaders).font = { bold: true };
    sumWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
    
    let gTot = 0;
    site.inventory.forEach(z => {
        z.plants.forEach(p => {
            const tot = Object.values(p.counts).reduce((a, b) => a + (b || 0), 0);
            if (tot === 0) return;
            gTot += tot;
            const hArr = (p.entries || []).map(e => parseFloat(e.height)).filter(n => !isNaN(n) && n > 0);
            const avgH = hArr.length ? (hArr.reduce((a, b) => a + b, 0) / hArr.length).toFixed(2) : '';
            const row = [z.name, p.name, tot];
            HEALTH_CONDITIONS.forEach(c => row.push(p.counts[c.id] || 0));
            row.push(avgH, p.note || '', site.stopMarker || '');
            sumWs.addRow(row);
        });
    });
    sumWs.addRow(['الإجمالي الكلي', '', gTot]);
    sumWs.columns.forEach(c => c.width = 15);

    // 2. Entries & Photos Sheet
    const entWs = wb.addWorksheet('سجل الترتيب والصور', { views: [{ rightToLeft: true }] });
    entWs.addRow(['المنطقة', 'النبات', 'التسلسل', 'التاريخ', 'الحالة الصحية', 'الطول المقاس', 'الصورة']).font = { bold: true };
    entWs.columns.forEach((c, i) => { c.width = i === 6 ? 22 : 15; });
    entWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };

    let rIdx = 2;
    site.inventory.forEach(z => {
        z.plants.forEach(p => {
            (p.entries || []).forEach((e, i) => {
                const cObj = HEALTH_CONDITIONS.find(c => c.id === e.condId);
                const rowObj = entWs.addRow([z.name, p.name, `#${i+1}`, e.date, cObj ? cObj.name : '', e.height || '', '']);
                rowObj.height = 70;
                
                const ePhotos = ensurePhotosArr(e);
                if (ePhotos.length > 0) {
                    try {
                        const imgId = wb.addImage({ base64: ePhotos[0], extension: 'jpeg' });
                        entWs.addImage(imgId, {
                            tl: { col: 6.1, row: rIdx - 0.9 },
                            ext: { width: 120, height: 80 }
                        });
                    } catch(err) { console.error(err); }
                }
                rIdx++;
            });
        });
    });

    const outBuffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TFF_Inventory_${site.id}_${state.activeDate}.xlsx`;
    a.click();
    showToast(`✅ تم تنزيل إكسيل الجرد بالصور!`);
}

/* ================= TAB 5: Issues, IR, SDL, OAR & Lightweight Gemini Export ================= */
function renderExportAndIssues(site, log) {
    renderStickySectionHistory('issues', 'stickyHist-issues', 'المشاكل والحوادث');
    const { photos } = collectTodayPhotos();
    const cntEl = document.getElementById('todayPhotoCount');
    if (cntEl) cntEl.textContent = photos.length;

    document.getElementById('issuesContainer').innerHTML = site.issues.length === 0
        ? `<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px;">لا توجد مشاكل مفتوحة</div>`
        : site.issues.map((iss, idx) => {
            const isOpen = iss.status === 'Open';
            const iPhotos = ensurePhotosArr(iss);
            return `
            <div class="meter-card ${isOpen ? 'faulty' : ''}">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <b style="font-size:12px;">${esc(iss.code)} | 📍 ${esc(iss.zone)} (${esc(iss.severity)})</b>
                    <span class="badge" style="background:${isOpen ? '#fee2e2' : '#dcfce7'};color:${isOpen ? '#b91c1c' : '#166534'};">${isOpen ? 'Open' : 'Resolved'}</span>
                </div>
                <div style="font-size:12px;margin:5px 0;">${esc(iss.desc)}</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                    ${isOpen ? `<button class="btn btn-green btn-sm" onclick="resolveIssue(${idx})">✓ إغلاق</button>` : ''}
                    <button class="btn btn-outline btn-sm" onclick="openPhotoSourceChoice('issue', ${idx})">📸 +صورة (${iPhotos.length})</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="deleteIssue(${idx})">✕</button>
                </div>
                ${iPhotos.length > 0 ? `<div class="photo-strip">${iPhotos.map((u, pI) => `<div class="photo-item-wrap"><img src="${u}" class="photo-thumb" onclick="previewSinglePhoto('${u}')"><button class="photo-del-badge" onclick="removePhotoFromItem('issue', ${idx}, ${pI})">✕</button></div>`).join('')}</div>` : ''}
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
        <label class="lbl">المنطقة:</label>
        <div class="inp-wrap"><input id="issZone" list="globalZonesList" class="inp" placeholder="مثلاً: B1"><button class="clr-btn" onclick="quickClearField('issZone')">✕</button></div>
        <label class="lbl">درجة الخطورة:</label><select id="issSev" class="inp"><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option><option value="Low">Low</option></select>
        <label class="lbl">وصف المشكلة:</label>
        <div class="inp-wrap"><textarea id="issDesc" class="inp auto-grow" rows="3"></textarea><button class="clr-btn top-align" onclick="quickClearField('issDesc')">✕</button></div>
        <div class="grid-2"><button class="btn btn-red" onclick="saveNewIssue()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveNewIssue() {
    const site = getSite();
    const desc = applySpellAndDictationGuard(document.getElementById('issDesc').value.trim()).text;
    if (!desc) return;
    pushUndo('تسجيل مشكلة ميدانية');
    const code = 'ISS-' + String(site.issues.length + 1).padStart(2, '0');
    const zone = document.getElementById('issZone').value.trim() || 'General';
    const iid = 'i_' + Date.now();
    site.issues.unshift({ id: iid, code, date: state.activeDate, zone, severity: document.getElementById('issSev').value, desc, status: 'Open', resolvedDate: '', photos: [] });
    logSectionHistory('issues', 'add', `${code} [${zone}]: ${desc}`, { issueId: iid });
    closeModal(); saveState(); renderExportAndIssues(site, getDayLog());
}
function resolveIssue(idx) {
    pushUndo('إغلاق مشكلة');
    const iss = getSite().issues[idx];
    iss.status = 'Resolved'; iss.resolvedDate = state.activeDate;
    logSectionHistory('issues', 'resolve', `إغلاق ${iss.code} [${iss.zone}]`, { issueId: iss.id });
    saveState(); renderExportAndIssues(getSite(), getDayLog());
}
function deleteIssue(idx) { pushUndo('حذف مشكلة'); getSite().issues.splice(idx, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }

function openIncidentModal() {
    tempModalPhotos = [];
    openModal(`
        <h3 class="card-title">🚨 نموذج تقرير حادث (Incident Report)</h3>
        <div class="grid-2">
            <div><label class="lbl">وقت الحادث:</label><input type="time" id="irTime" class="inp" value="10:30"></div>
            <div><label class="lbl">الموقع / المنطقة:</label><input id="irZone" list="globalZonesList" class="inp" placeholder="B1"></div>
        </div>
        <div class="grid-2">
            <div><label class="lbl">نوع الحادث:</label><input id="irType" class="inp" placeholder="كسر أنبوب / إصابة"></div>
            <div><label class="lbl">الخطورة:</label><select id="irSev" class="inp"><option value="Minor / طفيف">Minor / طفيف</option><option value="Moderate / متوسط">Moderate / متوسط</option><option value="Major / كبير">Major / كبير</option><option value="Critical / حرج">Critical / حرج</option></select></div>
        </div>
        <label class="lbl">الأشخاص المتورطون:</label><input id="irPersons" class="inp">
        <label class="lbl">ماذا حدث (التسلسل):</label><textarea id="irTimeline" class="inp auto-grow" rows="2"></textarea>
        <label class="lbl">الإجراء الفوري المتخذ:</label><textarea id="irAction" class="inp auto-grow" rows="2"></textarea>
        <div class="grid-2">
            <div><label class="lbl">رعاية طبية؟</label><select id="irMed" class="inp"><option value="No / لا">No / لا</option><option value="Yes / نعم">Yes / نعم</option></select></div>
            <div style="padding-top:16px;display:flex;gap:4px;">
                <button class="btn btn-blue btn-sm" style="flex:1;" onclick="triggerInlineModalPhoto('camFileInput')">📸 كاميرا</button>
                <button class="btn btn-green btn-sm" style="flex:1;" onclick="triggerInlineModalPhoto('galFileInput')">🖼️ استوديو</button>
            </div>
        </div>
        <div id="inlineModalPhotoStrip" class="photo-strip" style="margin-bottom:8px;"></div>
        <div class="grid-2"><button class="btn btn-orange" onclick="saveIncident()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveIncident() {
    pushUndo('إضافة تقرير حادث');
    const log = getDayLog();
    const code = 'IR-' + String(log.incidents.length + 1).padStart(3, '0');
    const zone = document.getElementById('irZone').value.trim() || 'General';
    log.incidents.push({
        code, time: document.getElementById('irTime').value, zone,
        type: document.getElementById('irType').value.trim(), severity: document.getElementById('irSev').value,
        persons: document.getElementById('irPersons').value.trim(), timeline: document.getElementById('irTimeline').value.trim(),
        action: document.getElementById('irAction').value.trim(), medical: document.getElementById('irMed').value, photos: [...tempModalPhotos]
    });
    logSectionHistory('issues', 'ir', `تقرير حادث ${code} [${zone}]`, {});
    tempModalPhotos = []; closeModal(); saveState(); renderExportAndIssues(getSite(), log); showToast('🚨 تم حفظ تقرير الحادث ' + code);
}
function deleteIncident(i) { pushUndo('حذف تقرير حادث'); getDayLog().incidents.splice(i, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }

function openSdlModal() {
    tempModalPhotos = [];
    openModal(`
        <h3 class="card-title">📑 سجل انحراف موقع (Site Deviation Log)</h3>
        <label class="lbl">موضوع الانحراف:</label><input id="sdlSub" class="inp" placeholder="مثلاً: أعمال حفر المقاول">
        <div class="grid-2">
            <div><label class="lbl">المنطقة:</label><input id="sdlZone" list="globalZonesList" class="inp"></div>
            <div><label class="lbl">الخطورة:</label><select id="sdlSev" class="inp"><option value="Moderate / متوسط">Moderate / متوسط</option><option value="Major / كبير">Major / كبير</option><option value="Critical / حرج">Critical / حرج</option><option value="Minor / طفيف">Minor / طفيف</option></select></div>
        </div>
        <div class="grid-2">
            <div><label class="lbl">نوع الانحراف:</label><input id="sdlType" class="inp"></div>
            <div><label class="lbl">الطرف المسؤول:</label><input id="sdlParty" class="inp"></div>
        </div>
        <label class="lbl">الملاحظة (OBS):</label><textarea id="sdlObs" class="inp auto-grow" rows="2"></textarea>
        <label class="lbl">التحليل (ANA):</label><textarea id="sdlAna" class="inp auto-grow" rows="2"></textarea>
        <label class="lbl">التوصية (REC):</label><textarea id="sdlRec" class="inp auto-grow" rows="2"></textarea>
        <div class="grid-2" style="margin-bottom:6px;">
            <button class="btn btn-blue btn-sm" onclick="triggerInlineModalPhoto('camFileInput')">📸 كاميرا</button>
            <button class="btn btn-green btn-sm" onclick="triggerInlineModalPhoto('galFileInput')">🖼️ استوديو</button>
        </div>
        <div id="inlineModalPhotoStrip" class="photo-strip" style="margin-bottom:8px;"></div>
        <div class="grid-2"><button class="btn btn-purple" onclick="saveSdl()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
    `);
}
function saveSdl() {
    pushUndo('إضافة سجل انحراف');
    const log = getDayLog();
    const code = 'SDL-' + String(log.sdls.length + 1).padStart(3, '0');
    const zone = document.getElementById('sdlZone').value.trim() || 'General';
    log.sdls.push({
        code, subject: document.getElementById('sdlSub').value.trim(), zone,
        severity: document.getElementById('sdlSev').value, type: document.getElementById('sdlType').value.trim(),
        party: document.getElementById('sdlParty').value.trim(), obs: document.getElementById('sdlObs').value.trim(),
        ana: document.getElementById('sdlAna').value.trim(), rec: document.getElementById('sdlRec').value.trim(), photos: [...tempModalPhotos]
    });
    logSectionHistory('issues', 'sdl', `سجل انحراف ${code} [${zone}]`, {});
    tempModalPhotos = []; closeModal(); saveState(); renderExportAndIssues(getSite(), log); showToast('📑 تم حفظ سجل الانحراف ' + code);
}
function deleteSdl(i) { pushUndo('حذف سجل انحراف'); getDayLog().sdls.splice(i, 1); saveState(); renderExportAndIssues(getSite(), getDayLog()); }

function saveOarFields() {
    const log = getDayLog();
    log.oar.obs = applySpellAndDictationGuard(document.getElementById('oarObs').value).text;
    log.oar.ana = applySpellAndDictationGuard(document.getElementById('oarAna').value).text;
    log.oar.rec = applySpellAndDictationGuard(document.getElementById('oarRec').value).text;
    saveState();
}

function autoGenerateOAR() {
    pushUndo('توليد OAR ذكي');
    const site = getSite(); const log = getDayLog();
    const blocked = log.tasks.filter(t => t.status.includes('Blocked')).map(t => `${t.zones}: ${t.note || t.desc}`);
    const faultyMeters = log.meters.filter(m => m.status === 'faulty').map(m => `${m.name} (${m.note || 'عاطل'})`);
    const lowGauges = log.gauges.filter(g => g.val !== '' && parseFloat(g.val) < g.normal).map(g => `${g.name} (${g.val} bar)`);
    const openIssues = site.issues.filter(i => i.status === 'Open').map(i => `${i.code} [${i.zone}]: ${i.desc}`);
    const totalTanker = log.tasks.reduce((s, t) => s + (parseFloat(t.tankerLiters) || 0), 0);

    const obsParts = [];
    if (blocked.length) obsParts.push(`توقف الري في: ${blocked.join('؛ ')}.`);
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

    saveState(); renderExportAndIssues(site, log); triggerAllAutoGrows(); showToast('🔄 تم توليد مسودة OAR تلقائياً');
}

function generateWhatsAppBrief() {
    const site = getSite();
    const log = getDayLog();
    const pres = log.attendance.filter(w => !w.status.includes('Absent')).length;
    const totalTk = log.tasks.reduce((s, t) => s + (parseFloat(t.tankerLiters) || 0), 0);
    const blocked = log.tasks.filter(t => t.status.includes('Blocked')).map(t => t.zones).join(', ');
    const txt = `*ملخص الوردية - ${site.name.split('/')[0].trim()}*\n` +
        `📅 التاريخ: ${state.activeDate}\n` +
        `📑 DFL-${log.dflNum}\n` +
        `👷 الحضور: ${pres} / ${log.attendance.length}\n` +
        `💧 التنكر: ${totalTk.toLocaleString()} L\n` +
        (blocked ? `🛑 مناطق متوقفة: ${blocked}\n` : '') +
        `✅ حالة الشبكة: ${log.perf.status}`;
    
    if (navigator.share) {
        navigator.share({ title: 'ملخص الوردية', text: txt }).catch(()=>{});
    } else {
        navigator.clipboard.writeText(txt);
        showToast('📋 تم نسخ الملخص للواتساب');
    }
}

function openTablePreviewModal() {
    const log = getDayLog();
    const { taskPhotoRefs } = collectTodayPhotos();
    openModal(`
        <h3 class="card-title">👁️ معاينة شكل المهام في الـ DFL</h3>
        <div style="max-height:300px;overflow-y:auto;font-size:11px;">
            <table style="width:100%;border-collapse:collapse;text-align:center;" border="1">
                <tr style="background:#e2e8f0;font-weight:bold;"><td>Task</td><td>Desc</td><td>Zone</td><td>Time</td><td>St</td><td>Photos</td></tr>
                ${log.tasks.map((t, i) => `<tr><td>${t.task.split('/')[0]}</td><td>${t.desc}</td><td>${t.zones}</td><td>${t.dur}</td><td>${t.status.split('/')[0]}</td><td style="color:var(--blue);">${taskPhotoRefs[i] || '-'}</td></tr>`).join('')}
            </table>
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:10px;" onclick="closeModal()">إغلاق</button>
    `);
}

/* ================= Multi-Photo Collector, Gallery & ZIP Download ================= */
function collectTodayPhotos() {
    const site = getSite();
    const log = getDayLog();
    const photos = [];
    const regArr = (arr, section, desc) => {
        const names = [];
        (arr || []).forEach(b64 => {
            if (!b64) return;
            const fname = `PHOTO_${String(photos.length + 1).padStart(2, '0')}.jpg`;
            photos.push({ fileName: fname, section, description: desc, dataUrl: b64 });
            names.push(fname);
        });
        return names.join(' / ');
    };

    const taskPhotoRefs = log.tasks.map(t => regArr(ensurePhotosArr(t), 'Section 3 - Tasks', `${t.task} - ${t.zones}`));
    const meterPhotoRefs = log.meters.map(m => regArr(ensurePhotosArr(m), 'Section 5B - Water Meters', m.name));
    const sickPlants = [];
    site.inventory.forEach(z => z.plants.forEach(p => {
        const todayEntries = (p.entries || []).filter(e => e.date === state.activeDate);
        const aff = todayEntries.filter(e => e.condId !== 'c1');
        if (aff.length > 0) {
            const cObj = HEALTH_CONDITIONS.find(c => c.id === aff[0].condId);
            const allEntPhotos = [];
            todayEntries.forEach(e => ensurePhotosArr(e).forEach(u => allEntPhotos.push(u)));
            const ref = regArr(allEntPhotos, 'Section 6 - Plants Health', `${p.name} (${z.name})`);
            sickPlants.push({
                plantName: p.name,
                scientificName: state.company.speciesDict[p.name] || '',
                healthStatusDFL: cObj ? cObj.dfl : 'متوسط',
                visibleSigns: `${cObj ? cObj.name : ''} (${aff.length})${p.note ? ' - ' + p.note : ''}`,
                zone: z.name,
                imageRef: ref
            });
        }
    }));
    const activeIssues = site.issues.filter(i => i.status === 'Open' || i.date === state.activeDate);
    const issuePhotoRefs = activeIssues.map(i => regArr(ensurePhotosArr(i), 'Section 7 - Issues', `${i.code} - ${i.zone}`));
    log.incidents.forEach(ir => regArr(ensurePhotosArr(ir), 'Incident Report', `${ir.code} - ${ir.zone}`));
    log.sdls.forEach(sd => regArr(ensurePhotosArr(sd), 'Site Deviation Log', `${sd.code} - ${sd.zone}`));

    return { photos, taskPhotoRefs, meterPhotoRefs, sickPlants, activeIssues, issuePhotoRefs };
}

async function downloadTodayPhotosZip() {
    const { photos } = collectTodayPhotos();
    if (!photos.length) { showToast('⚠️ لا توجد صور ملتقطة اليوم'); return; }
    if (typeof JSZip === 'undefined') {
        photos.forEach((p, idx) => setTimeout(() => { const a = document.createElement('a'); a.href = p.dataUrl; a.download = p.fileName; a.click(); }, idx * 250));
        return;
    }
    showToast('⏳ جاري ضغط الصور في ملف ZIP...');
    const zip = new JSZip();
    photos.forEach(p => {
        const base64Data = p.dataUrl.split(',')[1];
        zip.file(p.fileName, base64Data, { base64: true });
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TFF_Photos_DFL${getDayLog().dflNum}_${state.activeDate}.zip`;
    a.click();
    showToast(`📦 تم تنزيل ${photos.length} صور في ملف ZIP واحد!`);
}

function openTodayPhotosGallery() {
    const { photos } = collectTodayPhotos();
    openModal(`
        <h3 class="card-title">🖼️ معرض صور اليوم (${photos.length})</h3>
        <div style="max-height:360px;overflow-y:auto;">
            ${photos.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:20px;">لا توجد صور مسجلة اليوم</div>' :
            photos.map(p => `
                <div class="meter-card" style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;">
                    <img src="${p.dataUrl}" class="photo-thumb" onclick="previewSinglePhoto('${p.dataUrl}')">
                    <div style="flex:1;">
                        <b style="font-size:12px;color:var(--blue);">${esc(p.fileName)}</b>
                        <div style="font-size:11px;font-weight:bold;">${esc(p.section)}</div>
                        <div style="font-size:10.5px;color:var(--muted);">${esc(p.description)}</div>
                    </div>
                    <a href="${p.dataUrl}" download="${esc(p.fileName)}" class="btn btn-outline btn-sm">📥</a>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="closeModal()">إغلاق</button>
    `);
}

function previewSinglePhoto(url) {
    openModal(`
        <img src="${url}" style="width:100%;border-radius:10px;display:block;margin-bottom:10px;">
        <button class="btn btn-outline btn-full" onclick="closeModal()">إغلاق المعاينة</button>
    `);
}

/* ================= Lightweight JSON Export + Hardened Gemini Prompt ================= */
function runPreExportCheck() {
    const log = getDayLog();
    const warnings = [];
    if (log.meters.some(m => m.status === 'working' && m.curr === '')) warnings.push('• توجد قراءة عداد شغال غير مدخلة.');
    if (log.meters.some(m => ensurePhotosArr(m).length === 0)) warnings.push('• لم تُلتقط صورة عداد المياه اليوم.');
    if (log.tasks.some(t => t.status.includes('Blocked') && !t.note.trim())) warnings.push('• توجد مهمة متوقفة بدون كتابة سبب التوقف.');
    if (log.tasks.some(t => t.status.includes('Blocked')) && !log.oar.obs) warnings.push('• توجد مهام متوقفة ولم يُملأ تقرير OAR بعد.');
    if (log.tasks.some(t => t.status.includes('Progress'))) warnings.push('• توجد مهام جارية لم تُكتمل بعد.');

    if (warnings.length > 0) {
        openModal(`
            <h3 class="card-title">🔍 تنبيهات ما قبل التصدير</h3>
            <div style="font-size:12px;color:#92400e;background:#fef3c7;padding:10px;border-radius:8px;margin-bottom:10px;line-height:1.6;">${warnings.join('<br>')}</div>
            <div class="grid-2"><button class="btn btn-green" onclick="closeModal();exportLightweightDFL()">تصدير على أي حال</button><button class="btn btn-outline" onclick="closeModal()">مراجعة</button></div>
        `);
    } else {
        exportLightweightDFL();
    }
}

function exportLightweightDFL() {
    const site = getSite();
    const log = getDayLog();
    const dayEn = getDayNameEn(state.activeDate);
    syncIrrigatedZonesFromTasks(false);

    const { photos, taskPhotoRefs, meterPhotoRefs, sickPlants, activeIssues, issuePhotoRefs } = collectTodayPhotos();
    const rowOffset = Math.max(0, log.attendance.length - 5);

    let totalTankerL = 0; let totalTrips = 0;
    log.tasks.forEach(t => { if (parseFloat(t.tankerLiters) > 0) { totalTankerL += parseFloat(t.tankerLiters); totalTrips += (t.tankerTrips || 1); } });
    
    const machNote = (log.machinery.pumpHrs || log.machinery.genHrs || log.machinery.fuelL)
        ? ` | Pump: ${log.machinery.pumpHrs || 0}h, Gen: ${log.machinery.genHrs || 0}h, Fuel: ${log.machinery.fuelL || 0}L` : '';
    const tankerNote = totalTankerL > 0 ? ` | Tanker Total: ${totalTankerL.toLocaleString()} L (${totalTrips} Trips)` : '';

    const lightPayload = {
        templateVersion: 'V03_Clean',
        rowOffsetForExtraWorkers: rowOffset,
        metadata: {
            F5_formId: log.dflNum,
            F6_siteName: site.name,
            B7_date: state.activeDate,
            F7_day: dayEn,
            B8_teamLead: state.company.teamLead,
            B9_shift: state.company.shift,
            F9_supervisor: state.company.supervisor || 'Maitham Ibrahim',
            B10_outsideWorkerRateIQD: state.company.outsideRate
        },
        section2_attendance: log.attendance.map((w, idx) => ({
            seq: idx + 1,
            name: w.name,
            type: w.type,
            status: w.status,
            timeIn: w.status.includes('Absent') ? '' : w.tIn,
            timeOut: w.status.includes('Absent') ? '' : w.tOut,
            overtimeHrs: parseFloat(w.ot) || 0,
            notes: w.note || ''
        })),
        section3_tasks: log.tasks.map((t, idx) => ({
            task: t.task,
            briefDescription: t.desc,
            zonesList: (t.zones || 'عام / General').split(',').map(s => s.trim()).filter(Boolean),
            time: t.dur,
            workersCount: (t.workers || []).length || 1,
            status: t.status,
            notes: t.note || '',
            workersAssigned: (t.workers || []).join(' / '),
            imageRef: taskPhotoRefs[idx] || ''
        })),
        section4_equipment: log.tools,
        section5_siteReadings: {
            moisture5A: log.moisture.filter(m => m.zone || m.pct),
            waterMeters5B: log.meters.map((m, idx) => ({
                name: m.name,
                status: m.status,
                visualQuality: m.visual,
                prevReading: m.status === 'working' ? (parseFloat(m.prev) || 0) : 'Faulty',
                currReading: m.status === 'working' ? (m.curr !== '' ? parseFloat(m.curr) : '') : 'Faulty',
                notes: m.status === 'faulty' ? `Faulty Meter: ${m.note || 'عاطل'}` : (m.note || ''),
                imageRef: meterPhotoRefs[idx] || ''
            })),
            irrigationPerformance5C: {
                B83_systemStatus: log.perf.status,
                E83_durationHrs: log.perf.duration,
                B84_zonesIrrigated: log.perf.zonesIrrigated,
                E84_pressureNotes: log.perf.pressureNotes || '',
                B85_performanceNotes: (log.perf.notes || '') + tankerNote + machNote
            },
            barGauges5D: log.gauges
        },
        section6_plantsHealth: sickPlants,
        section7_incidentsAndIssues: activeIssues.map((iss, idx) => ({
            code: iss.code,
            description: `${iss.code} [${iss.zone}] (${iss.status}): ${iss.desc}`,
            severity: iss.severity,
            imageRef: issuePhotoRefs[idx] || ''
        })),
        section8_photoReferences: photos.map((p, i) => ({
            seq: i + 1,
            fileName: p.fileName,
            section: p.section,
            description: p.description
        })),
        section9_teamLeadOAR: {
            OBS: log.oar.obs || '',
            ANA: log.oar.ana || '',
            REC: log.oar.rec || ''
        },
        section10_signOff: {
            A_teamLead: `Team Lead Name  /  اسم قائد الفريق: ${state.company.teamLead}`,
            H_dateTime: `Date & Time  /  التاريخ والوقت: ${state.activeDate}`
        },
        incidentReportsSheet: log.incidents.map(({ photos: _p, ...r }) => r),
        siteDeviationLogSheet: log.sdls.map(({ photos: _p, ...r }) => r)
    };

    const fname = `TFF_Light_DFL${log.dflNum}_${state.activeDate}.json`;
    const blob = new Blob([JSON.stringify(lightPayload, null, 2)], { type: 'application/json;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();

    const hardenedPrompt = `أنت خبير أتمتة التقارير الميدانية لشركة غابات الغذاء (The Food Forests).
مرفق لك:
1. قالب Excel النظيف (Al-Mutahida_DFL_V03_Clean.xlsx).
2. ملف بيانات اليوم الخفيف (${fname}).
(وإذا أرفقت لك ملف الصور ZIP ففك ضغطه وازرع كل صورة داخل خليتها حسب اسمها المرجعي).

اكتب ونفّذ كود Python (باستخدام openpyxl) لتعبئة ورقة 'Daily Field Log' مباشرة (In-Place) مع الحفاظ التام على الألوان والخطوط والحدود:

1. إزاحة الصفوف للعمالة الإضافية (offset = ${rowOffset}):
   - القالب يحتوي على 5 صفوف للحضور (18 إلى 22).
   - إذا كان rowOffsetForExtraWorkers > 0: أدرج ${rowOffset} صفوف عند صف 23 (ws.insert_rows(23, ${rowOffset})) قبل كتابة أي بيانات أسفل صف 22، وانسخ ارتفاع الصف (42.75) والحدود ودمج H{r}:K{r} من صف 22.
   - أضف offset = ${rowOffset} لأرقام صفوف جميع الأقسام من القسم 3 حتى القسم 10.

2. البيانات التعريفية (Metadata) — املأها بالكامل:
   - F5 = ${log.dflNum} | F6 = "${site.name}" | B7 = "${state.activeDate}" | F7 = "${dayEn}" | B8 = "${state.company.teamLead}" | B9 = "${state.company.shift}" | F9 = "${state.company.supervisor || 'Maitham Ibrahim'}" | B10 = ${state.company.outsideRate}

3. القسم 1 (Weather — صف 13):
   - ابحث عن طقس مدينة الحلة لتاريخ ${state.activeDate} واملأ B13 (الأحوال)، C13 (الصغرى رقم)، D13 (العظمى رقم)، E13 (الرياح)، F13 (الرطوبة % رقم أو اتركها فارغة — ممنوع وضع رمز '-').

4. القسم 2 (Attendance — صفوف 18 إلى ${17 + log.attendance.length}):
   - املأ section2_attendance، وأخفِ أي صف فارغ متبقٍ حتى صف 22.

5. القسم 3 (Tasks — يبدأ من صف ${27 + rowOffset} حتى ${59 + rowOffset}):
   - ضع منطقة واحدة فقط في كل صف في العمود D (فكّ أي قائمة مناطق إلى صفوف متتالية).
   - ادمج عمودياً الأعمدة (A, B, C, F, K) فقط عبر الصفوف المتتالية التي تشترك في نفس المهمة والوصف والعمال.
   - ممنوع منعاً باتاً دمج عمود الملاحظات H:J عمودياً! أبقِ H{r}:J{r} مدمجاً أفقياً لكل صف على حدة فقط.
   - افصل أسماء العمال في K باستخدام ' / '.
   - في العمود L: اكتب أسماء ملفات الصور المرجعية مثل 'PHOTO_01.jpg' فقط إذا وُجدت، واتركه فارغاً تماماً إذا لم توجد صورة (ممنوع كتابة Yes أو No).
   - أخفِ جميع الصفوف الفارغة المتبقية في هذا القسم (ws.row_dimensions[r].hidden = True).

6. الأقسام 4 و 5 و 6 و 7 و 8 (مُزاحة بمقدار offset = ${rowOffset}):
   - القسم 4 (المعدات، يبدأ من ${64 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
   - القسم 5A (الرطوبة، ${71 + rowOffset}..${75 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
   - القسم 5B (العدادات، ${79 + rowOffset}..${80 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
   - القسم 5C (أداء الري): B${83 + rowOffset} (الحالة)، E${83 + rowOffset} (المدة)، B${84 + rowOffset} (المناطق المروية)، E${84 + rowOffset} (ملاحظات الضغط)، B${85 + rowOffset} (ملاحظات الأداء).
   - القسم 5D (مقاييس الضغط، ${89 + rowOffset}..${94 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
   - القسم 6 (صحة النبات، ${98 + rowOffset}..${102 + rowOffset}) والقسم 7 (الحوادث، ${106 + rowOffset}..${109 + rowOffset}): املأ وأخفِ الصفوف الفارغة.
   - القسم 8 (مراجع الصور، ${113 + rowOffset}..${118 + rowOffset}): املأ section8_photoReferences وأخفِ الصفوف الفارغة.

7. القسم 9 (OAR) والقسم 10 (Sign-off) + أوراق IR/SDL:
   - اكتب OBS في A${123 + rowOffset}، ANA في A${125 + rowOffset}، REC في A${127 + rowOffset}.
   - اكتب اسم قائد الفريق في A${131 + rowOffset} والتاريخ في H${131 + rowOffset}.
   - إذا وجدت بيانات في incidentReportsSheet أو siteDeviationLogSheet فاملأ أوراقها المخصصة في نفس الملف.

احفظ الملف بصيغة .xlsx وقدّم رابط التحميل مباشرة.`;

    openModal(`
        <h3 class="card-title">🤖 تم تنزيل ملف اليوم الخفيف بنجاح!</h3>
        <p style="font-size:12px;color:var(--muted);line-height:1.5;">
            تم تنزيل <b>${esc(fname)}</b> (حجم خفيف بدون صور ثقيلة).<br>
            افتح <b>محادثة جديدة</b> في Gemini، ارفع <code>Al-Mutahida_DFL_V03_Clean.xlsx</code> مع هذا الملف، والصق الأمر التالي:
        </p>
        <textarea id="gmHardPrompt" class="inp" rows="9" readonly style="font-size:11.5px;">${esc(hardenedPrompt)}</textarea>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="navigator.clipboard.writeText(document.getElementById('gmHardPrompt').value);showToast('📋 تم نسخ الأمر المحصّن!')">📋 نسخ الأمر</button>
            <button class="btn btn-outline" onclick="closeModal()">إغلاق</button>
        </div>
    `);
}

/* ================= Camera, Multi-Gallery & Voice Dictation ================= */
function openPhotoSourceChoice(type, ctx) {
    pendingPhotoCtx = { type, ctx };
    openModal(`
        <h3 class="card-title">📸 إرفاق صورة أو أكثر</h3>
        <div class="grid-2">
            <button class="btn btn-blue" onclick="closeModal();triggerFileInp('camFileInput')">📸 التقاط بالكاميرا</button>
            <button class="btn btn-green" onclick="closeModal();triggerFileInp('galFileInput')">🖼️ اختيار من الاستوديو</button>
        </div>
        <button class="btn btn-outline btn-full" style="margin-top:8px;" onclick="closeModal()">إلغاء</button>
    `);
}
function triggerInlineModalPhoto(inpId) {
    pendingPhotoCtx = { type: 'inline_modal', ctx: 0 };
    triggerFileInp(inpId);
}
function triggerFileInp(id) { const el = document.getElementById(id); el.value = ''; el.click(); }

function stampSingleFile(file) {
    return new Promise(resolve => {
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

                resolve(c.toDataURL('image/jpeg', 0.88));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function onPhotoSelected(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !pendingPhotoCtx) return;
    const { type, ctx } = pendingPhotoCtx;
    pendingPhotoCtx = null;

    showToast(`⏳ جاري معالجة وختم ${files.length} صورة...`);
    const stampedUrls = [];
    for (const f of files) {
        stampedUrls.push(await stampSingleFile(f));
    }

    if (type === 'inline_modal') {
        tempModalPhotos.push(...stampedUrls);
        const strip = document.getElementById('inlineModalPhotoStrip');
        if (strip) strip.innerHTML = tempModalPhotos.map(u => `<img src="${u}" class="photo-thumb">`).join('');
        showToast(`📸 تم إرفاق ${stampedUrls.length} صورة للنموذج`);
        return;
    }

    const log = getDayLog();
    pushUndo(`إرفاق ${stampedUrls.length} صورة`);
    if (type === 'task') {
        ensurePhotosArr(log.tasks[ctx]).push(...stampedUrls);
        logSectionHistory('tasks', 'photo', `إرفاق ${stampedUrls.length} صورة: ${log.tasks[ctx].zones}`, { taskId: log.tasks[ctx].id });
    } else if (type === 'meter') {
        ensurePhotosArr(log.meters[ctx]).push(...stampedUrls);
        logSectionHistory('tools', 'photo', `صورة عداد: ${log.meters[ctx].name}`, { meterId: log.meters[ctx].id });
    } else if (type === 'issue') {
        ensurePhotosArr(getSite().issues[ctx]).push(...stampedUrls);
        logSectionHistory('issues', 'photo', `صورة مشكلة: ${getSite().issues[ctx].code}`, { issueId: getSite().issues[ctx].id });
    } else if (type === 'plant') {
        const z = getSite().inventory.find(x => x.id === activeInvZoneId);
        const p = z ? z.plants[ctx.pIdx] : null;
        const ent = p ? (p.entries || []).find(x => x.id === ctx.entryId) : null;
        if (ent) ensurePhotosArr(ent).push(...stampedUrls);
    }
    saveState(); renderAll(); showToast(`📸 تم حفظ وختم ${stampedUrls.length} صورة بنجاح`);
}

function removePhotoFromItem(type, idx, photoIdx) {
    pushUndo('حذف صورة');
    const log = getDayLog();
    if (type === 'task') ensurePhotosArr(log.tasks[idx]).splice(photoIdx, 1);
    else if (type === 'meter') ensurePhotosArr(log.meters[idx]).splice(photoIdx, 1);
    else if (type === 'issue') ensurePhotosArr(getSite().issues[idx]).splice(photoIdx, 1);
    else if (type === 'plant') {
        const { pIdx, entryId } = idx;
        const z = getSite().inventory.find(x => x.id === activeInvZoneId);
        const p = z ? z.plants[pIdx] : null;
        const ent = p ? (p.entries || []).find(e => e.id === entryId) : null;
        if (ent) ensurePhotosArr(ent).splice(photoIdx, 1);
    }
    saveState(); renderAll(); showToast('🗑️ تم حذف الصورة');
}

function startDictation(targetId, onDone) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('⚠️ المتصفح لا يدعم الإملاء الصوتي المباشر، استخدم مايكروفون الكيبورد'); return; }
    const rec = new SR();
    rec.lang = 'ar-IQ';
    rec.interimResults = false;
    showToast('🎤 تحدث الآن...');
    rec.onresult = e => {
        const raw = e.results[0][0].transcript;
        const { text, changed } = applySpellAndDictationGuard(raw);
        const el = document.getElementById(targetId);
        if (el) {
            el.value = (el.value ? el.value + ' ' : '') + text;
            if (el.tagName === 'TEXTAREA') autoGrow(el);
            if (onDone) onDone(el.value);
        }
        showToast(changed ? `✨ تم التحويل والتصحيح: ${text}` : `✓ تم التحويل: ${text}`);
    };
    rec.onerror = () => showToast('⚠️ تعذر التقاط الصوت');
    rec.start();
}

/* ================= Settings, Staff/Zones Manager, New Site & Backup ================= */
function openNewSiteModal() {
    openModal(`
        <h3 class="card-title">🏗️ إضافة موقع جديد للشركة</h3>
        <label class="lbl">اسم الموقع (عربي / إنجليزي):</label><div class="inp-wrap"><input id="nsName" class="inp" placeholder="مثلاً: Al-Kufa Project"><button class="clr-btn" onclick="quickClearField('nsName')">✕</button></div>
        <label class="lbl">رقم DFL البدائي:</label><input type="number" id="nsDfl" class="inp" value="1">
        <label class="lbl">المناطق (مفصولة بفاصلة):</label><div class="inp-wrap"><input id="nsZones" class="inp" value="Z1, Z2, Z3, Z4, Nursery, Admin"><button class="clr-btn" onclick="quickClearField('nsZones')">✕</button></div>
        <div class="grid-2"><button class="btn btn-green" onclick="createNewSite()">إنشاء</button><button class="btn btn-outline" onclick="closeModal()">إلغاء</button></div>
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
        plan: {}, inventory: [], issues: [], stopMarker: null, logs: {}
    };
    state.activeSiteId = id; activeInvZoneId = null; getDayLog();
    closeModal(); saveState(); renderAll(); showToast('✓ تم إنشاء الموقع: ' + name);
}

function openSettingsModal() {
    const site = getSite();
    openModal(`
        <h3 class="card-title">⚙️ إعدادات الشركة والموقع</h3>
        <label class="lbl">قائد الفريق (Team Lead):</label><div class="inp-wrap"><input id="stTl" class="inp" value="${esc(state.company.teamLead)}"><button class="clr-btn" onclick="quickClearField('stTl')">✕</button></div>
        <label class="lbl">المشرف (Supervisor Ref):</label><div class="inp-wrap"><input id="stSup" class="inp" value="${esc(state.company.supervisor || 'Maitham Ibrahim')}"><button class="clr-btn" onclick="quickClearField('stSup')">✕</button></div>
        <div class="grid-2">
            <div><label class="lbl">وحدة الأطوال:</label><select id="stUnit" class="inp"><option value="م" ${state.company.heightUnit === 'م' ? 'selected' : ''}>المتر (م)</option><option value="سم" ${state.company.heightUnit === 'سم' ? 'selected' : ''}>السنتيمتر (سم)</option></select></div>
            <div><label class="lbl">أجر العامل الخارجي:</label><input type="number" id="stRate" class="inp" value="${state.company.outsideRate}"></div>
        </div>
        <label class="lbl">مناطق الموقع الحالي (مفصولة بفاصلة):</label>
        <div class="inp-wrap">
            <textarea id="stSiteZones" class="inp auto-grow" rows="2">${esc(site.zones.join(', '))}</textarea>
            <button class="clr-btn top-align" onclick="quickClearField('stSiteZones')">✕</button>
        </div>
        <button class="btn btn-blue btn-full" onclick="openStaffPoolManager()">👷 إدارة القائمة الدائمة للكادر (${state.company.staffPool.length})</button>
        <button class="btn btn-outline btn-full" style="color:var(--red);" onclick="purgeOldPhotos()">🧹 تنظيف الصور الأقدم من 30 يوم</button>
        <div class="grid-2"><button class="btn btn-green" onclick="saveSettings()">حفظ</button><button class="btn btn-outline" onclick="closeModal()">إغلاق</button></div>
    `);
}
function saveSettings() {
    state.company.teamLead = document.getElementById('stTl').value.trim();
    state.company.supervisor = document.getElementById('stSup').value.trim();
    state.company.heightUnit = document.getElementById('stUnit').value;
    state.company.outsideRate = parseFloat(document.getElementById('stRate').value) || 25000;
    const zArr = document.getElementById('stSiteZones').value.split(',').map(s => s.trim()).filter(Boolean);
    if (zArr.length) getSite().zones = zArr;
    closeModal(); saveState(); renderAll(); showToast('✓ تم حفظ الإعدادات');
}
function openStaffPoolManager() {
    openModal(`
        <h3 class="card-title">👷 القائمة الدائمة للكادر</h3>
        <div style="max-height:260px;overflow-y:auto;margin-bottom:10px;">
            ${state.company.staffPool.map((s, i) => `
                <div class="meter-card" style="padding:7px;display:flex;justify-content:space-between;align-items:center;">
                    <div><b style="font-size:12px;">${esc(s.name)}</b><div style="font-size:10px;color:var(--muted);">${esc(s.type)}</div></div>
                    <button class="btn btn-outline btn-sm" style="color:var(--red);" onclick="removeStaffFromPool(${i})">حذف</button>
                </div>
            `).join('')}
        </div>
        <button class="btn btn-outline btn-full" onclick="openSettingsModal()">رجوع للإعدادات</button>
    `);
}
function removeStaffFromPool(i) { state.company.staffPool.splice(i, 1); saveState(); openStaffPoolManager(); }

function purgeOldPhotos() {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    Object.values(state.sites).forEach(s => {
        Object.entries(s.logs).forEach(([d, l]) => { if (d < cutoff) { l.tasks.forEach(t => t.photos = []); l.meters.forEach(m => m.photos = []); } });
        s.inventory.forEach(z => z.plants.forEach(p => (p.entries || []).forEach(e => { if (e.date < cutoff) e.photos = []; })));
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

function openModal(html) { document.getElementById('genericModalBody').innerHTML = html; document.getElementById('genericModal').classList.add('active'); setTimeout(triggerAllAutoGrows, 20); }
function closeModal() { document.getElementById('genericModal').classList.remove('active'); }

window.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    getDayLog();
    renderAll();
});
