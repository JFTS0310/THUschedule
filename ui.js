function updateUndoRedoUI() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    if(btnUndo) btnUndo.disabled = (typeof historyIndex !== 'undefined' && historyIndex <= 0);
    if(btnRedo) btnRedo.disabled = (typeof historyIndex !== 'undefined' && typeof historyStack !== 'undefined' && historyIndex >= historyStack.length - 1);
}

let currentDragState = null;
let lastHoveredSlot = null;

function clearPreviews() {
    document.querySelectorAll('.course-block-preview').forEach(el => el.remove());
    document.querySelectorAll('.drop-highlight').forEach(el => el.classList.remove('drop-highlight'));
}

function handleDragEnd() {
    document.body.classList.remove('is-dragging'); 
    clearHighlights(); 
    clearPreviews();
    currentDragState = null;
    lastHoveredSlot = null;
}

function handleDragOver(e, slotId, td) {
    e.preventDefault();
    if (isReadOnly || !currentDragState) return;

    td.classList.add('drop-highlight');

    if (lastHoveredSlot === slotId) return;
    lastHoveredSlot = slotId;

    document.querySelectorAll('.course-block-preview').forEach(el => el.remove());

    const [d, g, pStart] = slotId.split('-');
    const pIdx = PERIODS.findIndex(p => p.id === pStart);
    let actualStartIndex = pIdx - currentDragState.offset;

    if (actualStartIndex < 0 || actualStartIndex + currentDragState.dur > PERIODS.length) return;

    let startTd = document.querySelector(`td[data-dp="${d}-${PERIODS[actualStartIndex].id}"][data-grade="${g}"]`);
    if (startTd) {
        let div = document.createElement('div');
        div.className = 'course-block course-block-preview';
        let c = currentDragState.course;

        let tList = c.teacher.split(',').map(t=>t.trim()).filter(t=>t);
        let firstTeacher = tList[0] || "";
        let secondTeacher = tList[1] || "";
        
        let bg = 'white'; let txt = 'black'; let bs = 'none';
        if (c.isDeptReq) { 
            bg = 'white'; txt = 'red'; bs = 'inset 0 0 0 1px red'; 
        } else if (tList.length === 1) { 
            bg = teacherColors[firstTeacher] || '#cccccc'; txt = teacherTextColors[firstTeacher] || 'black'; bs = 'inset 0 0 0 1px rgba(0,0,0,0.1)'; 
        } else if (tList.length === 2) { 
            bg = teacherColors[firstTeacher] || '#cccccc'; txt = teacherTextColors[firstTeacher] || 'black'; bs = `inset 0 0 0 3px ${teacherColors[secondTeacher] || '#666'}`; 
        } else if (tList.length >= 3) { 
            bg = 'linear-gradient(135deg, #ffb3ba, #ffdfba, #ffffba, #baffc9, #bae1ff)'; txt = 'black'; bs = 'inset 0 0 0 1px rgba(0,0,0,0.1)'; 
        }

        div.style.background = bg;
        div.style.color = txt;
        div.style.boxShadow = bs;
        div.style.border = 'none';

        let duration = currentDragState.dur;
        div.style.height = `calc(${duration * 100}% + ${(duration-1)}px - 1px)`;
        div.style.top = '1px';
        div.style.width = `calc(100% - 6px)`;
        div.style.left = `3px`;

        let rawName = c.name; let room = ""; let rMatch = rawName.match(/\[(.*?)\]/);
        if(rMatch) { room = rMatch[1]; rawName = rawName.replace(/\[.*?\]/g, '').trim(); }
        let dispName = rawName;
        if (!dispName.includes('專討') && !dispName.includes('專題')) dispName = dispName.replace(/\(\d+\)$/, '');
        dispName = dispName.replace(/(\((?:必|選)\))/g, '<span style="font-weight:normal; font-size: calc(1em - 4px);">$1</span>');

        let c_classFilter = c.classFilter || 'all';
        let c_idFilter = c.idFilter || 'all';
        if(c_idFilter === 'A') { c_classFilter = 'A'; c_idFilter = 'all'; }
        if(c_idFilter === 'B') { c_classFilter = 'B'; c_idFilter = 'all'; }

        let idFilterStr = "";
        if (c_classFilter === 'A') idFilterStr += '<br><span style="color:#008000; font-weight:bold; font-size:0.9em;">(A班)</span>';
        if (c_classFilter === 'B') idFilterStr += '<br><span style="color:#800080; font-weight:bold; font-size:0.9em;">(B班)</span>';
        if (c_idFilter === 'odd') idFilterStr += '<br><span style="color:#0055aa; font-weight:bold; font-size:0.9em;">(單)</span>';
        if (c_idFilter === 'even') idFilterStr += '<br><span style="color:#aa5500; font-weight:bold; font-size:0.9em;">(雙)</span>';
        dispName += idFilterStr;

        let infoHtml = c.teacher; 
        if(room) { infoHtml += `<br><span style="font-size:0.9em; font-weight:bold;">${room}</span>`; }
        
        div.innerHTML = `<div>${dispName}</div><div class="course-info">${infoHtml}</div>`;
        startTd.appendChild(div);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    let isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    let btn = document.getElementById('btnDarkMode');
    if(btn) btn.innerHTML = isDark ? '<span class="icon"><i class="fas fa-sun" style="color:#f1c40f;"></i></span>' : '<span class="icon"><i class="fas fa-moon"></i></span>';
}

function setupAutocomplete(inp) {
    if(!inp) return;
    inp.parentNode.style.position = "relative";
    function triggerList(e) {
        if(e && e.type === 'click') e.stopPropagation();
        let val = inp.value;
        closeAllLists();
        let parts = val ? val.split(',') : [""];
        let currentPart = parts[parts.length-1].trim();
        
        let a = document.createElement("DIV");
        a.setAttribute("id", inp.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        a.style.position = "absolute";
        a.style.backgroundColor = "white";
        a.style.border = "1px solid #d4d4d4";
        a.style.borderTop = "none";
        a.style.zIndex = "99999";
        a.style.top = "100%";
        a.style.left = "0";
        a.style.right = "0";
        a.style.maxHeight = "200px";
        a.style.overflowY = "auto";
        a.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
        inp.parentNode.appendChild(a);

        let hasItems = false;
        for (let category in teacherCategories) {
            let catAdded = false;
            teacherCategories[category].forEach(t => {
                if (currentPart === "" || t.toLowerCase().includes(currentPart.toLowerCase())) {
                    hasItems = true;
                    if (!catAdded) {
                        let cDiv = document.createElement("DIV");
                        cDiv.innerHTML = `<strong style="color:#3273dc;font-size:0.75rem;padding:4px 8px;background:#f5f5f5;display:block;">[${category}]</strong>`;
                        a.appendChild(cDiv);
                        catAdded = true;
                    }
                    let b = document.createElement("DIV");
                    b.style.padding = "8px";
                    b.style.cursor = "pointer";
                    b.style.fontSize = "0.85rem";
                    b.style.borderBottom = "1px solid #eee";
                    b.innerHTML = t;
                    b.addEventListener("click", function(ev) {
                        ev.stopPropagation();
                        parts[parts.length-1] = t;
                        inp.value = parts.map(x => x.trim()).filter(x => x).join(", ") + ", ";
                        closeAllLists();
                        inp.focus();
                    });
                    a.appendChild(b);
                }
            });
        }
        if(!hasItems) closeAllLists();
    }

    inp.addEventListener("input", triggerList);
    inp.addEventListener("focus", triggerList);
    inp.addEventListener("click", triggerList);

    function closeAllLists(elmnt) {
        let x = document.getElementsByClassName("autocomplete-items");
        for (let i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    document.addEventListener("click", function (e) { 
        if(e.target !== inp && !e.target.closest('.autocomplete-items')) {
            closeAllLists();
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    let isDark = localStorage.getItem('darkMode') === 'true';
    if(isDark) {
        document.body.classList.add('dark-mode');
        let btn = document.getElementById('btnDarkMode');
        if(btn) btn.innerHTML = '<span class="icon"><i class="fas fa-sun" style="color:#f1c40f;"></i></span>';
    }

    setupAutocomplete(document.getElementById('mTeacher'));
    setupAutocomplete(document.getElementById('eTeacher'));

    document.addEventListener('keydown', (e) => {
        if (document.querySelector('.swal2-container')) return;

        if (e.key === 'Enter') {
            if (document.getElementById('courseModal').classList.contains('is-active')) {
                e.preventDefault(); addCourse(); return;
            } else if (document.getElementById('editCourseModal').classList.contains('is-active')) {
                e.preventDefault(); submitEdit(); return;
            } else if (document.getElementById('teacherSettingsModal').classList.contains('is-active')) {
                e.preventDefault(); saveTeacherSettings(); return;
            } else if (document.getElementById('settingsModal').classList.contains('is-active')) {
                e.preventDefault(); closeSettingsModal(); return;
            }
        }

        if (isReadOnly) return;
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redo();
        }
    });

    const sidebar = document.getElementById('sidebar');
    if(sidebar) {
        sidebar.ondragover = (e) => {
            e.preventDefault();
            if(!isReadOnly) sidebar.classList.add('drop-remove-highlight');
        };
        sidebar.ondragleave = (e) => {
            sidebar.classList.remove('drop-remove-highlight');
        };
        sidebar.ondrop = (e) => {
            e.preventDefault();
            sidebar.classList.remove('drop-remove-highlight');
            if(isReadOnly) return;
            const src = e.dataTransfer.getData('src');
            const cId = e.dataTransfer.getData('cId');
            if(src === 'timetable' && cId) { clearCourse(cId); }
            handleDragEnd();
        };
    }
});

function openSettingsModal() {
    document.getElementById('settingsModal').classList.add('is-active');
    syncSettingsUI();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('is-active');
}

function updateSettings() {
    const semRadios = document.getElementsByName('semView');
    for(let r of semRadios) { if(r.checked) settings.currentSemester = parseInt(r.value); }

    settings.wd = [
        document.getElementById('g1').checked,
        document.getElementById('g2').checked,
        document.getElementById('g3').checked,
        document.getElementById('g4').checked
    ];
    
    settings.sat = document.getElementById('showSat').checked;
    settings.sun = document.getElementById('showSun').checked;
    settings.enableSplitTeacherSelection = document.getElementById('settingSplitTeacher').checked;
    settings.enableNas = document.getElementById('settingEnableNas').checked;

    if(!isReadOnly) save();
    syncSettingsUI();
    render();
}

function syncSettingsUI() {
    let semVal = settings.currentSemester || 1;
    let r = document.querySelector(`input[name="semView"][value="${semVal}"]`);
    if(r) r.checked = true;

    if(settings.wd && settings.wd.length >= 4) {
        document.getElementById('g1').checked = settings.wd[0];
        document.getElementById('g2').checked = settings.wd[1];
        document.getElementById('g3').checked = settings.wd[2];
        document.getElementById('g4').checked = settings.wd[3];
    }
    
    let chkSat = document.getElementById('showSat');
    if(chkSat) chkSat.checked = settings.sat;
    
    let chkSun = document.getElementById('showSun');
    if(chkSun) chkSun.checked = settings.sun;
    
    let splitToggle = document.getElementById('settingSplitTeacher');
    if(splitToggle) splitToggle.checked = settings.enableSplitTeacherSelection !== false;
    
    let nasToggle = document.getElementById('settingEnableNas');
    if(nasToggle) nasToggle.checked = settings.enableNas !== false;

    let enableNas = settings.enableNas !== false;
    let btnManualNas = document.getElementById('btnManualNas'); if(btnManualNas) btnManualNas.style.display = enableNas ? 'inline-flex' : 'none';
    let btnNasSync = document.getElementById('btnNasSync'); if(btnNasSync) btnNasSync.style.display = enableNas ? 'inline-flex' : 'none';
    let btnSaveNas = document.getElementById('btnSaveNas'); if(btnSaveNas) btnSaveNas.style.display = enableNas ? 'inline-flex' : 'none';
    let nasStatus = document.getElementById('nasSyncStatus'); if(nasStatus && !enableNas) nasStatus.style.display = 'none';
}

function toggleMIndependent(show) { document.getElementById('mIndependentField').style.display = show ? 'block' : 'none'; if(!show) document.getElementById('mIndependent').checked = false; }
function toggleEIndependent(show) { document.getElementById('eIndependentField').style.display = show ? 'block' : 'none'; if(!show) document.getElementById('eIndependent').checked = false; }

function toggleDeptReqs() {
    if(isReadOnly) return;
    let exists = courses.some(c => c.isDeptReq);
    if (exists) {
        let idsToRemove = courses.filter(c => c.isDeptReq).map(c => c.id);
        courses = courses.filter(c => !c.isDeptReq);
        Object.keys(schedule).forEach(key => { schedule[key] = schedule[key].filter(id => !idsToRemove.includes(id)); if(schedule[key].length === 0) delete schedule[key]; });
        Swal.fire('已移除', '電機系校必修已移除', 'success');
    } else {
        let newCourses = []; let conflictCount = 0;
        getDeptReqData().forEach((req, idx) => {
            let reqId = `dept_req_${idx}_${Date.now()}`; let reqSem = req.sem || 3; 
            req.days.forEach(d => {
                req.periods.forEach(p => {
                    let key = `${d}-${req.grade}-${p}`;
                    if (schedule[key] && schedule[key].length > 0) { conflictCount += schedule[key].length; delete schedule[key]; }
                    if (!schedule[key]) schedule[key] = []; schedule[key].push(reqId);
                });
            });
            newCourses.push({ id: reqId, name: req.name + "(校)", teacher: "校必修", periods: req.days.length * req.periods.length, isSplit: false, allowedGrades: [req.grade], courseType: 'required', isIndependent: true, isDeptReq: true, isLocked: false, semester: reqSem, idFilter: 'all', classFilter: 'all' });
        });
        courses = [...courses, ...newCourses];
        let msg = '電機系校必修已載入'; if(conflictCount > 0) msg += `，並移除了 ${conflictCount} 個衝突時段的課程回到列表`;
        Swal.fire('已載入', msg, 'success');
    }
    save(); render();
}

function clearScheduleOnly() {
    if(isReadOnly) return;
    Swal.fire({ title: '確定清除課表?', text: "所有課程將回到左側列表", icon: 'warning', showCancelButton: true, confirmButtonText: '清除', cancelButtonText: '取消' }).then((result) => {
        if (result.isConfirmed) { schedule = {}; save(); render(); }
    });
}

function clearAllData() {
    if(isReadOnly) return;
    Swal.fire({ title: '確定清除所有資料?', text: "這將會刪除所有課程與設定，無法復原！", icon: 'error', showCancelButton: true, confirmButtonText: '全部刪除', cancelButtonText: '取消' }).then((result) => {
        if (result.isConfirmed) { localStorage.clear(); location.reload(); }
    });
}

function calculateColumnLayout(day, grade) {
    let events = []; let colKeyPrefix = `${day}-${grade}-`; let rawSlots = {}; 
    let currSem = parseInt(settings.currentSemester);
    PERIODS.forEach((p, idx) => {
        let key = colKeyPrefix + p.id;
        if(schedule[key] && schedule[key].length > 0) {
            let validIds = schedule[key].filter(cId => {
                let c = courses.find(x => x.id === cId); if (!c) return false;
                let cSem = c.semester || 3; return (cSem == 3 || cSem == currSem);
            });
            if (validIds.length > 0) rawSlots[idx] = validIds;
        }
    });
    let processedCourseIds = new Set();
    Object.values(rawSlots).flat().forEach(cId => {
        if(processedCourseIds.has(cId)) return;
        let indices = []; for(let idx in rawSlots) { if(rawSlots[idx].includes(cId)) indices.push(parseInt(idx)); }
        indices.sort((a,b)=>a-b);
        if(indices.length > 0) {
            let start = indices[0]; let prev = start;
            for(let i=1; i<indices.length; i++) { if(indices[i] !== prev + 1) { events.push({ cId: cId, start: start, end: prev }); start = indices[i]; } prev = indices[i]; }
            events.push({ cId: cId, start: start, end: prev });
        }
        processedCourseIds.add(cId);
    });
    events.sort((a,b) => (a.start - b.start) || ((b.end - b.start) - (a.end - a.start)));
    let tracks = []; 
    events.forEach(ev => { let placed = false; for(let i=0; i<tracks.length; i++) { if(tracks[i] < ev.start) { ev.track = i; tracks[i] = ev.end; placed = true; break; } } if(!placed) { ev.track = tracks.length; tracks.push(ev.end); } });
    
    let maxTracks = Math.max(1, tracks.length);
    events.forEach(ev => {
        let maxSpan = maxTracks - ev.track;
        for (let other of events) {
            if (other === ev) continue;
            if (ev.start <= other.end && ev.end >= other.start) {
                if (other.track > ev.track) {
                    maxSpan = Math.min(maxSpan, other.track - ev.track);
                }
            }
        }
        ev.span = maxSpan;
    });

    return { events, maxTracks: maxTracks };
}

function applyTeacherFilter() { currentTeacherFilter = document.getElementById('teacherFilterSelect').value; render(); }

function renderTeacherFilterOptions() {
    let select = document.getElementById('teacherFilterSelect'); let teachers = new Set(); 
    courses.forEach(c => {
        let tList = c.teacher.split(',').map(t=>t.trim()).filter(t=>t);
        tList.forEach(t => teachers.add(t));
    });
    let sortedTeachers = Array.from(teachers).sort(); let oldVal = select.value;
    select.innerHTML = '<option value="ALL">👨‍🏫 全部教師</option>';
    sortedTeachers.forEach(t => { let opt = document.createElement('option'); opt.value = t; opt.innerText = t; select.appendChild(opt); });
    if (sortedTeachers.includes(oldVal)) select.value = oldVal; else { select.value = "ALL"; currentTeacherFilter = "ALL"; }
}

function render() { 
    courses.forEach(c => { if (c.isDeptReq) c.isLocked = false; });

    renderTeacherFilterOptions();
    let teacherCounts = {}; courses.forEach(c => { 
        let tList = c.teacher.split(',').map(t=>t.trim()).filter(t=>t);
        tList.forEach(t => {
            if(!teacherCounts[t]) teacherCounts[t] = 0; 
            teacherCounts[t]++; 
        });
    });
    courses.sort((a, b) => {
        if (a.isDeptReq && !b.isDeptReq) return -1; if (!a.isDeptReq && b.isDeptReq) return 1;
        let aT = a.teacher.split(',')[0].trim();
        let bT = b.teacher.split(',')[0].trim();
        let countDiff = (teacherCounts[bT] || 0) - (teacherCounts[aT] || 0); if (countDiff !== 0) return countDiff;
        let teacherDiff = aT.localeCompare(bT); if (teacherDiff !== 0) return teacherDiff;
        return a.name.localeCompare(b.name);
    });
    const semLabel = document.getElementById('currentSemLabel'); const yearLabel = document.getElementById('currentYearLabel');
    yearLabel.innerText = `${currentYear}學年`;
    if (settings.currentSemester == 1) semLabel.innerText = "上學期"; else if (settings.currentSemester == 2) semLabel.innerText = "下學期"; else semLabel.innerText = "";
    renderSidebar(); renderTimetable(); renderLegend(); adjustCourseFonts();
}

function adjustCourseFonts() {
    const blocks = document.querySelectorAll('.course-block');
    const wrapper = document.querySelector('.screenshot-wrapper');
    // getBoundingClientRect 會回傳縮放後的視覺尺寸，需除以 zoom 還原真實寬度
    const zoomFactor = parseFloat(wrapper?.style.zoom) || 1;

    blocks.forEach(block => {
        const width = block.getBoundingClientRect().width / zoomFactor;
        const duration = parseInt(block.getAttribute('data-duration')) || 1;

        let calcSize = width / 3.2;
        const nameDiv = block.querySelector('div:first-child');
        const textLength = nameDiv ? nameDiv.innerText.length : 0;

        if (textLength <= 4) calcSize = width / 2.5;
        const isExportMode = document.body.classList.contains('is-exporting');
        let finalSize = Math.floor(calcSize);
        if (finalSize > (isExportMode ? 22 : 15)) finalSize = isExportMode ? 22 : 15;
        if (nameDiv && nameDiv.innerText.length > 6 && duration === 1) finalSize -= 2.5;

        // 極限字體縮放
        if (finalSize < 11) finalSize = (width < 35) ? 6.5 : 8.5;

        block.style.fontSize = `${finalSize}px`;

        let infoDiv = block.querySelector('.course-info');
        if (infoDiv) {
            let infoSize = finalSize - 1.2;
            if (infoSize < 6) infoSize = 6;
            infoDiv.style.fontSize = `${infoSize}px`;
            infoDiv.style.lineHeight = '1.05';
            infoDiv.style.marginTop = '1px';
        }
    });
}

function renderSidebar() {
    const list = document.getElementById('courseList'); list.innerHTML = '';
    
    let searchInput = document.getElementById('courseSearchInput');
    let searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let coursesByTeacher = {}; let teacherOrder = []; let currSem = parseInt(settings.currentSemester);
    
    let visibleCourses = courses.filter(c => { 
        let cSem = c.semester || 3; 
        let matchSem = (cSem == 3 || cSem == currSem);
        let matchSearch = searchTerm === '' || 
                          c.name.toLowerCase().includes(searchTerm) || 
                          c.teacher.toLowerCase().includes(searchTerm);
        return matchSem && matchSearch; 
    });
    
    visibleCourses.forEach(c => { 
        let tList = c.teacher.split(',').map(t=>t.trim()).filter(t=>t);
        if(tList.length === 0) tList = ["未指定"];
        tList.forEach(t => {
            if (!coursesByTeacher[t]) { coursesByTeacher[t] = []; teacherOrder.push(t); } 
            coursesByTeacher[t].push(c); 
        });
    });

    teacherOrder.forEach(teacher => {
        let processedParents = new Set();
        let teacherCourses = coursesByTeacher[teacher]; 
        let isCollapsed = (searchTerm !== '') ? false : collapsedTeachers.includes(teacher);
        let arrowIcon = isCollapsed ? 'fa-angle-right' : 'fa-angle-down';
        let tColor = teacherColors[teacher] || '#ccc'; if(teacher === "校必修") tColor = 'red';
        let uniqueCourses = new Set(); teacherCourses.forEach(c => { if(c.parentId) uniqueCourses.add(c.parentId); else uniqueCourses.add(c.id); });
        let uniqueCount = uniqueCourses.size;

        let groupDiv = document.createElement('div'); groupDiv.className = 'teacher-group';
        let headerDiv = document.createElement('div'); headerDiv.className = 'teacher-header'; headerDiv.style.borderLeftColor = tColor; 
        let displayName = teacher;
        headerDiv.innerHTML = `<span><span class="icon"><i class="fas ${arrowIcon}"></i></span> ${displayName}</span> <span class="tag is-light is-rounded">${uniqueCount}</span>`;
        headerDiv.onclick = () => toggleTeacherCollapse(teacher);
        groupDiv.appendChild(headerDiv);

        let contentDiv = document.createElement('div'); contentDiv.className = `teacher-content ${isCollapsed ? 'is-collapsed' : ''}`;
        teacherCourses.forEach(c => { let cardHtml = createCourseCard(c, processedParents, teacher); if (cardHtml) contentDiv.appendChild(cardHtml); });

        groupDiv.appendChild(contentDiv); list.appendChild(groupDiv);
    });
}

function toggleTeacherCollapse(teacher) {
    if (collapsedTeachers.includes(teacher)) collapsedTeachers = collapsedTeachers.filter(t => t !== teacher); else collapsedTeachers.push(teacher);
    localStorage.setItem('collapsedTeachers', JSON.stringify(collapsedTeachers)); renderSidebar();
}

function getSemTag(sem) { if (sem == 1) return `<span class="sem-tag sem-1">上</span>`; if (sem == 2) return `<span class="sem-tag sem-2">下</span>`; return `<span class="sem-tag sem-3">全</span>`; }

function createCourseCard(c, processedParents, currentTeacher) {
    let borderColor = c.isDeptReq ? '#ff0000' : (teacherColors[currentTeacher] || '#ccc');
    let isLockedClass = c.isLocked ? 'is-locked' : ''; let semTag = getSemTag(c.semester || 3);

    let c_classFilter = c.classFilter || 'all';
    let c_idFilter = c.idFilter || 'all';
    
    // 向前相容處理：之前把 A, B 存在 idFilter
    if(c_idFilter === 'A') { c_classFilter = 'A'; c_idFilter = 'all'; }
    if(c_idFilter === 'B') { c_classFilter = 'B'; c_idFilter = 'all'; }

    let idFilterStr = "";
    if (c_classFilter === 'A') idFilterStr += '<span class="tag is-rounded is-light is-small" style="font-size:10px; padding:0 4px; height:1.5em; border:1px solid #999; color:#008000; margin-left:5px;">A班</span>';
    if (c_classFilter === 'B') idFilterStr += '<span class="tag is-rounded is-light is-small" style="font-size:10px; padding:0 4px; height:1.5em; border:1px solid #999; color:#800080; margin-left:5px;">B班</span>';
    if (c_idFilter === 'odd') idFilterStr += '<span class="tag is-rounded is-light is-small" style="font-size:10px; padding:0 4px; height:1.5em; border:1px solid #999; color:#0055aa; margin-left:5px;">單號</span>';
    if (c_idFilter === 'even') idFilterStr += '<span class="tag is-rounded is-light is-small" style="font-size:10px; padding:0 4px; height:1.5em; border:1px solid #999; color:#aa5500; margin-left:5px;">雙號</span>';

    if(c.parentId) {
        if(processedParents.has(c.parentId)) return null; processedParents.add(c.parentId);
        let siblings = courses.filter(x => x.parentId === c.parentId).sort((a,b) => a.periods - b.periods);
        let baseName = siblings[0].name.replace(/\(必\)$/, '').replace(/\(選\)$/, '').replace(/\(校\)$/, '');
        
        if (!baseName.includes('專討') && !baseName.includes('專題')) {
            baseName = baseName.replace(/\(\d+\)$/, '');
        }

        let roomMatch = baseName.match(/\[(.*?)\]/); let roomStr = "";
        if(roomMatch) { roomStr = roomMatch[1]; baseName = baseName.replace(/\[.*?\]/g, '').trim(); }
        let typeSuffix = ""; if (siblings[0].courseType === 'required') typeSuffix = " (必)"; else if (siblings[0].courseType === 'elective') typeSuffix = " (選)";
        
        const div = document.createElement('div'); div.className = `course-card ${isLockedClass}`; div.style.borderLeftColor = borderColor;
        let allFull = siblings.every(part => getScheduledCount(part.id) >= part.periods); if (allFull) div.classList.add('is-fully-scheduled');

        let partsHtml = '';
        siblings.forEach((part, index) => {
            let used = getScheduledCount(part.id); let isFull = used >= part.periods;
            let draggableAttr = (isReadOnly || isFull || part.isLocked) ? '' : 'draggable="true"';
            let disabledClass = (isReadOnly || isFull) ? 'disabled' : '';
            partsHtml += `<div class="split-part ${disabledClass}" ${draggableAttr} ondragstart="handleSidebarDragStart(event, '${part.id}', ${part.periods}, '${currentTeacher}')" ondragend="handleDragEnd()">第${index+1}段 (${part.periods}節)</div>`;
        });

        div.innerHTML = `${semTag}<div class="card-header"><span class="card-title" style="padding-right:15px; display:flex; align-items:center; flex-wrap:wrap;">${baseName}${typeSuffix} ${idFilterStr}</span><span class="tag-split">已拆分</span></div>
            <div style="font-size:10px;color:#666;margin-bottom:2px;">${siblings[0].teacher} ${roomStr ? '<br><b>' + roomStr + '</b>' : ''}</div>
            ${siblings[0].isIndependent ? '<div style="font-size:10px;color:red;font-weight:bold;">★ 獨立必修</div>' : ''}
            <div class="split-parts-container">${partsHtml}</div>
            <div class="btn-actions edit-only" ${c.isLocked ? 'style="display:none"' : ''}>
                <button class="has-background-info-dark" onclick="openEditModal('${siblings[0].id}')">編輯</button>
                <button class="has-background-success-dark" onclick="mergeCourse('${siblings[0].id}')">合併</button>
                <button class="has-background-danger-dark" onclick="deleteCourse('${siblings[0].id}')">刪除</button>
            </div>`;
        return div;
    } else {
        const used = getScheduledCount(c.id); const total = c.periods; const isFull = used >= total;
        const div = document.createElement('div'); div.className = `course-card draggable-card ${isFull ? 'disabled' : ''} ${isLockedClass}`;
        if (isFull) div.classList.add('is-fully-scheduled'); div.style.borderLeftColor = borderColor;
        div.draggable = !isReadOnly && !isFull && !c.isLocked;
        div.ondragstart = (e) => handleSidebarDragStart(e, c.id, total, currentTeacher);
        div.ondragend = handleDragEnd;
        let splitBtn = ((total === 3 || total === 4) || total === 2) ? `<button class="has-background-warning-dark" onclick="splitCourse('${c.id}')">拆分</button>` : '';

        let baseName = c.name; let roomMatch = baseName.match(/\[(.*?)\]/); let roomStr = "";
        if(roomMatch) { roomStr = roomMatch[1]; baseName = baseName.replace(/\[.*?\]/g, '').trim(); }

        div.innerHTML = `${semTag}<div class="card-header"><span class="card-title" style="padding-right:15px; display:flex; align-items:center; flex-wrap:wrap;">${baseName} ${idFilterStr}</span></div>
            <div style="font-size:10px;color:#666;margin-bottom:2px;">${c.teacher} ${roomStr ? '<br><b>' + roomStr + '</b>' : ''} • ${total}節 (已排${used})</div>
            ${c.isIndependent ? '<div style="font-size:10px;color:red;font-weight:bold;">★ 獨立必修</div>' : ''}
            <div class="btn-actions edit-only" ${c.isLocked ? 'style="display:none"' : ''}>
                <button class="has-background-info-dark" onclick="openEditModal('${c.id}')">編輯</button>
                ${splitBtn} 
                <button class="has-background-danger-dark" onclick="deleteCourse('${c.id}')">刪除</button>
            </div>`;
        return div;
    }
}

function handleSidebarDragStart(e, cId, duration, currentTeacher) {
    if(isReadOnly || e.target.classList.contains('disabled')) { e.preventDefault(); return; }
    
    setTimeout(() => document.body.classList.add('is-dragging'), 0);
    e.dataTransfer.setData('cId', cId); e.dataTransfer.setData('src', 'sidebar'); e.dataTransfer.setData('dur', duration);
    e.dataTransfer.setData('dragOffset', 0);
    let course = courses.find(c => c.id === cId); 
    if(course) {
        currentDragState = { cId: cId, dur: duration, offset: 0, course: course };
        highlightZones(course, currentTeacher);
        
        let rect = e.target.getBoundingClientRect();
        let canvas = document.createElement('canvas');
        canvas.width = rect.width;
        canvas.height = rect.height;
        let ctx = canvas.getContext('2d');
        
        ctx.globalAlpha = 0.6;
        let tList = course.teacher.split(',').map(t=>t.trim()).filter(t=>t);
        
        if (course.isDeptReq) {
             ctx.fillStyle = '#ffffff';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             ctx.strokeStyle = 'red';
             ctx.lineWidth = 2;
             ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        } else if (tList.length >= 3) {
             let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
             grad.addColorStop(0, '#ffb3ba');
             grad.addColorStop(0.25, '#ffdfba');
             grad.addColorStop(0.5, '#ffffba');
             grad.addColorStop(0.75, '#baffc9');
             grad.addColorStop(1, '#bae1ff');
             ctx.fillStyle = grad;
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             ctx.strokeStyle = 'rgba(150,150,150,0.8)';
             ctx.lineWidth = 2;
             ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        } else {
             ctx.fillStyle = teacherColors[tList[0]] || '#cccccc';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
             if (tList.length === 2) {
                 ctx.strokeStyle = teacherColors[tList[1]] || '#666';
                 ctx.lineWidth = 6;
                 ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
             } else {
                 ctx.strokeStyle = 'rgba(150,150,150,0.8)';
                 ctx.lineWidth = 2;
                 ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
             }
        }
        
        e.dataTransfer.setDragImage(canvas, e.clientX - rect.left, e.clientY - rect.top);
    }
}

function highlightZones(course, currentTeacher) {
    if(isReadOnly) return;
    let grades = course.allowedGrades || []; 
    let tList = currentTeacher ? [currentTeacher] : course.teacher.split(',').map(t=>t.trim());
    
    if (grades.length > 0) { grades.forEach(g => { document.querySelectorAll(`td[data-grade="${g}"]`).forEach(td => td.classList.add('grade-highlight')); }); }
    
    tList.forEach(t => {
        let avail = teacherAvailability[t] || [];
        if (avail.length > 0) { 
            avail.forEach(dp => { 
                let targets = document.querySelectorAll(`td[data-dp="${dp}"]`); 
                targets.forEach(td => { 
                    let tdGrade = parseInt(td.getAttribute('data-grade')); 
                    if (grades.length === 0 || grades.includes(tdGrade)) { td.classList.add('suggestion-highlight'); } 
                }); 
            }); 
        }
    });
    
    mergeHighlights('grade-highlight');
    mergeHighlights('suggestion-highlight');
}

function mergeHighlights(className) {
    let cells = document.querySelectorAll('.' + className);
    cells.forEach(td => {
        let dp = td.getAttribute('data-dp'); 
        let grade = td.getAttribute('data-grade');
        if(!dp || !grade) return;
        
        let [d, pId] = dp.split('-'); 
        let pIdx = PERIODS.findIndex(p => p.id === pId);
        
        let topMerge = false;
        let bottomMerge = false;
        
        if (pIdx > 0) {
            let prevPId = PERIODS[pIdx-1].id;
            let topTd = document.querySelector(`td[data-dp="${d}-${prevPId}"][data-grade="${grade}"]`);
            if (topTd && topTd.classList.contains(className)) topMerge = true;
        }
        if (pIdx < PERIODS.length - 1) {
            let nextPId = PERIODS[pIdx+1].id;
            let bottomTd = document.querySelector(`td[data-dp="${d}-${nextPId}"][data-grade="${grade}"]`);
            if (bottomTd && bottomTd.classList.contains(className)) bottomMerge = true;
        }

        if (topMerge) td.classList.add(className + '-merge-top');
        if (bottomMerge) td.classList.add(className + '-merge-bottom');
    });
}

function clearHighlights() {
    document.querySelectorAll('.grade-highlight').forEach(el => el.classList.remove('grade-highlight', 'grade-highlight-merge-top', 'grade-highlight-merge-bottom'));
    document.querySelectorAll('.suggestion-highlight').forEach(el => el.classList.remove('suggestion-highlight', 'suggestion-highlight-merge-top', 'suggestion-highlight-merge-bottom'));
    document.querySelectorAll('.common-free-highlight').forEach(el => el.classList.remove('common-free-highlight', 'common-free-highlight-merge-top', 'common-free-highlight-merge-bottom'));
    
    let btn = document.getElementById('btnClearHighlights');
    if(btn) btn.style.display = 'none';
}

function renderTimetable() {
    const table = document.getElementById('mainTable'); const colgroup = document.getElementById('tableColGroup');
    const thead = document.getElementById('tableHead'); const tbody = document.getElementById('tableBody');
    const appContainer = document.getElementById('appContainer');
    colgroup.innerHTML = ''; thead.innerHTML = ''; tbody.innerHTML = '';

    let days = ['一','二','三','四','五','六','日']; let dayCols = [];
    for(let d=1; d<=7; d++) {
        if (d <= 5) { 
            for(let g=1; g<=4; g++) { if(settings.wd[g-1]) dayCols.push({d:d, g:g}); } 
        } else if (d == 6 && settings.sat) { 
            for(let g=3; g<=4; g++) { if(settings.wd[g-1]) dayCols.push({d:d, g:g}); } 
        } else if (d == 7 && settings.sun) {
            for(let g=3; g<=4; g++) { if(settings.wd[g-1]) dayCols.push({d:d, g:g}); }
        }
    }

    let colLayouts = dayCols.map(col => calculateColumnLayout(col.d, col.g));
    let totalTracks = colLayouts.reduce((acc, curr) => acc + curr.maxTracks, 0);
    
    const isExportMode = document.body.classList.contains('is-exporting');
    const isMobile = window.innerWidth <= 768;
    const IDEAL_TRACK_WIDTH = isMobile ? 46 : 60; const SIDEBAR_WIDTH = 220; const TIME_COL_WIDTH = 40; const MARGINS = 80;
    let idealTableWidth = TIME_COL_WIDTH + (totalTracks * IDEAL_TRACK_WIDTH);
    let baseWidth = isExportMode ? 2000 : window.innerWidth;
    let effectiveSidebar = (isExportMode || isMobile) ? 0 : SIDEBAR_WIDTH;
    let maxAvailableWidth = isExportMode ? (2000 - MARGINS) : (isMobile ? idealTableWidth : (baseWidth - effectiveSidebar - MARGINS));
    let finalTableWidth = Math.min(idealTableWidth, maxAvailableWidth);
    let newAppWidth = effectiveSidebar + MARGINS + finalTableWidth;
    if (!isExportMode) {
        if (isMobile) appContainer.style.width = '';
        else appContainer.style.width = `${Math.max(800, newAppWidth)}px`;
    }

    let colTime = document.createElement('col'); colTime.style.width = `${TIME_COL_WIDTH}px`; colgroup.appendChild(colTime);
    let availableForCourses = finalTableWidth - TIME_COL_WIDTH;
    dayCols.forEach((col, idx) => { let colEl = document.createElement('col'); let trackCount = colLayouts[idx].maxTracks; let colWidth = (availableForCourses * trackCount) / totalTracks; colEl.style.width = `${colWidth}px`; colgroup.appendChild(colEl); });

    let tr1 = document.createElement('tr'); let tr2 = document.createElement('tr');
    let thTime = document.createElement('th'); thTime.rowSpan = 2; thTime.textContent = '#'; thTime.className = 'time-col'; tr1.appendChild(thTime);
    let currentDay = -1; let currentDaySpan = 0; let dayTh = null;
    
    dayCols.forEach((col, idx) => {
        if(col.d !== currentDay) {
            currentDay = col.d; dayTh = document.createElement('th'); dayTh.textContent = `週${days[col.d-1]}`; dayTh.classList.add('day-border-left');
            if(col.d >= 6) dayTh.style.color = '#e67e22'; tr1.appendChild(dayTh); currentDaySpan = 1;
        } else { currentDaySpan++; }
        if(dayTh) dayTh.colSpan = currentDaySpan;
        let thG = document.createElement('th'); thG.textContent = `大${['一','二','三','四'][col.g-1]}`;
        if (currentDaySpan === 1) thG.classList.add('day-border-left'); if(col.d >= 6) thG.classList.add('weekend-bg'); if(col.g === 4) thG.textContent = "大四/碩士"; tr2.appendChild(thG);
    });
    thead.appendChild(tr1); thead.appendChild(tr2);

    PERIODS.forEach((p, pIdx) => {
        let tr = document.createElement('tr'); let tdTime = document.createElement('td'); tdTime.className = 'time-col';
        let displayId = p.display || p.id; let displayTime = p.t.replace('-', '<br>'); 
        tdTime.innerHTML = `<div style="line-height:1.2; font-size:12px;">${displayId}</div><div style="font-size:9px; color:#888;">${displayTime}</div>`; tr.appendChild(tdTime);
        let currentDayForTd = -1;

        dayCols.forEach((col, colIdx) => {
            let td = document.createElement('td'); let slotId = `${col.d}-${col.g}-${p.id}`;
            if (col.d !== currentDayForTd) { td.classList.add('day-border-left'); currentDayForTd = col.d; }
            td.setAttribute('data-dp', `${col.d}-${p.id}`); td.setAttribute('data-grade', col.g);
            if(col.d >= 6) td.classList.add('weekend-bg');
            let layout = colLayouts[colIdx];
            
            td.ondragover = (e) => handleDragOver(e, slotId, td);
            td.ondragleave = (e) => { td.classList.remove('drop-highlight'); };
            td.ondrop = (e) => handleDrop(e, slotId);
            
            let startingEvents = layout.events.filter(ev => ev.start === pIdx);
            startingEvents.forEach(ev => {
                let course = courses.find(c => c.id === ev.cId);
                if(course) {
                    let tList = course.teacher.split(',').map(t=>t.trim()).filter(t=>t);
                    if (currentTeacherFilter !== 'ALL' && !tList.includes(currentTeacherFilter)) return;
                    let div = document.createElement('div');
                    
                    let firstTeacher = tList[0] || "";
                    let secondTeacher = tList[1] || "";
                    let bg = 'white'; let txt = 'black'; let bs = 'none';

                    if (course.isDeptReq) { 
                        div.className = 'course-block is-locked';
                        bg = 'white'; txt = 'red'; bs = 'inset 0 0 0 1px red'; 
                    } else { 
                        div.className = 'course-block';
                        if (tList.length === 1) { 
                            bg = teacherColors[firstTeacher] || '#cccccc'; txt = teacherTextColors[firstTeacher] || 'black'; bs = 'inset 0 0 0 1px rgba(0,0,0,0.1)'; 
                        } else if (tList.length === 2) { 
                            bg = teacherColors[firstTeacher] || '#cccccc'; txt = teacherTextColors[firstTeacher] || 'black'; bs = `inset 0 0 0 3px ${teacherColors[secondTeacher] || '#666'}`; 
                        } else if (tList.length >= 3) { 
                            bg = 'linear-gradient(135deg, #ffb3ba, #ffdfba, #ffffba, #baffc9, #bae1ff)'; txt = 'black'; bs = 'inset 0 0 0 1px rgba(0,0,0,0.1)'; 
                        }
                    }

                    div.style.background = bg;
                    div.style.color = txt;
                    div.style.boxShadow = bs;
                    div.style.border = 'none';

                    let duration = ev.end - ev.start + 1;
                    div.setAttribute('data-duration', duration);
                    div.style.height = `calc(${duration * 100}% + ${(duration-1)}px - 1px)`; 
                    div.style.top = '1px'; 
                    
                    let widthPct = (100 / layout.maxTracks) * (ev.span || 1); 
                    let leftPct = ev.track * (100 / layout.maxTracks);
                    div.style.width = `calc(${widthPct}% - 2px)`; 
                    div.style.left = `calc(${leftPct}% + 1px)`;
                    
                    let rawName = course.name; let room = ""; let rMatch = rawName.match(/\[(.*?)\]/);
                    if(rMatch) { room = rMatch[1]; rawName = rawName.replace(/\[.*?\]/g, '').trim(); }

                    let dispName = rawName;
                    if (!dispName.includes('專討') && !dispName.includes('專題')) {
                        dispName = dispName.replace(/\(\d+\)$/, '');
                    }

                    dispName = dispName.replace(/(\((?:必|選)\))/g, '<span style="font-weight:normal; font-size: calc(1em - 4px);">$1</span>');
                    
                    let c_classFilter = course.classFilter || 'all';
                    let c_idFilter = course.idFilter || 'all';
                    if(c_idFilter === 'A') { c_classFilter = 'A'; c_idFilter = 'all'; }
                    if(c_idFilter === 'B') { c_classFilter = 'B'; c_idFilter = 'all'; }

                    let idFilterStr = "";
                    if (c_classFilter === 'A') idFilterStr += '<br><span style="color:#008000; font-weight:bold; font-size:0.9em;">(A班)</span>';
                    if (c_classFilter === 'B') idFilterStr += '<br><span style="color:#800080; font-weight:bold; font-size:0.9em;">(B班)</span>';
                    if (c_idFilter === 'odd') idFilterStr += '<br><span style="color:#0055aa; font-weight:bold; font-size:0.9em;">(單)</span>';
                    if (c_idFilter === 'even') idFilterStr += '<br><span style="color:#aa5500; font-weight:bold; font-size:0.9em;">(雙)</span>';
                    dispName += idFilterStr;

                    let infoHtml = course.teacher; if(room) { infoHtml += `<br><span style="font-size:0.9em; font-weight:bold;">${room}</span>`; }
                    
                    div.innerHTML = `<div>${dispName}</div><div class="course-info">${infoHtml}</div><div class="del-btn edit-only" onclick="clearCourse('${course.id}')">×</div>`;
                    
                    div.draggable = !isReadOnly && !course.isLocked;
                    
                    div.oncontextmenu = (e) => {
                        e.preventDefault();
                        if (!isReadOnly) {
                            if (course.isLocked && course.isDeptReq) {
                                Swal.fire('無法編輯', '校必修課程已鎖定，無法直接編輯', 'info');
                            } else {
                                openEditModal(course.id);
                            }
                        }
                    };

                    // 手機：點擊開啟編輯（桌機由右鍵處理）
                    div.addEventListener('click', (e) => {
                        if (window.innerWidth <= 768 && !isReadOnly) {
                            e.stopPropagation();
                            if (course.isDeptReq) {
                                Swal.fire('無法編輯', '校必修課程已鎖定', 'info');
                            } else if (!course.isLocked) {
                                openEditModal(course.id);
                            }
                        }
                    });

                    if (!isReadOnly && !course.isLocked) {
                        div.title = "💡 提示：右鍵點擊可快速編輯課程";
                    }

                    if(div.draggable) {
                        div.ondragstart = (e) => {
                            e.stopPropagation(); setTimeout(() => document.body.classList.add('is-dragging'), 0);
                            e.dataTransfer.setData('cId', course.id); 
                            e.dataTransfer.setData('src', 'timetable'); 
                            e.dataTransfer.setData('oldSlotId', slotId); 
                            e.dataTransfer.setData('dur', duration); 
                            
                            let rect = div.getBoundingClientRect();
                            let clickY = e.clientY - rect.top;
                            let segmentHeight = rect.height / duration;
                            let offsetIndex = Math.floor(clickY / segmentHeight);
                            offsetIndex = Math.max(0, Math.min(offsetIndex, duration - 1));
                            e.dataTransfer.setData('dragOffset', offsetIndex);

                            currentDragState = { cId: course.id, dur: duration, offset: offsetIndex, course: course };
                            highlightZones(course, null);
                            
                            let canvas = document.createElement('canvas');
                            canvas.width = rect.width;
                            canvas.height = rect.height;
                            let ctx = canvas.getContext('2d');
                            
                            ctx.globalAlpha = 0.6;
                            
                            if (course.isDeptReq) {
                                 ctx.fillStyle = '#ffffff';
                                 ctx.fillRect(0, 0, canvas.width, canvas.height);
                                 ctx.strokeStyle = 'red';
                                 ctx.lineWidth = 2;
                                 ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
                            } else if (tList.length >= 3) {
                                 let grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                                 grad.addColorStop(0, '#ffb3ba');
                                 grad.addColorStop(0.25, '#ffdfba');
                                 grad.addColorStop(0.5, '#ffffba');
                                 grad.addColorStop(0.75, '#baffc9');
                                 grad.addColorStop(1, '#bae1ff');
                                 ctx.fillStyle = grad;
                                 ctx.fillRect(0, 0, canvas.width, canvas.height);
                                 ctx.strokeStyle = 'rgba(150,150,150,0.8)';
                                 ctx.lineWidth = 2;
                                 ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
                            } else {
                                 ctx.fillStyle = teacherColors[firstTeacher] || '#cccccc';
                                 ctx.fillRect(0, 0, canvas.width, canvas.height);
                                 if (tList.length === 2) {
                                     ctx.strokeStyle = teacherColors[secondTeacher] || '#666';
                                     ctx.lineWidth = 6;
                                     ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
                                 } else {
                                     ctx.strokeStyle = 'rgba(150,150,150,0.8)';
                                     ctx.lineWidth = 2;
                                     ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
                                 }
                            }
                            
                            e.dataTransfer.setDragImage(canvas, e.clientX - rect.left, e.clientY - rect.top);
                        };
                        div.ondragend = handleDragEnd;
                    }
                    td.appendChild(div);
                }
            });
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function openAnalysisModal() {
    document.getElementById('analysisModal').classList.add('is-active');
    switchAnalysisTab(document.querySelector('#analysisModal .tabs li:first-child'));
    renderStatsView();
    renderFreeTimeView();
}

function closeAnalysisModal() {
    document.getElementById('analysisModal').classList.remove('is-active');
}

function switchAnalysisTab(tabLi) {
    document.querySelectorAll('#analysisModal .tabs li').forEach(li => li.classList.remove('is-active'));
    document.querySelectorAll('#analysisModal .tab-content').forEach(c => c.classList.remove('is-active'));
    tabLi.classList.add('is-active');
    const targetId = tabLi.getAttribute('data-tab');
    document.getElementById(targetId).classList.add('is-active');
}

function renderStatsView() {
    let stats = { 1: { req: 0, ele: 0 }, 2: { req: 0, ele: 0 }, 3: { req: 0, ele: 0 }, 4: { req: 0, ele: 0 } };
    let currSem = parseInt(settings.currentSemester);

    for (let key in schedule) {
        let [d, g, p] = key.split('-');
        g = parseInt(g);
        if (!stats[g]) continue;
        let cIds = schedule[key];
        
        let hasReq = false;
        let hasEle = false;
        
        cIds.forEach(cId => {
            let course = courses.find(c => c.id === cId);
            if (course) {
                let cSem = course.semester || 3;
                if (cSem == 3 || cSem == currSem) {
                    if (course.courseType === 'required') hasReq = true;
                    if (course.courseType === 'elective') hasEle = true;
                }
            }
        });

        if (hasReq) stats[g].req++;
        else if (hasEle) stats[g].ele++; 
    }

    let html = `<table class="table is-fullwidth is-bordered is-striped is-narrow has-text-centered" style="font-size: 14px;">
        <thead style="background-color: var(--table-header-bg, #fafafa);">
            <tr><th class="has-text-centered">年級</th><th class="has-text-centered">必修節數</th><th class="has-text-centered">選修節數</th><th class="has-text-centered" style="color:#2196F3;">總節數</th></tr>
        </thead>
        <tbody>`;
    [1,2,3,4].forEach(g => {
        let req = stats[g].req;
        let ele = stats[g].ele;
        let total = req + ele;
        let gName = g === 4 ? "大四/碩士" : `大${['一','二','三','四'][g-1]}`;
        html += `<tr>
            <td><strong>${gName}</strong></td>
            <td>${req > 0 ? req : '<span class="has-text-grey-light">-</span>'}</td>
            <td>${ele > 0 ? ele : '<span class="has-text-grey-light">-</span>'}</td>
            <td><strong style="color:#2196F3;">${total}</strong></td>
        </tr>`;
    });
    html += `</tbody></table>`;
    html += `<p class="help is-info has-text-right">* 僅統計當前顯示學期（第 ${currSem} 學期）與學年課</p>`;
    document.getElementById('statsContainer').innerHTML = html;
}

function renderFreeTimeView() {
    let container = document.getElementById('ftTeacherContainer');
    let teachers = new Set();
    courses.forEach(c => {
        let tList = c.teacher.split(',').map(t=>t.trim()).filter(t=>t);
        tList.forEach(t => teachers.add(t));
    });
    let sortedTeachers = Array.from(teachers).sort();
    let html = '';
    sortedTeachers.forEach(t => {
        if(t !== '校必修') {
            html += `<label class="checkbox mr-2 mb-1" style="display:inline-block; width: 100px;"><input type="checkbox" class="ft-teacher" value="${t}"> ${t}</label>`;
        }
    });
    container.innerHTML = html;
    document.querySelectorAll('.ft-grade').forEach(cb => cb.checked = false);
}

function findCommonFreeTime() {
    let selectedGrades = Array.from(document.querySelectorAll('.ft-grade:checked')).map(cb => parseInt(cb.value));
    let selectedTeachers = Array.from(document.querySelectorAll('.ft-teacher:checked')).map(cb => cb.value);

    if (selectedGrades.length === 0 && selectedTeachers.length === 0) {
        Swal.fire('請選擇對象', '至少選擇一個參與年級或教師', 'warning');
        return;
    }

    clearHighlights(); 
    let currSem = parseInt(settings.currentSemester);
    let days = [1,2,3,4,5,6,7];
    let freeSlots = [];

    days.forEach(d => {
        PERIODS.forEach(pObj => {
            let pId = pObj.id;
            let isFree = true;

            for (let g of selectedGrades) {
                let key = `${d}-${g}-${pId}`;
                let slotCourses = schedule[key] || [];
                let hasVisibleCourse = slotCourses.some(cId => {
                    let c = courses.find(x => x.id === cId);
                    if(!c) return false;
                    let cSem = c.semester || 3;
                    return (cSem == 3 || cSem == currSem);
                });
                if (hasVisibleCourse) { isFree = false; break; }
            }

            if (isFree) {
                for (let t of selectedTeachers) {
                    let teacherBusy = false;
                    for (let g = 1; g <= 4; g++) {
                        let key = `${d}-${g}-${pId}`;
                        let slotCourses = schedule[key] || [];
                        let hasTeacherCourse = slotCourses.some(cId => {
                            let c = courses.find(x => x.id === cId);
                            if(!c) return false;
                            let cSem = c.semester || 3;
                            let tList = c.teacher.split(',').map(x=>x.trim());
                            return (cSem == 3 || cSem == currSem) && tList.includes(t);
                        });
                        if (hasTeacherCourse) { teacherBusy = true; break; }
                    }
                    if (teacherBusy) { isFree = false; break; }
                }
            }

            if (isFree) {
                freeSlots.push(`${d}-${pId}`);
            }
        });
    });

    if (freeSlots.length === 0) {
        Swal.fire('無共同空堂', '找不到大家都有空的時段', 'info');
    } else {
        freeSlots.forEach(dp => {
            if (selectedGrades.length > 0) {
                // 只亮顯選中的年級欄位，避免誤標未選年級
                selectedGrades.forEach(g => {
                    let td = document.querySelector(`td[data-dp="${dp}"][data-grade="${g}"]`);
                    if (td) td.classList.add('common-free-highlight');
                });
            } else {
                document.querySelectorAll(`td[data-dp="${dp}"]`).forEach(td => td.classList.add('common-free-highlight'));
            }
        });
        mergeHighlights('common-free-highlight');
        closeAnalysisModal();
        
        let btn = document.getElementById('btnClearHighlights');
        if(btn) btn.style.display = 'inline-flex';
        
        Swal.fire({
            toast: true, position: 'top-end', icon: 'success',
            title: `找到 ${freeSlots.length} 個共同空堂！`,
            showConfirmButton: false, timer: 3000
        });
    }
}

// ===== 校訂必修管理 =====
function openDeptReqModal() {
    document.getElementById('deptReqModal').classList.add('is-active');
    renderDeptReqTable();
}
function closeDeptReqModal() {
    document.getElementById('deptReqModal').classList.remove('is-active');
}

function renderDeptReqTable() {
    const data = getDeptReqData();
    const dayNames = { 1:'一', 2:'二', 3:'三', 4:'四', 5:'五', 6:'六', 7:'日' };
    const semNames = { 1:'上學期', 2:'下學期', 3:'全學年' };
    const gradeNames = ['大一','大二','大三','大四'];
    let html = `<table class="table is-fullwidth is-bordered is-narrow is-striped" style="font-size:13px;">
        <thead><tr><th>課程名稱</th><th>年級</th><th>星期</th><th>節次</th><th>學期</th><th>操作</th></tr></thead><tbody>`;
    data.forEach((e, idx) => {
        let daysStr = (e.days||[]).map(d => '週'+dayNames[d]).join(' ');
        let perStr = (e.periods||[]).join(',');
        html += `<tr><td>${e.name}</td><td>${gradeNames[e.grade-1]||e.grade}</td><td>${daysStr}</td><td>第${perStr}節</td><td>${semNames[e.sem]||'全學年'}</td>
            <td style="white-space:nowrap">
                <button class="button is-info is-small" onclick="editDeptReqEntry(${idx})">編輯</button>
                <button class="button is-danger is-small ml-1" onclick="deleteDeptReqEntry(${idx})">刪除</button>
            </td></tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('deptReqTableContainer').innerHTML = html;
}

async function editDeptReqEntry(idx) {
    const data = getDeptReqData();
    const isNew = idx < 0;
    const e = isNew ? { name: '', grade: 1, days: [], periods: [], sem: 3 } : data[idx];
    const dayLabels = ['一','二','三','四','五','六','日'];
    const dayCBs = dayLabels.map((lbl, i) => {
        const v = i+1, chk = (e.days||[]).includes(v) ? 'checked' : '';
        return `<label class="checkbox mr-2"><input type="checkbox" class="dept-day-cb" value="${v}" ${chk}> ${lbl}</label>`;
    }).join('');
    const gradeOpts = [1,2,3,4].map(g => `<option value="${g}" ${e.grade===g?'selected':''}>${['大一','大二','大三','大四'][g-1]}</option>`).join('');
    const semOpts = [[1,'上學期'],[2,'下學期'],[3,'全學年']].map(([v,l]) => `<option value="${v}" ${e.sem===v?'selected':''}>${l}</option>`).join('');

    const { value: result } = await Swal.fire({
        title: isNew ? '新增校必修項目' : '編輯校必修項目',
        html: `<div style="text-align:left">
            <div class="field mb-2"><label class="label is-small">課程名稱</label><input id="deptName" class="input is-small" value="${e.name}" placeholder="例如: 英文"></div>
            <div class="field mb-2"><label class="label is-small">年級</label><div class="select is-small"><select id="deptGrade">${gradeOpts}</select></div></div>
            <div class="field mb-2"><label class="label is-small">星期（可複選）</label><div>${dayCBs}</div></div>
            <div class="field mb-2"><label class="label is-small">節次（逗號分隔，例如 3,4 或 5）</label><input id="deptPeriods" class="input is-small" value="${(e.periods||[]).join(',')}" placeholder="例如: 1,2"></div>
            <div class="field"><label class="label is-small">學期</label><div class="select is-small"><select id="deptSem">${semOpts}</select></div></div>
        </div>`,
        showCancelButton: true,
        confirmButtonText: isNew ? '新增' : '儲存',
        cancelButtonText: '取消',
        preConfirm: () => {
            const name = document.getElementById('deptName').value.trim();
            const grade = parseInt(document.getElementById('deptGrade').value);
            const days = Array.from(document.querySelectorAll('.dept-day-cb:checked')).map(c => parseInt(c.value));
            const periods = document.getElementById('deptPeriods').value.split(',').map(p=>p.trim()).filter(p=>p);
            const sem = parseInt(document.getElementById('deptSem').value);
            if (!name) { Swal.showValidationMessage('課程名稱不能為空'); return false; }
            if (!days.length) { Swal.showValidationMessage('請至少選擇一個星期'); return false; }
            if (!periods.length) { Swal.showValidationMessage('請輸入節次'); return false; }
            return { name, grade, days, periods, sem };
        }
    });
    if (!result) return;
    const latest = getDeptReqData();
    if (isNew) latest.push(result); else latest[idx] = result;
    localStorage.setItem('deptReqData', JSON.stringify(latest));
    renderDeptReqTable();
}

function addDeptReqEntry() { editDeptReqEntry(-1); }

function deleteDeptReqEntry(idx) {
    Swal.fire({ title: '確定刪除此項目？', icon: 'warning', showCancelButton: true, confirmButtonText: '刪除', cancelButtonText: '取消' }).then(r => {
        if (!r.isConfirmed) return;
        const data = getDeptReqData();
        data.splice(idx, 1);
        localStorage.setItem('deptReqData', JSON.stringify(data));
        renderDeptReqTable();
    });
}

function resetDeptReqData() {
    Swal.fire({ title: '恢復預設值？', text: '將回到系統內建的校必修時間設定', icon: 'warning', showCancelButton: true, confirmButtonText: '確定恢復', cancelButtonText: '取消' }).then(r => {
        if (!r.isConfirmed) return;
        localStorage.removeItem('deptReqData');
        renderDeptReqTable();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '已恢復預設值', showConfirmButton: false, timer: 2000 });
    });
}

function renderLegend() {
    const el = document.getElementById('teacherLegend'); el.innerHTML = '';
    Object.keys(teacherColors).forEach(t => { 
        el.innerHTML += `<div class="tag is-light legend-item" onclick="openTeacherSettings('${t}')" style="background:${teacherColors[t]}55;border:1px solid ${teacherColors[t]}; font-size: 10px; padding: 0 5px; height: 1.5em;"><span style="width:5px;height:5px;background:${teacherColors[t]};border-radius:50%;margin-right:3px;"></span>${t}</div>`; 
    });
}

let editingTeacherName = null; let tempEvents = [];
function openTeacherSettings(teacherName) {
    if(isReadOnly) return;
    editingTeacherName = teacherName; document.getElementById('tsName').innerText = teacherName; document.getElementById('teacherSettingsModal').classList.add('is-active');
    document.getElementById('tsColor').value = teacherColors[teacherName] || '#cccccc'; document.getElementById('tsTextColor').value = teacherTextColors[teacherName] || 'black';
    renderTsAvailTable(teacherName);
    tempEvents = JSON.parse(JSON.stringify(teacherEvents[teacherName] || [])); renderTsEventList();
    let pSelect = document.getElementById('newEventPeriod'); pSelect.innerHTML = '';
    PERIODS.forEach(p => { let opt = document.createElement('option'); opt.value = p.id; opt.innerText = `${p.display || p.id} (${p.t.split('-')[0]})`; pSelect.appendChild(opt); });
    switchTeacherTab(document.querySelector('.tabs li:first-child'));
}
function closeTeacherSettingsModal() { document.getElementById('teacherSettingsModal').classList.remove('is-active'); editingTeacherName = null; }
function switchTeacherTab(tabLi) { document.querySelectorAll('.tabs li').forEach(li => li.classList.remove('is-active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('is-active')); tabLi.classList.add('is-active'); const targetId = tabLi.getAttribute('data-tab'); document.getElementById(targetId).classList.add('is-active'); }
function renderTsAvailTable(teacherName) {
    const container = document.getElementById('tsAvailContainer'); let currentAvail = teacherAvailability[teacherName] || [];
    let html = '<table class="avail-table"><thead><tr><th>節</th>'; const dayMap = { '1':'一', '2':'二', '3':'三', '4':'四', '5':'五', '6':'六', '7':'日' }; for(let d=1; d<=7; d++) html += `<th>${dayMap[d]}</th>`; html += '</tr></thead><tbody>';
    PERIODS.forEach(p => { html += `<tr><td>${p.display||p.id}</td>`; for(let d=1; d<=7; d++) { let dp = `${d}-${p.id}`; let checked = currentAvail.includes(dp) ? 'checked' : ''; html += `<td><input type="checkbox" class="avail-checkbox-modal" value="${dp}" ${checked}></td>`; } html += '</tr>'; }); html += '</tbody></table>'; container.innerHTML = html;
}
function autoFillLocation() { const type = document.getElementById('newEventType').value; const locInput = document.getElementById('newEventLoc'); if(type === '晤談時間') locInput.value = '教師辦公室'; else if(type === '產學會議') locInput.value = '線上/系辦會議室'; else if(type === '研究生會議') locInput.value = '系辦會議室'; }
function addTeacherEvent() { const type = document.getElementById('newEventType').value; const loc = document.getElementById('newEventLoc').value; const day = document.getElementById('newEventDay').value; const period = document.getElementById('newEventPeriod').value; if(!loc) { Swal.fire('請輸入地點', '', 'warning'); return; } tempEvents.push({ id: Date.now().toString(), type: type, location: loc, day: parseInt(day), period: period }); renderTsEventList(); }
function removeTeacherEvent(id) { tempEvents = tempEvents.filter(e => e.id !== id); renderTsEventList(); }
function renderTsEventList() {
    const list = document.getElementById('tsEventList'); list.innerHTML = '';
    if(tempEvents.length === 0) { list.innerHTML = '<div class="has-text-grey is-size-7 p-2">尚無自訂行程</div>'; return; }
    const dayMap = {1:'週一', 2:'週二', 3:'週三', 4:'週四', 5:'週五', 6:'週六'};
    tempEvents.sort((a,b) => { if(a.day !== b.day) return a.day - b.day; return a.period.localeCompare(b.period); });
    tempEvents.forEach(evt => { let row = document.createElement('div'); row.className = 'event-row'; row.innerHTML = `<span class="tag is-info is-light">${dayMap[evt.day]} - ${evt.period}</span><span style="flex:1; font-size:0.9em;"><strong>${evt.type}</strong> <span class="has-text-grey">@ ${evt.location}</span></span><button class="button is-small is-danger is-inverted" onclick="removeTeacherEvent('${evt.id}')"><i class="fas fa-times"></i></button>`; list.appendChild(row); });
}
function deleteCurrentTeacher() { if(!editingTeacherName) return; deleteTeacher(editingTeacherName); closeTeacherSettingsModal(); }
function saveTeacherSettings() {
    if(!editingTeacherName) return;
    teacherColors[editingTeacherName] = document.getElementById('tsColor').value; teacherTextColors[editingTeacherName] = document.getElementById('tsTextColor').value;
    let checkedBoxes = document.querySelectorAll('.avail-checkbox-modal:checked'); let newAvail = Array.from(checkedBoxes).map(cb => cb.value); teacherAvailability[editingTeacherName] = newAvail;
    teacherEvents[editingTeacherName] = tempEvents;
    save(); render(); closeTeacherSettingsModal(); Swal.fire({toast:true, position:'top-end', icon:'success', title:'設定已儲存', timer:1500, showConfirmButton:false});
}

function deleteTeacher(teacherName) {
    Swal.fire({ title: `確定刪除 ${teacherName}?`, text: "這將會將該老師從所有課程中移除。若課程沒有其他老師，將會刪除該課程！", icon: 'warning', showCancelButton: true, confirmButtonText: '確認', cancelButtonText: '取消', confirmButtonColor: '#d33' }).then((result) => {
        if (result.isConfirmed) {
            let idsToDelete = [];
            courses.forEach(c => {
                let tList = c.teacher.split(',').map(t=>t.trim()).filter(t=>t);
                if(tList.includes(teacherName)) {
                    let newTList = tList.filter(t => t !== teacherName);
                    if(newTList.length === 0) {
                        idsToDelete.push(c.id);
                    } else {
                        c.teacher = newTList.join(', ');
                    }
                }
            });
            idsToDelete.forEach(id => clearCourse(id)); 
            courses = courses.filter(c => !idsToDelete.includes(c.id)); 
            delete teacherColors[teacherName]; delete teacherTextColors[teacherName]; delete teacherAvailability[teacherName]; delete teacherEvents[teacherName];
            collapsedTeachers = collapsedTeachers.filter(t => t !== teacherName); save(); render(); Swal.fire('已移除', `${teacherName} 已被移除。`, 'success');
        }
    });
}

function handleDrop(e, targetSlotId) {
    e.preventDefault(); 
    if(isReadOnly) return;
    
    const cId = e.dataTransfer.getData('cId');
    const duration = parseInt(e.dataTransfer.getData('dur')) || 1;
    const dragOffset = currentDragState ? currentDragState.offset : (parseInt(e.dataTransfer.getData('dragOffset')) || 0); 
    
    handleDragEnd();
    
    const course = courses.find(c => c.id === cId); if(!course) return;
    
    const [d, g, pStart] = targetSlotId.split('-'); const pIdx = PERIODS.findIndex(p => p.id === pStart);
    let targetGrade = parseInt(g); if (course.allowedGrades && course.allowedGrades.length > 0) { if (!course.allowedGrades.includes(targetGrade)) { Swal.fire('限制警告', '該課程有限制年級，無法放置於此年級。', 'error'); return; } }

    let actualStartIndex = pIdx - dragOffset;
    
    if (actualStartIndex < 0 || actualStartIndex + duration > PERIODS.length) {
        Swal.fire('放置錯誤', '課程排課時間超出課表範圍', 'error');
        return;
    }

    let targetSlots = []; 
    for(let i=0; i<duration; i++) {
        targetSlots.push(`${d}-${g}-${PERIODS[actualStartIndex+i].id}`);
    }
    
    for(let tSlot of targetSlots) {
        let [td, tg, tp] = tSlot.split('-'); let existing = schedule[tSlot] || [];
        for(let exId of existing) {
            if(exId === cId) continue; 
            
            let exCourse = courses.find(c => c.id === exId); if(!exCourse) continue;
            if(course.parentId && exCourse.parentId === course.parentId) { Swal.fire('重疊錯誤', '同一門課的拆分時段不可重疊', 'error'); return; }
            let mySem = course.semester || 3; let exSem = exCourse.semester || 3; let isSemConflict = (mySem == 3 || exSem == 3 || mySem == exSem);
            if (isSemConflict) { 
                let myTList = course.teacher.split(',').map(t=>t.trim());
                let exTList = exCourse.teacher.split(',').map(t=>t.trim());
                let commonTeacher = myTList.find(t => exTList.includes(t) && t !== "校必修");
                if(commonTeacher) { Swal.fire('教師衝堂', `教師 ${commonTeacher} 在此時段已有 ${exCourse.name}`, 'error'); return; } 
            }
        }
        let conflictFound = false; let conflictName = ""; let checkKey = `${td}-${tg}-${tp}`; let checkList = schedule[checkKey] || [];
        for(let checkId of checkList) {
            if (checkId === cId) continue; 
            let checkCourse = courses.find(c => c.id === checkId); if (!checkCourse) continue;
            let mySem = course.semester || 3; let chkSem = checkCourse.semester || 3; if (mySem != 3 && chkSem != 3 && mySem != chkSem) continue; 
            if (course.isIndependent) { conflictFound = true; conflictName = checkCourse.name; } else if (checkCourse.isIndependent) { conflictFound = true; conflictName = checkCourse.name + "(必修)"; }
            if (conflictFound) break;
        }
        if (conflictFound) { Swal.fire('必修衝突', `同年級時段已有課程「${conflictName}」，獨立必修/校必修課程不可與同年級課程衝堂。`, 'error'); return; }
    }

    Object.keys(schedule).forEach(key => removeFromSchedule(key, cId));
    targetSlots.forEach(s => addToSchedule(s, cId)); 
    
    save(); render();
}

function addToSchedule(slot, cId) { if(!schedule[slot]) schedule[slot] = []; if(!schedule[slot].includes(cId)) schedule[slot].push(cId); }
function removeFromSchedule(slot, cId) { if(schedule[slot]) { schedule[slot] = schedule[slot].filter(x => x !== cId); if(schedule[slot].length === 0) delete schedule[slot]; } }
function getScheduledCount(cId) { let cnt = 0; Object.values(schedule).forEach(l => { if(l.includes(cId)) cnt++; }); return cnt; }
function clearCourse(cId) { if(isReadOnly) return; Object.keys(schedule).forEach(k => removeFromSchedule(k, cId)); save(); render(); }
function deleteCourse(cId) {
    if(isReadOnly) return;
    Swal.fire({ title: '確定刪除?', icon: 'warning', showCancelButton: true, confirmButtonText: '刪除', cancelButtonText: '取消' }).then((result) => {
        if (result.isConfirmed) {
            let course = courses.find(c => c.id === cId); let idsToDelete = [cId]; let targetTeacher = course ? course.teacher : null;
            if(course && course.parentId) { courses.forEach(c => { if(c.parentId === course.parentId) idsToDelete.push(c.id); }); } 
            else if(course && !course.parentId) { courses.forEach(c => { if(c.parentId === cId) idsToDelete.push(c.id); }); }
            idsToDelete = [...new Set(idsToDelete)]; idsToDelete.forEach(id => clearCourse(id)); courses = courses.filter(c => !idsToDelete.includes(c.id));
            if(targetTeacher && targetTeacher !== "校必修") { 
                let tList = targetTeacher.split(',').map(t=>t.trim());
                tList.forEach(t => {
                    let teacherStillExists = courses.some(c => c.teacher.split(',').map(x=>x.trim()).includes(t)); 
                    if(!teacherStillExists) { /* 老師設定跨學年保留，不在此自動刪除 */ } 
                });
            }
            save(); render();
        }
    });
}

function splitCourse(cId) {
    if(isReadOnly) return;
    let original = courses.find(x => x.id === cId); if(!original) return;
    
    let p1Credits, p2Credits;
    if (original.periods === 3) { p1Credits = 1; p2Credits = 2; }
    else if (original.periods === 4) { p1Credits = 2; p2Credits = 2; }
    else if (original.periods === 2) { p1Credits = 1; p2Credits = 1; }
    else { Swal.fire('限制', '目前支援拆分：2學分(1+1)、3學分(1+2)、4學分(2+2)', 'info'); return; }

    if (settings.enableSplitTeacherSelection !== false) {
        let tList = original.teacher.split(',').map(t=>t.trim()).filter(t=>t);
        let tHtml = tList.map(t => `<label class="checkbox mr-3"><input type="checkbox" value="${t}" checked> ${t}</label>`).join('');

        Swal.fire({
            title: '設定拆分課程與教師',
            html: `
                <div style="text-align:left; font-size: 0.9em;">
                    <p class="mb-2"><strong>第一段 (${p1Credits}節) 授課教師：</strong></p>
                    <div id="splitT1" class="mb-3">${tHtml}</div>
                    <p class="mb-2"><strong>第二段 (${p2Credits}節) 授課教師：</strong></p>
                    <div id="splitT2">${tHtml}</div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: '確定拆分',
            cancelButtonText: '取消',
            preConfirm: () => {
                let t1 = Array.from(document.querySelectorAll('#splitT1 input:checked')).map(i=>i.value).join(', ');
                let t2 = Array.from(document.querySelectorAll('#splitT2 input:checked')).map(i=>i.value).join(', ');
                if(!t1) t1 = "未指定"; if(!t2) t2 = "未指定";
                return { t1, t2 };
            }
        }).then(res => {
            if(res.isConfirmed) {
                executeSplit(cId, original, p1Credits, p2Credits, res.value.t1, res.value.t2);
            }
        });
    } else {
        executeSplit(cId, original, p1Credits, p2Credits, original.teacher, original.teacher);
    }
}

function executeSplit(cId, original, p1Credits, p2Credits, t1, t2) {
    clearCourse(cId); let baseId = Date.now();
    let allowed = original.allowedGrades ? [...original.allowedGrades] : []; 
    let cType = original.courseType || 'none'; let isInd = original.isIndependent || false; let cSem = original.semester || 3; 
    let idFilter = original.idFilter || 'all';
    let classFilter = original.classFilter || 'all';
    let partNameBase = original.name.replace(/\(必\)$/, '').replace(/\(選\)$/, '');
    
    let partA = { ...original, id: (baseId).toString(), periods: p1Credits, teacher: t1, isSplit: true, parentId: cId, name: partNameBase + "(1)", allowedGrades: allowed, courseType: cType, isIndependent: isInd, semester: cSem, idFilter: idFilter, classFilter: classFilter };
    let partB = { ...original, id: (baseId+1).toString(), periods: p2Credits, teacher: t2, isSplit: true, parentId: cId, name: partNameBase + "(2)", allowedGrades: allowed, courseType: cType, isIndependent: isInd, semester: cSem, idFilter: idFilter, classFilter: classFilter };
    
    [t1, t2].forEach(ts => {
        ts.split(',').map(t=>t.trim()).filter(t=>t).forEach(t => {
            if(!teacherColors[t]) teacherColors[t] = SOFT_COLORS[Object.keys(teacherColors).length % SOFT_COLORS.length];
        });
    });

    courses = courses.filter(c => c.id !== cId); courses.push(partA, partB); save(); render();
}

function mergeCourse(cId) {
    if(isReadOnly) return;
    let part = courses.find(c => c.id === cId); if(!part || !part.parentId) return;
    let parentId = part.parentId; let siblings = courses.filter(c => c.parentId === parentId);
    siblings.forEach(s => clearCourse(s.id)); let template = siblings[0];
    let totalPeriods = siblings.reduce((sum, s) => sum + s.periods, 0);
    
    let allTeachers = new Set();
    siblings.forEach(s => s.teacher.split(',').map(t=>t.trim()).filter(t=>t).forEach(t => allTeachers.add(t)));
    let mergedTeacher = Array.from(allTeachers).join(', ');
    if(!mergedTeacher) mergedTeacher = "未指定";

    let allowed = template.allowedGrades ? [...template.allowedGrades] : []; let cSem = template.semester || 3;
    let idFilter = template.idFilter || 'all';
    let classFilter = template.classFilter || 'all';
    let cleanName = template.name.replace(/\(\d+\)$/, '').replace(/\(必\)$/, '').replace(/\(選\)$/, '');
    let original = { id: parentId, name: cleanName, teacher: mergedTeacher, periods: totalPeriods, isSplit: false, allowedGrades: allowed, courseType: template.courseType, isIndependent: template.isIndependent, semester: cSem, idFilter: idFilter, classFilter: classFilter };
    courses = courses.filter(c => c.parentId !== parentId); courses.push(original); save(); render();
}

function addCourse() {
    if(isReadOnly) return;
    let name = document.getElementById('mName').value; let teacher = document.getElementById('mTeacher').value; let credits = parseInt(document.getElementById('mCredits').value);
    let checkedGrades = Array.from(document.querySelectorAll('#mGradeContainer input:checked')).map(cb => parseInt(cb.value));
    let mType = document.querySelector('input[name="mType"]:checked').value; let mIndependent = (mType === 'required') ? document.getElementById('mIndependent').checked : false;
    let mSem = parseInt(document.querySelector('input[name="mSem"]:checked').value);
    let idRadio = document.querySelector('input[name="mIdFilter"]:checked'); let mIdFilter = idRadio ? idRadio.value : 'all';
    let classRadio = document.querySelector('input[name="mClassFilter"]:checked'); let mClassFilter = classRadio ? classRadio.value : 'all';

    let finalName = name; if (mType === 'required') finalName += " (必)"; else if (mType === 'elective') finalName += " (選)";
    
    if(name && teacher && credits) {
        courses.push({ id: Date.now().toString(), name: finalName, teacher, periods: credits, isSplit: false, allowedGrades: checkedGrades, courseType: mType, isIndependent: mIndependent, semester: mSem, idFilter: mIdFilter, classFilter: mClassFilter });
        
        let tList = teacher.split(',').map(t=>t.trim()).filter(t=>t);
        tList.forEach(t => {
            if(!teacherColors[t]) teacherColors[t] = SOFT_COLORS[Object.keys(teacherColors).length % SOFT_COLORS.length];
        });

        save(); render(); closeModal();
        if (window.innerWidth <= 768 && typeof closeMobileSidebar === 'function') closeMobileSidebar();
        document.getElementById('mName').value = ''; document.getElementById('mTeacher').value = ''; document.querySelectorAll('#mGradeContainer input').forEach(cb => cb.checked = false);
        document.querySelector('input[name="mType"][value="none"]').checked = true; document.querySelector('input[name="mSem"][value="3"]').checked = true; 
        document.querySelector('input[name="mIdFilter"][value="all"]').checked = true; 
        document.querySelector('input[name="mClassFilter"][value="all"]').checked = true; toggleMIndependent(false);
    } else { Swal.fire('欄位不完整', '請填寫所有欄位', 'warning'); }
}

function openModal() { document.getElementById('courseModal').classList.add('is-active'); }
function closeModal() { document.getElementById('courseModal').classList.remove('is-active'); }

function openEditModal(cId) {
    if(isReadOnly) return;
    let course = courses.find(c => c.id === cId); if(!course) return;
    
    let tabsContainer = document.getElementById('editCourseTabsContainer');
    let tabsUl = document.getElementById('editCourseTabs');
    tabsUl.innerHTML = '';
    
    if (course.parentId) {
        tabsContainer.style.display = 'block';
        let siblings = courses.filter(c => c.parentId === course.parentId).sort((a,b) => a.periods - b.periods);
        siblings.forEach((sib, index) => {
            let li = document.createElement('li');
            if (sib.id === cId) li.className = 'is-active';
            li.innerHTML = `<a onclick="loadEditForm('${sib.id}')">第 ${index + 1} 段</a>`;
            tabsUl.appendChild(li);
        });
    } else {
        tabsContainer.style.display = 'none';
    }
    
    loadEditForm(cId);
    document.getElementById('editCourseModal').classList.add('is-active');
}

function loadEditForm(cId) {
    let course = courses.find(c => c.id === cId); if(!course) return;
    document.getElementById('eId').value = course.id;
    
    let tabsUl = document.getElementById('editCourseTabs');
    if (course.parentId && tabsUl.children.length > 0) {
        Array.from(tabsUl.children).forEach(li => {
            li.classList.remove('is-active');
            if (li.innerHTML.includes(`'${cId}'`)) li.classList.add('is-active');
        });
    }

    let displayName = course.name; 
    if(course.parentId) displayName = displayName.replace(/\(\d+\)$/, ''); 
    displayName = displayName.replace(/\(必\)$/, '').replace(/\(選\)$/, '');
    
    let roomMatch = displayName.match(/\[(.*?)\]/); 
    let roomVal = ""; 
    if (roomMatch) { roomVal = roomMatch[1]; displayName = displayName.replace(/\[.*?\]/g, '').trim(); }
    
    document.getElementById('eName').value = displayName; 
    document.getElementById('eRoom').value = roomVal; 
    document.getElementById('eTeacher').value = course.teacher;
    
    let creditInput = document.getElementById('eCredits'); creditInput.value = course.periods;
    let allowed = course.allowedGrades || []; 
    document.querySelectorAll('#eGradeContainer input').forEach(cb => { cb.checked = allowed.includes(parseInt(cb.value)); });
    
    let cType = course.courseType || 'none'; 
    let radio = document.querySelector(`input[name="eType"][value="${cType}"]`); 
    if(radio) { radio.checked = true; } else { document.querySelector('input[name="eType"][value="none"]').checked = true; } 
    
    toggleEIndependent(cType === 'required'); 
    if (cType === 'required') { document.getElementById('eIndependent').checked = !!course.isIndependent; }
    
    let cSem = course.semester || 3; 
    let semRadio = document.querySelector(`input[name="eSem"][value="${cSem}"]`); 
    if(semRadio) { semRadio.checked = true; } else { document.querySelector('input[name="eSem"][value="3"]').checked = true; } 
    
    // 向前相容與載入
    let classFilter = course.classFilter || 'all';
    if (course.idFilter === 'A' || course.idFilter === 'B') { classFilter = course.idFilter; }
    let classRadio = document.querySelector(`input[name="eClassFilter"][value="${classFilter}"]`);
    if(classRadio) { classRadio.checked = true; } else { document.querySelector('input[name="eClassFilter"][value="all"]').checked = true; }

    let idFilter = course.idFilter || 'all';
    if (idFilter === 'A' || idFilter === 'B') { idFilter = 'all'; }
    let idRadio = document.querySelector(`input[name="eIdFilter"][value="${idFilter}"]`);
    if(idRadio) { idRadio.checked = true; } else { document.querySelector('input[name="eIdFilter"][value="all"]').checked = true; }
    
    if(course.parentId) { 
        creditInput.disabled = true; 
        document.getElementById('eCreditsHelp').innerText = "已拆分課程不可修改節數，請先合併後再修改。"; 
    } else { 
        creditInput.disabled = false; 
        document.getElementById('eCreditsHelp').innerText = "注意：修改節數將會清除該課程目前的排課時間。"; 
    }
}

function closeEditModal() { document.getElementById('editCourseModal').classList.remove('is-active'); }

function submitEdit() {
    try {
        if(isReadOnly) return;
        let cId = document.getElementById('eId').value; 
        let baseName = document.getElementById('eName').value.trim(); 
        let room = document.getElementById('eRoom').value.trim(); 
        let teacher = document.getElementById('eTeacher').value;
        let creditsInputVal = document.getElementById('eCredits').value; let credits = parseInt(creditsInputVal);
        let checkedGrades = Array.from(document.querySelectorAll('#eGradeContainer input:checked')).map(cb => parseInt(cb.value));
        let typeRadio = document.querySelector('input[name="eType"]:checked'); let eType = typeRadio ? typeRadio.value : 'none'; let eIndependent = (eType === 'required') ? document.getElementById('eIndependent').checked : false;
        let semRadio = document.querySelector('input[name="eSem"]:checked'); let eSem = semRadio ? parseInt(semRadio.value) : 3;
        let idRadio = document.querySelector('input[name="eIdFilter"]:checked'); let eIdFilter = idRadio ? idRadio.value : 'all';
        let classRadio = document.querySelector('input[name="eClassFilter"]:checked'); let eClassFilter = classRadio ? classRadio.value : 'all';
        
        let coreName = baseName; 
        if (eType === 'required') coreName += " (必)"; else if (eType === 'elective') coreName += " (選)";
        
        let courseIndex = courses.findIndex(c => c.id === cId); if(courseIndex === -1) { Swal.fire('錯誤', '找不到該課程，請重新整理頁面。', 'error'); return; }
        let originalCourse = courses[courseIndex]; let isValid = baseName && teacher;
        if (!originalCourse.parentId) { if (!credits || isNaN(credits)) isValid = false; } else { credits = originalCourse.periods; }

        if(isValid) {
            if (originalCourse.parentId) {
                courses.forEach(c => { 
                    if (c.parentId === originalCourse.parentId) { 
                        c.allowedGrades = checkedGrades; 
                        c.courseType = eType; 
                        c.isIndependent = eIndependent; 
                        c.semester = eSem; 
                        c.idFilter = eIdFilter;
                        c.classFilter = eClassFilter;
                        
                        let suffixMatch = c.name.match(/\(\d+\)$/);
                        let suffix = suffixMatch ? suffixMatch[0] : "";
                        
                        if (c.id === cId) {
                            c.teacher = teacher;
                            let newName = coreName;
                            if (room) newName += ` [${room}]`;
                            c.name = newName + suffix;
                        } else {
                            let existingRoomMatch = c.name.match(/\[(.*?)\]/);
                            let existingRoom = existingRoomMatch ? existingRoomMatch[1] : "";
                            let newName = coreName;
                            if (existingRoom) newName += ` [${existingRoom}]`;
                            c.name = newName + suffix;
                        }
                    } 
                });
                handleTeacherColorUpdate(originalCourse.teacher, teacher);
            } else {
                if(originalCourse.periods !== credits) clearCourse(cId);
                handleTeacherColorUpdate(originalCourse.teacher, teacher);
                
                let finalName = coreName;
                if (room) finalName += ` [${room}]`;
                
                courses[courseIndex] = { ...originalCourse, name: finalName, teacher: teacher, periods: credits, allowedGrades: checkedGrades, courseType: eType, isIndependent: eIndependent, semester: eSem, idFilter: eIdFilter, classFilter: eClassFilter };
            }
            save(); render(); closeEditModal();
        } else { Swal.fire('欄位不完整', '請填寫所有欄位', 'warning'); }
    } catch (error) { console.error(error); Swal.fire('系統錯誤', '儲存時發生例外錯誤: ' + error.message, 'error'); }
}

function handleTeacherColorUpdate(oldTeacherStr, newTeacherStr) {
    let oldList = oldTeacherStr.split(',').map(t=>t.trim()).filter(t=>t);
    let newList = newTeacherStr.split(',').map(t=>t.trim()).filter(t=>t);

    oldList.forEach(oldTeacher => {
        if(oldTeacher !== "校必修" && !newList.includes(oldTeacher)) {
            let oldTeacherStillExists = courses.some(c => c.teacher.split(',').map(x=>x.trim()).includes(oldTeacher));
            if(!oldTeacherStillExists) { 
                /* 老師設定跨學年保留，不在此自動刪除 */
            }
        }
    });

    newList.forEach(newTeacher => {
        if(newTeacher !== "校必修" && !teacherColors[newTeacher]) {
            teacherColors[newTeacher] = SOFT_COLORS[Object.keys(teacherColors).length % SOFT_COLORS.length];
        }
    });
}

function exportToICS() {
    let currSem = parseInt(settings.currentSemester);
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//HC//Schedule Simulator//TW\nCALSCALE:GREGORIAN\n";
    
    let baseDates = { 1: "20240909", 2: "20240910", 3: "20240911", 4: "20240912", 5: "20240913", 6: "20240914", 7: "20240915" };

    let addedEvents = new Set();
    let dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + "Z";

    for (let key in schedule) {
        let [d, g, p] = key.split('-');
        let cIds = schedule[key];
        let pObj = PERIODS.find(x => x.id === p);
        if(!pObj) continue;
        
        let [startTime, endTime] = pObj.t.split('-');
        let formatTime = (t) => t.replace(':', '') + '00';
        let dtStart = baseDates[d] + "T" + formatTime(startTime);
        let dtEnd = baseDates[d] + "T" + formatTime(endTime);

        cIds.forEach(cId => {
            let course = courses.find(c => c.id === cId);
            if(course && (course.semester == 3 || course.semester == currSem)) {
                let eventKey = `${cId}-${d}-${p}`;
                if(!addedEvents.has(eventKey)) {
                    addedEvents.add(eventKey);
                    let roomMatch = course.name.match(/\[(.*?)\]/);
                    let room = roomMatch ? roomMatch[1] : "";
                    let cleanName = course.name.replace(/\[.*?\]/g, '').trim();

                    icsContent += "BEGIN:VEVENT\n";
                    icsContent += `UID:${eventKey}@hc.simulator\n`;
                    icsContent += `DTSTAMP:${dtstamp}\n`;
                    icsContent += `DTSTART;TZID=Asia/Taipei:${dtStart}\n`;
                    icsContent += `DTEND;TZID=Asia/Taipei:${dtEnd}\n`;
                    icsContent += `SUMMARY:${cleanName}\n`;
                    icsContent += `DESCRIPTION:教師: ${course.teacher}\\n學分: ${course.periods}\\n年級: 大${['一','二','三','四'][g-1]}\n`;
                    if(room) icsContent += `LOCATION:${room}\n`;
                    icsContent += "RRULE:FREQ=WEEKLY;COUNT=18\n";
                    icsContent += "END:VEVENT\n";
                }
            }
        });
    }
    icsContent += "END:VCALENDAR";

    let blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    let link = document.createElement("a");
    let url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `東海電機_排課日曆_第${currSem}學期.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    Swal.fire({toast: true, position: 'top-end', icon: 'success', title: '已下載行事曆 (.ics)', showConfirmButton: false, timer: 2000});
}

/* ===== 手機版互動函數 ===== */

// --- Body scroll lock（解決 iOS 滑動穿透問題）---
let _mobileScrollY = 0;

function lockBodyScroll() {
    if (window.innerWidth > 768) return;
    _mobileScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${_mobileScrollY}px`;
    document.body.style.width = '100%';
}

function unlockBodyScroll() {
    if (window.innerWidth > 768) return;
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, _mobileScrollY);
}

// --- Modal 高度精確計算（解決 iOS vh bug）---
function fixMobileModalHeight(modalEl) {
    if (window.innerWidth > 768 || !modalEl) return;
    const card = modalEl.querySelector('.modal-card');
    if (!card) return;

    const availH = window.innerHeight - 65; // 65px = bottom nav
    card.style.maxHeight = availH + 'px';
    card.style.height = 'auto';

    requestAnimationFrame(() => {
        const head = card.querySelector('.modal-card-head');
        const foot = card.querySelector('.modal-card-foot');
        const body = card.querySelector('.modal-card-body');
        if (!body) return;
        const headH = head ? head.getBoundingClientRect().height : 0;
        const footH = foot ? foot.getBoundingClientRect().height : 0;
        const bodyH = Math.max(availH - headH - footH - 2, 100);
        body.style.height = bodyH + 'px';
        body.style.maxHeight = bodyH + 'px';
        body.style.overflowY = 'auto';
        body.style.webkitOverflowScrolling = 'touch';
        body.style.flex = 'none';
    });
}

// --- MutationObserver：監聽所有 Modal 開關 ---
window.addEventListener('DOMContentLoaded', () => {
    if (window.innerWidth > 768) return;

    const observer = new MutationObserver(mutations => {
        mutations.forEach(({ target, attributeName }) => {
            if (attributeName !== 'class' || !target.classList.contains('modal')) return;
            if (target.classList.contains('is-active')) {
                closeMobileSidebar();
                lockBodyScroll();
                setTimeout(() => fixMobileModalHeight(target), 40);
            } else {
                // 只有在沒有其他 modal 開著時才 unlock
                const stillOpen = document.querySelector('.modal.is-active');
                if (!stillOpen) unlockBodyScroll();
            }
        });
    });

    document.querySelectorAll('.modal').forEach(m =>
        observer.observe(m, { attributes: true, attributeFilter: ['class'] })
    );

    // 防止手指在 modal 背景滑動時捲動底層頁面
    document.addEventListener('touchmove', e => {
        const activeModal = document.querySelector('.modal.is-active');
        if (!activeModal) return;
        if (!e.target.closest('.modal-card-body') && !e.target.closest('.modal-content')) {
            e.preventDefault();
        }
    }, { passive: false });

    initMobileZoom();
});

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if (!sidebar || !overlay) return;
    const isOpen = sidebar.classList.contains('mobile-open');
    if (isOpen) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('is-active');
        const btn = document.getElementById('mobileNavCourses');
        if (btn) btn.classList.remove('is-active');
        const timetableBtn = document.getElementById('mobileNavTimetable');
        if (timetableBtn) timetableBtn.classList.add('is-active');
    } else {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('is-active');
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    if (!sidebar || !overlay) return;
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('is-active');
    const coursesBtn = document.getElementById('mobileNavCourses');
    if (coursesBtn) coursesBtn.classList.remove('is-active');
    const timetableBtn = document.getElementById('mobileNavTimetable');
    if (timetableBtn) timetableBtn.classList.add('is-active');
}

function mobileNavTo(tab) {
    document.querySelectorAll('.mobile-nav-item').forEach(btn => btn.classList.remove('is-active'));

    switch (tab) {
        case 'timetable':
            closeMobileSidebar();
            document.getElementById('mobileNavTimetable').classList.add('is-active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            break;
        case 'courses':
            document.getElementById('mobileNavCourses').classList.add('is-active');
            toggleMobileSidebar();
            break;
        case 'stats':
            document.getElementById('mobileNavStats').classList.add('is-active');
            openAnalysisModal();
            setTimeout(() => {
                document.getElementById('mobileNavTimetable').classList.add('is-active');
                document.getElementById('mobileNavStats').classList.remove('is-active');
            }, 400);
            break;
        case 'download':
            document.getElementById('mobileNavDownload').classList.add('is-active');
            Swal.fire({
                title: '下載課表',
                html: `<div style="display:flex;flex-direction:column;gap:10px;padding:5px 0;">
                    <button class="button is-info is-light is-fullwidth" onclick="Swal.close();exportImage('png')">
                        <span class="icon"><i class="fas fa-image"></i></span><span>下載 PNG 圖片</span>
                    </button>
                    <button class="button is-danger is-light is-fullwidth" onclick="Swal.close();exportImage('pdf')">
                        <span class="icon"><i class="fas fa-file-pdf"></i></span><span>下載 PDF (總表)</span>
                    </button>
                    <button class="button is-warning is-light is-fullwidth" onclick="Swal.close();openTeacherExportModal()">
                        <span class="icon"><i class="fas fa-user"></i></span><span>教師個人課表 (PDF)</span>
                    </button>
                </div>`,
                showConfirmButton: false,
                showCloseButton: true,
            });
            setTimeout(() => {
                document.getElementById('mobileNavTimetable').classList.add('is-active');
                document.getElementById('mobileNavDownload').classList.remove('is-active');
            }, 400);
            break;
        case 'settings':
            document.getElementById('mobileNavSettings').classList.add('is-active');
            openSettingsModal();
            setTimeout(() => {
                document.getElementById('mobileNavTimetable').classList.add('is-active');
                document.getElementById('mobileNavSettings').classList.remove('is-active');
            }, 400);
            break;
    }
}

// ===== 手機版整體縮放功能 =====
let _mobileZoom = 1.0;
const _ZOOM_KEY = 'mobileZoomLevel';

function initMobileZoom() {
    if (window.innerWidth > 768) return;
    const saved = parseFloat(localStorage.getItem(_ZOOM_KEY));
    if (!isNaN(saved) && saved >= 0.4 && saved <= 1.5) {
        _mobileZoom = saved;
    }
    _applyMobileZoom();
}

function _applyMobileZoom() {
    const wrapper = document.querySelector('.screenshot-wrapper');
    if (wrapper) wrapper.style.zoom = _mobileZoom;

    const label = document.getElementById('mobileZoomLabel');
    const slider = document.getElementById('mobileZoomSlider');
    if (label) label.textContent = Math.round(_mobileZoom * 100) + '%';
    if (slider) slider.value = Math.round(_mobileZoom * 100);

    localStorage.setItem(_ZOOM_KEY, _mobileZoom);
}

function adjustMobileZoom(delta) {
    _mobileZoom = Math.max(0.4, Math.min(1.5, Math.round((_mobileZoom + delta) * 100) / 100));
    _applyMobileZoom();
}

function setMobileZoomFromSlider(value) {
    _mobileZoom = parseFloat(value) / 100;
    _applyMobileZoom();
}