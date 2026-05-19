let isReadOnly = true; 
const SOFT_COLORS = ['#FFB3BA', '#BAE1FF', '#FFFFBA', '#BAE1BA', '#FFD7BA', '#E1BAFF', '#BAE1E1', '#FFE1BA', '#FFB3D9', '#B3E5FF', '#C8E6C9', '#FFE0B2', '#F8BBD0', '#D1C4E9', '#B2DFDB'];
const PERIODS = [{id:'1', t:'08:10-09:00'}, {id:'2', t:'09:10-10:00'}, {id:'3', t:'10:20-11:10'}, {id:'4', t:'11:20-12:10'}, {id:'N', t:'12:10-13:00', display:'4.5(B)'}, {id:'5', t:'13:10-14:00'}, {id:'6', t:'14:10-15:00'}, {id:'7', t:'15:20-16:10'}, {id:'8', t:'16:20-17:10'}, {id:'9', t:'17:20-18:10'}];
const DEPT_REQ_DATA = [{ name: "勞作", grade: 1, days: [1], periods: ['5'], sem: 3 }, { name: "勞作", grade: 1, days: [2], periods: ['5'], sem: 3 }, { name: "勞作", grade: 1, days: [3], periods: ['5'], sem: 3 }, { name: "勞作", grade: 1, days: [4], periods: ['5'], sem: 3 }, { name: "勞作", grade: 1, days: [5], periods: ['5'], sem: 3 }, { name: "英文", grade: 1, days: [1,3], periods: ['3','4'], sem: 3 }, { name: "英文", grade: 2, days: [5], periods: ['1','2'], sem: 2 }, { name: "國文", grade: 1, days: [5], periods: ['8','9'], sem: 3 }, { name: "體育", grade: 1, days: [3], periods: ['1','2'], sem: 3 }, { name: "體育", grade: 2, days: [4], periods: ['5','6'], sem: 3 }];

let currentYear = parseInt(localStorage.getItem('lastActiveYear')) || 114;
let courses = []; 
let schedule = {}; 
let teacherColors = {}; 
let teacherAvailability = {}; 
let teacherTextColors = {}; 
let teacherEvents = {}; 
let teacherCategories = {};
let currentTeacherFilter = 'ALL';

let historyStack = [];
let historyIndex = -1;

let settings = JSON.parse(localStorage.getItem('settings')) || { sat: false, sun: false, wd: [true,true,true,true], we: [true,true,true,true], currentSemester: 1, enableSplitTeacherSelection: true, enableNas: true };
if (!settings.currentSemester) settings.currentSemester = 1;
if (settings.enableSplitTeacherSelection === undefined) settings.enableSplitTeacherSelection = true;
if (settings.enableNas === undefined) settings.enableNas = true;
if (settings.sat === undefined) settings.sat = false;
if (settings.sun === undefined) settings.sun = false;
let collapsedTeachers = JSON.parse(localStorage.getItem('collapsedTeachers')) || [];

function selectReadOnlyMode() { 
    isReadOnly = true; 
    localStorage.setItem('savedAppMode', 'readonly'); // 記住選擇
    closeModeModal(); 
    updateUIForMode(); 
    loadDataForYear(); 
    if (settings.enableNas && !isNasSyncActive) autoInitNasSync(); 
}

async function selectEditMode() { 
    const { value: password } = await Swal.fire({ title: '請輸入編輯密碼', input: 'password', inputPlaceholder: '請輸入密碼', showCancelButton: true, confirmButtonText: '驗證', cancelButtonText: '取消' }); 
    if (password && password === '33900') { 
        isReadOnly = false; 
        localStorage.setItem('savedAppMode', 'edit'); // 記住選擇
        closeModeModal(); 
        updateUIForMode(); 
        loadDataForYear(); 
        if (settings.enableNas && !isNasSyncActive) autoInitNasSync(); 
    } else if (password !== undefined) { 
        Swal.fire('密碼錯誤', '無法進入編輯模式', 'error'); 
    } 
}

function closeModeModal() { document.getElementById('modeSelectionModal').classList.remove('is-active'); }
function updateUIForMode() { if (isReadOnly) { document.body.classList.add('read-only-mode'); } else { document.body.classList.remove('read-only-mode'); } }

function getStorageKey(baseKey) { return `${baseKey}_${currentYear}`; }

function normalizeScheduleKeys() {
    let keys = Object.keys(schedule); let fixedCount = 0;
    keys.forEach(key => {
        if (key.endsWith('-4.5')) { let newKey = key.replace(/-4\.5$/, '-N'); if (!schedule[newKey]) { schedule[newKey] = schedule[key]; delete schedule[key]; fixedCount++; } else { let existing = schedule[newKey]; let oldData = schedule[key]; oldData.forEach(id => { if(!existing.includes(id)) existing.push(id); }); delete schedule[key]; fixedCount++; } }
    });
    if (fixedCount > 0) { save(false); }
}

function syncToGlobal(baseKey) {
    let globalKey = baseKey + '_global';
    let gData = JSON.parse(localStorage.getItem(globalKey));
    if (!gData || Array.isArray(gData) || typeof gData !== 'object') gData = {}; 
    
    let isModified = false;
    for (let i = 0; i < localStorage.length; i++) {
        let key = localStorage.key(i);
        if (key.startsWith(baseKey + '_') && key !== globalKey) {
            let oldData = JSON.parse(localStorage.getItem(key));
            if (oldData && !Array.isArray(oldData) && typeof oldData === 'object') {
                for (let itemKey in oldData) {
                    if (gData[itemKey] === undefined) { 
                        gData[itemKey] = oldData[itemKey];
                        isModified = true;
                    }
                }
            }
        }
    }
    
    if (isModified) {
        localStorage.setItem(globalKey, JSON.stringify(gData));
    }
    return gData;
}

function loadDataForYear() {
    let loadedCourses = JSON.parse(localStorage.getItem(getStorageKey('courses')));
    courses = (loadedCourses && Array.isArray(loadedCourses)) ? loadedCourses : [];

    let loadedSchedule = JSON.parse(localStorage.getItem(getStorageKey('schedule')));
    schedule = (loadedSchedule && !Array.isArray(loadedSchedule) && typeof loadedSchedule === 'object') ? loadedSchedule : {};

    teacherColors = syncToGlobal('teacherColors');
    teacherAvailability = syncToGlobal('teacherAvailability');
    teacherTextColors = syncToGlobal('teacherTextColors');
    teacherEvents = syncToGlobal('teacherEvents');
    teacherCategories = syncToGlobal('teacherCategories');
    
    if (!settings.currentSemester) settings.currentSemester = 1;
    if (settings.enableSplitTeacherSelection === undefined) settings.enableSplitTeacherSelection = true;
    if (settings.enableNas === undefined) settings.enableNas = true;
    if (settings.sat === undefined) settings.sat = false;
    if (settings.sun === undefined) settings.sun = false;
    normalizeScheduleKeys(); 

    if (courses.length === 0 && !isReadOnly) {
        let prevYearCourses = JSON.parse(localStorage.getItem(`courses_${currentYear - 1}`));
        if (prevYearCourses && prevYearCourses.length > 0) {
            Swal.fire({
                title: `要複製 ${currentYear - 1} 學年的課程嗎？`,
                text: `偵測到 ${currentYear} 學年度目前沒有課程資料！是否要直接把 ${currentYear - 1} 學年度的「課程清單」複製過來？（只複製清單，排課時間會清空讓您重排）`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: '好，幫我複製！',
                cancelButtonText: '不用，我要重新建立'
            }).then((result) => {
                if (result.isConfirmed) {
                    courses = prevYearCourses;
                    schedule = {}; 
                    save(false);
                    render();
                    if (typeof autoSaveToNAS_Silent === 'function') autoSaveToNAS_Silent();
                    Swal.fire('複製成功', `已成功載入 ${currentYear - 1} 學年度的課程清單！`, 'success');
                }
            });
        }
    }
    
    historyStack = [{ courses: JSON.parse(JSON.stringify(courses)), schedule: JSON.parse(JSON.stringify(schedule)) }];
    historyIndex = 0;
    if (typeof updateUndoRedoUI === 'function') updateUndoRedoUI();

    if(typeof syncSettingsUI === 'function') syncSettingsUI(); 
    if(typeof render === 'function') render();
    autoLoadTeachers();
}

function autoLoadTeachers() {
    fetch('teachers.txt')
        .then(res => { if(!res.ok) throw new Error(); return res.text(); })
        .then(text => {
            if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
            const lines = text.split(/\r?\n/);
            let currentCategory = "未分類";
            let newCat = {};
            lines.forEach(line => {
                line = line.replace(/\r/g, '').trim();
                if(!line) return;
                let catMatch = line.match(/^\[(.*?)\]$/) || line.match(/^【(.*?)】$/);
                if(catMatch) {
                    currentCategory = catMatch[1].trim();
                } else {
                    if(!newCat[currentCategory]) newCat[currentCategory] = [];
                    if(!newCat[currentCategory].includes(line)) newCat[currentCategory].push(line);
                }
            });
            if(Object.keys(newCat).length > 0) {
                teacherCategories = newCat;
                localStorage.setItem('teacherCategories_global', JSON.stringify(teacherCategories));
            }
        }).catch(err => {});
}

function changeYear() {
    if(!isReadOnly) save();
    currentYear = parseInt(document.getElementById('yearSelect').value);
    localStorage.setItem('lastActiveYear', currentYear);
    loadDataForYear();
    Swal.fire({ title: `已切換至 ${currentYear} 學年度`, icon: 'info', timer: 1000, showConfirmButton: false });
}

function save(recordHistory = true) {
    if(isReadOnly) return;
    
    if(recordHistory) {
        if (historyIndex < historyStack.length - 1) { historyStack = historyStack.slice(0, historyIndex + 1); }
        historyStack.push({ courses: JSON.parse(JSON.stringify(courses)), schedule: JSON.parse(JSON.stringify(schedule)) });
        if (historyStack.length > 30) { historyStack.shift(); } else { historyIndex++; }
        if (typeof updateUndoRedoUI === 'function') updateUndoRedoUI();
    }

    localStorage.setItem(getStorageKey('courses'), JSON.stringify(courses));
    localStorage.setItem(getStorageKey('schedule'), JSON.stringify(schedule));
    localStorage.setItem('teacherColors_global', JSON.stringify(teacherColors));
    localStorage.setItem('teacherAvailability_global', JSON.stringify(teacherAvailability));
    localStorage.setItem('teacherTextColors_global', JSON.stringify(teacherTextColors));
    localStorage.setItem('teacherEvents_global', JSON.stringify(teacherEvents));
    localStorage.setItem('teacherCategories_global', JSON.stringify(teacherCategories));
    localStorage.setItem('settings', JSON.stringify(settings));
    localStorage.setItem('collapsedTeachers', JSON.stringify(collapsedTeachers));
    localStorage.setItem('lastActiveYear', currentYear);

    if (typeof autoSaveToNAS_Silent === 'function') autoSaveToNAS_Silent();
}

function importTeacherTxt(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.name !== 'teachers.txt') {
        Swal.fire('檔案名稱錯誤', '請匯入名為 teachers.txt 的檔案', 'error');
        event.target.value = "";
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        let text = e.target.result;
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const lines = text.split(/\r?\n/);
        let currentCategory = "未分類";
        teacherCategories = {};
        lines.forEach(line => {
            line = line.replace(/\r/g, '').trim();
            if(!line) return;
            let catMatch = line.match(/^\[(.*?)\]$/) || line.match(/^【(.*?)】$/);
            if(catMatch) {
                currentCategory = catMatch[1].trim();
            } else {
                if(!teacherCategories[currentCategory]) teacherCategories[currentCategory] = [];
                if(!teacherCategories[currentCategory].includes(line)) teacherCategories[currentCategory].push(line);
            }
        });
        save();
        Swal.fire('匯入成功', '教師名單已更新', 'success');
        event.target.value = "";
    };
    reader.readAsText(file, 'UTF-8');
}

function undo() {
    if (isReadOnly || historyIndex <= 0) return;
    historyIndex--;
    let state = historyStack[historyIndex];
    courses = JSON.parse(JSON.stringify(state.courses));
    schedule = JSON.parse(JSON.stringify(state.schedule));
    save(false); 
    if (typeof render === 'function') render();
    if (typeof updateUndoRedoUI === 'function') updateUndoRedoUI();
}

function redo() {
    if (isReadOnly || historyIndex >= historyStack.length - 1) return;
    historyIndex++;
    let state = historyStack[historyIndex];
    courses = JSON.parse(JSON.stringify(state.courses));
    schedule = JSON.parse(JSON.stringify(state.schedule));
    save(false); 
    if (typeof render === 'function') render();
    if (typeof updateUndoRedoUI === 'function') updateUndoRedoUI();
}

let apiEndpoint = './api.php';
let staticDataEndpoint = './schedule_data.json';
let isNasSyncActive = false;
let isStaticMode = false;
let syncInterval = null;
let lastServerTimestamp = 0;
let autoSaveTimeout = null;

function fetchWithTimeout(url, options = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

function autoInitNasSync() {
    if(!settings.enableNas) return;
    updateSyncUI('waiting', '連線中...');
    const btn = document.getElementById('btnNasSync');
    if(btn) { btn.classList.add('is-loading'); }

    fetchWithTimeout(apiEndpoint, {}, 3000)
    .then(res => { if(!res.ok) throw new Error(res.status); return res.json(); })
    .then(data => {
        if(btn) btn.classList.remove('is-loading');
        isNasSyncActive = true; isStaticMode = false; updateSyncUI('active');
        if (data.status !== 'empty' && data.timestamp > 0) {
            loadFromNasData(data); lastServerTimestamp = data.timestamp || 0;
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            Toast.fire({ icon: 'success', title: '已自動連線並載入雲端最新資料' });
        } else {
            const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            Toast.fire({ icon: 'info', title: '雲端尚無資料，使用本地存檔' });
        }
        if(syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(checkForUpdates, 5000);
    })
    .catch(err => {
        // api.php 無法連線，嘗試直接讀取靜態 schedule_data.json
        fetchWithTimeout(staticDataEndpoint, {}, 3000)
        .then(res => { if(!res.ok) throw new Error(res.status); return res.json(); })
        .then(data => {
            if(btn) btn.classList.remove('is-loading');
            if (data.timestamp > 0) {
                isStaticMode = true;
                loadFromNasData(data); lastServerTimestamp = data.timestamp || 0;
                updateSyncUI('waiting', '靜態模式');
                const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                Toast.fire({ icon: 'info', title: '已載入靜態資料 (唯讀)' });
            }
        })
        .catch(() => {
            if(btn) btn.classList.remove('is-loading');
            isNasSyncActive = false; isStaticMode = false; updateSyncUI('error', '離線');
        });
    });
}

function manualLoadFromNAS() {
    if(!settings.enableNas) return;
    const title = isStaticMode ? '重新載入靜態資料' : '從 NAS 下載課表';
    Swal.fire({ title: title, text: '這將會強制覆蓋目前的畫面，確定執行？', icon: 'warning', showCancelButton: true, confirmButtonText: '下載並覆蓋', cancelButtonText: '取消' }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: '連線中...', didOpen: () => Swal.showLoading() });
            const endpoint = isStaticMode ? staticDataEndpoint : apiEndpoint;
            fetchWithTimeout(endpoint, {}, 5000).then(res => res.json()).then(data => {
                if (data.status !== 'empty' && data.timestamp > 0) {
                    loadFromNasData(data); lastServerTimestamp = data.timestamp || 0;
                    Swal.fire('載入成功', isStaticMode ? '已重新載入靜態資料' : '已同步 NAS 最新資料', 'success');
                    if(!isNasSyncActive && !isStaticMode) { isNasSyncActive = true; updateSyncUI('active'); syncInterval = setInterval(checkForUpdates, 5000); }
                } else { Swal.fire('資料為空', '伺服器上還沒有任何存檔', 'info'); }
            }).catch(err => { Swal.fire('載入失敗', '無法取得資料: ' + err.message, 'error'); });
        }
    });
}

function autoSaveToNAS_Silent() {
    if (isReadOnly || !settings.enableNas || !isNasSyncActive || isStaticMode) return;
    
    const txt = document.getElementById('nasStatusText');
    if (txt) txt.innerText = '同步中...'; 

    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        let exportObj = {}; exportObj['settings'] = settings; exportObj['collapsedTeachers'] = collapsedTeachers; exportObj['lastActiveYear'] = currentYear;
        for (let i = 0; i < localStorage.length; i++) { 
            let key = localStorage.key(i); 
            if (key.startsWith('courses_') || key.startsWith('schedule_') || key.startsWith('teacherColors_') || key.startsWith('teacherTextColors_') || key.startsWith('teacherAvailability_') || key.startsWith('teacherEvents_') || key.startsWith('teacherCategories_')) { 
                exportObj[key] = JSON.parse(localStorage.getItem(key)); 
            } 
        }
        fetchWithTimeout(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exportObj) }, 5000)
        .then(res => res.json())
        .then(result => { 
            if (result.status === 'success') { 
                lastServerTimestamp = result.timestamp; 
                if (txt) txt.innerText = '已自動儲存'; 
            } 
        })
        .catch(err => { 
            if (txt) txt.innerText = '儲存失敗'; 
        });
    }, 1000); 
}

function toggleNasSync() {
    if (isReadOnly || !settings.enableNas) return;
    const btn = document.getElementById('btnNasSync');
    if (isNasSyncActive) {
        isNasSyncActive = false; clearInterval(syncInterval); document.getElementById('nasSyncStatus').style.display = 'none';
        btn.classList.remove('is-success', 'is-danger'); btn.classList.add('is-link', 'is-light'); btn.querySelector('span:last-child').innerText = 'NAS 同步';
        Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'NAS 同步已關閉', showConfirmButton: false, timer: 1500 });
    } else {
        if (window.location.protocol === 'file:') { Swal.fire('環境錯誤', '請透過 http:// 網址開啟。', 'error'); return; }
        btn.classList.remove('is-link', 'is-light'); btn.classList.add('is-warning'); btn.querySelector('span:last-child').innerText = '連線中...';
        autoInitNasSync();
    }
}

function updateSyncUI(status, message) {
    const el = document.getElementById('nasSyncStatus'); const txt = document.getElementById('nasStatusText'); const btn = document.getElementById('btnNasSync');
    if(!el || !btn || !txt) return;
    el.style.display = settings.enableNas ? 'flex' : 'none'; el.className = 'sync-status'; 
    if (status === 'active') { el.classList.add('sync-active', 'sync-pulse'); txt.innerText = '已連線'; btn.classList.remove('is-warning', 'is-danger', 'is-light', 'is-link'); btn.classList.add('is-success'); btn.querySelector('span:last-child').innerText = '同步開啟'; }
    else if (status === 'error') { el.classList.add('sync-error'); txt.innerText = message || '錯誤'; btn.classList.remove('is-warning', 'is-success'); btn.classList.add('is-danger'); btn.querySelector('span:last-child').innerText = '連線失敗'; }
    else if (status === 'waiting') { el.classList.add('sync-waiting'); txt.innerText = message || '連線中...'; }
}

function checkForUpdates() {
    if (!isNasSyncActive || !settings.enableNas) return;
    fetchWithTimeout(apiEndpoint, {}, 5000).then(res => res.json()).then(data => {
        if (data.status === 'empty') return;
        if (data.timestamp && data.timestamp > lastServerTimestamp) {
            const el = document.getElementById('nasSyncStatus'); el.classList.remove('sync-pulse'); el.classList.add('sync-error'); document.getElementById('nasStatusText').innerText = '有新版本！';
            Swal.fire({ title: '資料已更新', text: '雲端有新版本，請載入以免資料衝突。', icon: 'warning', confirmButtonText: '立即載入' }).then(() => { loadFromNasData(data); lastServerTimestamp = data.timestamp; updateSyncUI('active'); });
        }
    }).catch(err => {});
}

function loadFromNasData(data) {
    if (data.settings) localStorage.setItem('settings', JSON.stringify(data.settings));
    if (data.collapsedTeachers) localStorage.setItem('collapsedTeachers', JSON.stringify(data.collapsedTeachers));
    if (data.lastActiveYear) { localStorage.setItem('lastActiveYear', data.lastActiveYear); currentYear = parseInt(data.lastActiveYear); document.getElementById('yearSelect').value = currentYear; }
    for (let key in data) { if (key.startsWith('courses_') || key.startsWith('schedule_') || key.startsWith('teacherColors_') || key.startsWith('teacherTextColors_') || key.startsWith('teacherAvailability_') || key.startsWith('teacherEvents_') || key.startsWith('teacherCategories_')) { localStorage.setItem(key, JSON.stringify(data[key])); } }
    settings = data.settings || settings; collapsedTeachers = data.collapsedTeachers || collapsedTeachers; loadDataForYear(); 
}

function saveToNAS() { if(isReadOnly || !settings.enableNas) return; save(); if (!isNasSyncActive) { oneTimeSave(); return; } performSave(); }

function oneTimeSave() {
    Swal.fire({ title: '連線中...', didOpen: () => Swal.showLoading() });
    fetchWithTimeout(apiEndpoint, {}, 3000).then(res => { if(!res.ok) throw new Error('API 無法連線'); return res.json(); }).then(serverData => { if (serverData.timestamp && serverData.timestamp > lastServerTimestamp) { Swal.fire({ title: '版本衝突', text: '雲端有新資料，無法覆蓋。', icon: 'error', confirmButtonText: '載入新版' }).then(()=> loadFromNasData(serverData)); } else { performSave(); } }).catch(err => { Swal.fire('無法連線', '請確認 api.php 存在且可存取', 'error'); });
}

function performSave() {
    let exportObj = {}; exportObj['settings'] = settings; exportObj['collapsedTeachers'] = collapsedTeachers; exportObj['lastActiveYear'] = currentYear;
    for (let i = 0; i < localStorage.length; i++) { let key = localStorage.key(i); if (key.startsWith('courses_') || key.startsWith('schedule_') || key.startsWith('teacherColors_') || key.startsWith('teacherTextColors_') || key.startsWith('teacherAvailability_') || key.startsWith('teacherEvents_') || key.startsWith('teacherCategories_')) { exportObj[key] = JSON.parse(localStorage.getItem(key)); } }
    const btn = document.querySelectorAll('button[onclick="saveToNAS()"]')[0]; btn.classList.add('is-loading');
    fetchWithTimeout(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exportObj) }, 8000).then(res => res.json()).then(result => { btn.classList.remove('is-loading'); if (result.status === 'success') { lastServerTimestamp = result.timestamp; Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '儲存成功', showConfirmButton: false, timer: 1500 }); } else { throw new Error(result.message); } }).catch(err => { btn.classList.remove('is-loading'); Swal.fire('儲存失敗', err.message, 'error'); });
}

// 自動登入判斷機制
window.addEventListener('DOMContentLoaded', () => {
    const savedMode = localStorage.getItem('savedAppMode');
    
    // 如果有記憶過模式，直接關閉歡迎視窗並載入
    if (savedMode === 'edit') {
        isReadOnly = false;
        closeModeModal();
        updateUIForMode();
        loadDataForYear();
    } else if (savedMode === 'readonly') {
        isReadOnly = true;
        closeModeModal();
        updateUIForMode();
        loadDataForYear();
    }

    // NAS 自動連線 (確保只在歡迎畫面關閉時啟動)
    setTimeout(() => {
        if (!document.getElementById('modeSelectionModal').classList.contains('is-active')) {
            if (settings.enableNas && !isNasSyncActive && typeof autoInitNasSync === 'function') {
                autoInitNasSync();
            }
        }
    }, 500);
});