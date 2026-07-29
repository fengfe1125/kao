/* ============================================================
   专升本备考系统 · 主逻辑
   科目：数字电路与逻辑设计 / 大学英语
   ============================================================ */

const KEY='sbz_v2';
const DEF={
  subj:'dl',
  done:{}, openFold:{},
  wrongs:[], wrongsEn:[],
  known:{},                 // 词汇已掌握
  srs:{},                   // 记忆曲线卡片状态 word -> {ef,n,iv,due,seen,wrong}
  plan:{goal:30,newRatio:0.4},  // 每日计划：目标个数 / 新词占比
  log:{},                   // 学习日志 date -> {new:[],review:[],right,wrong}
  gdone:{},                 // 语法专题完成
  streak:0, lastDay:'',
  totalQ:0, rightQ:0,
  vocabIdx:0
};
let S=load(), Q={list:[],i:0,mode:null};

function load(){
  try{const r=localStorage.getItem(KEY);
    if(r) return Object.assign(JSON.parse(JSON.stringify(DEF)),JSON.parse(r));
  }catch(e){console.warn('读取失败',e)}
  return JSON.parse(JSON.stringify(DEF));
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){toast('存储空间不足')}}
function today(){return new Date().toISOString().slice(0,10)}
function checkStreak(){
  const t=today(); if(S.lastDay===t) return;
  const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
  S.streak=(S.lastDay===y)?S.streak+1:1; S.lastDay=t; save();
  const el=document.getElementById('streak'); if(el) el.textContent='🔥 '+S.streak+' 天';
}
function toast(m){
  const el=document.getElementById('toast');
  el.textContent=m; el.classList.add('on');
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('on'),1900);
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- 数据索引 ---------- */
const DL_NODES=SYLLABUS.flatMap(c=>c.nodes);
const DL_MAP=Object.fromEntries(DL_NODES.map(n=>[n.id,n]));
const ALL_VOCAB=VOCAB.concat(typeof VOCAB_EXT!=='undefined'?VOCAB_EXT:[]);
const GRAM_MAP=Object.fromEntries(GRAMMAR.map(g=>[g.id,g]));

const isEn=()=>S.subj==='en';

/* ---------- 统计 ---------- */
function dlStats(){
  const d=DL_NODES.filter(n=>S.done[n.id]).length;
  return {total:DL_NODES.length,done:d,pct:Math.round(d/DL_NODES.length*100)};
}
function enStats(){
  const g=GRAMMAR.filter(x=>S.gdone[x.id]).length;
  const kn=Object.keys(S.known).length;
  return {gTotal:GRAMMAR.length,gDone:g,gPct:Math.round(g/GRAMMAR.length*100),
    vTotal:ALL_VOCAB.length,vKnown:kn,vPct:Math.round(kn/ALL_VOCAB.length*100)};
}
function chapProg(c){
  const d=c.nodes.filter(n=>S.done[n.id]).length;
  return {d,t:c.nodes.length,pct:Math.round(d/c.nodes.length*100)};
}
function stageProg(st){
  if(!st.nodes||!st.nodes.length) return {d:0,t:0,pct:0};
  const d=st.nodes.filter(id=>S.done[id]).length;
  return {d,t:st.nodes.length,pct:Math.round(d/st.nodes.length*100)};
}
function curStage(){
  for(const st of LEARNING_PATH){const p=stageProg(st); if(p.t===0||p.pct<100) return st.stage}
  return LEARNING_PATH.length;
}
function enCurStage(){
  for(const st of EN_PATH){
    const ids=stageGrammar(st.stage);
    if(!ids.length) return st.stage;
    if(ids.some(id=>!S.gdone[id])) return st.stage;
  }
  return EN_PATH.length;
}
/* 英语阶段 → 语法专题映射 */
function stageGrammar(n){
  const m={1:['g1'],2:['g2','g3'],3:['g4','g5'],4:['g6','g7','g8','g9','g10'],5:[],6:[]};
  return m[n]||[];
}

/* ============================================================
   首页
   ============================================================ */
function renderHome(){
  document.getElementById('p-home').innerHTML = isEn()?homeEn():homeDl();
}

function homeDl(){
  const s=dlStats(),M=EXAM_META,cs=curStage();
  const st=LEARNING_PATH.find(x=>x.stage===cs);
  const acc=S.totalQ?Math.round(S.rightQ/S.totalQ*100):0;
  return `
  <div class="hero">
    <div class="lbl">大纲掌握进度</div>
    <div class="big">${s.pct}%</div>
    <div class="note">${s.done} / ${s.total} 个考纲知识点已完成</div>
    <div class="prog"><i style="width:${s.pct}%"></i></div>
  </div>
  <div class="grid3">
    <div class="stat"><b>${S.streak}</b><span>连续打卡</span></div>
    <div class="stat"><b>${acc}%</b><span>答题正确率</span></div>
    <div class="stat"><b>${S.wrongs.length}</b><span>待攻克错题</span></div>
  </div>
  <div class="card" style="border-left:4px solid var(--brand)">
    <div class="muted" style="font-weight:700;font-size:11px">当前阶段 · 第 ${cs} 阶段</div>
    <div style="font-size:17px;font-weight:700;margin:3px 0">${st.name}
      <span class="muted" style="font-weight:400;font-size:13px">　${st.weeks}</span></div>
    <div style="font-size:13px;color:var(--ink2)">${st.goal}</div>
    <div class="miniprog"><i style="width:${stageProg(st).pct}%"></i></div>
    <div class="row" style="margin-top:12px">
      <button class="btn sm" onclick="go('path')">学习路径</button>
      <button class="btn sm ghost" onclick="go('quiz')">开始做题</button>
    </div>
  </div>
  <div class="sec-t">考试基本信息</div>
  <div class="card">
    <div class="meta-grid">
      <div class="meta"><div class="k">考试方式</div><div class="v">${M.method}</div></div>
      <div class="meta"><div class="k">考试时长</div><div class="v">${M.duration} 分钟</div></div>
      <div class="meta"><div class="k">试卷满分</div><div class="v">${M.fullScore} 分</div></div>
      <div class="meta"><div class="k">考查章节</div><div class="v">${SYLLABUS.length} 章</div></div>
    </div>
    <div class="muted" style="margin:13px 0 0;font-size:11px">试题难易程度分布</div>
    <div class="diffbar">${M.difficulty.map(d=>
      `<i style="width:${d.pct}%;background:${d.color}">${d.name} ${d.pct}%</i>`).join('')}</div>
    <div class="warnbox"><b>⚠️ 题型特别提示</b><br>
      大纲明确规定：<b>${M.questionTypes}</b>。<br>
      不能靠蒙选项得分，所有答案都必须完整写出推导过程、画出卡诺图与逻辑图。
      本站练习均按主观题设计，请务必在纸上写完再核对解析。</div>
  </div>
  <div class="sec-t">各章权重与进度</div>
  <div class="card">
    ${SYLLABUS.map(c=>{const p=chapProg(c);
      return `<div style="margin-bottom:12px">
        <div class="spread" style="font-size:13px;margin-bottom:5px">
          <span style="font-weight:600">第${c.num}章 ${esc(c.title)}</span>
          <span class="muted">${p.d}/${p.t} · 约${c.weight}分</span></div>
        <div class="miniprog"><i style="width:${p.pct}%"></i></div></div>`}).join('')}
  </div>`;
}

function homeEn(){
  const s=enStats(),M=EN_META,cs=enCurStage();
  const st=EN_PATH.find(x=>x.stage===cs);
  const sr=srsStats(), fs=famStats();
  const goal=(S.plan&&S.plan.goal)||30, doneN=todayCount();
  const pct=Math.min(100,Math.round(doneN/goal*100));
  return `
  <div class="hero">
    <div class="lbl">今日学习进度</div>
    <div class="big">${doneN}<span style="font-size:17px;font-weight:600;opacity:.75"> / ${goal}</span></div>
    <div class="note">${doneN>=goal?'🎉 今日目标已完成':`还差 ${goal-doneN} 个　·　${sr.dueNow} 词待复习`}</div>
    <div class="prog"><i style="width:${pct}%"></i></div>
  </div>
  <div class="grid3">
    <div class="stat"><b style="color:#4f8a6b">${fs[4]+fs[3]}</b><span>熟悉+牢固</span></div>
    <div class="stat"><b style="color:#c9992e">${fs[1]+fs[2]}</b><span>陌生+模糊</span></div>
    <div class="stat"><b style="color:#8e99a6">${fs[0]}</b><span>未学新词</span></div>
  </div>
  <div class="card" style="border-left:4px solid var(--brand)">
    <div class="muted" style="font-weight:700;font-size:11px">当前阶段 · 第 ${cs} 阶段</div>
    <div style="font-size:17px;font-weight:700;margin:3px 0">${st.name}
      <span class="muted" style="font-weight:400;font-size:13px">　${st.weeks}</span></div>
    <div style="font-size:13px;color:var(--ink2)">${st.goal}</div>
    <div class="row" style="margin-top:12px">
      <button class="btn sm" onclick="goVocab('plan')">开始今日学习</button>
      <button class="btn sm ghost" onclick="goVocab('tree')">语法体系</button>
    </div>
  </div>
  <div class="sec-t">考试基本信息</div>
  <div class="card">
    <div class="meta-grid">
      <div class="meta"><div class="k">考试方式</div><div class="v">${M.method}</div></div>
      <div class="meta"><div class="k">考试时长</div><div class="v">${M.duration} 分钟</div></div>
      <div class="meta"><div class="k">试卷满分</div><div class="v">${M.fullScore} 分</div></div>
      <div class="meta"><div class="k">词汇要求</div><div class="v">约 3400 词</div></div>
    </div>
    <div class="muted" style="margin:13px 0 6px;font-size:11px">题型与分值构成</div>
    <div class="diffbar">${M.sections.map(x=>
      `<i style="width:${x.score}%;background:${x.color}">${x.name} ${x.score}</i>`).join('')}</div>
    ${M.sections.map(x=>`<div class="gpt"><span class="k">${x.name} ${x.score}分</span>
      <span class="v">${esc(x.detail)}</span></div>`).join('')}
    <div class="infobox" style="margin-top:11px">
      <b>命题依据</b>：${esc(M.standard)}<br>
      <b>考查重点</b>：${esc(M.focus)}</div>
    <div class="tipbox" style="margin-top:9px">💡 ${esc(M.note)}</div>
  </div>
  <div class="sec-t">得分优先级建议</div>
  <div class="card">
    <div class="infobox" style="background:var(--bg)">
      <b>阅读理解 45 分是最大头</b>，但它依赖词汇量，短期难速成。<br><br>
      <b>词汇与结构 25 分</b>是性价比最高的部分——语法规则有限、考点固定，
      认真过完10个语法专题 + 背熟核心词，这25分能拿到大部分。<br><br>
      <b>写作 10 分</b>背模板见效最快，考前两周突击即可。<br><br>
      所以零基础的推进顺序应该是：<b>语法 → 词汇 → 阅读 → 翻译写作</b>，
      而不是一上来就刷阅读。
    </div>
  </div>`;
}

/* ============================================================
   学习路径
   ============================================================ */
/* 从首页直达词汇子页 */
function goVocab(tab){mapTab=tab;famView=null;go('map')}

function renderPath(){
  document.getElementById('p-path').innerHTML = isEn()?pathEn():pathDl();
}
function pathDl(){
  const cs=curStage();
  return `<div class="card flat"><div class="infobox" style="background:none;padding:0">
    <b style="color:var(--brand)">零基础 16 周推进方案</b><br>
    路径按知识依赖关系排序：先学「怎么记数」→「逻辑代数这套数学工具」→「认识器件」→
    「用器件搭组合电路」→ 最后「加入记忆单元」。每阶段完成全部知识点后自动进入下一段。
  </div></div>
  ${LEARNING_PATH.map(st=>{
    const p=stageProg(st),done=p.t>0&&p.pct===100,act=st.stage===cs;
    return `<div class="stage ${done?'done':act?'act':''}">
      <div class="spread" style="align-items:flex-start">
        <div style="flex:1">
          <div class="stage-n">STAGE ${st.stage} · ${st.weeks}</div>
          <div class="stage-t">${st.name}</div>
          <div class="stage-g">${st.goal}</div>
        </div>
        <span class="badge ${done?'ok':act?'':'idle'}">${done?'✓ 完成':act?'进行中':'未开始'}</span>
      </div>
      ${st.nodes.length?`<div class="miniprog"><i style="width:${p.pct}%"></i></div>
        <div class="muted" style="margin-top:6px;font-size:11.5px">${p.d}/${p.t} 知识点</div>
        <div style="margin-top:9px">${st.nodes.map(id=>{const n=DL_MAP[id];
          return n?`<span class="chip ${S.done[id]?'on':''}" onclick="jumpNode('${id}')">${S.done[id]?'✓ ':''}${esc(n.title)}</span>`:''}).join('')}</div>`
        :`<div class="muted" style="margin-top:9px">本阶段为全书总复习，无独立知识点</div>`}
      <div class="tipbox" style="margin-top:10px">💡 ${esc(st.tip)}</div>
    </div>`}).join('')}`;
}
function pathEn(){
  const cs=enCurStage();
  return `<div class="card flat"><div class="infobox" style="background:none;padding:0">
    <b style="color:var(--brand)">零基础 26 周推进方案</b><br>
    英语没有捷径，但有顺序。先把句子结构搞懂，再攻时态，然后啃非谓语和定语从句这两个分水岭，
    最后补齐零散语法并转向阅读翻译写作。词汇每天坚持，贯穿全程。
  </div></div>
  ${EN_PATH.map(st=>{
    const ids=stageGrammar(st.stage);
    const d=ids.filter(i=>S.gdone[i]).length;
    const pct=ids.length?Math.round(d/ids.length*100):0;
    const done=ids.length>0&&pct===100, act=st.stage===cs;
    return `<div class="stage ${done?'done':act?'act':''}">
      <div class="spread" style="align-items:flex-start">
        <div style="flex:1">
          <div class="stage-n">STAGE ${st.stage} · ${st.weeks}</div>
          <div class="stage-t">${st.name}</div>
          <div class="stage-g">${st.goal}</div>
        </div>
        <span class="badge ${done?'ok':act?'':'idle'}">${done?'✓ 完成':act?'进行中':'未开始'}</span>
      </div>
      ${ids.length?`<div class="miniprog"><i style="width:${pct}%"></i></div>
        <div class="muted" style="margin-top:6px;font-size:11.5px">${d}/${ids.length} 语法专题</div>
        <div style="margin-top:9px">${ids.map(id=>{const g=GRAM_MAP[id];
          return g?`<span class="chip ${S.gdone[id]?'on':''}" onclick="jumpGram('${id}')">${S.gdone[id]?'✓ ':''}${esc(g.title)}</span>`:''}).join('')}</div>`:''}
      <ul class="tasks">${st.tasks.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
      <div class="tipbox" style="margin-top:9px">💡 ${esc(st.tip)}</div>
    </div>`}).join('')}`;
}

/* ============================================================
   知识 Tab（数电=导图+章节 / 英语=语法+词汇）
   ============================================================ */
let mapTab='tree', vocabFilter={q:'',az:'',lv:0}, flashIdx=0, flashBack=false;

function renderMap(){
  document.getElementById('p-map').innerHTML = isEn()?mapEn():mapDl();
}

/* ---------- 数电：导图 + 章节 ---------- */
function mapDl(){
  return `
  <div class="tabs">
    <button class="${mapTab==='tree'?'on':''}" onclick="setMapTab('tree')">🧠 思维导图</button>
    <button class="${mapTab==='chap'?'on':''}" onclick="setMapTab('chap')">📖 章节详情</button>
  </div>
  <div id="mapBody">${mapTab==='tree'?dlTree():dlChaps()}</div>`;
}
function setMapTab(t){mapTab=t;renderMap();syncSubjUI();window.scrollTo({top:0})}

function dlTree(){
  return `<div class="card flat">
    <div class="mmtip">按大纲原文层级构建：<b>课程 → 章 → 知识点 → 具体考点</b>。
      标签颜色代表大纲要求的掌握层次。点击章节标题可展开/收起，点知识点跳转到详情打卡。</div>
    <div style="margin-top:10px">${Object.entries(LEVELS).map(([k,v])=>
      `<span class="lvtag" style="background:${v.color};margin-right:6px">${v.name}</span>`).join('')}</div>
  </div>
  ${SYLLABUS.map(c=>{
    const op=S.openFold['t-'+c.id], p=chapProg(c);
    return `<div class="fold ${op?'open':''}" id="fold-t-${c.id}">
      <div class="fold-h" onclick="toggleFold('t-${c.id}')">
        <div class="fold-num">${c.num}</div>
        <div style="flex:1"><div class="fold-t">${esc(c.title)}</div>
          <div class="fold-m">${c.nodes.length} 个知识点 · 约 ${c.weight} 分 · ${p.d} 已掌握</div></div>
        <span class="arw">›</span>
      </div>
      <div class="fold-b">
        <div class="mtree">${c.nodes.map(n=>`
          <div style="margin-bottom:9px">
            <div class="mnode ${S.done[n.id]?'d':'n'}" onclick="jumpNode('${n.id}')">
              ${S.done[n.id]?'✓ ':''}${esc(n.title)}
              <span class="lvtag" style="background:${LEVELS[n.level].color}">${LEVELS[n.level].name}</span>
            </div>
            ${n.points.map(x=>`<span class="mleaf">${esc(x)}</span>`).join('')}
          </div>`).join('')}</div>
      </div></div>`}).join('')}`;
}

function dlChaps(){
  return SYLLABUS.map(c=>{
    const p=chapProg(c),op=S.openFold['c-'+c.id];
    return `<div class="fold ${op?'open':''}" id="fold-c-${c.id}">
      <div class="fold-h" onclick="toggleFold('c-${c.id}')">
        <div class="fold-num">${c.num}</div>
        <div style="flex:1"><div class="fold-t">${esc(c.title)}</div>
          <div class="fold-m">${p.d}/${p.t} 知识点 · 约 ${c.weight} 分 · 建议 ${c.estHours} 小时</div></div>
        <span class="arw">›</span>
      </div>
      <div class="fold-b">
        <div class="raw"><b>【大纲原文 · 考试内容】</b><br>${esc(c.content)}</div>
        ${c.nodes.map(n=>`
          <div class="node ${S.done[n.id]?'done':''}" id="nd-${n.id}">
            <div class="node-h">
              <div class="chk" onclick="tog('${n.id}')">✓</div>
              <div class="node-t">${esc(n.title)}</div>
              <span class="lvtag" style="background:${LEVELS[n.level].color}">${LEVELS[n.level].name}</span>
            </div>
            <div class="raw" style="margin:6px 0"><b>大纲要求</b><br>${esc(n.raw)}</div>
            <ul class="pts">${n.points.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
            ${n.exam?`<div class="exam">🎯 <b>应试提示</b>：${esc(n.exam)}</div>`:''}
            <button class="btn sm line" style="margin-top:10px" onclick="event.stopPropagation();showDlDetail('${n.id}')">查看详细讲解</button>
            ${QUIZ_BANK[n.id]?`<button class="btn sm ghost" style="margin-top:10px"
              onclick="event.stopPropagation();startQuiz('${n.id}')">练习本知识点（${QUIZ_BANK[n.id].length} 题）</button>`:''}
          </div>`).join('')}
      </div></div>`}).join('');
}

/* ---------- 英语：语法 + 词汇 ---------- */
function mapEn(){
  return `
  <div class="tabs">
    <button class="${mapTab==='plan'?'on':''}" onclick="setMapTab('plan')">🎯 每日学习</button>
    <button class="${mapTab==='tree'?'on':''}" onclick="setMapTab('tree')">📐 语法体系</button>
    <button class="${mapTab==='wb'?'on':''}" onclick="setMapTab('wb')">🧬 构词法</button>
    <button class="${mapTab==='vocab'?'on':''}" onclick="setMapTab('vocab')">📚 词汇总览</button>
    <button class="${mapTab==='phr'?'on':''}" onclick="setMapTab('phr')">🔗 固定搭配</button>
  </div>
  <div id="mapBody">${
    mapTab==='vocab'?enVocab():
    mapTab==='plan'?(famView!==null?famListView():enPlan()):
    mapTab==='wb'?enWordBuild():
    mapTab==='phr'?enPhrases():enGrammar()}</div>`;
}

function enGrammar(){
  return `<div class="card flat"><div class="mmtip">
    10 个语法专题按<b>学习顺序</b>排列，不是按重要性。标 <span class="must">必修</span> 的是
    考试直接命题点，务必吃透；其余为理解性内容。点击展开查看要点，学完后打勾。
  </div></div>
  ${GRAMMAR.map((g,i)=>{
    const op=S.openFold['g-'+g.id];
    return `<div class="fold ${op?'open':''}" id="fold-g-${g.id}">
      <div class="fold-h" onclick="toggleFold('g-${g.id}')">
        <div class="chk ${S.gdone[g.id]?'':''}" style="${S.gdone[g.id]?'background:var(--ok);border-color:var(--ok);color:#fff':''}"
          onclick="event.stopPropagation();togGram('${g.id}')">✓</div>
        <div style="flex:1"><div class="fold-t">${i+1}. ${esc(g.title)}
          ${g.must?'<span class="must">必修</span>':''}</div>
          <div class="fold-m">${g.weeks} · ${g.points.length} 个要点</div></div>
        <span class="arw">›</span>
      </div>
      <div class="fold-b">
        <div class="why"><b>为什么要学这个？</b><br>${esc(g.why)}</div>
        ${g.points.map(p=>`<div class="gpt"><span class="k">${esc(p.k)}</span>
          <span class="v">${esc(p.v)}</span></div>`).join('')}
        ${g.exam?`<div class="exam" style="margin-top:10px">🎯 ${esc(g.exam)}</div>`:''}
        ${EN_QUIZ[g.id]?`<button class="btn sm ghost" style="margin-top:11px"
          onclick="event.stopPropagation();startQuiz('g:${g.id}')">练习本专题（${EN_QUIZ[g.id].length} 题）</button>`:''}
      </div></div>`}).join('')}`;
}

function enVocab(){
  const f=vocabFilter;
  let list=ALL_VOCAB;
  if(f.lv) list=list.filter(w=>w[3]===f.lv);
  if(f.az) list=list.filter(w=>w[0][0].toUpperCase()===f.az);
  if(f.q){const q=f.q.toLowerCase();
    list=list.filter(w=>w[0].toLowerCase().includes(q)||w[2].includes(f.q))}
  const show=list.slice(0,300);
  const AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return `
  <div class="card flat">
    <input class="srch" id="vq" placeholder="搜索单词或中文释义…" value="${esc(f.q)}"
      oninput="vSearch(this.value)">
    <div class="row" style="margin-bottom:8px">
      ${[[0,'全部'],[1,'L1 入门'],[2,'L2 高频'],[3,'L3 进阶'],[4,'L4 拓展']].map(([v,n])=>
        `<span class="chip ${f.lv===v?'on':''}" onclick="vLv(${v})">${n}</span>`).join('')}
    </div>
    <div class="azbar">
      <span class="${f.az===''?'on':''}" onclick="vAz('')">全</span>
      ${AZ.map(c=>`<span class="${f.az===c?'on':''}" onclick="vAz('${c}')">${c}</span>`).join('')}
    </div>
    <div class="muted">共 ${list.length} 词${list.length>300?'，显示前 300 个':''}　·　已掌握 ${Object.keys(S.known).length}</div>
  </div>
  <div class="card" style="padding:0">
    ${show.length?show.map(w=>`
      <div class="witem ${S.known[w[0]]?'known':''}" id="w-${esc(w[0])}">
        <div class="wl">
          <div class="ww">${esc(w[0])} <span class="wp">${esc(w[1])}</span></div>
          <div class="wm">${esc(w[2])}</div>
        </div>
        <button class="wbtn" onclick="togWord('${esc(w[0])}')">✓</button>
      </div>`).join(''):'<div class="empty"><div class="e">🔍</div><p>没有找到匹配的单词</p></div>'}
  </div>`;
}
function vSearch(v){vocabFilter.q=v;document.getElementById('mapBody').innerHTML=enVocab();
  const el=document.getElementById('vq');if(el){el.focus();el.setSelectionRange(v.length,v.length)}}
function vLv(v){vocabFilter.lv=v;document.getElementById('mapBody').innerHTML=enVocab()}
function vAz(c){vocabFilter.az=c;document.getElementById('mapBody').innerHTML=enVocab()}
function togWord(w){
  if(S.known[w]) delete S.known[w]; else {S.known[w]=1;checkStreak()}
  save();
  const el=document.getElementById('w-'+w);
  if(el) el.classList.toggle('known',!!S.known[w]);
  renderHome();
}

/* ============================================================
   每日计划 · 自适应学习（参考百词斩流程）
   新词：先学习卡认识 → 再测试
   旧词：直接按熟练度出对应难度的题
   ============================================================ */
let sess=null;  // {items:[], i:0, phase:'study'|'quiz', answered, picked, correct, right, wrong}

function enPlan(){
  if(!sess) return planHome();
  if(sess.i>=sess.items.length) return planDone();
  const it=sess.items[sess.i];
  return it.study?studyView(it):quizView(it);
}

/* ---------- 计划首页 ---------- */
function planHome(){
  const p=planToday(), t=todayLog(), doneN=todayCount();
  const fs=famStats();
  const pct=Math.min(100,Math.round(doneN/p.goal*100));
  const days=recentDays(7);
  const maxN=Math.max(10,...days.map(d=>d.n));
  const acc=(t.right+t.wrong)?Math.round(t.right/(t.right+t.wrong)*100):0;

  return `
  <div class="hero" style="margin-bottom:12px">
    <div class="spread">
      <div>
        <div class="lbl">今日进度</div>
        <div class="big">${doneN}<span style="font-size:17px;font-weight:600;opacity:.75"> / ${p.goal}</span></div>
      </div>
      <button class="goal-btn" onclick="showGoalEditor()">调整目标</button>
    </div>
    <div class="prog"><i style="width:${pct}%"></i></div>
    <div class="note" style="margin-top:7px">
      ${doneN>=p.goal?'🎉 今日目标已完成，可以继续加练':
        `还差 ${p.goal-doneN} 个　·　新词 ${p.fresh.length} + 复习 ${p.review.length}`}
    </div>
  </div>

  <div class="card">
    <div class="spread" style="margin-bottom:11px">
      <span style="font-weight:700;font-size:15px">开始今日学习</span>
      <span class="muted">${p.dueTotal} 词待复习</span>
    </div>
    <div class="plan-split">
      <div class="ps-item"><b style="color:var(--brand)">${p.fresh.length}</b><span>新词</span></div>
      <div class="ps-sep"></div>
      <div class="ps-item"><b style="color:var(--ok)">${p.review.length}</b><span>复习</span></div>
      <div class="ps-sep"></div>
      <div class="ps-item"><b style="color:var(--ink2)">${p.goal}</b><span>合计</span></div>
    </div>
    ${(p.fresh.length+p.review.length)?
      `<button class="btn full" style="margin-top:13px" onclick="planStart()">开始学习</button>`
      :`<div class="tipbox" style="margin-top:12px">今天没有到期的词了，休息一下，或点下方「额外加练」。</div>`}
    <div class="row" style="margin-top:8px">
      <button class="btn line sm" style="flex:1" onclick="planStart(true)">额外加练 20 个</button>
    </div>
    <div class="muted" style="margin-top:10px;font-size:11.5px">
      题型由系统按你对每个词的熟练度自动分配：陌生词给选择题，熟练词要求拼写。
    </div>
  </div>

  <div class="sec-t">词汇熟练度分布</div>
  <div class="card">
    ${(()=>{const learned=fs[1]+fs[2]+fs[3]+fs[4];
      return learned?`
      <div class="spread" style="margin-bottom:7px">
        <span class="muted" style="font-size:11.5px">已学 ${learned} 词的掌握情况</span>
        <span class="muted" style="font-size:11.5px">未学 ${fs[0]}</span>
      </div>
      <div class="fambar">
        ${[1,2,3,4].map(i=>fs[i]?`<i style="width:${fs[i]/learned*100}%;background:${FAM[i].color}"
          title="${FAM[i].name}"></i>`:'').join('')}
      </div>`:`
      <div class="muted" style="margin-bottom:11px">还没有开始背词，完成第一轮学习后这里会显示分布</div>`})()}
    <div class="famlist">
      ${FAM.map((f,i)=>`<div class="famrow" onclick="showFamList(${i})">
        <span class="fdot" style="background:${f.color}"></span>
        <span class="fname">${f.name}</span>
        <span class="fdesc">${f.desc}</span>
        <span class="fnum">${fs[i]}</span>
        <span class="arw">›</span>
      </div>`).join('')}
    </div>
  </div>

  <div class="sec-t">最近 7 天</div>
  <div class="card">
    <div class="chart">
      ${days.map(d=>{
        const h=d.n?Math.max(6,Math.round(d.n/maxN*88)):0;
        const hn=d.n?Math.round(d.newN/d.n*h):0;
        const wd=['日','一','二','三','四','五','六'][new Date(d.date+'T00:00:00').getDay()];
        return `<div class="cbar">
          <div class="cval">${d.n||''}</div>
          <div class="cstack" style="height:${h}px">
            ${d.revN?`<i style="height:${h-hn}px;background:var(--ok)"></i>`:''}
            ${d.newN?`<i style="height:${hn}px;background:var(--brand)"></i>`:''}
          </div>
          <div class="cday">${wd}</div>
        </div>`;
      }).join('')}
    </div>
    <div class="legend">
      <span><i style="background:var(--brand)"></i>新学</span>
      <span><i style="background:var(--ok)"></i>复习</span>
      ${(t.right+t.wrong)?`<span style="margin-left:auto;color:var(--ink3)">今日正确率 ${acc}%</span>`:''}
    </div>
  </div>

  ${(t.new.length||t.review.length)?`
  <div class="sec-t">今天背了什么</div>
  <div class="card">
    ${t.new.length?`<div class="tw-h">🆕 新学 ${t.new.length} 个</div>
      <div class="twrap">${t.new.map(w=>wordChip(w)).join('')}</div>`:''}
    ${t.review.length?`<div class="tw-h" style="margin-top:12px">🔁 复习 ${t.review.length} 个</div>
      <div class="twrap">${t.review.map(w=>wordChip(w)).join('')}</div>`:''}
  </div>`:''}`;
}
function wordChip(w){
  const f=famOf(w);
  return `<span class="wchip" style="border-color:${FAM[f].color}55;background:${FAM[f].color}1f;color:${FAM[f].color}"
    onclick="speak('${esc(w)}')" title="${FAM[f].name}">${esc(w)}</span>`;
}
function showGoalEditor(){
  const cur=(S.plan&&S.plan.goal)||30;
  const box=document.createElement('div'); box.className='goal-modal';
  box.innerHTML=`<div class="goal-sheet"><div class="goal-title">每日学习目标</div>
    <div class="muted">每天完成多少个单词？建议 20-50 个</div>
    <input id="goalInput" type="number" min="5" max="200" value="${cur}" inputmode="numeric">
    <div class="row"><button class="btn line" onclick="this.closest('.goal-modal').remove()">取消</button>
    <button class="btn" onclick="saveGoalFromUI()">保存目标</button></div></div>`;
  document.body.appendChild(box); setTimeout(()=>document.getElementById('goalInput').focus(),80);
}
function saveGoalFromUI(){
  const el=document.getElementById('goalInput'); const n=parseInt(el&&el.value,10);
  if(isNaN(n)||n<5||n>200){toast('请输入 5-200 之间的数字');return}
  S.plan=S.plan||{}; S.plan.goal=n; save();
  const m=document.querySelector('.goal-modal'); if(m)m.remove();
  document.getElementById('mapBody').innerHTML=enPlan(); renderHome(); toast('目标已改为每日 '+n+' 个');
}
function editGoal(){
  const cur=(S.plan&&S.plan.goal)||30;
  const v=prompt('每日学习目标（个单词）\n建议 20-50，贵在坚持', cur);
  if(v===null) return;
  const n=parseInt(v,10);
  if(isNaN(n)||n<5||n>200){toast('请输入 5-200 之间的数字');return}
  S.plan=S.plan||{}; S.plan.goal=n; save();
  document.getElementById('mapBody').innerHTML=enPlan();
  toast('目标已改为每日 '+n+' 个');
}

/* ---------- 熟练度词表 ---------- */
let famView=null;
function showFamList(lv){famView=lv;document.getElementById('mapBody').innerHTML=famListView();window.scrollTo({top:0})}
function famListView(){
  const f=FAM[famView];
  const list=ALL_VOCAB.filter(w=>famOf(w[0])===famView);
  const show=list.slice(0,200);
  return `
  <div class="spread" style="margin-bottom:12px">
    <div><span class="fdot" style="background:${f.color};display:inline-block"></span>
      <b style="font-size:16px;margin-left:6px">${f.name}</b>
      <span class="muted" style="margin-left:6px">${list.length} 词</span></div>
    <button class="btn line sm" onclick="closeFam()">返回</button>
  </div>
  <div class="card flat"><div class="muted">${f.desc}${list.length>200?'　·　显示前 200 个':''}</div></div>
  <div class="card" style="padding:0">
    ${show.length?show.map(w=>{
      const c=(S.srs||{})[w[0]];
      return `<div class="witem">
        <div class="wl">
          <div class="ww">${esc(w[0])} <span class="wp">${esc(w[1])}</span></div>
          <div class="wm">${esc(w[2])}</div>
          ${c?`<div class="wsrs">复习 ${c.seen||0} 次　·　错 ${c.wrong||0} 次　·　间隔 ${c.iv||0} 天</div>`:''}
        </div>
        <button class="wbtn" onclick="speak('${esc(w[0])}')">🔊</button>
      </div>`}).join('')
      :'<div class="empty"><div class="e">📭</div><p>这一档暂时没有单词</p></div>'}
  </div>`;
}
function closeFam(){famView=null;document.getElementById('mapBody').innerHTML=enPlan();window.scrollTo({top:0})}

/* ---------- 开始学习 ---------- */
function planStart(extra){
  const p=planToday();
  let items=[];
  if(extra){
    // 额外加练：优先取熟练度低的词
    const pool=ALL_VOCAB.filter(w=>famOf(w[0])>0).sort((a,b)=>famOf(a[0])-famOf(b[0]));
    const pick=pool.slice(0,60);
    items=shuffle(pick).slice(0,20).map(w=>{const q=adaptiveQuestion(w);q.isNew=false;return q});
    if(!items.length){toast('还没有学过的词，请先完成今日计划');return}
  } else {
    // 新词：学习卡 + 紧随其后的测试
    p.fresh.forEach(w=>{
      const sc=studyCard(w); sc.isNew=true; items.push(sc);
      const q=adaptiveQuestion(w); q.isNew=true; q.afterStudy=true; items.push(q);
    });
    // 复习词：直接出题
    p.review.forEach(w=>{const q=adaptiveQuestion(w); q.isNew=false; items.push(q)});
    if(!items.length){toast('今日没有需要学习的词');return}
  }
  sess={items,i:0,answered:false,picked:null,correct:false,right:0,wrong:0,extra:!!extra};
  document.getElementById('mapBody').innerHTML=enPlan();
  window.scrollTo({top:0});
  const f=sess.items[0];
  if(f.study) setTimeout(()=>speak(f.speakText),300);
  else if(f.form==='blank'&&f.type==='spell') setTimeout(()=>speak(f.speakText),350);
}

/* ---------- 新词学习卡 ---------- */
function studyView(it){
  return `
  ${sessBar()}
  <div class="card">
    <div class="stag">🆕 新词学习</div>
    <div class="qword" style="padding-top:8px">
      <div class="qw">${esc(it.word)}</div>
      <div class="qph">${esc(it.ph)}</div>
      <button class="spk" onclick="speak('${esc(it.speakText)}')">🔊 朗读</button>
      <button class="spk" onclick="speakSlow('${esc(it.speakText)}')">🐢 慢速</button>
    </div>
    <div class="smean">${esc(it.mean)}</div>
    <div class="muted" style="text-align:center;font-size:12px;margin-top:12px">
      先读两遍记住它，下一步会马上考你</div>
    <button class="btn full" style="margin-top:14px" onclick="sessNext()">记住了，继续 ›</button>
  </div>`;
}

/* ---------- 测试卡 ---------- */
function quizView(q){
  const tName={e2c:'英译汉',c2e:'汉译英',spell:'拼写'}[q.type];
  const fName=q.form==='choice'?'选择':'填空';
  const f=FAM[q.fam||0];
  return `
  ${sessBar()}
  <div class="card">
    <div class="spread" style="margin-bottom:10px">
      <span class="muted" style="font-weight:700">${q.title}</span>
      <span class="ftag" style="background:${f.color}18;color:${f.color}">${f.name} · ${tName}${fName}</span>
    </div>
    <div class="qword">
      <div class="qw">${esc(q.ask)}</div>
      ${q.askSub&&q.type!=='c2e'?`<div class="qph">${esc(q.askSub)}</div>`:''}
      ${q.type!=='c2e'||sess.answered?
        `<button class="spk" onclick="speak('${esc(q.speakText)}')">🔊 朗读</button>
         <button class="spk" onclick="speakSlow('${esc(q.speakText)}')">🐢 慢速</button>`:''}
    </div>
    ${q.form==='choice'?`
      <div class="opts">
        ${q.options.map((o,i)=>{
          let cls='';
          if(sess.answered){
            if(o===q.answer) cls='ok';
            else if(o===sess.picked) cls='no';
          }
          return `<button class="opt ${cls}" onclick="sessPick('${esc(o).replace(/'/g,"\\'")}')"
            ${sess.answered?'disabled':''}>
            <span class="oi">${'ABCD'[i]}</span><span class="ot">${esc(o)}</span></button>`;
        }).join('')}
      </div>`
    :`
      <input class="ans-in" id="sessIn" style="min-height:auto;margin-top:4px;font-family:${q.type==='e2c'?'inherit':"'SF Mono',Menlo,monospace"}"
        placeholder="${q.type==='e2c'?'输入中文意思…':'输入英文单词…'}"
        ${sess.answered?'disabled':''} value="${sess.answered?esc(sess.picked||''):''}"
        onkeydown="if(event.key==='Enter')sessSubmit()">
      ${!sess.answered?`<button class="btn full" style="margin-top:10px" onclick="sessSubmit()">提交</button>`:''}
    `}
    ${sess.answered?`
      <div class="fb ${sess.correct?'ok':'no'}">
        <div class="fb-h">${sess.correct?'✓ 回答正确':'✗ 回答错误'}</div>
        <div class="fb-b"><b>${esc(q.word)}</b> <span class="qph">${esc(q.ph)}</span><br>
          ${esc((ALL_VOCAB.find(x=>x[0]===q.word)||['','',''])[2])}</div>
        ${!sess.correct&&q.form==='blank'?`<div class="fb-b" style="margin-top:5px">
          你的答案：${esc(sess.picked||'')}</div>`:''}
        <div class="fb-b" style="margin-top:6px;font-size:12px;color:var(--ink3)">
          ${nextIvText(q.word)}</div>
      </div>
      <button class="btn full" style="margin-top:11px" onclick="sessNext()">
        ${sess.i>=sess.items.length-1?'完成学习':'下一个 ›'}</button>`:''}
  </div>`;
}
function sessBar(){
  const p=Math.round(sess.i/sess.items.length*100);
  return `
  <div class="spread" style="margin-bottom:9px">
    <span class="muted">${sess.i+1} / ${sess.items.length}　·　对 ${sess.right} 错 ${sess.wrong}</span>
    <button class="btn line sm" onclick="sessQuit()">退出</button>
  </div>
  <div class="miniprog" style="margin-bottom:12px"><i style="width:${p}%"></i></div>`;
}
function nextIvText(word){
  const c=(S.srs||{})[word];
  if(!c) return '';
  if(c.iv<=0) return '这个词今天会再出现一次';
  if(c.iv===1) return '明天会再考你一次';
  return `下次复习：${c.iv} 天后`;
}

function sessPick(o){
  if(sess.answered) return;
  const q=sess.items[sess.i];
  sess.picked=o; sess.correct=(o===q.answer);
  sessGrade(q);
}
function sessSubmit(){
  if(sess.answered) return;
  const el=document.getElementById('sessIn');
  const v=el?el.value:'';
  if(!v.trim()){toast('请先输入答案');return}
  const q=sess.items[sess.i];
  sess.picked=v; sess.correct=checkAnswer(q,v);
  sessGrade(q);
}
function sessGrade(q){
  sess.answered=true;
  if(sess.correct) sess.right++; else sess.wrong++;
  S.srs=S.srs||{};
  // 新词刚学完就答对 → 记为「想了一下」；旧词答对 → 视填空/选择给不同权重
  let grade;
  if(!sess.correct) grade=0;
  else if(q.afterStudy) grade=2;
  else grade=(q.form==='blank')?3:2;
  S.srs[q.word]=SRS.grade(S.srs[q.word],grade);
  if(sess.correct) S.known[q.word]=1; else delete S.known[q.word];
  logWord(q.word, !!q.isNew, sess.correct);
  checkStreak(); save();
  document.getElementById('mapBody').innerHTML=enPlan();
  if(!sess.correct) speak(q.speakText);
  renderHome();
}
function sessNext(){
  sess.i++; sess.answered=false; sess.picked=null; sess.correct=false;
  document.getElementById('mapBody').innerHTML=enPlan();
  window.scrollTo({top:0});
  const it=sess.items[sess.i];
  if(!it) return;
  if(it.study) setTimeout(()=>speak(it.speakText),300);
  else if(it.form==='blank'&&it.type==='spell') setTimeout(()=>speak(it.speakText),350);
}
function planDone(){
  const total=sess.right+sess.wrong;
  const acc=total?Math.round(sess.right/total*100):0;
  const doneN=todayCount(), goal=(S.plan&&S.plan.goal)||30;
  const reach=doneN>=goal;
  return `<div class="card" style="text-align:center;padding:32px 20px">
    <div style="font-size:44px;margin-bottom:10px">${reach?'🎉':acc>=80?'👍':'💪'}</div>
    <div style="font-size:19px;font-weight:700;margin-bottom:4px">
      ${reach?'今日目标达成':'本轮完成'}</div>
    <div class="muted" style="margin-bottom:5px">
      答对 ${sess.right} / ${total}　·　正确率 ${acc}%</div>
    <div class="muted" style="margin-bottom:18px;font-size:12px">
      今日累计 ${doneN} / ${goal} 个　${reach?'':'　还差 '+(goal-doneN)+' 个'}</div>
    <div class="row" style="justify-content:center">
      <button class="btn" onclick="sessQuit()">查看统计</button>
      <button class="btn ghost" onclick="planStart(true)">再练 20 个</button>
    </div></div>`;
}
function sessQuit(){sess=null;document.getElementById('mapBody').innerHTML=enPlan();window.scrollTo({top:0});renderHome()}

function enPhrases(){
  const f=vocabFilter;
  let list=PHRASES;
  if(f.q){const q=f.q.toLowerCase();
    list=list.filter(p=>p[0].toLowerCase().includes(q)||p[1].includes(f.q))}
  return `
  <div class="card flat">
    <input class="srch" placeholder="搜索词组或中文…" value="${esc(f.q)}" oninput="pSearch(this.value)">
    <div class="mmtip">共 ${PHRASES.length} 个高频固定搭配。这类题不会就是不会，
      靠理解没用，必须背。建议每天 10 个，滚动复习。</div>
  </div>
  <div class="card" style="padding:0">
    ${list.length?list.map(p=>`
      <div class="witem ${S.known[p[0]]?'known':''}" id="w-${esc(p[0]).replace(/\s/g,'_')}">
        <div class="wl">
          <div class="ww" style="font-size:14px">${esc(p[0])}</div>
          <div class="wm">${esc(p[1])}</div>
        </div>
        <button class="wbtn" onclick="togWord('${esc(p[0])}')">✓</button>
      </div>`).join(''):'<div class="empty"><div class="e">🔍</div><p>没有找到</p></div>'}
  </div>`;
}
function pSearch(v){vocabFilter.q=v;document.getElementById('mapBody').innerHTML=enPhrases()}

/* ---------- 折叠 / 打卡 ---------- */
function toggleFold(id){
  S.openFold[id]=!S.openFold[id];save();
  const el=document.getElementById('fold-'+id);
  if(el) el.classList.toggle('open');
}
function tog(id){
  S.done[id]=!S.done[id];
  if(S.done[id]) checkStreak();
  save();
  const el=document.getElementById('nd-'+id);
  if(el) el.classList.toggle('done',!!S.done[id]);
  toast(S.done[id]?'已标记掌握 ✓':'已取消标记');
  renderHome();
}
function togGram(id){
  S.gdone[id]=!S.gdone[id];
  if(S.gdone[id]) checkStreak();
  save();
  toast(S.gdone[id]?'专题已完成 ✓':'已取消标记');
  renderMap(); renderHome();
}
function showDlDetail(id){
  const n=DL_MAP[id], ch=SYLLABUS.find(c=>c.nodes.some(x=>x.id===id)), L=DL_LESSONS[id];
  if(!n||!ch||!L)return;
  const q=QUIZ_BANK[id];
  const box=document.createElement('div');box.className='detail-modal';
  box.innerHTML=`<div class="detail-sheet"><div class="spread"><div><div class="detail-ch">第${ch.num}章 · ${esc(ch.title)}</div><div class="detail-title">${esc(n.title)}</div></div><button class="close-detail" onclick="this.closest('.detail-modal').remove()">×</button></div>
    <div class="detail-level" style="color:${LEVELS[n.level].color}">${LEVELS[n.level].name} · ${LEVELS[n.level].desc}</div>
    <div class="lesson-goal"><b>为什么现在学它？</b><p>${esc(L.why)}</p></div>
    <div class="detail-section"><b>大纲要求</b><p>${esc(n.raw)}</p></div>
    ${L.teach.map((x,i)=>`<div class="lesson-step"><div class="step-no">${i+1}</div><div><b>${esc(x[0])}</b><p>${esc(x[1])}</p></div></div>`).join('')}
    <div class="lesson-example"><b>举个例子</b><p>${esc(L.example)}</p></div>
    <div class="detail-section"><b>常见错误</b><ul>${L.mistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="lesson-check"><b>学完自测</b><p>${esc(L.check)}</p><button class="btn sm ghost" onclick="toast('先在纸上回答，再对照章节题目')">我想好了</button></div>
    <div class="lesson-next"><span>下一步</span><b>${L.next?(DL_MAP[L.next]?esc(DL_MAP[L.next].title):'继续学习'):'本章完成，进入复习'}</b></div>
    ${q?`<button class="btn full" onclick="this.closest('.detail-modal').remove();startQuiz('${id}')">练习本知识点（${q.length}题）</button>`:''}
  </div>`;document.body.appendChild(box);
}
function jumpNode(id){
  const ch=SYLLABUS.find(c=>c.nodes.some(n=>n.id===id));
  if(!ch) return;
  mapTab='chap'; S.openFold['c-'+ch.id]=true; save();
  go('map');
  setTimeout(()=>{
    const el=document.getElementById('nd-'+id);
    if(el){el.scrollIntoView({behavior:'smooth',block:'center'});
      el.style.transition='background .4s'; el.style.background='var(--warm-l)';
      setTimeout(()=>el.style.background='',1300)}
  },80);
}
function jumpGram(id){
  mapTab='tree'; S.openFold['g-'+id]=true; save();
  go('map');
  setTimeout(()=>{
    const el=document.getElementById('fold-g-'+id);
    if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
  },80);
}

/* ============================================================
   测验
   ============================================================ */
function renderQuiz(){
  if(Q.list.length){renderQCard();return}
  document.getElementById('p-quiz').innerHTML = isEn()?quizEnHome():quizDlHome();
}

function quizDlHome(){
  let total=0; for(const k in QUIZ_BANK) total+=QUIZ_BANK[k].length;
  return `
  <div class="card flat" style="background:var(--warm-l);border:none">
    <div style="font-size:13.5px;font-weight:700;color:#856016;margin-bottom:5px">📝 全部为主观题</div>
    <div style="font-size:12.5px;color:#856016;line-height:1.7">
      大纲规定「无选择题、无判断题，主要为主观题」，所以这里不设选项。
      正确做法：<b>先在纸上完整写出解题过程</b>，再展开解析对照，然后如实评价掌握程度。
      骗自己没有意义，考场上只认写在卷面上的推导。</div>
  </div>
  <div class="row" style="margin-bottom:12px">
    <button class="btn" onclick="startQuiz('all')">全部随机（${total} 题）</button>
    ${S.wrongs.length?`<button class="btn ghost" onclick="startQuiz('wrong')">攻克错题（${S.wrongs.length}）</button>`:''}
  </div>
  <div class="sec-t">按难度专项</div>
  <div class="card">
    <div class="muted" style="margin-bottom:10px">难度分布：较易45% / 中等35% / 较难20%。
      基础薄弱先把「较易」做熟，这是 45 分的基本盘。</div>
    <div class="row">
      <button class="btn sm" style="background:#5b9279" onclick="startQuiz('d1')">较易专项</button>
      <button class="btn sm" style="background:#d9a441" onclick="startQuiz('d2')">中等专项</button>
      <button class="btn sm" style="background:#c1666b" onclick="startQuiz('d3')">较难专项</button>
    </div>
  </div>
  <div class="sec-t">按章节训练</div>
  ${SYLLABUS.map(c=>{
    const ns=c.nodes.filter(n=>QUIZ_BANK[n.id]); if(!ns.length) return '';
    const cnt=ns.reduce((a,n)=>a+QUIZ_BANK[n.id].length,0);
    return `<div class="card" style="padding:13px 15px"><div class="spread">
      <div><div style="font-size:14px;font-weight:600">第${c.num}章 ${esc(c.title)}</div>
        <div class="muted">${cnt} 道主观题</div></div>
      <button class="btn sm ghost" onclick="startQuiz('ch:${c.id}')">练习</button>
    </div></div>`}).join('')}`;
}

function quizEnHome(){
  let total=0; for(const k in EN_QUIZ) total+=EN_QUIZ[k].length;
  return `
  <div class="card flat" style="background:var(--brand-l);border:none">
    <div style="font-size:13.5px;font-weight:700;color:var(--brand);margin-bottom:5px">📝 语法专项训练</div>
    <div style="font-size:12.5px;color:var(--ink2);line-height:1.7">
      题目以填空、改错、句型转换为主，贴近「词汇与结构」25 分的考查方式。
      做题时<b>先自己写出答案再看解析</b>，解析里给出了完整的判断依据和同类扩展。</div>
  </div>
  <div class="row" style="margin-bottom:12px">
    <button class="btn" onclick="startQuiz('all')">全部随机（${total} 题）</button>
    ${S.wrongsEn.length?`<button class="btn ghost" onclick="startQuiz('wrong')">攻克错题（${S.wrongsEn.length}）</button>`:''}
  </div>
  <div class="sec-t">按语法专题</div>
  ${GRAMMAR.filter(g=>EN_QUIZ[g.id]).map(g=>`
    <div class="card" style="padding:13px 15px"><div class="spread">
      <div><div style="font-size:14px;font-weight:600">${esc(g.title)}
        ${g.must?'<span class="must">必修</span>':''}</div>
        <div class="muted">${EN_QUIZ[g.id].length} 题 · ${g.weeks}</div></div>
      <button class="btn sm ghost" onclick="startQuiz('g:${g.id}')">练习</button>
    </div></div>`).join('')}`;
}

function startQuiz(mode){
  const bank=isEn()?EN_QUIZ:QUIZ_BANK;
  const wrongs=isEn()?S.wrongsEn:S.wrongs;
  let list=[];
  if(mode==='all'){
    for(const k in bank) bank[k].forEach((q,i)=>list.push({nid:k,qi:i,...q}));
    list.sort(()=>Math.random()-.5);
  } else if(mode==='wrong'){
    list=wrongs.map(w=>{const q=bank[w.nid]&&bank[w.nid][w.qi];
      return q?{nid:w.nid,qi:w.qi,...q}:null}).filter(Boolean);
  } else if(mode.startsWith('d')&&!isEn()){
    const d=+mode[1];
    for(const k in bank) bank[k].forEach((q,i)=>{if(q.d===d)list.push({nid:k,qi:i,...q})});
    list.sort(()=>Math.random()-.5);
  } else if(mode.startsWith('ch:')){
    const ch=SYLLABUS.find(c=>c.id===mode.slice(3));
    if(ch) ch.nodes.forEach(n=>(bank[n.id]||[]).forEach((q,i)=>list.push({nid:n.id,qi:i,...q})));
  } else if(mode.startsWith('g:')){
    const g=mode.slice(2);
    (bank[g]||[]).forEach((q,i)=>list.push({nid:g,qi:i,...q}));
  } else {
    (bank[mode]||[]).forEach((q,i)=>list.push({nid:mode,qi:i,...q}));
  }
  if(!list.length){toast('该分类暂无题目');return}
  Q={list,i:0,mode}; go('quiz'); renderQCard(); window.scrollTo({top:0});
}

function renderQCard(){
  const q=Q.list[Q.i];
  const label=isEn()?(GRAM_MAP[q.nid]?GRAM_MAP[q.nid].title:''):(DL_MAP[q.nid]?DL_MAP[q.nid].title:'');
  const dc=['','#5b9279','#d9a441','#c1666b'][q.d]||'#8e99a6';
  const dn=['','较易','中等','较难'][q.d]||'';
  const tn={fill:'填空计算',step:'分步推导',design:'设计题'}[q.t]||'主观题';
  document.getElementById('p-quiz').innerHTML=`
  <div class="card">
    <div class="qmeta">
      <div class="muted">第 ${Q.i+1} / ${Q.list.length} 题　·　${esc(label)}</div>
      ${dn?`<span class="dtag" style="background:${dc}">${dn}</span>`:''}
    </div>
    ${!isEn()?`<div class="muted" style="margin-bottom:8px">题型：${tn}</div>`:''}
    <div class="qtxt">${esc(q.q)}</div>
    <textarea class="ans-in" placeholder="${isEn()?'写下你的答案…':'先在纸上写出完整过程，这里可记录最终答案或思路要点…'}"></textarea>
    <div class="row" style="margin-top:11px">
      <button class="btn sm ghost" onclick="document.getElementById('hint').classList.toggle('on')">💡 提示</button>
      <button class="btn sm" onclick="showSol()" id="btnSol">查看解析</button>
    </div>
    <div class="hintbox" id="hint">${esc(q.hint||'暂无提示')}</div>
    <div class="sol" id="sol">
      <div class="sol-t">参考答案</div><pre>${esc(q.a)}</pre>
      <div class="sol-t" style="margin-top:12px">完整解析</div><pre>${esc(q.sol)}</pre>
      <div class="sol-t" style="margin-top:14px">对照解析，如实评价掌握程度</div>
      <div class="selfrate">
        <button class="sr-bad" onclick="rate(0)">完全不会</button>
        <button class="sr-mid" onclick="rate(1)">思路对<br>过程有错</button>
        <button class="sr-ok" onclick="rate(2)">完全正确</button>
      </div>
    </div>
  </div>
  <div class="row">
    <button class="btn line sm" onclick="quitQuiz()">退出</button>
    ${Q.i>0?`<button class="btn line sm" onclick="Q.i--;renderQCard()">上一题</button>`:''}
    <button class="btn ghost sm" onclick="nextQ()">跳过 ›</button>
  </div>`;
}
function showSol(){
  document.getElementById('sol').classList.add('on');
  document.getElementById('btnSol').disabled=true;
  document.getElementById('sol').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function rate(r){
  const q=Q.list[Q.i];
  checkStreak(); S.totalQ++; if(r===2) S.rightQ++;
  const wrongs=isEn()?S.wrongsEn:S.wrongs;
  const idx=wrongs.findIndex(w=>w.nid===q.nid&&w.qi===q.qi);
  if(r<2){
    if(idx>=0) wrongs[idx].times++;
    else wrongs.push({nid:q.nid,qi:q.qi,q:q.q,times:1,ts:Date.now()});
  } else if(idx>=0){wrongs.splice(idx,1);toast('已从错题本移除 ✓')}
  save(); setTimeout(nextQ,300);
}
function nextQ(){
  if(Q.i<Q.list.length-1){Q.i++;renderQCard();window.scrollTo({top:0,behavior:'smooth'})}
  else finishQuiz();
}
function finishQuiz(){
  const n=Q.list.length, wrongs=isEn()?S.wrongsEn:S.wrongs;
  document.getElementById('p-quiz').innerHTML=`
  <div class="card" style="text-align:center;padding:34px 20px">
    <div style="font-size:42px;margin-bottom:12px">🎉</div>
    <div style="font-size:19px;font-weight:700;margin-bottom:5px">本轮练习完成</div>
    <div class="muted" style="margin-bottom:20px">共完成 ${n} 道题</div>
    <div class="row" style="justify-content:center">
      <button class="btn" onclick="quitQuiz()">返回题库</button>
      ${wrongs.length?`<button class="btn ghost" onclick="startQuiz('wrong')">攻克错题(${wrongs.length})</button>`:''}
    </div></div>`;
  Q={list:[],i:0,mode:null}; renderHome();
}
function quitQuiz(){Q={list:[],i:0,mode:null};renderQuiz();window.scrollTo({top:0})}

/* ============================================================
   我的
   ============================================================ */
function renderMe(){
  const wrongs=isEn()?S.wrongsEn:S.wrongs;
  const bank=isEn()?EN_QUIZ:QUIZ_BANK;
  const nameOf=nid=>isEn()?(GRAM_MAP[nid]?GRAM_MAP[nid].title:''):(DL_MAP[nid]?DL_MAP[nid].title:'');
  document.getElementById('p-me').innerHTML=`
  <div class="sec-t">错题本 · ${isEn()?'大学英语':'数字电路'}</div>
  ${wrongs.length?`
    <div class="card" style="padding:12px 14px"><div class="spread">
      <span class="muted">共 ${wrongs.length} 道，按错误次数排序</span>
      <button class="btn sm" onclick="startQuiz('wrong')">开始攻克</button></div></div>
    ${[...wrongs].sort((a,b)=>b.times-a.times).map(w=>`
      <div class="wrong"><div class="wrong-q">${esc(w.q)}</div>
        <div class="wrong-m"><span>${esc(nameOf(w.nid))} · 错 ${w.times} 次</span>
          <button class="btn sm line" onclick="delWrong('${w.nid}',${w.qi})">移除</button>
        </div></div>`).join('')}
  `:`<div class="card"><div class="empty"><div class="e">📖</div>
      <p>错题本是空的<br>做题时如实评价，没做对的会自动收进来</p></div></div>`}

  ${isEn()?meEnRef():meDlRef()}

  <div class="sec-t">数据管理</div>
  <div class="card">
    <div class="row">
      <button class="btn sm ghost" onclick="expData()">导出进度</button>
      <button class="btn sm ghost" onclick="impData()">导入进度</button>
      <button class="btn sm" style="background:var(--bad)" onclick="resetAll()">清空数据</button>
    </div>
    <div class="muted" style="margin-top:11px">
      数据保存在本机浏览器，清除浏览器数据会丢失，建议定期导出备份。<br>
      当前：数电 ${dlStats().done} 知识点 / 英语 ${enStats().gDone} 语法专题 / ${Object.keys(S.known).length} 词已掌握</div>
  </div>`;
}
function meDlRef(){
  const M=EXAM_META;
  return `<div class="sec-t">主要参考书目</div>
  <div class="card">
    <div class="muted" style="margin-bottom:11px">以下为大纲第六部分指定书目，第一本为主要教材。</div>
    ${M.refs.map(r=>`<div class="ref ${r.primary?'main':''}">
      ${r.primary?'<div class="ref-tag">主要教材</div>':''}
      <div class="ref-t">${esc(r.title)}</div>
      <div class="ref-a">${esc(r.authors)}</div>
      <div class="ref-p">${esc(r.press)}　${r.year} 年版</div></div>`).join('')}
    <div class="tipbox">💡 以欧阳星明版为主线逐章精读，每章读完立刻回到本站对应章节打卡并做题。
      万国春版可作为看不懂时的第二种讲法参考，不必通读。</div>
  </div>
  <div class="sec-t">大纲原文要点</div>
  <div class="card">
    <div class="muted" style="font-weight:700;margin-bottom:4px">一、考试性质</div>
    <div style="font-size:12.5px;color:var(--ink2);line-height:1.75;margin-bottom:13px">${esc(M.nature)}</div>
    <div class="muted" style="font-weight:700;margin-bottom:4px">二、考试基本要求</div>
    <div style="font-size:12.5px;color:var(--ink2);line-height:1.75;margin-bottom:13px">${esc(M.basicReq)}</div>
    <div class="muted" style="font-weight:700;margin-bottom:4px">五、命题要求</div>
    <div style="font-size:12.5px;color:var(--ink2);line-height:1.75">
      命题范围涵盖所有章节，难易程度：较易 45%，中等 35%，较难 20%。
      <b style="color:var(--bad)">题型范围无选择题、无判断题，主要为主观题。</b></div>
  </div>`;
}
function meEnRef(){
  const M=EN_META;
  return `<div class="sec-t">备考资源与方法</div>
  <div class="card">
    <div class="ref main"><div class="ref-tag">命题依据</div>
      <div class="ref-t">高职高专教育英语课程教学基本要求（试行）</div>
      <div class="ref-a">B 级标准（听力部分除外）</div>
      <div class="ref-p">这是湖北专升本《大学英语》的命题基准</div></div>
    <div class="ref"><div class="ref-t">历年真题</div>
      <div class="ref-a">湖北省教育考试院 / 各招生院校官网</div>
      <div class="ref-p">真题是最重要的资料，务必反复做透</div></div>
    <div class="ref"><div class="ref-t">配套教材</div>
      <div class="ref-a">各院校指定的《大学英语》教材</div>
      <div class="ref-p">以报考院校当年公布的考纲与指定教材为准</div></div>
    <div class="tipbox">💡 <b>方法建议</b>：语法先行，词汇每天不断线。
      阅读从精读起步——一篇文章查完所有生词、拆完所有长句，胜过泛读十篇。
      作文考前两周背 3 类模板（书信/通知/议论）即可应对。</div>
  </div>
  <div class="sec-t">题型分值构成</div>
  <div class="card">
    ${M.sections.map(x=>`<div class="gpt">
      <span class="k" style="color:${x.color}">${x.name} ${x.score}分</span>
      <span class="v">${esc(x.detail)}</span></div>`).join('')}
    <div class="warnbox" style="margin-top:11px">⚠️ ${esc(M.note)}</div>
  </div>`;
}
function delWrong(nid,qi){
  const wrongs=isEn()?S.wrongsEn:S.wrongs;
  const arr=wrongs.filter(w=>!(w.nid===nid&&w.qi===qi));
  if(isEn()) S.wrongsEn=arr; else S.wrongs=arr;
  save(); renderMe(); renderHome(); toast('已移除');
}
function expData(){
  const s=JSON.stringify(S);
  if(navigator.clipboard) navigator.clipboard.writeText(s).then(
    ()=>toast('进度已复制到剪贴板'),()=>prompt('复制以下内容：',s));
  else prompt('复制以下内容：',s);
}
function impData(){
  const s=prompt('粘贴之前导出的进度数据：'); if(!s) return;
  try{S=Object.assign(JSON.parse(JSON.stringify(DEF)),JSON.parse(s));save();renderAll();toast('导入成功')}
  catch(e){toast('数据格式错误')}
}
function resetAll(){
  if(!confirm('确定清空全部学习进度？此操作不可恢复。')) return;
  S=JSON.parse(JSON.stringify(DEF));save();renderAll();toast('已重置');
}

/* ============================================================
   路由
   ============================================================ */
const R={home:renderHome,path:renderPath,map:renderMap,quiz:renderQuiz,me:renderMe};
const TITLE={
  dl:{home:'数字电路与逻辑设计',path:'零基础学习路径',map:'知识点与思维导图',quiz:'主观题训练',me:'我的备考中心'},
  en:{home:'大学英语',path:'零基础学习路径',map:'语法与词汇',quiz:'语法专项训练',me:'我的备考中心'}
};
const SUB={dl:'武昌首义学院 2025 专升本考试大纲',en:'湖北省普通高等教育专升本考试大纲'};
let curPage='home';

/* 科目相关的 UI 状态统一同步，避免各入口不一致 */
function syncSubjUI(){
  document.body.classList.toggle('en-mode',S.subj==='en');
  document.querySelectorAll('.subj button')
    .forEach(b=>b.classList.toggle('on',b.dataset.s===S.subj));
}
function go(p){
  curPage=p;
  syncSubjUI();
  document.querySelectorAll('.page').forEach(e=>e.classList.remove('on'));
  document.getElementById('p-'+p).classList.add('on');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('on',b.dataset.p===p));
  document.getElementById('topTitle').textContent=TITLE[S.subj][p];
  document.getElementById('topSub').textContent=SUB[S.subj];
  R[p](); window.scrollTo({top:0});
}
function setSubj(s){
  if(S.subj===s) return;
  S.subj=s; save();
  mapTab=(s==='en')?'plan':'tree';
  famView=null; sess=null;
  vocabFilter={q:'',az:'',lv:0};
  flashIdx=0; flashBack=false;
  Q={list:[],i:0,mode:null};
  go(curPage);
  toast(s==='en'?'已切换到大学英语':'已切换到数字电路');
}
function renderAll(){syncSubjUI();renderHome();renderPath();renderMap();renderQuiz();renderMe()}

document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.p));
document.querySelectorAll('.subj button').forEach(b=>b.onclick=()=>setSubj(b.dataset.s));

/* 初始化 */
(function init(){
  if(S.lastDay&&S.lastDay!==today()){
    const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
    if(S.lastDay!==y) S.streak=0;
  }
  document.getElementById('streak').textContent='🔥 '+S.streak+' 天';
  syncSubjUI();
  go('home'); save();
})();
