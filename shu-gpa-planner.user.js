// ==UserScript==
// @name         上大绩点规划助手
// @namespace    shu-gpa-planner
// @version      1.2.0
// @description  读取上海大学教务系统当前绩点与下学期课表，根据目标绩点和课程难度浮动计算每门课建议绩点（11级离散值）
// @author       GPA Planner
// @match        https://jwxt.shu.edu.cn/jwglxt/*
// @match        https://byxk.shu.edu.cn/jwglxt/*
// @require      https://scriptcat.org/lib/637/1.4.8/ajaxHooker.js
// @require      https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      jwxt.shu.edu.cn
// @connect      byxk.shu.edu.cn
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  /* ============================================================
   * 1. 上海大学11级绩点（离散值，非连续）
   * ============================================================ */
  const VALID_GPAS = [0, 1.0, 1.5, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0];

  const GPA_RANGES = [
    { min: 90, max: 100.1, gpa: 4.0, label: 'A' },
    { min: 85, max: 90,    gpa: 3.7, label: 'A-' },
    { min: 82, max: 85,    gpa: 3.3, label: 'B+' },
    { min: 78, max: 82,    gpa: 3.0, label: 'B' },
    { min: 75, max: 78,    gpa: 2.7, label: 'B-' },
    { min: 72, max: 75,    gpa: 2.3, label: 'C+' },
    { min: 68, max: 72,    gpa: 2.0, label: 'C' },
    { min: 66, max: 68,    gpa: 1.7, label: 'C-' },
    { min: 64, max: 66,    gpa: 1.5, label: 'D' },
    { min: 60, max: 64,    gpa: 1.0, label: 'D-' },
    { min: 0,  max: 60,    gpa: 0,   label: 'F' },
  ];

  function scoreToGPA(score) {
    const s = Number(score);
    if (isNaN(s)) return null;
    for (const r of GPA_RANGES) {
      if (s >= r.min && s < r.max) return r.gpa;
    }
    return 0;
  }

  function roundToGPA(val) {
    if (val <= 0) return 0;
    if (val >= 4.0) return 4.0;
    let best = VALID_GPAS[0], minDiff = Math.abs(val - best);
    for (const g of VALID_GPAS) {
      const d = Math.abs(val - g);
      if (d < minDiff) { minDiff = d; best = g; }
    }
    return best;
  }

  function gpaToScoreRange(gpa) {
    const r = GPA_RANGES.find(x => x.gpa === gpa);
    if (!r) {
      if (gpa >= 4.0) return '90-100';
      if (gpa >= 3.7) return '85-89';
      if (gpa >= 3.3) return '82-84';
      if (gpa >= 3.0) return '78-81';
      if (gpa >= 2.7) return '75-77';
      if (gpa >= 2.3) return '72-74';
      if (gpa >= 2.0) return '68-71';
      if (gpa >= 1.7) return '66-67';
      if (gpa >= 1.5) return '64-65';
      if (gpa >= 1.0) return '60-63';
      return '<60';
    }
    if (r.gpa === 4.0) return '90-100';
    if (r.gpa === 0) return '<60';
    return `${r.min}-${r.max - 0.1}`;
  }

  /* ============================================================
   * 2. 课程难度数据库（1 很简单 ~ 5 很难）
   * ============================================================ */
  const DIFFICULTY_DB = [
    { kw: '高等数学', diff: 5 }, { kw: '数学分析', diff: 5 },
    { kw: '模拟电子', diff: 5 }, { kw: '模电', diff: 5 },
    { kw: '通信原理', diff: 5 }, { kw: '随机过程', diff: 5 },
    { kw: '量子力学', diff: 5 }, { kw: '物理光学', diff: 5 },
    { kw: '电磁场', diff: 5 }, { kw: '电磁波', diff: 5 },
    { kw: '编译原理', diff: 5 }, { kw: '微积分', diff: 5 },

    { kw: '线性代数', diff: 4 }, { kw: '概率论', diff: 4 },
    { kw: '数理统计', diff: 4 }, { kw: '复变函数', diff: 4 },
    { kw: '积分变换', diff: 4 }, { kw: '大学物理', diff: 4 },
    { kw: '数字电子', diff: 4 }, { kw: '数电', diff: 4 },
    { kw: '数字逻辑', diff: 4 }, { kw: '信号与系统', diff: 4 },
    { kw: '数据结构', diff: 4 }, { kw: '操作系统', diff: 4 },
    { kw: '计算机网络', diff: 4 }, { kw: '微波', diff: 4 },
    { kw: '数字信号处理', diff: 4 }, { kw: '信息论', diff: 4 },
    { kw: '自动控制原理', diff: 4 }, { kw: '理论力学', diff: 4 },
    { kw: '材料力学', diff: 4 }, { kw: '结构力学', diff: 4 },
    { kw: '有机化学', diff: 4 }, { kw: '物理化学', diff: 4 },
    { kw: '算法设计', diff: 4 }, { kw: '计算机组成', diff: 4 },
    { kw: '大学化学', diff: 4 },

    { kw: '电路分析', diff: 3 }, { kw: '电路基础', diff: 3 },
    { kw: '电路', diff: 3 }, { kw: 'C语言', diff: 3 },
    { kw: 'C++', diff: 3 }, { kw: '单片机', diff: 3 },
    { kw: '嵌入式', diff: 3 }, { kw: '光纤通信', diff: 3 },
    { kw: '工程制图', diff: 3 }, { kw: '机械设计', diff: 3 },
    { kw: '电子工艺', diff: 3 }, { kw: '课程设计', diff: 3 },
    { kw: '数据库', diff: 3 }, { kw: '软件工程', diff: 3 },
    { kw: '面向对象', diff: 3 }, { kw: '无线通信', diff: 3 },
    { kw: '移动通信', diff: 3 }, { kw: '交换技术', diff: 3 },
    { kw: '网络安全', diff: 3 }, { kw: '机器学习', diff: 3 },
    { kw: '人工智能', diff: 3 }, { kw: '深度学习', diff: 3 },
    { kw: '金工实习', diff: 3 }, { kw: '电子实习', diff: 3 },
    { kw: '生产实习', diff: 3 }, { kw: '认识实习', diff: 3 },
    { kw: '商务英语', diff: 3 }, { kw: '学术英语', diff: 3 },
    { kw: '英语写作', diff: 3 },

    { kw: '大学英语', diff: 2 }, { kw: '通用学术英语', diff: 2 },
    { kw: 'Python', diff: 2 }, { kw: 'python', diff: 2 },
    { kw: 'Java', diff: 2 }, { kw: 'java', diff: 2 },
    { kw: '马克思', diff: 2 }, { kw: '毛泽东', diff: 2 },
    { kw: '习近', diff: 2 }, { kw: '中国近现代史', diff: 2 },
    { kw: '近现代史', diff: 2 }, { kw: '思想道德', diff: 2 },
    { kw: '思修', diff: 2 }, { kw: '法治', diff: 2 },
    { kw: '军事理论', diff: 2 }, { kw: '军事', diff: 2 },
    { kw: '形势与政策', diff: 2 }, { kw: '形势', diff: 2 },
    { kw: '程序设计', diff: 2 }, { kw: '网页设计', diff: 2 },
    { kw: '多媒体', diff: 2 }, { kw: '摄影', diff: 2 },
    { kw: '影视', diff: 2 }, { kw: '音乐', diff: 2 },
    { kw: '美术', diff: 2 }, { kw: '书法', diff: 2 },
    { kw: '诗词', diff: 2 }, { kw: '文学', diff: 2 },
    { kw: '历史', diff: 2 }, { kw: '哲学', diff: 2 },
    { kw: '社会学', diff: 2 }, { kw: '心理学', diff: 2 },
    { kw: '经济学', diff: 2 }, { kw: '管理学', diff: 2 },
    { kw: '市场营销', diff: 2 }, { kw: '会计学', diff: 2 },
    { kw: '统计学', diff: 2 }, { kw: '创新创业', diff: 2 },
    { kw: '创业', diff: 2 }, { kw: '高尔夫', diff: 2 },
    { kw: '网球', diff: 2 }, { kw: '乒乓球', diff: 2 },

    { kw: '体育', diff: 1 }, { kw: '心理健康', diff: 1 },
    { kw: '职业生涯', diff: 1 }, { kw: '就业指导', diff: 1 },
    { kw: '劳动教育', diff: 1 }, { kw: '劳动', diff: 1 },
    { kw: '安全教育', diff: 1 }, { kw: '环保', diff: 1 },
    { kw: '生态文明', diff: 1 }, { kw: '通识', diff: 1 },
    { kw: '选修', diff: 1 }, { kw: '鉴赏', diff: 1 },
    { kw: '导论', diff: 1 }, { kw: '概论', diff: 1 },
    { kw: '基础', diff: 1 }, { kw: '认识实习', diff: 1 },
  ];

  function getDifficulty(courseName) {
    const overrides = getOverrides();
    if (overrides[courseName] != null) return overrides[courseName];
    for (const item of DIFFICULTY_DB) {
      if (courseName.includes(item.kw)) return item.diff;
    }
    return 3;
  }

  function getDifficultyLabel(d) {
    return ['', '很简单', '较简单', '中等', '较难', '很难'][d] || '中等';
  }

  function getDifficultyColor(d) {
    return ['', '#52c41a', '#73d13d', '#faad14', '#fa8c16', '#f5222d'][d] || '#faad14';
  }

  /* ============================================================
   * 3. 持久化存储
   * ============================================================ */
  const STORE = {
    gpa:      'shu_gpa_current_gpa',
    credits:  'shu_gpa_current_credits',
    courses:  'shu_gpa_selected_courses',
    target:   'shu_gpa_target_gpa',
    factor:   'shu_gpa_float_factor',
    overrides:'shu_gpa_difficulty_overrides',
    updated:  'shu_gpa_last_updated',
  };

  const state = {
    currentGPA: null,
    currentCredits: null,
    selectedCourses: [],
    targetGPA: 3.5,
    floatFactor: 0.15,
    scoresLoaded: false,
    coursesLoaded: false,
  };

  function loadState() {
    try {
      const gpa = localStorage.getItem(STORE.gpa);
      const credits = localStorage.getItem(STORE.credits);
      const courses = localStorage.getItem(STORE.courses);
      const target = localStorage.getItem(STORE.target);
      const factor = localStorage.getItem(STORE.factor);
      if (gpa !== null) state.currentGPA = parseFloat(gpa);
      if (credits !== null) state.currentCredits = parseFloat(credits);
      if (courses) state.selectedCourses = JSON.parse(courses);
      if (target !== null) state.targetGPA = parseFloat(target);
      if (factor !== null) state.floatFactor = parseFloat(factor);
      if (state.currentGPA != null) state.scoresLoaded = true;
      if (state.selectedCourses.length > 0) state.coursesLoaded = true;
    } catch (e) { console.warn('[GPA Planner] 加载本地数据失败', e); }
  }

  function saveScores(gpa, credits) {
    state.currentGPA = gpa;
    state.currentCredits = credits;
    state.scoresLoaded = true;
    localStorage.setItem(STORE.gpa, String(gpa));
    localStorage.setItem(STORE.credits, String(credits));
    localStorage.setItem(STORE.updated, String(Date.now()));
  }

  function saveCourses(courses) {
    state.selectedCourses = courses;
    state.coursesLoaded = courses.length > 0;
    localStorage.setItem(STORE.courses, JSON.stringify(courses));
    localStorage.setItem(STORE.updated, String(Date.now()));
  }

  function saveTarget(gpa) {
    state.targetGPA = gpa;
    localStorage.setItem(STORE.target, String(gpa));
  }

  function saveFactor(f) {
    state.floatFactor = f;
    localStorage.setItem(STORE.factor, String(f));
  }

  function getOverrides() {
    try { return JSON.parse(localStorage.getItem(STORE.overrides) || '{}'); }
    catch { return {}; }
  }

  function setOverride(courseName, diff) {
    const o = getOverrides();
    o[courseName] = diff;
    localStorage.setItem(STORE.overrides, JSON.stringify(o));
  }

  function clearOverride(courseName) {
    const o = getOverrides();
    delete o[courseName];
    localStorage.setItem(STORE.overrides, JSON.stringify(o));
  }

  /* ============================================================
   * 4. 获取成绩 —— 策略A：成绩接口
   * ============================================================ */
  async function fetchScores() {
    const urls = [
      `${location.origin}/jwglxt/cjcx/cjcx_cxDgXscj.html?gnmkdm=N305005`,
      `${location.origin}/jwglxt/cjcx/cjcx_cxXsgrcj.html?gnmkdm=N305005`,
    ];
    const body = new URLSearchParams({
      xnm: '', xqm: '', _search: 'false', nd: String(Date.now()),
      'queryModel.showCount': '500', 'queryModel.currentPage': '1',
      'queryModel.sortName': '', 'queryModel.sortOrder': 'asc', time: '1',
    });
    for (const url of urls) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: body.toString(), credentials: 'include',
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const items = data.items || data.result || [];
        if (items.length > 0) { parseScoreItems(items); return true; }
      } catch (e) { console.warn('[GPA Planner] 成绩接口失败:', e); }
    }
    return false;
  }

  function parseScoreItems(items) {
    let totalPoints = 0, totalCredits = 0;
    for (const item of items) {
      const xf = parseFloat(item.xf || item.credit || 0);
      const cj = item.cj != null ? item.cj : item.score;
      const jd = parseFloat(item.jd || item.gpa);
      if (item.cjsfzf === '1' || item.cjsfzf === 1) continue;
      if (!xf || xf <= 0) continue;
      let gpa = null;
      if (!isNaN(jd) && jd >= 0) gpa = jd;
      else if (typeof cj === 'number' || (typeof cj === 'string' && !isNaN(parseFloat(cj)))) gpa = scoreToGPA(cj);
      else if (typeof cj === 'string') {
        const m = { '优秀':4.0,'良好':3.3,'中等':2.3,'及格':1.0,'不及格':0,
          'A':4.0,'A-':3.7,'B+':3.3,'B':3.0,'B-':2.7,'C+':2.3,'C':2.0,'C-':1.7,'D':1.5,'D-':1.0,'F':0 };
        if (m[cj.trim()] !== undefined) gpa = m[cj.trim()];
      }
      if (gpa == null) continue;
      totalPoints += gpa * xf;
      totalCredits += xf;
    }
    if (totalCredits > 0) saveScores(totalPoints / totalCredits, totalCredits);
  }

  /* ============================================================
   * 5. 获取绩点 —— 策略B：学业情况页面 DOM
   * ============================================================ */
  function parseAcademiaPage() {
    const alertBox = document.querySelector('#alertBox');
    if (alertBox) {
      const text = alertBox.textContent || '';
      let gpa = null;
      const m1 = text.match(/平均学分绩点[^0-9]*([0-9]+\.?[0-9]*)/);
      if (m1) gpa = parseFloat(m1[1]);
      else {
        const nums = text.match(/[0-9]+\.[0-9]+/g);
        if (nums && nums.length > 0) gpa = parseFloat(nums[0]);
      }
      if (gpa != null && gpa > 0 && gpa <= 4) {
        const credits = estimateCreditsFromAcademia();
        saveScores(gpa, credits || state.currentCredits || 0);
        return true;
      }
    }
    return false;
  }

  function estimateCreditsFromAcademia() {
    const body = document.body.innerText || '';
    let total = 0, found = false;
    const re = /获得学分[：:]\s*([0-9]+\.?[0-9]*)/g;
    let m;
    while ((m = re.exec(body)) !== null) {
      const v = parseFloat(m[1]);
      if (!isNaN(v)) { total += v; found = true; }
    }
    return found ? total : null;
  }

  /* ============================================================
   * 6. 获取绩点 —— 策略C：PDF 成绩总表解析（pdf.js）
   * ============================================================ */
  let pdfjsInited = false;
  function initPDFJS() {
    if (pdfjsInited) return;
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
      pdfjsInited = true;
    }
  }

  async function parsePDFScore(url) {
    initPDFJS();
    if (typeof pdfjsLib === 'undefined') {
      console.warn('[GPA Planner] pdf.js 未加载，跳过PDF解析');
      return false;
    }
    try {
      const resp = await fetch(url, { credentials: 'include' });
      if (!resp.ok) return false;
      const buf = await resp.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buf });
      const pdf = await loadingTask.promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // 按y坐标降序、x坐标升序排列，保证阅读顺序
        const items = content.items.slice().sort((a, b) => {
          const dy = b.transform[5] - a.transform[5];
          if (Math.abs(dy) > 2) return dy;
          return a.transform[4] - b.transform[4];
        });
        text += items.map(item => item.str).join('') + '\n';
      }
      console.log('[GPA Planner] PDF提取文本片段:', text.substring(0, 300));

      const creditMatch = text.match(/获得总学分[：:\s]*([0-9]+\.?[0-9]*)/);
      const gpaMatch = text.match(/平均绩点[：:\s]*([0-9]+\.?[0-9]*)/);

      if (creditMatch && gpaMatch) {
        const gpa = parseFloat(gpaMatch[1]);
        const credits = parseFloat(creditMatch[1]);
        if (gpa > 0 && gpa <= 4 && credits > 0) {
          saveScores(gpa, credits);
          console.log('[GPA Planner] PDF解析成功: 绩点', gpa, '学分', credits);
          return true;
        }
      }
      if (gpaMatch && !creditMatch) {
        const gpa = parseFloat(gpaMatch[1]);
        if (gpa > 0 && gpa <= 4) {
          saveScores(gpa, state.currentCredits || 0);
          return true;
        }
      }
      console.warn('[GPA Planner] PDF中未找到绩点/学分关键字');
    } catch (e) { console.warn('[GPA Planner] PDF解析失败', e); }
    return false;
  }

  /* ============================================================
   * 7. 获取绩点 —— 策略D：成绩总表 HTML 页面解析
   * ============================================================ */
  function parseScoreTotalPage() {
    // 先尝试在页面文本中直接找汇总行
    const bodyText = document.body.innerText || '';
    const creditMatch = bodyText.match(/获得总学分[：:\s]*([0-9]+\.?[0-9]*)/);
    const gpaMatch = bodyText.match(/平均绩点[：:\s]*([0-9]+\.?[0-9]*)/);
    if (creditMatch && gpaMatch) {
      saveScores(parseFloat(gpaMatch[1]), parseFloat(creditMatch[1]));
      return true;
    }

    // 否则解析表格
    const tables = document.querySelectorAll('table');
    let totalPoints = 0, totalCredits = 0, found = false;
    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) continue;
        const texts = Array.from(cells).map(c => (c.textContent || '').trim());
        // 找学分数（0.5-10）和成绩（数字或等级）
        let xf = null, grade = null;
        for (const t of texts) {
          const n = parseFloat(t);
          if (xf === null && !isNaN(n) && n >= 0.5 && n <= 10 && /^[0-9]+\.?[0-9]*$/.test(t)) xf = n;
        }
        // 成绩列：数字 0-100 或等级
        for (const t of texts) {
          if (/^[0-9]{1,3}$/.test(t)) { const n = parseInt(t); if (n >= 0 && n <= 100) { grade = n; break; } }
          if (/^(A-?|B\+?|B-?|C\+?|C-?|D-?|F|优秀|良好|中等|及格|不及格)$/.test(t)) { grade = t; break; }
        }
        if (xf != null && grade != null) {
          let gpa = typeof grade === 'number' ? scoreToGPA(grade) : null;
          if (gpa == null && typeof grade === 'string') {
            const gm = { '优秀':4.0,'良好':3.3,'中等':2.3,'及格':1.0,'不及格':0,
              'A':4.0,'A-':3.7,'B+':3.3,'B':3.0,'B-':2.7,'C+':2.3,'C':2.0,'C-':1.7,'D':1.5,'D-':1.0,'F':0 };
            gpa = gm[grade];
          }
          if (gpa != null && gpa >= 0) {
            totalPoints += gpa * xf;
            totalCredits += xf;
            found = true;
          }
        }
      }
    }
    if (found && totalCredits > 0) {
      saveScores(totalPoints / totalCredits, totalCredits);
      return true;
    }
    return false;
  }

  /* ============================================================
   * 8. 获取课表 —— Hook + 主动调用
   * ============================================================ */
  function initHooks() {
    if (typeof ajaxHooker === 'undefined') return;
    ajaxHooker.hook(request => {
      if (request.method !== 'POST') return;
      const url = request.url || '';
      if (url.indexOf('xskbcx_cxXsKb') !== -1) {
        request.response = res => {
          try {
            const data = JSON.parse(res.responseText);
            if (data.kbList && Array.isArray(data.kbList)) parseScheduleCourses(data.kbList);
          } catch (e) {}
        };
      }
      if (url.indexOf('zzxkyzb_cxZzxkYzbChoosedDisplay') !== -1) {
        request.response = res => {
          try {
            const data = JSON.parse(res.responseText);
            if (Array.isArray(data)) parseSelectedCourses(data);
          } catch (e) {}
        };
      }
    });
  }

  function parseScheduleCourses(kbList) {
    const seen = new Set();
    const courses = [];
    for (const item of kbList) {
      const name = item.kcmc || item.courseName || '';
      if (!name || seen.has(name)) continue;
      seen.add(name);
      courses.push({
        name, xf: parseFloat(item.xf || 0),
        teacher: item.xm || item.teacher || '',
        sksj: `${item.xqj ? '周'+['日','一','二','三','四','五','六'][item.xqj] : ''} ${item.jc || ''}节 ${item.zcd || ''}`.trim(),
        type: item.khfsmc || '', source: '课表',
      });
    }
    if (courses.length > 0) {
      const manual = state.selectedCourses.filter(c => c.manual);
      saveCourses([...courses, ...manual]);
      if (panelVisible) { renderPanel(); renderResults(); }
    }
  }

  function parseSelectedCourses(data) {
    const seen = new Set();
    const courses = [];
    for (const item of data) {
      const name = item.kcmc || '';
      if (!name || seen.has(name)) continue;
      seen.add(name);
      courses.push({
        name, xf: parseFloat(item.jxbxf || item.xf || 0),
        teacher: item.jsxx || '', sksj: item.sksj || '',
        type: item.kclb || '', source: '选课',
      });
    }
    if (courses.length > 0) {
      const manual = state.selectedCourses.filter(c => c.manual);
      saveCourses([...courses, ...manual]);
      if (panelVisible) { renderPanel(); renderResults(); }
    }
  }

  async function fetchSchedule() {
    let xnm = '', xqm = '';
    const xnmEl = document.querySelector('#xnm, input[name=xnm], #xnxqh');
    const xqmEl = document.querySelector('#xqm, select[name=xqm]');
    if (xnmEl) xnm = xnmEl.value || '';
    if (xqmEl) xqm = xqmEl.value || '';
    const url = `${location.origin}/jwglxt/kbcx/xskbcx_cxXsKb.html?gnmkdm=N2151`;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ xnm, xqm }).toString(),
        credentials: 'include',
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      if (data.kbList && Array.isArray(data.kbList)) { parseScheduleCourses(data.kbList); return true; }
    } catch (e) { console.warn('[GPA Planner] 主动获取课表失败', e); }
    return false;
  }

  /* ============================================================
   * 9. 难度浮动算法（11级离散绩点）
   *    raw_i = avgNeeded + factor × (avgDiff - d_i)
   *    → round 到最近的11级 → 贪心微调使加权总和逼近目标
   * ============================================================ */
  function calculateSuggestions(targetGPA) {
    if (state.currentGPA == null || state.currentCredits == null) {
      return { error: '尚未获取当前绩点，请在成绩总表/学业情况页面打开脚本，或手动输入' };
    }
    if (state.selectedCourses.length === 0) {
      return { error: '尚未获取课程，请在课表页面打开脚本，或手动添加课程' };
    }

    const nextCredits = state.selectedCourses.reduce((s, c) => s + (c.xf || 0), 0);
    if (nextCredits === 0) return { error: '已选课程总学分为0' };

    const targetTotal = targetGPA * (state.currentCredits + nextCredits);
    const currentTotal = state.currentGPA * state.currentCredits;
    const neededTotal = targetTotal - currentTotal;
    const avgNeeded = neededTotal / nextCredits;

    // 学分加权平均难度
    let totalDiffCredits = 0;
    const enriched = state.selectedCourses.map(c => {
      const diff = getDifficulty(c.name);
      totalDiffCredits += diff * c.xf;
      return { ...c, diff };
    });
    const avgDiff = totalDiffCredits / nextCredits;
    const factor = state.floatFactor || 0.15;

    // 初步建议：难度浮动 + round到11级
    const suggestions = enriched.map(c => {
      const raw = avgNeeded + factor * (avgDiff - c.diff);
      return { ...c, rawGPA: raw, suggestedGPA: roundToGPA(raw) };
    });

    // 贪心微调，使加权总和逼近 neededTotal
    adjustToTarget(suggestions, neededTotal);

    // 实际可达
    const actualNextTotal = suggestions.reduce((s, c) => s + c.suggestedGPA * c.xf, 0);
    const actualTotalGPA = (currentTotal + actualNextTotal) / (state.currentCredits + nextCredits);

    // 可行性
    const maxPossible = suggestions.reduce((s, c) => s + 4.0 * c.xf, 0);
    const minPossible = suggestions.reduce((s, c) => s + 1.0 * c.xf, 0);
    let feasible = true, warning = '';
    if (neededTotal > maxPossible + 0.01) {
      feasible = false;
      warning = '目标过高：所有课程都拿4.0也无法达到目标总绩点';
    } else if (neededTotal < minPossible - 0.01) {
      feasible = false;
      warning = '目标过低：所有课程都只拿1.0也会超过目标';
    }

    return {
      suggestions,
      avgNeeded: Math.round(avgNeeded * 100) / 100,
      avgDiff: Math.round(avgDiff * 100) / 100,
      feasible, warning, nextCredits,
      actualTotalGPA: Math.round(actualTotalGPA * 100) / 100,
      neededTotal: Math.round(neededTotal * 100) / 100,
      factor,
    };
  }

  function adjustToTarget(suggestions, neededTotal) {
    const calcTotal = () => suggestions.reduce((s, c) => s + c.suggestedGPA * c.xf, 0);
    let total = calcTotal();
    const EPS = 0.005;

    // 需要提升总和
    while (total < neededTotal - EPS) {
      let bestIdx = -1, bestCost = Infinity;
      for (let i = 0; i < suggestions.length; i++) {
        const idx = VALID_GPAS.indexOf(suggestions[i].suggestedGPA);
        if (idx < VALID_GPAS.length - 1) {
          const nextGpa = VALID_GPAS[idx + 1];
          const increment = (nextGpa - suggestions[i].suggestedGPA) * suggestions[i].xf;
          if (increment <= 0) continue;
          // 优先提升离原始raw值最近的课程
          const cost = Math.abs(suggestions[i].rawGPA - nextGpa) + increment * 0.01;
          if (cost < bestCost) { bestCost = cost; bestIdx = i; }
        }
      }
      if (bestIdx === -1) break;
      const idx = VALID_GPAS.indexOf(suggestions[bestIdx].suggestedGPA);
      suggestions[bestIdx].suggestedGPA = VALID_GPAS[idx + 1];
      total = calcTotal();
    }

    // 需要降低总和
    while (total > neededTotal + EPS) {
      let bestIdx = -1, bestCost = Infinity;
      for (let i = 0; i < suggestions.length; i++) {
        const idx = VALID_GPAS.indexOf(suggestions[i].suggestedGPA);
        if (idx > 0) {
          const prevGpa = VALID_GPAS[idx - 1];
          const decrement = (suggestions[i].suggestedGPA - prevGpa) * suggestions[i].xf;
          if (decrement <= 0) continue;
          const cost = Math.abs(suggestions[i].rawGPA - prevGpa) + decrement * 0.01;
          if (cost < bestCost) { bestCost = cost; bestIdx = i; }
        }
      }
      if (bestIdx === -1) break;
      const idx = VALID_GPAS.indexOf(suggestions[bestIdx].suggestedGPA);
      suggestions[bestIdx].suggestedGPA = VALID_GPAS[idx - 1];
      total = calcTotal();
    }
  }

  /* ============================================================
   * 10. UI 面板
   * ============================================================ */
  let panelEl = null, panelVisible = false, dragState = null;

  function createPanel() {
    panelEl = document.createElement('div');
    panelEl.id = 'shu-gpa-planner-panel';
    panelEl.style.cssText = `
      position: fixed; right: 20px; bottom: 80px; width: 460px; max-height: 85vh;
      background: #fff; border: 1px solid #e8e8e8; border-radius: 10px;
      box-shadow: 0 6px 24px rgba(0,0,0,0.15); z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft YaHei", sans-serif;
      font-size: 13px; color: #333; display: flex; flex-direction: column; overflow: hidden;`;
    document.body.appendChild(panelEl);
    renderPanel();
    makeDraggable(panelEl);
  }

  function togglePanel() {
    if (!panelEl) createPanel();
    panelVisible = !panelVisible;
    panelEl.style.display = panelVisible ? 'flex' : 'none';
    if (panelVisible) renderPanel();
  }

  function renderPanel() {
    if (!panelEl) return;
    const gpaText = state.currentGPA != null ? state.currentGPA.toFixed(2) : '未获取';
    const creditsText = state.currentCredits != null ? state.currentCredits.toFixed(1) : '—';
    const updated = localStorage.getItem(STORE.updated);
    const updatedText = updated ? new Date(parseInt(updated)).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';

    panelEl.innerHTML = `
      <div id="gpa-header" style="background:linear-gradient(135deg,#1890ff,#096dd9);color:#fff;padding:10px 14px;cursor:move;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:600;font-size:14px;">📊 上大绩点规划助手</span>
        <span id="gpa-close" style="cursor:pointer;opacity:0.8;font-size:18px;padding:0 4px;">×</span>
      </div>
      <div style="padding:12px 14px;overflow-y:auto;flex:1;">
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <div style="flex:1;background:#f0f5ff;border-radius:6px;padding:8px;text-align:center;">
            <div style="color:#8c8c8c;font-size:11px;">当前绩点</div>
            <div style="font-size:20px;font-weight:700;color:#1890ff;">${gpaText}</div>
          </div>
          <div style="flex:1;background:#f6ffed;border-radius:6px;padding:8px;text-align:center;">
            <div style="color:#8c8c8c;font-size:11px;">累计学分</div>
            <div style="font-size:20px;font-weight:700;color:#52c41a;">${creditsText}</div>
          </div>
          <div style="flex:1;background:#fff7e6;border-radius:6px;padding:8px;text-align:center;">
            <div style="color:#8c8c8c;font-size:11px;">已选课程</div>
            <div style="font-size:20px;font-weight:700;color:#fa8c16;">${state.selectedCourses.length}</div>
          </div>
        </div>
        <div style="font-size:10px;color:#bfbfbf;margin-bottom:10px;text-align:right;">数据更新于 ${updatedText}</div>

        <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
          <button id="gpa-refresh-score" style="flex:1;min-width:80px;padding:6px;border:1px solid #1890ff;background:#fff;color:#1890ff;border-radius:4px;cursor:pointer;font-size:12px;">刷新成绩</button>
          <button id="gpa-refresh-schedule" style="flex:1;min-width:80px;padding:6px;border:1px solid #52c41a;background:#fff;color:#52c41a;border-radius:4px;cursor:pointer;font-size:12px;">刷新课表</button>
          <button id="gpa-manual-score" style="flex:1;min-width:80px;padding:6px;border:1px solid #d9d9d9;background:#fff;color:#595959;border-radius:4px;cursor:pointer;font-size:12px;">手动输入</button>
        </div>

        <div style="margin-bottom:10px;">
          <label style="display:block;font-weight:600;margin-bottom:4px;color:#595959;">目标总绩点（含已修+下学期）</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input id="gpa-target" type="number" step="0.01" min="0" max="4" value="${state.targetGPA}" style="flex:1;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;font-size:13px;">
            <button id="gpa-calc" style="padding:6px 16px;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">计算</button>
          </div>
          <div style="margin-top:4px;font-size:11px;color:#8c8c8c;">快捷：
            <span class="gpa-quick" data-val="3.0" style="color:#1890ff;cursor:pointer;margin-right:6px;">3.0</span>
            <span class="gpa-quick" data-val="3.3" style="color:#1890ff;cursor:pointer;margin-right:6px;">3.3</span>
            <span class="gpa-quick" data-val="3.5" style="color:#1890ff;cursor:pointer;margin-right:6px;">3.5</span>
            <span class="gpa-quick" data-val="3.7" style="color:#1890ff;cursor:pointer;margin-right:6px;">3.7</span>
            <span class="gpa-quick" data-val="3.8" style="color:#1890ff;cursor:pointer;">3.8</span>
          </div>
        </div>

        <div style="margin-bottom:12px;padding:8px 10px;background:#fafafa;border-radius:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:600;color:#595959;font-size:12px;">难度浮动系数</span>
            <span id="gpa-factor-val" style="font-weight:700;color:#1890ff;">${state.floatFactor.toFixed(2)}</span>
          </div>
          <input id="gpa-factor" type="range" min="0" max="0.4" step="0.01" value="${state.floatFactor}" style="width:100%;">
          <div style="font-size:10px;color:#bfbfbf;margin-top:2px;">系数越大，难课与水课的目标绩点差距越大；0 = 所有课目标相同</div>
        </div>

        <div id="gpa-results"></div>

        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #f0f0f0;">
          <div style="font-weight:600;margin-bottom:6px;color:#595959;cursor:pointer;" id="gpa-manual-toggle">➕ 手动添加/管理课程</div>
          <div id="gpa-manual-area" style="display:none;">
            <div style="display:flex;gap:4px;margin-bottom:6px;">
              <input id="gpa-add-name" placeholder="课程名" style="flex:2;padding:4px 6px;border:1px solid #d9d9d9;border-radius:3px;font-size:12px;">
              <input id="gpa-add-xf" type="number" step="0.5" placeholder="学分" style="flex:1;padding:4px 6px;border:1px solid #d9d9d9;border-radius:3px;font-size:12px;">
              <button id="gpa-add-btn" style="padding:4px 8px;background:#52c41a;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:12px;">添加</button>
            </div>
            <div id="gpa-manual-list"></div>
          </div>
        </div>
        <div style="margin-top:10px;font-size:10px;color:#bfbfbf;text-align:center;">数据已本地保存 · 难度可点击修正 · 11级离散绩点</div>
      </div>`;

    panelEl.querySelector('#gpa-close').onclick = togglePanel;
    panelEl.querySelector('#gpa-refresh-score').onclick = async () => {
      const btn = panelEl.querySelector('#gpa-refresh-score');
      btn.textContent = '加载中...'; btn.disabled = true;
      let ok = await fetchScores();
      if (!ok && location.href.includes('xsxyqk')) ok = parseAcademiaPage();
      if (!ok && location.href.includes('xscjzbdy')) ok = parseScoreTotalPage();
      if (!ok && location.href.includes('scorePrint') && location.href.endsWith('.pdf')) ok = await parsePDFScore(location.href);
      btn.textContent = ok ? '成绩已更新 ✓' : '获取失败，可手动输入';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = '刷新成绩'; }, 2500);
      renderPanel();
    };
    panelEl.querySelector('#gpa-refresh-schedule').onclick = async () => {
      const btn = panelEl.querySelector('#gpa-refresh-schedule');
      btn.textContent = '加载中...'; btn.disabled = true;
      const ok = await fetchSchedule();
      btn.textContent = ok ? '课表已更新 ✓' : '请在课表页面操作';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = '刷新课表'; }, 2500);
      renderPanel();
    };
    panelEl.querySelector('#gpa-manual-score').onclick = showManualScoreDialog;
    panelEl.querySelector('#gpa-calc').onclick = () => {
      const val = parseFloat(panelEl.querySelector('#gpa-target').value);
      if (!isNaN(val)) { saveTarget(val); renderResults(); }
    };
    panelEl.querySelectorAll('.gpa-quick').forEach(el => {
      el.onclick = () => {
        const val = parseFloat(el.dataset.val);
        saveTarget(val);
        panelEl.querySelector('#gpa-target').value = val;
        renderResults();
      };
    });
    const factorSlider = panelEl.querySelector('#gpa-factor');
    factorSlider.oninput = () => {
      const val = parseFloat(factorSlider.value);
      saveFactor(val);
      panelEl.querySelector('#gpa-factor-val').textContent = val.toFixed(2);
      renderResults();
    };
    panelEl.querySelector('#gpa-manual-toggle').onclick = () => {
      const area = panelEl.querySelector('#gpa-manual-area');
      area.style.display = area.style.display === 'none' ? 'block' : 'none';
      renderManualList();
    };
    panelEl.querySelector('#gpa-add-btn').onclick = () => {
      const name = panelEl.querySelector('#gpa-add-name').value.trim();
      const xf = parseFloat(panelEl.querySelector('#gpa-add-xf').value);
      if (name && !isNaN(xf) && xf > 0) {
        const courses = [...state.selectedCourses, { name, xf, teacher:'', sksj:'', type:'手动添加', manual:true }];
        saveCourses(courses);
        panelEl.querySelector('#gpa-add-name').value = '';
        panelEl.querySelector('#gpa-add-xf').value = '';
        renderManualList();
        renderPanel();
      }
    };
    renderResults();
  }

  function renderResults() {
    const container = panelEl?.querySelector('#gpa-results');
    if (!container) return;
    const result = calculateSuggestions(state.targetGPA);

    if (result.error) {
      container.innerHTML = `<div style="padding:12px;background:#fff2f0;border:1px solid #ffccc7;border-radius:6px;color:#cf1322;font-size:12px;">${result.error}</div>`;
      return;
    }

    let html = `<div style="background:#f0f5ff;border-radius:6px;padding:8px 10px;margin-bottom:10px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:#595959;">下学期总学分：</span><span style="font-weight:600;">${result.nextCredits}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:#595959;">下学期需拿学分绩点：</span><span style="font-weight:600;">${result.neededTotal}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:#595959;">下学期平均需达绩点：</span><span style="font-weight:600;color:#1890ff;">${result.avgNeeded}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#595959;">选课平均难度：</span><span style="font-weight:600;color:#fa8c16;">${result.avgDiff} / 5</span></div>
    </div>`;

    if (result.warning) {
      html += `<div style="padding:8px 10px;background:#fff2f0;border:1px solid #ffccc7;border-radius:6px;color:#cf1322;font-size:12px;margin-bottom:10px;">⚠️ ${result.warning}</div>`;
    }

    html += `<div style="font-weight:600;margin-bottom:6px;color:#595959;">各课程建议绩点：</div>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr style="background:#fafafa;color:#8c8c8c;">
        <th style="text-align:left;padding:5px 4px;border-bottom:1px solid #f0f0f0;">课程</th>
        <th style="text-align:center;padding:5px 4px;border-bottom:1px solid #f0f0f0;">学分</th>
        <th style="text-align:center;padding:5px 4px;border-bottom:1px solid #f0f0f0;">难度</th>
        <th style="text-align:center;padding:5px 4px;border-bottom:1px solid #f0f0f0;">建议绩点</th>
        <th style="text-align:center;padding:5px 4px;border-bottom:1px solid #f0f0f0;">参考分数</th>
      </tr></thead><tbody>`;

    for (const c of result.suggestions) {
      const diffColor = getDifficultyColor(c.diff);
      const gpaColor = c.suggestedGPA >= 3.7 ? '#52c41a' : c.suggestedGPA >= 3.0 ? '#1890ff' : c.suggestedGPA >= 2.0 ? '#fa8c16' : '#f5222d';
      const gpaLabel = GPA_RANGES.find(r => r.gpa === c.suggestedGPA)?.label || '';
      html += `<tr style="border-bottom:1px solid #f5f5f5;">
        <td style="padding:5px 4px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.name}">${c.name}</td>
        <td style="text-align:center;padding:5px 4px;">${c.xf}</td>
        <td style="text-align:center;padding:5px 4px;">
          <span class="gpa-diff-badge" data-course="${c.name.replace(/"/g,'&quot;')}" style="display:inline-block;padding:1px 6px;border-radius:8px;background:${diffColor}22;color:${diffColor};font-size:11px;cursor:pointer;font-weight:600;" title="点击修改难度">${c.diff} ${getDifficultyLabel(c.diff)}</span>
        </td>
        <td style="text-align:center;padding:5px 4px;font-weight:700;color:${gpaColor};">${c.suggestedGPA.toFixed(1)} <span style="font-size:10px;font-weight:400;color:#8c8c8c;">${gpaLabel}</span></td>
        <td style="text-align:center;padding:5px 4px;color:#8c8c8c;">${gpaToScoreRange(c.suggestedGPA)}</td>
      </tr>`;
    }
    html += `</tbody></table>`;

    if (!result.feasible) {
      html += `<div style="margin-top:8px;font-size:11px;color:#8c8c8c;">按上述建议实际可达总绩点：<b style="color:#1890ff;">${result.actualTotalGPA}</b></div>`;
    } else {
      html += `<div style="margin-top:8px;font-size:11px;color:#52c41a;">✓ 按上述建议可达到目标绩点 ${state.targetGPA.toFixed(2)}</div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll('.gpa-diff-badge').forEach(el => {
      el.onclick = () => showDifficultyDialog(el.dataset.course);
    });
  }

  function renderManualList() {
    const list = panelEl?.querySelector('#gpa-manual-list');
    if (!list) return;
    const items = state.selectedCourses.map((c, i) => ({ c, i })).filter(x => x.c.manual);
    if (items.length === 0) {
      list.innerHTML = '<div style="font-size:11px;color:#bfbfbf;">暂无手动添加的课程</div>';
      return;
    }
    list.innerHTML = items.map(({ c, i }) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px;border-bottom:1px solid #f5f5f5;">
        <span>${c.name} (${c.xf}学分)</span>
        <span class="gpa-remove-manual" data-idx="${i}" style="color:#f5222d;cursor:pointer;">删除</span>
      </div>`
    ).join('');
    list.querySelectorAll('.gpa-remove-manual').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.idx);
        const courses = [...state.selectedCourses];
        courses.splice(idx, 1);
        saveCourses(courses);
        renderManualList();
        renderPanel();
      };
    });
  }

  /* ============================================================
   * 11. 对话框
   * ============================================================ */
  function showDifficultyDialog(courseName) {
    const currentDiff = getDifficulty(courseName);
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:100000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:10px;padding:20px;width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
        <div style="font-weight:600;margin-bottom:12px;font-size:14px;">修改难度：${courseName}</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">
          ${[1,2,3,4,5].map(d => `
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 8px;border-radius:4px;${d===currentDiff?'background:#e6f7ff;border:1px solid #1890ff;':'border:1px solid #f0f0f0;'}">
              <input type="radio" name="diff-opt" value="${d}" ${d===currentDiff?'checked':''}>
              <span style="color:${getDifficultyColor(d)};font-weight:600;">${d} - ${getDifficultyLabel(d)}</span>
            </label>`).join('')}
        </div>
        <div style="display:flex;gap:8px;">
          <button id="diff-ok" style="flex:1;padding:7px;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;">确定</button>
          <button id="diff-reset" style="flex:1;padding:7px;background:#fff;color:#595959;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;">恢复默认</button>
          <button id="diff-cancel" style="flex:1;padding:7px;background:#fff;color:#595959;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;">取消</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#diff-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#diff-ok').onclick = () => {
      const sel = overlay.querySelector('input[name="diff-opt"]:checked');
      if (sel) { setOverride(courseName, parseInt(sel.value)); renderResults(); }
      overlay.remove();
    };
    overlay.querySelector('#diff-reset').onclick = () => { clearOverride(courseName); renderResults(); overlay.remove(); };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  function showManualScoreDialog() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:100000;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:10px;padding:20px;width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
        <div style="font-weight:600;margin-bottom:12px;font-size:14px;">手动输入当前成绩</div>
        <div style="margin-bottom:10px;">
          <label style="display:block;font-size:12px;color:#595959;margin-bottom:3px;">当前累计绩点（如 3.65）</label>
          <input id="manual-gpa" type="number" step="0.01" min="0" max="4" value="${state.currentGPA ?? ''}" style="width:100%;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;box-sizing:border-box;">
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;color:#595959;margin-bottom:3px;">累计学分（如 165.0）</label>
          <input id="manual-credits" type="number" step="0.5" min="0" value="${state.currentCredits ?? ''}" style="width:100%;padding:6px 8px;border:1px solid #d9d9d9;border-radius:4px;box-sizing:border-box;">
        </div>
        <div style="display:flex;gap:8px;">
          <button id="manual-ok" style="flex:1;padding:7px;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;">确定</button>
          <button id="manual-cancel" style="flex:1;padding:7px;background:#fff;color:#595959;border:1px solid #d9d9d9;border-radius:4px;cursor:pointer;">取消</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#manual-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#manual-ok').onclick = () => {
      const gpa = parseFloat(overlay.querySelector('#manual-gpa').value);
      const credits = parseFloat(overlay.querySelector('#manual-credits').value);
      if (!isNaN(gpa)) saveScores(gpa, isNaN(credits) ? state.currentCredits || 0 : credits);
      overlay.remove();
      renderPanel();
    };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  /* ============================================================
   * 12. 拖拽 & 悬浮按钮
   * ============================================================ */
  function makeDraggable(el) {
    const header = el.querySelector('#gpa-header');
    header.addEventListener('mousedown', (e) => {
      if (e.target.id === 'gpa-close') return;
      dragState = { offsetX: e.clientX - el.offsetLeft, offsetY: e.clientY - el.offsetTop };
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragState) return;
      el.style.left = (e.clientX - dragState.offsetX) + 'px';
      el.style.top = (e.clientY - dragState.offsetY) + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => { dragState = null; });
  }

  function createFAB() {
    const fab = document.createElement('div');
    fab.id = 'shu-gpa-planner-fab';
    fab.textContent = '📊';
    fab.style.cssText = `position:fixed;right:20px;bottom:20px;width:48px;height:48px;background:linear-gradient(135deg,#1890ff,#096dd9);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;z-index:99998;box-shadow:0 4px 16px rgba(24,144,255,0.4);transition:transform 0.2s;`;
    fab.onmouseenter = () => fab.style.transform = 'scale(1.1)';
    fab.onmouseleave = () => fab.style.transform = 'scale(1)';
    fab.onclick = togglePanel;
    document.body.appendChild(fab);
  }

  /* ============================================================
   * 13. 初始化 —— 根据页面自动获取数据
   * ============================================================ */
  function init() {
    loadState();
    initHooks();
    createFAB();

    const url = location.href;

    // PDF 成绩总表：fetch + 解析文本流
    if (url.includes('scorePrint') && url.endsWith('.pdf')) {
      setTimeout(async () => {
        const ok = await parsePDFScore(url);
        if (ok) console.log('[GPA Planner] PDF成绩总表解析成功');
      }, 1200);
    }

    // 学业情况页面
    if (url.includes('xsxyqk')) {
      setTimeout(() => {
        if (!parseAcademiaPage()) setTimeout(parseAcademiaPage, 2500);
      }, 1500);
    }

    // 成绩总表 HTML 页面
    if (url.includes('xscjzbdy')) {
      setTimeout(() => {
        if (!parseScoreTotalPage()) setTimeout(parseScoreTotalPage, 2500);
      }, 2000);
    }

    // 课表页面
    if (url.includes('xskbcx')) {
      setTimeout(fetchSchedule, 2000);
    }

    // 任何页面都后台尝试成绩接口
    setTimeout(fetchScores, 2500);

    console.log('[GPA Planner] v1.2 已加载，点击右下角 📊 打开面板');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
