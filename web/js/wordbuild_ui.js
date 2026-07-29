/* ============================================================
   构词法 · 同义替换 · 真题词汇 —— 界面渲染层
   挂载点：英语知识页新增「构词法」Tab
   ============================================================ */

let wbTab = 'root';      // root | prefix | suffix | syn | exam | quiz
let wbOpen = {};          // 折叠状态
let wbQuizIdx = 0, wbQuizDone = false;

/* ---------- 主入口 ---------- */
function enWordBuild(){
  const tabs = [
    ['root','词根','🌳'],['prefix','前缀','◀'],['suffix','后缀','▶'],
    ['syn','同义替换','🔄'],['exam','真题词汇','📌'],['quiz','构词练习','✏️']
  ];
  return `
  <div class="wb-nav">
    ${tabs.map(t=>`<button class="${wbTab===t[0]?'on':''}" onclick="setWbTab('${t[0]}')">
      <i>${t[2]}</i><span>${t[1]}</span></button>`).join('')}
  </div>
  <div id="wbBody">${wbRender()}</div>`;
}
function setWbTab(t){ wbTab=t; wbQuizIdx=0; wbQuizDone=false;
  const b=document.getElementById('wbBody'); if(b)b.innerHTML=wbRender();
  document.querySelectorAll('.wb-nav button').forEach(x=>x.classList.remove('on'));
  const btn=[...document.querySelectorAll('.wb-nav button')].find(x=>x.getAttribute('onclick').includes("'"+t+"'"));
  if(btn)btn.classList.add('on');
  window.scrollTo({top:0});
}
function wbRender(){
  switch(wbTab){
    case 'root':   return wbRoots();
    case 'prefix': return wbAffix(PREFIXES,'p','前缀加在词首，改变意思');
    case 'suffix': return wbAffix(SUFFIXES,'s','后缀加在词尾，决定词性 —— 语法填空的命根子');
    case 'syn':    return wbSyn();
    case 'exam':   return wbExam();
    case 'quiz':   return wbQuiz();
  }
}
function wbFold(id){ wbOpen[id]=!wbOpen[id];
  const b=document.getElementById('wbBody'); if(b)b.innerHTML=wbRender(); }

/* ---------- 1. 词根 ---------- */
function wbRoots(){
  return `
  <div class="wb-intro">
    <b>为什么先学词根</b>
    <p>3000 个单词不是 3000 件独立的事。掌握 15 个高频词根，能一次串起 84 个词。
    看到生词先拆，比硬背快得多。</p>
  </div>
  ${ROOTS.map((r,i)=>{
    const id='r'+i, on=wbOpen[id];
    return `<div class="wb-card">
      <div class="wb-head" onclick="wbFold('${id}')">
        <div class="wb-key">${r.r}</div>
        <div class="wb-mean"><b>${r.mean}</b><span>${r.words.length} 个派生词</span></div>
        <div class="wb-arrow ${on?'up':''}">▾</div>
      </div>
      ${on?`<div class="wb-body">
        <div class="wb-from">词源：${r.from}</div>
        ${r.words.map(w=>`<div class="wb-word">
          <div class="ww-top"><b>${w[0]}</b><button class="ww-spk" onclick="event.stopPropagation();speak('${w[0]}')">🔊</button></div>
          <div class="ww-split">${w[1]}</div>
          <div class="ww-def">${w[2]}</div>
        </div>`).join('')}
        <div class="wb-tip">💡 ${r.tip}</div>
      </div>`:''}
    </div>`;
  }).join('')}`;
}

/* ---------- 2/3. 前后缀 ---------- */
function wbAffix(list,pre,intro){
  return `
  <div class="wb-intro"><b>${pre==='p'?'前缀改变意思':'后缀决定词性'}</b><p>${intro}</p></div>
  ${list.map((a,i)=>{
    const id=pre+i, on=wbOpen[id], key=a.p||a.s;
    return `<div class="wb-card">
      <div class="wb-head" onclick="wbFold('${id}')">
        <div class="wb-key ${pre==='s'?'suf':''}">${key}</div>
        <div class="wb-mean"><b>${a.mean}</b>${a.pos?`<span class="wb-pos">${a.pos}</span>`:''}</div>
        <div class="wb-arrow ${on?'up':''}">▾</div>
      </div>
      ${on?`<div class="wb-body">
        ${a.ex.map(e=>`<div class="wb-ex">
          <span class="ex-l">${e[0]}</span><span class="ex-r">${e[1]}</span></div>`).join('')}
        <div class="wb-tip">💡 ${a.note}</div>
      </div>`:''}
    </div>`;
  }).join('')}`;
}

/* ---------- 4. 同义替换 ---------- */
function wbSyn(){
  return `
  <div class="wb-intro">
    <b>阅读理解的隐藏考点</b>
    <p>题干说 important，原文写的是 significant —— 这就是同义替换。
    认不出替换，题目就做不对。这 18 组是出现频率最高的。</p>
  </div>
  ${SYNONYMS.map((s,i)=>{
    const id='y'+i, on=wbOpen[id];
    return `<div class="wb-card">
      <div class="wb-head" onclick="wbFold('${id}')">
        <div class="syn-core">${s.core}</div>
        <div class="wb-mean"><b>${s.topic}</b><span>${s.words.length} 种说法</span></div>
        <div class="wb-arrow ${on?'up':''}">▾</div>
      </div>
      ${on?`<div class="wb-body">
        <div class="syn-list">${s.words.map(w=>
          `<span class="syn-tag" onclick="speak('${w.replace(/'/g,"")}')">${w}</span>`).join('')}</div>
        <div class="syn-ex">${s.ex}</div>
        ${s.note?`<div class="wb-tip">💡 ${s.note}</div>`:''}
      </div>`:''}
    </div>`;
  }).join('')}`;
}

/* ---------- 5. 真题词汇 ---------- */
function wbExam(){
  return `
  <div class="wb-intro">
    <b>真题里出现过的词</b>
    <p>下面每一条都来自 2026 年真题或历年高频考点，标注了出处和原句。
    带 ★ 的是语法陷阱，务必看清楚。</p>
  </div>
  ${EXAM_WORDS.map((e,i)=>`
    <div class="ex-card">
      <div class="ex-head">
        <div class="ex-w">${e.w}${e.ph?`<span class="ex-ph">${e.ph}</span>`:''}</div>
        <div class="ex-tools">
          <span class="ex-src">${e.src}</span>
          <button class="ww-spk" onclick="speak('${e.w.replace(/'/g,'')}')">🔊</button>
        </div>
      </div>
      <div class="ex-def">${e.def}</div>
      <div class="ex-sent">${e.sent}</div>
      <div class="ex-note ${e.note.includes('★')?'warn':''}">${e.note}</div>
    </div>`).join('')}`;
}

/* ---------- 6. 构词练习 ---------- */
function wbQuiz(){
  const q = MORPH_QUIZ[wbQuizIdx];
  const total = MORPH_QUIZ.length;
  return `
  <div class="wb-intro">
    <b>语法填空的核心能力</b>
    <p>给你一个词，按要求变形。这正是真题第一大题的考法（20 分）。</p>
  </div>
  <div class="mq-bar"><div class="mq-fill" style="width:${(wbQuizIdx/total)*100}%"></div></div>
  <div class="mq-count">第 ${wbQuizIdx+1} / ${total} 题</div>
  <div class="mq-card">
    <div class="mq-stem">${q.stem}</div>
    <div class="mq-want">请变成：<b>${q.want}</b></div>
    <input class="mq-in" id="mqIn" placeholder="输入答案" autocomplete="off"
      autocapitalize="off" spellcheck="false"
      onkeydown="if(event.key==='Enter')mqCheck()">
    <div id="mqFb"></div>
    <div class="mq-btns">
      <button class="btn-ghost" onclick="mqHint()">提示</button>
      <button class="btn-main" onclick="mqCheck()">检查</button>
    </div>
  </div>`;
}
function mqHint(){
  const q=MORPH_QUIZ[wbQuizIdx];
  document.getElementById('mqFb').innerHTML=`<div class="mq-hint">💡 ${q.hint}</div>`;
}
function mqCheck(){
  const q=MORPH_QUIZ[wbQuizIdx];
  const v=(document.getElementById('mqIn').value||'').trim().toLowerCase();
  const fb=document.getElementById('mqFb');
  if(!v){ fb.innerHTML=`<div class="mq-hint">请先输入答案</div>`; return; }
  const ok=q.ans.some(a=>a.toLowerCase()===v);
  if(ok){
    fb.innerHTML=`<div class="mq-ok">✓ 正确　<b>${q.ans[0]}</b>
      <div class="mq-why">${q.why}</div></div>`;
    speak(q.ans[0]);
  }else{
    fb.innerHTML=`<div class="mq-no">✗ 正确答案：<b>${q.ans[0]}</b>
      <div class="mq-why">${q.why}</div></div>`;
  }
  setTimeout(()=>{
    if(wbQuizIdx<MORPH_QUIZ.length-1){
      wbQuizIdx++;
      const b=document.getElementById('wbBody'); if(b)b.innerHTML=wbRender();
      const i=document.getElementById('mqIn'); if(i)i.focus();
    }else{
      const b=document.getElementById('wbBody');
      if(b)b.innerHTML=`<div class="mq-done">
        <div class="md-icon">✓</div>
        <div class="md-t">${MORPH_QUIZ.length} 题已全部完成</div>
        <div class="md-s">构词法是语法填空的基本功，多练几遍会形成条件反射。</div>
        <button class="btn-main" onclick="wbQuizIdx=0;setWbTab('quiz')">再来一遍</button>
      </div>`;
    }
  }, ok?1200:2600);
}
