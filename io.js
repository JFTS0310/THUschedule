function normalizeCourseName(name) {
    let n = name.replace(/必修/g, '')
                .replace(/選修/g, '')
                .replace(/\(必\)/g, '')
                .replace(/\(選\)/g, '')
                .replace(/\(校\)/g, '')
                .replace(/\s*\[.*?\]$/g, '')
                .replace(/[（〈＜\[{【]/g, '(')
                .replace(/[）〉＞\]}】]/g, ')')
                .replace(/Ⅰ/g, 'I')
                .replace(/Ⅱ/g, 'II')
                .replace(/Ⅲ/g, 'III')
                .replace(/-/g, '')
                .replace(/\s+/g, '');
    return n;
}

function getRootName(name) { return name.replace(/\(([\dI]+|[一二三四])\)$/i, ''); }

function openCrawlerModal() {
    if(isReadOnly) return;
    let deptCode = "360"; let sem = settings.currentSemester; let y = currentYear; let url = `https://course.thu.edu.tw/view-dept/${y}/${sem}/${deptCode}`;
    
    Swal.fire({ 
        title: '更新教室地點', 
        html: `<div style="text-align: left;"><p class="mb-2">此功能將解析 <strong>${y}學年度 第${sem}學期</strong> 的課表資料。</p>
        <div class="field has-addons"><p class="control is-expanded"><input class="input is-small" type="text" value="${url}" readonly></p><p class="control"><a class="button is-small is-link" href="${url}" target="_blank">打開網頁</a></p></div>
        <hr class="my-3">
        <div class="buttons is-centered">
            <button class="button is-success" onclick="document.getElementById('excelInput').click()">
                <span class="icon"><i class="fas fa-file-excel"></i></span><span>📂 上傳 Excel 課表</span>
            </button>
        </div>
        <p class="help has-text-grey mb-2">請確保 Excel 第一列包含：<strong>「選課代碼-課程名稱」、「授課教師」、「星期/節次」</strong>。</p>
        <hr>
        <p class="mb-2 is-size-7">或者使用網頁存檔：</p>
        <button class="button is-small is-light is-fullwidth" onclick="document.getElementById('crawlerJsonInput').click()">📂 上傳網頁存檔 (HTML)</button>
        </div>`, 
        showConfirmButton: false, showCloseButton: true
    });
}

function handleExcelUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        try {
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const headers = XLSX.utils.sheet_to_json(worksheet, {header: 1})[0];
            const jsonContent = XLSX.utils.sheet_to_json(worksheet);
            processExcelData(jsonContent, headers);
        } catch (err) {
            console.error(err);
            Swal.fire('讀取失敗', '檔案格式錯誤或無法讀取。\n' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; 
    Swal.close(); 
}

function processExcelData(data, headers) {
    let updateCount = 0; 
    let splitCount = 0;
    let dayMap = {'一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '日':7};
    
    let diagnostics = { totalRows: data.length, missingColumns: 0, teacherMismatch: 0, courseMismatch: 0, success: 0 };
    let errorSample = "";

    let nameKey = headers.find(h => typeof h === 'string' && (h.includes('課程名稱') || h.includes('科目') || h.includes('課名')));
    let teacherKey = headers.find(h => typeof h === 'string' && (h.includes('教師') || h.includes('老師')));
    let timeKey = headers.find(h => typeof h === 'string' && (h.includes('時間') || h.includes('節次') || h.includes('星期')));
    let roomKey = headers.find(h => typeof h === 'string' && (h.includes('教室') || h.includes('地點')));

    if (!nameKey || !teacherKey || !timeKey) {
        Swal.fire({ title: '欄位名稱錯誤', icon: 'error', html: `找不到必要欄位，請確認 Excel 標題列包含「課程名稱」、「教師」、「節次/時間」。<br><br><small>系統偵測到的標題: ${headers.join(', ')}</small>` });
        return;
    }

    data.forEach(row => {
        let safeRow = {}; for (let key in row) { safeRow[key.toString().trim()] = row[key]; }
        
        let rawName = safeRow[nameKey] ? safeRow[nameKey].toString() : '';
        let teacher = safeRow[teacherKey] ? safeRow[teacherKey].toString() : '';
        let timeStr = safeRow[timeKey] ? safeRow[timeKey].toString() : '';
        let separateRoom = (roomKey && safeRow[roomKey]) ? safeRow[roomKey].toString() : '';

        if (!rawName || !teacher) { diagnostics.missingColumns++; return; }

        let cleanName = rawName.replace(/^\d+\s+/, '').trim(); 
        let matchName = normalizeCourseName(cleanName); 
        teacher = teacher.trim();

        if (!timeStr) return;

        let segments = [];
        let normalizedTimeStr = timeStr.replace(/，/g, ',').replace(/、/g, ',').replace(/\s+/g, ' ').toUpperCase();
        let regex = /([一二三四五六日])\s*(?:\/|-)?\s*([0-9,N]+)(?:\[([a-zA-Z0-9_\-]+)\])?/g; 
        let match;
        let hasMatch = false;
        
        while ((match = regex.exec(normalizedTimeStr)) !== null) {
            hasMatch = true;
            let d = dayMap[match[1]];
            let pList = match[2].split(',').map(p => p.trim()).filter(p => p);
            let r = match[3] || separateRoom || ""; 
            if (d) segments.push({ day: d, periods: pList, room: r.trim() });
        }

        if (!hasMatch) return;

        let targetCourseIdx = courses.findIndex(c => 
            c.teacher === teacher && 
            normalizeCourseName(c.name).includes(matchName)
        );

        if (targetCourseIdx === -1) {
            let teacherExists = courses.some(c => c.teacher === teacher);
            if (teacherExists) { diagnostics.courseMismatch++; if(diagnostics.courseMismatch <= 3) errorSample += `<li>找不到課名：<strong>${cleanName}</strong> (老師: ${teacher})</li>`; } 
            else { diagnostics.teacherMismatch++; if(diagnostics.teacherMismatch <= 3) errorSample += `<li>找不到老師：<strong>${teacher}</strong></li>`; }
        } else {
            let originalCourse = courses[targetCourseIdx];
            let uniqueRooms = [...new Set(segments.map(s => s.room).filter(r=>r))];
            let isComplex = uniqueRooms.length > 1 || (originalCourse.parentId && segments.length > 1) || segments.length > 1;

            if (isComplex) {
                let idsToDelete = [];
                if (originalCourse.parentId) {
                    idsToDelete = courses.filter(c => c.parentId === originalCourse.parentId).map(c => c.id);
                } else {
                    idsToDelete = [originalCourse.id];
                }

                let savedColor = teacherColors[originalCourse.teacher];
                idsToDelete.forEach(id => clearCourse(id)); 
                courses = courses.filter(c => !idsToDelete.includes(c.id)); 

                let baseProps = {
                    teacher: teacher,
                    allowedGrades: originalCourse.allowedGrades,
                    courseType: originalCourse.courseType,
                    isIndependent: originalCourse.isIndependent,
                    semester: originalCourse.semester
                };
                
                performSmartSplit_Rebuild(baseProps, segments, cleanName, savedColor);
                
                splitCount++; updateCount++; diagnostics.success++;
            } else {
                let primaryRoom = uniqueRooms.length > 0 ? uniqueRooms[0] : "";
                let coreName = cleanName.replace(/必修-?/, '').replace(/選修-?/, ''); 
                if (originalCourse.courseType === 'required') coreName += " (必)";
                else if (originalCourse.courseType === 'elective') coreName += " (選)";
                
                let roomTxt = primaryRoom ? ` [${primaryRoom}]` : "";
                let finalName = `${coreName}${roomTxt}`;

                if (originalCourse.parentId) {
                    courses.forEach(c => {
                        if (c.parentId === originalCourse.parentId) {
                            let suffix = c.name.match(/\(\d+\)$/) ? c.name.match(/\(\d+\)$/)[0] : "";
                            c.name = `${coreName}${roomTxt}${suffix}`;
                        }
                    });
                } else {
                    originalCourse.name = finalName;
                    clearCourse(originalCourse.id);
                    segments.forEach(seg => {
                        seg.periods.forEach(p => {
                            let grade = (originalCourse.allowedGrades && originalCourse.allowedGrades.length>0) ? originalCourse.allowedGrades[0] : 1;
                            if(p === '4.5') p = 'N';
                            let key = `${seg.day}-${grade}-${p}`; 
                            addToSchedule(key, originalCourse.id);
                        });
                    });
                }
                updateCount++; diagnostics.success++;
            }
        }
    });

    save(); render();
    let icon = (updateCount > 0) ? 'success' : 'warning';
    let title = (updateCount > 0) ? '更新完成' : '沒有資料被更新';
    let detailHtml = `<ul style="text-align:left; font-size:13px; list-style-type:disc; padding-left:20px;">
        <li>Excel 總筆數: ${diagnostics.totalRows}</li>
        <li><strong>成功更新: ${updateCount}</strong> (包含 ${splitCount} 門智慧分流排課)</li>
        <li>課程比對失敗: ${diagnostics.courseMismatch}</li>
        <li>老師比對失敗: ${diagnostics.teacherMismatch}</li>
    </ul>`;
    if (errorSample) detailHtml += `<hr><p style="text-align:left;font-size:12px;color:red;">失敗範例:</p><ul style="text-align:left;font-size:12px;color:red;list-style:disc;padding-left:20px;">${errorSample}</ul>`;
    Swal.fire({ title: title, html: detailHtml, icon: icon });
}

function performSmartSplit_Rebuild(baseProps, segments, baseName, savedColor) {
    let parentId = Date.now() + "_" + Math.random().toString().substr(2, 5);
    let newParts = [];
    
    let cleanBaseName = baseName.replace(/必修-?/, '').replace(/選修-?/, '');
    let suffixType = "";
    if (baseProps.courseType === 'required') suffixType = " (必)";
    else if (baseProps.courseType === 'elective') suffixType = " (選)";

    segments.forEach((seg, idx) => {
        let partId = parentId + "_" + idx;
        let partPeriods = seg.periods.length;
        
        let roomTxt = seg.room ? ` [${seg.room}]` : "";
        let partName = `${cleanBaseName}${roomTxt}${suffixType}(${idx+1})`; 

        let newPart = {
            id: partId, name: partName, periods: partPeriods,
            teacher: baseProps.teacher, allowedGrades: baseProps.allowedGrades, courseType: baseProps.courseType,
            isIndependent: baseProps.isIndependent, semester: baseProps.semester,
            parentId: parentId, isSplit: true
        };
        newParts.push(newPart);

        let grade = (baseProps.allowedGrades && baseProps.allowedGrades.length > 0) ? baseProps.allowedGrades[0] : 1;
        seg.periods.forEach(p => {
            if (p === '4.5') p = 'N';
            let key = `${seg.day}-${grade}-${p}`;
            addToSchedule(key, partId);
        });
    });

    courses.push(...newParts);
    if (savedColor) teacherColors[baseProps.teacher] = savedColor;
    else if (!teacherColors[baseProps.teacher]) teacherColors[baseProps.teacher] = SOFT_COLORS[Object.keys(teacherColors).length % SOFT_COLORS.length];
}

async function importCoursesFromExcel(data, headers) {
    const result = await Swal.fire({
        title: 'Excel 匯入建檔',
        text: '偵測到 Excel 檔案！您要如何處理這些課程資料？',
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '覆蓋現存課表',
        denyButtonText: '附加於現存課表',
        cancelButtonText: '取消'
    });

    if (!result.isConfirmed && !result.isDenied) return;

    let nameKey = headers.find(h => typeof h === 'string' && (h.includes('課程名稱') || h.includes('科目') || h.includes('課名')));
    let teacherKey = headers.find(h => typeof h === 'string' && (h.includes('教師') || h.includes('老師')));
    let timeKey = headers.find(h => typeof h === 'string' && (h.includes('時間') || h.includes('節次') || h.includes('星期')));
    let creditKey = headers.find(h => typeof h === 'string' && (h.includes('學分') || h.includes('節數')));
    let noteKey = headers.find(h => typeof h === 'string' && (h.includes('備註') || h.includes('限制') || h.includes('年級')));
    let semKey = headers.find(h => typeof h === 'string' && (h.includes('學期')));
    let typeKey = headers.find(h => typeof h === 'string' && (h.includes('屬性')));
    let colorKey = headers.find(h => typeof h === 'string' && (h.includes('老師顏色') || h.includes('顏色')));

    if (!nameKey || !teacherKey || !timeKey) {
        Swal.fire('欄位錯誤', 'Excel 標題列必須包含「課程名稱」、「教師」、「時間」等關鍵字。', 'error');
        return;
    }

    if (result.isConfirmed) {
        courses = []; schedule = {}; teacherColors = {}; teacherAvailability = {}; teacherEvents = {};
    }

    let importCount = 0;
    let dayMap = {'一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '日':7};

    data.forEach(row => {
        let safeRow = {}; for (let key in row) { safeRow[key.toString().trim()] = row[key]; }
        
        let rawName = safeRow[nameKey] ? safeRow[nameKey].toString() : '';
        let teacher = safeRow[teacherKey] ? safeRow[teacherKey].toString().trim() : '';
        let timeStr = safeRow[timeKey] ? safeRow[timeKey].toString() : '';
        
        if (!rawName || !teacher || !timeStr) return;

        let cType = 'none';
        if (typeKey && safeRow[typeKey]) {
            let tStr = safeRow[typeKey].toString();
            if (tStr.includes('必修')) cType = 'required';
            else if (tStr.includes('選修')) cType = 'elective';
        } else {
            if (rawName.includes('必修')) cType = 'required';
            else if (rawName.includes('選修')) cType = 'elective';
        }

        let cleanName = rawName.replace(/^\d+\s+/, '').replace(/必修-?/, '').replace(/選修-?/, '').replace(/\(必\)/g, '').replace(/\(選\)/g, '').trim();
        if (cType === 'required' && !cleanName.includes('(必)')) cleanName += ' (必)';
        if (cType === 'elective' && !cleanName.includes('(選)')) cleanName += ' (選)';

        let credits = 3; 
        if (creditKey && safeRow[creditKey]) {
            let m = safeRow[creditKey].toString().match(/(\d+)/);
            if (m) credits = parseInt(m[1]);
        }

        let noteStr = ""; 
        for (let k in safeRow) {
            if (k.includes('備註') || k.includes('限制') || k.includes('年級') || k.includes('對象') || k.includes('系所')) {
                noteStr += safeRow[k] + " ";
            }
        }
        
        let fullStr = rawName + " " + noteStr;
        
        let targetStr = fullStr.split('\n')[0];
        
        let allowedGrades = [];
        
        if (targetStr.includes('/')) {
            let parts = targetStr.split('/');
            let afterSlash = parts[parts.length - 1]; 
            
            let hasShuo = afterSlash.includes('碩');
            let beforeShuo = hasShuo ? afterSlash.split('碩')[0] : afterSlash;
            
            let numMatches = beforeShuo.match(/[1-4]/g);
            if (numMatches && numMatches.length > 0) {
                allowedGrades.push(Math.min(...numMatches.map(Number)));
            } else if (hasShuo) {
                allowedGrades.push(4);
            }
        }

        if (allowedGrades.length === 0) {
            if (targetStr.match(/1年級|一年級|大一|電機系1/)) allowedGrades.push(1);
            else if (targetStr.match(/2年級|二年級|大二|電機系2/)) allowedGrades.push(2);
            else if (targetStr.match(/3年級|三年級|大三|電機系3/)) allowedGrades.push(3);
            else if (targetStr.match(/4年級|四年級|大四|電機系4/)) allowedGrades.push(4);
            else {
                let pureNote = noteStr.split('\n')[0];
                let hasShuo = pureNote.includes('碩');
                let beforeShuo = hasShuo ? pureNote.split('碩')[0] : pureNote;
                let numMatches = beforeShuo.match(/[1-4]/g);
                if (numMatches && numMatches.length > 0) {
                    allowedGrades.push(Math.min(...numMatches.map(Number)));
                } else if (hasShuo) {
                    allowedGrades.push(4);
                }
            }
        }

        if(allowedGrades.length === 0) allowedGrades = [1,2,3,4]; 

        let cSem = settings.currentSemester;
        if (semKey && safeRow[semKey]) {
            let semStr = safeRow[semKey].toString();
            if (semStr.includes('上') || semStr === '1') cSem = 1;
            else if (semStr.includes('下') || semStr === '2') cSem = 2;
            else if (semStr.includes('全') || semStr === '3') cSem = 3;
        }

        let segments = [];
        let normalizedTimeStr = timeStr.replace(/，/g, ',').replace(/、/g, ',').replace(/\s+/g, ' ').toUpperCase();
        let regex = /([一二三四五六日])\s*(?:\/|-)?\s*([0-9,N]+)(?:\[([a-zA-Z0-9_\-]+)\])?/g; 
        let match;
        while ((match = regex.exec(normalizedTimeStr)) !== null) {
            let d = dayMap[match[1]];
            let pList = match[2].split(',').map(p => p.trim()).filter(p => p);
            let r = match[3] || ""; 
            if (d) segments.push({ day: d, periods: pList, room: r.trim() });
        }

        if (segments.length === 0) return;
        let actualPeriods = segments.reduce((sum, s) => sum + s.periods.length, 0);
        if (actualPeriods > 0) credits = actualPeriods; 

        let extractedColor = colorKey && safeRow[colorKey] ? safeRow[colorKey].toString().trim() : null;
        if (extractedColor && /^#[0-9A-Fa-f]{6}$/i.test(extractedColor)) {
            teacherColors[teacher] = extractedColor;
        } else if (!teacherColors[teacher]) {
            teacherColors[teacher] = SOFT_COLORS[Object.keys(teacherColors).length % SOFT_COLORS.length];
        }

        let isComplex = segments.length > 1 || segments.some(s => s.room !== segments[0].room);
        
        if (isComplex) {
            let parentId = Date.now() + "_" + Math.random().toString().substr(2, 5);
            segments.forEach((seg, idx) => {
                let partId = parentId + "_" + idx;
                let roomTxt = seg.room ? ` [${seg.room}]` : "";
                let partName = `${cleanName.replace(/ \((必|選)\)/, '')}${roomTxt}`;
                if (cType === 'required') partName += ' (必)';
                else if (cType === 'elective') partName += ' (選)';
                partName += `(${idx+1})`;

                let newPart = {
                    id: partId, name: partName, periods: seg.periods.length,
                    teacher: teacher, allowedGrades: allowedGrades, courseType: cType,
                    isIndependent: false, semester: cSem,
                    parentId: parentId, isSplit: true
                };
                courses.push(newPart);

                seg.periods.forEach(p => {
                    if (p === '4.5') p = 'N';
                    let g = allowedGrades[0] || 1;
                    let key = `${seg.day}-${g}-${p}`;
                    addToSchedule(key, partId);
                });
            });
        } else {
            let cId = Date.now() + "_" + Math.random().toString().substr(2, 5);
            let roomTxt = segments[0].room ? ` [${segments[0].room}]` : "";
            let finalName = `${cleanName.replace(/ \((必|選)\)/, '')}${roomTxt}`;
            if (cType === 'required') finalName += ' (必)';
            else if (cType === 'elective') finalName += ' (選)';

            let newCourse = {
                id: cId, name: finalName, periods: actualPeriods,
                teacher: teacher, allowedGrades: allowedGrades, courseType: cType,
                isIndependent: false, semester: cSem,
                isSplit: false
            };
            courses.push(newCourse);

            segments[0].periods.forEach(p => {
                if (p === '4.5') p = 'N';
                let g = allowedGrades[0] || 1;
                let key = `${segments[0].day}-${g}-${p}`;
                addToSchedule(key, cId);
            });
        }
        importCount++;
    });

    save(); render();
    Swal.fire('匯入成功', `已順利將 ${importCount} 門課程匯入系統！`, 'success');
}

function exportToExcel() {
    if(courses.length === 0) {
        Swal.fire('無法匯出', '目前沒有任何課程資料喔。', 'warning');
        return;
    }
    
    Swal.fire({ title: '產生中...', text: '正在打包 Excel 檔案，請稍候', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    setTimeout(() => {
        let data = [['課程名稱', '授課教師', '學分', '開課學期', '屬性', '限制年級', '時間地點', '老師顏色']];
        const dayMap = {1:'一', 2:'二', 3:'三', 4:'四', 5:'五', 6:'六', 7:'日'};
        let processedParents = new Set();
        
        courses.forEach(c => {
            if (c.isDeptReq || c.teacher.split(',').map(t=>t.trim()).includes('校必修')) return;

            let isSplit = !!c.parentId;
            let refId = isSplit ? c.parentId : c.id;
            
            if (isSplit && processedParents.has(refId)) return;
            if (isSplit) processedParents.add(refId);
            
            let targetCourses = isSplit ? courses.filter(x => x.parentId === refId) : [c];
            
            let baseName = targetCourses[0].name.replace(/\(\d+\)$/, '').replace(/\[.*?\]/g, '').trim();
            baseName = baseName.replace(/ \((必|選)\)$/, ''); 
            
            let teacher = targetCourses[0].teacher;
            let totalPeriods = targetCourses.reduce((sum, x) => sum + x.periods, 0);
            let semText = targetCourses[0].semester === 3 ? '全學年' : (targetCourses[0].semester === 1 ? '上學期' : '下學期');
            let cTypeStr = targetCourses[0].courseType === 'required' ? '必修' : (targetCourses[0].courseType === 'elective' ? '選修' : '無');
            
            let prefix = (cTypeStr === '必修') ? '必修-' : ((cTypeStr === '選修') ? '選修-' : '');
            let exportName = prefix + baseName;
            
            let grades = (targetCourses[0].allowedGrades || []).map(g => {
                if(g===1) return '大一';
                if(g===2) return '大二';
                if(g===3) return '大三';
                if(g===4) return '大四/碩士';
                return '';
            }).join(', ');

            let timeStrings = [];
            targetCourses.forEach(tc => {
                let tcRoomMatch = tc.name.match(/\[(.*?)\]/);
                let tcRoom = tcRoomMatch ? tcRoomMatch[1] : "";
                
                let times = [];
                for (let key in schedule) {
                    if (schedule[key].includes(tc.id)) {
                        let [d, g, p] = key.split('-');
                        times.push({ day: parseInt(d), period: p });
                    }
                }
                
                let dayGroups = {};
                times.forEach(t => {
                    if (!dayGroups[t.day]) dayGroups[t.day] = [];
                    if (!dayGroups[t.day].includes(t.period)) dayGroups[t.day].push(t.period);
                });
                
                for (let d in dayGroups) {
                    let pStr = dayGroups[d].sort().join(',');
                    let str = `星期${dayMap[d]}/${pStr}`;
                    if (tcRoom) str += `[${tcRoom}]`;
                    timeStrings.push(str);
                }
            });
            
            let uniqueTimeStrings = [...new Set(timeStrings)];
            let timePlaceStr = uniqueTimeStrings.join(' ');
            
            let tColor = teacherColors[teacher] || '#cccccc';
            
            data.push([exportName, teacher, totalPeriods, semText, cTypeStr, grades, timePlaceStr, tColor]);
        });

        let ws = XLSX.utils.aoa_to_sheet(data);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "課表");
        let semName = settings.currentSemester === 1 ? '上學期' : '下學期';
        XLSX.writeFile(wb, `東海電機排課_${currentYear}學年${semName}.xlsx`);
        Swal.close();
    }, 100);
}

function importData(input) {
    if(isReadOnly) return;
    let file = input.files[0]; if (!file) return;
    let ext = file.name.split('.').pop().toLowerCase();
    
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
        let r = new FileReader();
        r.onload = e => {
            const data = new Uint8Array(e.target.result);
            try {
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const headers = XLSX.utils.sheet_to_json(worksheet, {header: 1})[0];
                const jsonContent = XLSX.utils.sheet_to_json(worksheet);
                importCoursesFromExcel(jsonContent, headers);
            } catch(err) { Swal.fire('讀取失敗', '無法解析 Excel 檔案：' + err.message, 'error'); }
        };
        r.readAsArrayBuffer(file);
    } else {
        let r = new FileReader(); 
        r.onload = e => { 
            try { 
                let content = e.target.result;
                if (file.name.endsWith('.json') || content.trim().startsWith('{')) {
                    let data = JSON.parse(content);
                    if (data.settings) localStorage.setItem('settings', JSON.stringify(data.settings));
                    if (data.collapsedTeachers) localStorage.setItem('collapsedTeachers', JSON.stringify(data.collapsedTeachers));
                    if (data.lastActiveYear) localStorage.setItem('lastActiveYear', data.lastActiveYear);
                    for (let key in data) { if (key.startsWith('courses_') || key.startsWith('schedule_') || key.startsWith('teacherColors_') || key.startsWith('teacherTextColors_') || key.startsWith('teacherAvailability_') || key.startsWith('teacherEvents_')) { localStorage.setItem(key, JSON.stringify(data[key])); } }
                    Swal.fire({ title: '系統備份導入成功', text: '所有資料已恢復，頁面將重新整理。', icon: 'success', timer: 2000, showConfirmButton: false }).then(() => { location.reload(); });
                } else { importLegacyTxt(content); }
            } catch(err) { console.error(err); Swal.fire('匯入失敗', '檔案格式錯誤，請確認。', 'error'); } 
        }; r.readAsText(file);
    }
    input.value = '';
}

function handleCrawlerJsonUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        try {
            const jsonData = JSON.parse(content); 
            let updateCount = 0; let exactMap = {}; let rootMap = {}; 
            Object.values(jsonData).forEach(item => { if (item.course_name && item.classroom) { let cleanName = normalizeCourseName(item.course_name); exactMap[cleanName] = item.classroom; let rootName = getRootName(cleanName); rootMap[rootName] = item.classroom; } });
            courses.forEach(c => { let baseName = c.name.replace(/\s*\[.*?\]/g, '').trim(); let appNorm = normalizeCourseName(baseName); let appRoot = getRootName(appNorm); let newRoom = exactMap[appNorm]; if (!newRoom) newRoom = rootMap[appRoot]; if (!newRoom) newRoom = exactMap[appRoot]; if (newRoom) { c.name = baseName + ` [${newRoom}]`; updateCount++; } });
            if (updateCount > 0) { save(); render(); Swal.fire('JSON 更新成功', `已從檔案更新 ${updateCount} 筆教室資料！`, 'success'); } else { Swal.fire('無相符資料', '無法將 JSON 中的課程名稱對應到現有課表。', 'warning'); }
        } catch (err) { 
            console.log("Not valid JSON, trying HTML parse...");
            parseTHUPublicPage(content);
        }
    }; 
    reader.readAsText(file); event.target.value = '';
}

function parseTHUPublicPage(htmlContent) {
    let parser = new DOMParser(); let doc = parser.parseFromString(htmlContent, 'text/html'); let updatedCount = 0; let rows = doc.querySelectorAll('tr'); 
    if (rows.length === 0) { Swal.fire('解析失敗', '無法在檔案中找到課程表格，請確認您下載的是正確的「系所課程」網頁。', 'error'); return; }
    let webExactMap = {}; let webRootMap = {};
    rows.forEach(row => {
        let cols = row.querySelectorAll('td');
        if (cols.length >= 6) {
            let nameRaw = cols[1].innerText.trim(); let teacherRaw = cols[4].innerText.trim(); let timePlaceRaw = cols[5].innerText.trim();
            if (nameRaw === "課程名稱") return;
            let roomMatch = timePlaceRaw.match(/([A-Z]{1,5}\s?\-?\d{3})/);
            if (roomMatch) { let room = roomMatch[1]; let cleanName = normalizeCourseName(nameRaw); let cleanTeacher = teacherRaw.replace(/\s+/g, ''); let exactKey = `${cleanTeacher}_${cleanName}`; let rootKey = `${cleanTeacher}_${getRootName(cleanName)}`; webExactMap[exactKey] = room; webRootMap[rootKey] = room; }
        }
    });
    courses.forEach(c => {
        let baseName = c.name.replace(/\s*\[.*?\]/g, '').trim(); let localNameClean = normalizeCourseName(baseName); let localRootName = getRootName(localNameClean); let localTeacherClean = c.teacher.replace(/\s+/g, '');
        let exactKey = `${localTeacherClean}_${localNameClean}`; let rootKey = `${localTeacherClean}_${localRootName}`; let newRoom = webExactMap[exactKey]; if (!newRoom) newRoom = webRootMap[rootKey]; if (!newRoom) { let reverseKey = `${localTeacherClean}_${localRootName}`; newRoom = webExactMap[reverseKey]; }
        if (newRoom) { c.name = baseName + ` [${newRoom}]`; updatedCount++; }
    });
    if (updatedCount > 0) { save(); render(); Swal.fire('更新成功', `已成功更新/填入 ${updatedCount} 門課程的教室資訊！`, 'success'); } else { Swal.fire('未發現新資訊', '無法在檔案中匹配到任何新的教室資訊。', 'warning'); }
}

function openCopyModal() {
    if (isReadOnly) return;
    let yearOptions = ''; for(let y=114; y<=120; y++) { if(y !== currentYear) { yearOptions += `<option value="${y}">${y} 學年度</option>`; } } if (yearOptions === '') yearOptions = '<option disabled>無其他學年可選</option>';
    Swal.fire({ title: '複製他學期資料', html: `<div class="field"><label class="label">來源學年</label><div class="control"><div class="select is-fullwidth"><select id="copyFromYear">${yearOptions}</select></div></div></div><div class="field"><label class="label">來源學期</label><div class="control"><div class="select is-fullwidth"><select id="copyFromSem"><option value="1">上學期 (第1學期)</option><option value="2">下學期 (第2學期)</option><option value="3">整學年 (全)</option></select></div></div></div><p class="help is-info">注意：複製過來的課程將加入左側列表，不會覆蓋現有排程。</p>`, showCancelButton: true, confirmButtonText: '開始複製', preConfirm: () => { const srcYear = document.getElementById('copyFromYear').value; const srcSem = document.getElementById('copyFromSem').value; return { srcYear, srcSem }; } }).then((result) => { if (result.isConfirmed) { performCopy(result.value.srcYear, result.value.srcSem); } });
}

function performCopy(srcYear, srcSem) {
    let srcCourses = JSON.parse(localStorage.getItem(`courses_${srcYear}`)) || [];
    if (srcCourses.length === 0) { Swal.fire('查無資料', `${srcYear} 學年度沒有資料可複製。`, 'warning'); return; }
    let count = 0; let targetSem = parseInt(settings.currentSemester); srcSem = parseInt(srcSem);
    srcCourses.forEach(c => {
        let cSem = c.semester || 3; let shouldCopy = false;
        if (srcSem === 3) { if (cSem === 3) shouldCopy = true; } else { if (cSem === srcSem || cSem === 3) shouldCopy = true; }
        if (shouldCopy) {
            let newCourse = JSON.parse(JSON.stringify(c)); newCourse.id = Date.now() + Math.random().toString();
            if (newCourse.parentId) newCourse.parentId = null; newCourse.isSplit = false; 
            if (cSem !== 3) newCourse.semester = targetSem; if (newCourse.isDeptReq) newCourse.id = `copied_${srcYear}_${Date.now()}_${Math.random()}`;
            courses.push(newCourse);
            if (!teacherColors[newCourse.teacher]) { let srcColors = JSON.parse(localStorage.getItem(`teacherColors_${srcYear}`)) || {}; if (srcColors[newCourse.teacher]) teacherColors[newCourse.teacher] = srcColors[newCourse.teacher]; else teacherColors[newCourse.teacher] = SOFT_COLORS[Object.keys(teacherColors).length % SOFT_COLORS.length]; }
            count++;
        }
    });
    save(); render(); Swal.fire('複製完成', `已成功從 ${srcYear} 學年度複製 ${count} 門課程至列表。`, 'success');
}

function openTeacherExportModal() {
    let teachers = new Set(); 
    courses.forEach(c => {
        c.teacher.split(',').map(t => t.trim()).filter(t => t).forEach(t => teachers.add(t));
    });
    let sortedTeachers = Array.from(teachers).sort(); 
    let options = sortedTeachers.map(t => `<option value="${t}">${t}</option>`).join('');
    Swal.fire({ title: '下載教師個人課表', html: `<div class="field"><label class="label">請選擇教師</label><div class="control"><div class="select is-fullwidth"><select id="exportTeacherSelect">${options}</select></div></div></div>`, showCancelButton: true, confirmButtonText: '下載 PDF', preConfirm: () => document.getElementById('exportTeacherSelect').value }).then((result) => { if (result.isConfirmed) exportTeacherSchedule(result.value); });
}

async function exportTeacherSchedule(teacherName) {
    const sem = settings.currentSemester; const semText = sem == 1 ? "1" : (sem == 2 ? "2" : "全");
    document.getElementById('pdfYear').textContent = currentYear; 
    document.getElementById('pdfSem').textContent = semText; 
    document.getElementById('pdfTeacherName').textContent = teacherName;
    
    let container = document.getElementById('teacherExportContainer');
    container.style.fontFamily = '"Microsoft JhengHei", "微軟正黑體", sans-serif';
    
    let metaDiv = container.querySelector('.pdf-meta');
    if(metaDiv) {
        metaDiv.style.fontWeight = 'bold';
        metaDiv.style.color = '#000';
    }
    
    let tableEl = container.querySelector('.pdf-table');
    if(tableEl) {
        tableEl.style.borderCollapse = 'collapse';
        tableEl.style.border = '2px solid #000'; 
        
        if (!tableEl.parentElement.classList.contains('pdf-table-wrapper')) {
            let wrapper = document.createElement('div');
            wrapper.className = 'pdf-table-wrapper';
            wrapper.style.border = '2px solid #000'; 
            wrapper.style.padding = '2px'; 
            wrapper.style.backgroundColor = '#fff';
            tableEl.parentNode.insertBefore(wrapper, tableEl);
            wrapper.appendChild(tableEl);
        }
    }

    let daysToInclude = [1, 2, 3, 4, 5]; let hasSat = false, hasSun = false;
    let tCourses = courses.filter(c => c.teacher.split(',').map(t=>t.trim()).includes(teacherName)); let tCourseIds = tCourses.map(c => c.id);
    for (let key in schedule) { let [d, g, p] = key.split('-'); if (schedule[key].some(id => tCourseIds.includes(id))) { if (d == '6') hasSat = true; if (d == '7') hasSun = true; } }
    let tEvents = teacherEvents[teacherName] || []; tEvents.forEach(e => { if(e.day == 6) hasSat = true; if(e.day == 7) hasSun = true; });
    if (hasSat) daysToInclude.push(6); if (hasSun) daysToInclude.push(7);
    const dayMap = {1:'星期一', 2:'星期二', 3:'星期三', 4:'星期四', 5:'星期五', 6:'星期六', 7:'星期日'};
    const thead = document.getElementById('pdfTableHead');
    
    let headerRow = `<tr><th colspan="2" width="20%" style="background-color: #e8f4f8; border: 1px solid #bbb; border-right: 2px solid #000; border-bottom: 2px solid #000;"><div class="pdf-cell-wrapper" style="font-weight:bold; font-size:18px; color:#000;">節次</div></th>`; 
    daysToInclude.forEach(d => { headerRow += `<th style="background-color: #e8f4f8; border: 1px solid #bbb; border-bottom: 2px solid #000;"><div class="pdf-cell-wrapper" style="font-weight:bold; font-size:18px; color:#000;">${dayMap[d]}</div></th>`; }); 
    headerRow += `</tr>`; 
    thead.innerHTML = headerRow;
    
    const tbody = document.getElementById('pdfTableBody'); tbody.innerHTML = '';
    
    PERIODS.forEach(p => {
        let tr = document.createElement('tr');
        
        let isNoonSeparator = (p.id === '4' || p.id === 'N');
        let trBorderBottom = isNoonSeparator ? 'border-bottom: 4px double #000;' : 'border-bottom: 1px solid #bbb;';
        
        let isNoonBreak = (p.id === 'N');
        let bgStyle = isNoonBreak ? 'background-color: #f0f0f0;' : '';
        
        let tdName = document.createElement('td'); 
        tdName.style.cssText = `border: 1px solid #bbb; ${trBorderBottom} ${bgStyle}`;
        tdName.innerHTML = `<div class="pdf-cell-wrapper pdf-period-cell" style="font-weight:bold; color:#000; font-size:15px;">${p.display || `第${p.id}節`}</div>`; 
        tr.appendChild(tdName);
        
        let tdTime = document.createElement('td'); 
        tdTime.style.cssText = `border: 1px solid #bbb; border-right: 2px solid #000; ${trBorderBottom} ${bgStyle}`;
        tdTime.innerHTML = `<div class="pdf-cell-wrapper pdf-time-cell" style="color:#000; font-weight:bold;">${p.t.replace('-', '<br>')}</div>`; 
        tr.appendChild(tdTime);

        daysToInclude.forEach(day => {
            let td = document.createElement('td'); 
            td.style.cssText = `border: 1px solid #bbb; ${trBorderBottom} ${bgStyle}`;
            let cellHtml = '';
            let cellCourses = [];
            for (let g=1; g<=4; g++) {
                let key = `${day}-${g}-${p.id}`;
                if (schedule[key]) { schedule[key].forEach(cId => { if (tCourseIds.includes(cId)) { let c = courses.find(x => x.id === cId); if (c) { if (!cellCourses.some(existing => existing.id === cId)) { let cSem = c.semester || 3; if (cSem == 3 || cSem == sem) cellCourses.push(c); } } } }); }
            }
            
            let finalCellCourses = [];
            let hasSeminar = false;
            cellCourses.forEach(c => {
                let rawName = c.name;
                if (rawName.includes('專討') || rawName.includes('專題')) {
                    if (!hasSeminar) { finalCellCourses.push(c); hasSeminar = true; }
                } else { finalCellCourses.push(c); }
            });

            if (finalCellCourses.length > 0) {
                cellHtml += finalCellCourses.map(c => { 
                    let rawName = c.name; let room = ""; let rMatch = rawName.match(/\[(.*?)\]/);
                    if(rMatch) { room = rMatch[1]; rawName = rawName.replace(/\[.*?\]/g, '').trim(); }
                    let name = rawName;
                    if (name.includes('專討') || name.includes('專題')) { name = name.replace(/\(\d+\)$/, '').replace(/\([一二三四]\)$/, ''); } 
                    else { name = name.replace(/\(\d+\)$/, ''); }
                    name = name.replace(/ ?\(必\)/g, '').replace(/ ?\(選\)/g, '').replace(/ ?\(校\)/g, '').trim();
                    
                    let display = `<div style="font-weight:bold; font-size:16px; color:#000;">${name}</div>`;
                    if(room) display += `<div style="font-size:14px; color:#000; margin-top:4px; font-weight:bold;">${room}</div>`;
                    return `<div class="pdf-cell-wrapper" style="padding: 4px 0;">${display}</div>`; 
                }).join('');
            }
            let cellEvents = tEvents.filter(e => e.day == day && e.period == p.id);
            if (cellEvents.length > 0) { cellEvents.forEach(e => { cellHtml += `<div class="pdf-cell-wrapper pdf-event-item" style="border: 1px dashed #000; background: transparent;"><div class="pdf-event-name" style="color:#000; font-weight:bold;">${e.type}</div><div class="pdf-event-loc" style="color:#000; font-weight:bold;">${e.location}</div></div>`; }); }
            td.innerHTML = cellHtml; tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    Swal.fire({ title: '產生中...', text: '正在製作 PDF，請稍候', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    const captureElement = document.getElementById('teacherExportContainer');
    
    setTimeout(async () => {
        try {
            const canvas = await html2canvas(captureElement, { scale: 2, useCORS: true });
            const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4'); 
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
            doc.save(`${teacherName}_${currentYear}_${semText}學期_課表.pdf`); Swal.close();
        } catch (err) { console.error(err); Swal.fire('錯誤', 'PDF 產生失敗', 'error'); }
    }, 500);
}

function exportImage(type) {
    const element = document.getElementById('captureTarget');
    const sidebar = document.getElementById('sidebar');
    const appContainer = document.getElementById('appContainer');
    const mainContent = document.querySelector('.main-content');
    const header = document.getElementById('screenshotHeader');
    let semText = settings.currentSemester == 1 ? "上學期" : "下學期";
    header.innerHTML = `東海電機 ${currentYear}學年 ${semText} 課表`; header.style.display = 'block';

    const EXPORT_H = 810; // 固定匯出高度，與桌機版比例一致

    const originalSidebarDisplay = sidebar.style.display;
    const originalContainerWidth = appContainer.style.width;
    const originalContainerMaxWidth = appContainer.style.maxWidth;
    const originalContainerHeight = appContainer.style.height;
    const originalElementWidth = element.style.width;
    const originalElementHeight = element.style.height;
    const originalElementOverflow = element.style.overflow;
    const originalMainWidth = mainContent ? mainContent.style.width : '';
    const originalMainMax = mainContent ? mainContent.style.maxWidth : '';
    const originalMainHeight = mainContent ? mainContent.style.height : '';

    document.body.classList.add('is-exporting');
    sidebar.style.display = 'none';
    appContainer.style.width = '2000px'; appContainer.style.maxWidth = 'none'; appContainer.style.height = EXPORT_H + 'px';
    if (mainContent) { mainContent.style.width = '2000px'; mainContent.style.maxWidth = 'none'; mainContent.style.height = EXPORT_H + 'px'; }
    element.style.width = '2000px'; element.style.height = EXPORT_H + 'px'; element.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#e0e0e0';

    if(typeof render === 'function') render();

    Swal.fire({ title: '處理中...', text: '正在產生高解析度圖片，請稍候', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    setTimeout(() => {
        html2canvas(element, { scale: 2, useCORS: true, width: 2000, height: EXPORT_H, windowWidth: 2000 }).then(canvas => {
            document.body.classList.remove('is-exporting');
            sidebar.style.display = originalSidebarDisplay;
            appContainer.style.width = originalContainerWidth; appContainer.style.maxWidth = originalContainerMaxWidth; appContainer.style.height = originalContainerHeight;
            if (mainContent) { mainContent.style.width = originalMainWidth; mainContent.style.maxWidth = originalMainMax; mainContent.style.height = originalMainHeight; }
            element.style.width = originalElementWidth; element.style.height = originalElementHeight; element.style.overflow = originalElementOverflow;
            document.body.style.backgroundColor = ''; header.style.display = 'none';
            if(typeof render === 'function') render();

            let filename = `東海電機_${currentYear}學年_${semText}_課表_${new Date().toISOString().slice(0,10)}`;
            if (type === 'png') {
                const link = document.createElement('a'); link.download = `${filename}.png`;
                link.href = canvas.toDataURL("image/png"); link.click(); Swal.close();
            } else if (type === 'pdf') {
                const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'mm', 'a4'); 
                const imgData = canvas.toDataURL('image/png'); const imgProps = doc.getImageProperties(imgData);
                const pdfWidth = doc.internal.pageSize.getWidth(); const pdfHeight = doc.internal.pageSize.getHeight();
                const margin = 6; const usableWidth = pdfWidth - (margin * 2); const usableHeight = pdfHeight - (margin * 2);
                const ratio = usableWidth / imgProps.width; 
                let imgHeight = imgProps.height * ratio;
                
                imgHeight = imgHeight * 1.2;
                let finalWidth = usableWidth;
                
                if (imgHeight > usableHeight) { 
                    imgHeight = usableHeight; 
                }

                let x = margin + (usableWidth - finalWidth) / 2; let y = margin + (usableHeight - imgHeight) / 2;
                doc.addImage(imgData, 'PNG', x, y, finalWidth, imgHeight); doc.save(`${filename}.pdf`); Swal.close();
            }
        }).catch(err => {
            document.body.classList.remove('is-exporting');
            appContainer.style.height = originalContainerHeight;
            if (mainContent) { mainContent.style.width = originalMainWidth; mainContent.style.maxWidth = originalMainMax; mainContent.style.height = originalMainHeight; }
            element.style.height = originalElementHeight;
            console.error(err); Swal.fire('錯誤', '圖片產生失敗', 'error');
        });
    }, 100);
}

function exportAllData(autoDownload = false) {
    let exportObj = {}; exportObj['settings'] = JSON.parse(localStorage.getItem('settings')); exportObj['collapsedTeachers'] = JSON.parse(localStorage.getItem('collapsedTeachers'));
    exportObj['lastActiveYear'] = localStorage.getItem('lastActiveYear');
    for (let i = 0; i < localStorage.length; i++) { let key = localStorage.key(i); if (key.startsWith('courses_') || key.startsWith('schedule_') || key.startsWith('teacherColors_') || key.startsWith('teacherTextColors_') || key.startsWith('teacherAvailability_') || key.startsWith('teacherEvents_')) { exportObj[key] = JSON.parse(localStorage.getItem(key)); } }
    let jsonString = JSON.stringify(exportObj, null, 2); let blob = new Blob([jsonString], {type: "application/json"}); let url = URL.createObjectURL(blob); let a = document.createElement('a'); a.href = url; a.download = `東海電機排課_全學年備份_${new Date().toISOString().slice(0,10)}.json`; a.click();
    if (!autoDownload) { Swal.fire('導出成功', '已下載包含所有學年資料的 JSON 備份檔。', 'success'); }
}

function importLegacyTxt(text) {
    text = text.trim(); if (text.startsWith("{")) text = text.substring(1); if (text.endsWith("}")) text = text.substring(0, text.length - 1);
    let lines = text.split('\n'); let newCourses = []; let newSchedule = {}; let newTeacherColors = {}; let newTeacherTextColors = {}; let newTeacherAvailability = {};
    let mode = "COURSES"; const dayMapRev = { '星期一':'1', '星期二':'2', '星期三':'3', '星期四':'4', '星期五':'5', '星期六':'6', '星期日':'7' };
    lines.forEach(line => {
        line = line.trim(); if (!line) return;
        if (line === "[COLORS]") { mode = "COLORS"; return; } if (line === "[TEACHER_META]") { mode = "TEACHER_META"; return; }
        if (mode === "COLORS") { let parts = line.split('|').map(s => s.trim()); if(parts.length >= 2) newTeacherColors[parts[0]] = parts[1]; } 
        else if (mode === "TEACHER_META") {
            let parts = line.split('|').map(s => s.trim());
            if(parts.length >= 2) { let t = parts[0]; newTeacherColors[t] = parts[1]; if(parts.length >= 3 && parts[2] !== "") { newTeacherAvailability[t] = parts[2].split(';'); } if(parts.length >= 4) { newTeacherTextColors[t] = parts[3]; } else { newTeacherTextColors[t] = 'black'; } }
        } else if (mode === "COURSES") {
            let parts = line.split('|').map(s => s.trim()); if (parts.length < 2) return; 
            let name = parts[0]; let teacher = parts[1]; let timeRaw = parts[2]; let gradesRaw = (parts.length >= 4) ? parts[3] : ""; let allowedGrades = []; if (gradesRaw && gradesRaw !== "") { allowedGrades = gradesRaw.split(';').map(g => parseInt(g)); }
            let cType = (parts.length >= 5) ? parts[4] : "none"; let isInd = (parts.length >= 6) ? (parts[5] === "1") : false; let cSem = (parts.length >= 7) ? parseInt(parts[6]) : 3; if(isNaN(cSem)) cSem = 3;
            if (teacher === "校必修") {
                let timeSegments = timeRaw.split(';').map(s => s.trim()).filter(s => s !== ""); let totalPeriods = 0;
                timeSegments.forEach(seg => { let match = seg.match(/^(\d+)\s+([^/]+)\/(.+)$/); if (match) { let pList = match[3].split(',').map(p => p.trim()); totalPeriods += pList.length; } });
                let cId = Date.now() + Math.random().toString(); newCourses.push({ id: cId, name, teacher, periods: totalPeriods, isSplit: false, allowedGrades, courseType: cType, isIndependent: true, isDeptReq: true, isLocked: true, semester: 3 });
                timeSegments.forEach(seg => { let match = seg.match(/^(\d+)\s+([^/]+)\/(.+)$/); if (match) { let grade = match[1]; let dayStr = match[2]; let periodsStr = match[3]; let day = dayMapRev[dayStr]; let pList = periodsStr.split(',').map(p => p.trim()); if (day && grade) { pList.forEach(p => { if(p === '4.5') p = 'N'; let key = `${day}-${grade}-${p}`; if(!newSchedule[key]) newSchedule[key] = []; newSchedule[key].push(cId); }); } } }); return; 
            }
            if (!timeRaw || timeRaw.trim() === "") { newCourses.push({ id: Date.now() + Math.random().toString(), name, teacher, periods: 3, isSplit: false, allowedGrades, courseType: cType, isIndependent: isInd, semester: cSem }); return; }
            let timeSegments = timeRaw.split(';').map(s => s.trim()).filter(s => s !== "");
            if (timeSegments.length > 1) {
                let parentId = Date.now() + Math.random().toString();
                timeSegments.forEach((seg, idx) => { let match = seg.match(/^(\d+)\s+([^/]+)\/(.+)$/); if (match) { let grade = match[1]; let dayStr = match[2]; let periodsStr = match[3]; let day = dayMapRev[dayStr]; let pList = periodsStr.split(',').map(p => p.trim()); let cId = parentId + "_" + idx; newCourses.push({ id: cId, parentId: parentId, name: name + `(${idx+1})`, teacher, periods: pList.length, isSplit: true, allowedGrades, courseType: cType, isIndependent: isInd, semester: cSem }); if (day && grade) { pList.forEach(p => { if(p === '4.5') p = 'N'; let key = `${day}-${grade}-${p}`; if(!newSchedule[key]) newSchedule[key] = []; newSchedule[key].push(cId); }); } } });
            } else {
                let seg = timeSegments[0]; let cId = Date.now() + Math.random().toString(); let match = seg.match(/^(\d+)\s+([^/]+)\/(.+)$/);
                if (match) { let grade = match[1]; let dayStr = match[2]; let periodsStr = match[3]; let day = dayMapRev[dayStr]; let pList = periodsStr.split(',').map(p => p.trim()); if (day && grade) { pList.forEach(p => { if(p === '4.5') p = 'N'; let key = `${day}-${grade}-${p}`; if(!newSchedule[key]) newSchedule[key] = []; newSchedule[key].push(cId); }); } newCourses.push({ id: cId, name, teacher, periods: pList.length, isSplit: false, allowedGrades, courseType: cType, isIndependent: isInd, semester: cSem }); }
            }
        }
    });
    newCourses.forEach(c => { let isDeptReq = (c.teacher === "校必修"); if(isDeptReq) { c.isDeptReq = true; c.isLocked = true; } if(c.teacher !== "校必修" && !newTeacherColors[c.teacher]) { newTeacherColors[c.teacher] = SOFT_COLORS[Object.keys(newTeacherColors).length % SOFT_COLORS.length]; } });
    courses = newCourses; schedule = newSchedule; teacherColors = newTeacherColors; teacherTextColors = newTeacherTextColors; teacherAvailability = newTeacherAvailability;
    save(); location.reload(); 
}

window.addEventListener('DOMContentLoaded', () => {
    const yearSelectEl = document.getElementById('yearSelect');
    if (yearSelectEl && typeof currentYear !== 'undefined') {
        for(let y=114; y<=120; y++) { 
            let opt = document.createElement('option'); 
            opt.value = y; opt.innerText = `${y} 學年度`; 
            if(y === currentYear) opt.selected = true; 
            yearSelectEl.appendChild(opt); 
        }
    }
});