/* ============================================================
   商业模式领域 · 交互界面
   四个 Tab：学习路径 / 知识地图 / 概念卡 / 自测
   ============================================================ */

let bmTab = 'path';
let bmOpen = {};
let bmLesson = null;
let bmQuiz = null;

/* ---------- 状态 ---------- */
function bmState(){
  S.bm = S.bm || {done:{}, quiz:{}, week:1};
  return S.bm;
}

/* ---------- 主入口 ---------- */
function bizModelPage(){
  const tabs=[['path','学习路径','🗺'],['tree','知识地图','🧠'],
              ['card','概念卡','📇'],['quiz','自测','✍️']];
  return `
  <div class="bm-hero">
    <div class="bm-h-t">${DOMAIN_META.name}</div>
    <div class="bm-h-s">${DOMAIN_META.subtitle}</div>
    <div class="bm-h-i">${DOMAIN_META.intro.replace(/\n/g,'<br>')}</div>
    ${bmProgress()}
  </div>
  <div class="wb-nav">
    ${tabs.map(t=>`<button class="${bmTab===t[0]?'on':''}" onclick="setBmTab('${t[0]}')">
      <i>${t[2]}</i><span>${t[1]}</span></button>`).join('')}
  </div>
  <div id="bmBody">${bmRender()}</div>`;
}
function setBmTab(t){
  bmTab=t; bmLesson=null; bmQuiz=null;
  bmToggleHero(false);
  const b=document.getElementById('bmBody'); if(b)b.innerHTML=bmRender();
  document.querySelectorAll('.wb-nav button').forEach(x=>x.classList.remove('on'));
  const btn=[...document.querySelectorAll('.wb-nav button')]
    .find(x=>(x.getAttribute('onclick')||'').includes("'"+t+"'"));
  if(btn)btn.classList.add('on');
  window.scrollTo({top:0});
}
function bmRender(){
  if(bmLesson) return bmLessonView(bmLesson);
  switch(bmTab){
    case 'path': return bmPath();
    case 'tree': return bmTree();
    case 'card': return bmCards();
    case 'quiz': return bmQuizView();
  }
}
/* 打开教学页时隐藏顶部大标题，避免信息重复 */
function bmToggleHero(hide){
  const h=document.querySelector('#p-map .bm-hero');
  const n=document.querySelector('#p-map .wb-nav');
  if(h) h.style.display = hide?'none':'';
  if(n) n.style.display = hide?'none':'';
}

/* ---------- 进度条 ---------- */
function bmProgress(){
  const st=bmState();
  let total=0, done=0;
  DOMAIN_TREE.forEach(s=>s.nodes.forEach(n=>{total++; if(st.done[n.id])done++}));
  const p=total?Math.round(done/total*100):0;
  return `<div class="bm-prog">
    <div class="bm-p-bar"><i style="width:${p}%"></i></div>
    <div class="bm-p-txt">${done} / ${total} 个知识点　·　${p}%</div>
  </div>`;
}

/* ---------- Tab 1：学习路径 ---------- */
function bmPath(){
  const st=bmState();
  return `
  <div class="wb-intro">
    <b>6 周走完</b>
    <p>每周聚焦一组知识点，配一个动手任务。
    任务不是作业，是让你把工具用在真实生意上——不用它就学不会。</p>
  </div>
  ${DOMAIN_PATH.map((w,i)=>{
    const nodes=w.nodes.map(id=>{
      let node=null;
      DOMAIN_TREE.forEach(s=>s.nodes.forEach(n=>{if(n.id===id)node=n}));
      return node;
    }).filter(Boolean);
    const doneN=nodes.filter(n=>st.done[n.id]).length;
    const all=doneN===nodes.length&&nodes.length>0;
    return `<div class="bm-week ${all?'done':''}">
      <div class="bmw-h">
        <span class="bmw-n">${w.w}</span>
        <span class="bmw-f">${w.focus}</span>
        <span class="bmw-p">${doneN}/${nodes.length}</span>
      </div>
      <div class="bmw-nodes">
        ${nodes.map(n=>`<div class="bmw-node ${st.done[n.id]?'d':''}"
          onclick="openLesson('${n.id}')">
          ${st.done[n.id]?'✓':'○'} ${n.t}</div>`).join('')}
      </div>
      <div class="bmw-task"><b>动手任务</b>${w.task}</div>
    </div>`;
  }).join('')}
  <div class="bm-books">
    <div class="bmb-t">参考书</div>
    ${DOMAIN_META.books.map(b=>`
      <div class="bmb-item">
        <div class="bmb-h"><b>${b.t}</b><span>${b.role}</span></div>
        <div class="bmb-a">${b.a}</div>
        <div class="bmb-w">${b.why}</div>
      </div>`).join('')}
  </div>`;
}

/* ---------- Tab 2：知识地图 ---------- */
function bmTree(){
  const st=bmState();
  return `
  <div class="wb-intro">
    <b>七个阶段，逐层搭建判断力</b>
    <p>点击章节展开，点知识点进入讲解。前四阶段是工具，后三阶段是应用。</p>
  </div>
  ${DOMAIN_TREE.map(s=>{
    const on=bmOpen[s.id];
    const doneN=s.nodes.filter(n=>st.done[n.id]).length;
    return `<div class="bm-stage ${doneN===s.nodes.length?'done':''}">
      <div class="bms-h" onclick="bmFold('${s.id}')">
        <div class="bms-num">${s.num}</div>
        <div class="bms-mid">
          <div class="bms-t">${s.title}</div>
          <div class="bms-g">${s.goal}</div>
          <div class="bms-m">${doneN}/${s.nodes.length} 已完成　·　${s.src}</div>
        </div>
        <div class="wb-arrow ${on?'up':''}">▾</div>
      </div>
      ${on?`<div class="bms-body">
        <div class="bms-why">${s.why}</div>
        ${s.nodes.map(n=>`
          <div class="bms-node ${st.done[n.id]?'d':''}" onclick="openLesson('${n.id}')">
            <div class="bmn-h">
              <span class="bmn-t">${st.done[n.id]?'✓ ':''}${n.t}</span>
              <span class="bmn-lv lv-${n.lv}">${n.lv}</span>
            </div>
            <div class="bmn-pts">${n.pts.map(p=>`<span>${p}</span>`).join('')}</div>
          </div>`).join('')}
      </div>`:''}
    </div>`;
  }).join('')}`;
}
function bmFold(id){
  bmOpen[id]=!bmOpen[id];
  const b=document.getElementById('bmBody'); if(b)b.innerHTML=bmRender();
}

/* ---------- 教学页 ---------- */
function openLesson(id){
  bmLesson=id;
  const b=document.getElementById('bmBody');
  if(b)b.innerHTML=bmRender();
  bmToggleHero(true);
  if(typeof syncSubjUI==='function') syncSubjUI();
  window.scrollTo({top:0});
}
function closeLesson(){
  bmLesson=null;
  const b=document.getElementById('bmBody'); if(b)b.innerHTML=bmRender();
  bmToggleHero(false);
  window.scrollTo({top:0});
}
function bmLessonView(id){
  const L=UE_LESSONS[id];
  if(!L) return '<div class="wb-intro">内容准备中</div>';
  const st=bmState();
  const done=!!st.done[id];
  return `
  <div class="bm-back" onclick="closeLesson()">‹ 返回</div>
  <div class="bml">
    <div class="bml-t">${L.t}</div>

    <div class="bml-sec why">
      <div class="bml-st">为什么学它</div>
      <div class="bml-c">${L.why.replace(/\n/g,'<br>')}</div>
    </div>

    ${L.teach.map((t,i)=>`
      <div class="bml-sec">
        <div class="bml-st"><span class="bml-i">${i+1}</span>${t.h}</div>
        <div class="bml-c">${mdLite(t.c)}</div>
      </div>`).join('')}

    ${L.example?`
      <div class="bml-sec ex">
        <div class="bml-st">📌 ${L.example.t}</div>
        <div class="bml-c">${mdLite(L.example.c)}</div>
      </div>`:''}

    <div class="bml-sec mis">
      <div class="bml-st">⚠️ 常见错误</div>
      ${L.mistakes.map(m=>`<div class="bml-m">${m}</div>`).join('')}
    </div>

    <div class="bml-sec quiz">
      <div class="bml-st">✍️ 学完自测</div>
      ${L.quiz.map((q,i)=>`
        <div class="bml-q" id="lq${i}">
          <div class="bmq-q">${i+1}. ${q.q}</div>
          <button class="bmq-btn" onclick="showLQ(${i})">看答案</button>
          <div class="bmq-a" id="lqa${i}">
            <b>${q.a}</b>
            <div class="bmq-w">${q.why}</div>
          </div>
        </div>`).join('')}
    </div>

    <div class="bml-foot">
      <button class="btn ${done?'ghost':''} full" onclick="toggleDone('${id}')">
        ${done?'✓ 已标记掌握（点击取消）':'标记为已掌握'}</button>
      ${L.next?`<button class="btn ghost full" style="margin-top:8px"
        onclick="openLesson('${L.next}')">下一节：${UE_LESSONS[L.next]?UE_LESSONS[L.next].t:''} ›</button>`:''}
    </div>
  </div>`;
}
function showLQ(i){
  const e=document.getElementById('lqa'+i);
  if(e) e.classList.add('on');
}
function toggleDone(id){
  const st=bmState();
  if(st.done[id]) delete st.done[id]; else st.done[id]=1;
  save();
  const b=document.getElementById('bmBody'); if(b)b.innerHTML=bmRender();
  const h=document.querySelector('.bm-prog');
  if(h) h.outerHTML=bmProgress();
}

/* ---------- 极简 Markdown ---------- */
function mdLite(s){
  let t=String(s);
  // 表格
  t=t.replace(/((?:^\|.*\|$\n?)+)/gm, m=>{
    const rows=m.trim().split('\n').map(r=>r.trim());
    if(rows.length<2) return m;
    let html='<table class="bmt">';
    rows.forEach((r,i)=>{
      if(/^\|[\s\-:|]+\|$/.test(r)) return;
      const cells=r.split('|').slice(1,-1);
      const tag=(i===0)?'th':'td';
      html+='<tr>'+cells.map(c=>`<${tag}>${c.trim()}</${tag}>`).join('')+'</tr>';
    });
    return html+'</table>';
  });
  t=t.replace(/^&gt; (.*)$/gm,'<blockquote>$1</blockquote>');
  t=t.replace(/^> (.*)$/gm,'<blockquote>$1</blockquote>');
  t=t.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>');
  t=t.replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>');
  t=t.replace(/<br>(<table|<blockquote)/g,'$1');
  t=t.replace(/(<\/table>|<\/blockquote>)<br>/g,'$1');
  return t;
}

/* ---------- Tab 3：概念卡 ---------- */
function bmCards(){
  const all=[];
  Object.entries(UE_LESSONS).forEach(([id,L])=>{
    L.teach.forEach(t=>{
      const m=t.c.match(/\*\*(.+?)\*\*[：:]/g);
      if(m) m.forEach(x=>{
        const name=x.replace(/\*\*/g,'').replace(/[：:]/,'');
        if(name.length<=14 && !all.some(a=>a.n===name))
          all.push({n:name, from:L.t, id:id});
      });
    });
  });
  return `
  <div class="wb-intro">
    <b>核心概念速查</b>
    <p>点任意概念跳到它所在的讲解。这些是你判断商业模式时反复要用到的词。</p>
  </div>
  <div class="bm-cards">
    ${all.map(c=>`<div class="bm-card" onclick="openLesson('${c.id}')">
      <div class="bmc-n">${c.n}</div>
      <div class="bmc-f">${c.from}</div>
    </div>`).join('')}
  </div>`;
}

/* ---------- Tab 4：自测 ---------- */
function bmQuizView(){
  if(!bmQuiz){
    const pool=[];
    Object.entries(UE_LESSONS).forEach(([id,L])=>{
      L.quiz.forEach(q=>pool.push(Object.assign({},q,{lid:id,lt:L.t})));
    });
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
    bmQuiz={pool:pool.slice(0,12), i:0, right:0, shown:false};
  }
  const q=bmQuiz.pool[bmQuiz.i];
  if(!q) return bmQuizDone();
  return `
  <div class="wb-intro">
    <b>随机抽测</b>
    <p>从 ${Object.values(UE_LESSONS).reduce((s,l)=>s+l.quiz.length,0)} 道题里随机抽 12 道。
    先自己想，再看答案。</p>
  </div>
  <div class="mq-bar"><div class="mq-fill" style="width:${bmQuiz.i/bmQuiz.pool.length*100}%"></div></div>
  <div class="mq-count">第 ${bmQuiz.i+1} / ${bmQuiz.pool.length} 题　·　来自「${q.lt}」</div>
  <div class="bmq-card">
    <div class="bmq-qt">${q.q}</div>
    ${bmQuiz.shown?`
      <div class="bmq-ans">
        <div class="bmq-al">参考答案</div>
        <b>${q.a}</b>
        <div class="bmq-w">${q.why}</div>
      </div>
      <div class="bmq-self">
        <button class="btn" onclick="bmNext(1)">答对了</button>
        <button class="btn ghost" onclick="bmNext(0)">没答对</button>
      </div>`
    :`<button class="btn full" onclick="bmShow()">看答案</button>`}
  </div>`;
}
function bmShow(){
  bmQuiz.shown=true;
  const b=document.getElementById('bmBody'); if(b)b.innerHTML=bmRender();
}
function bmNext(ok){
  if(ok) bmQuiz.right++;
  bmQuiz.i++; bmQuiz.shown=false;
  const b=document.getElementById('bmBody'); if(b)b.innerHTML=bmRender();
  window.scrollTo({top:0});
}
function bmQuizDone(){
  const acc=Math.round(bmQuiz.right/bmQuiz.pool.length*100);
  return `<div class="card" style="text-align:center;padding:34px 20px">
    <div style="font-size:42px;margin-bottom:10px">${acc>=80?'🎯':acc>=60?'👍':'📖'}</div>
    <div style="font-size:18px;font-weight:700;margin-bottom:6px">
      答对 ${bmQuiz.right} / ${bmQuiz.pool.length}</div>
    <div class="muted" style="margin-bottom:18px">正确率 ${acc}%</div>
    <div class="muted" style="font-size:12.5px;line-height:1.7;margin-bottom:20px">
      ${acc>=80?'框架已经比较扎实了，可以开始拿真实生意练手。'
        :acc>=60?'主要概念掌握了，薄弱的地方回去重看一遍讲解。'
        :'建议按学习路径重新走一遍，重点看"为什么学它"部分。'}</div>
    <button class="btn" onclick="bmQuiz=null;setBmTab('quiz')">再来一轮</button>
  </div>`;
}


/* ---------- 商业模式首页 ---------- */
function bmHome(){
  const st=bmState();
  let total=0, done=0;
  DOMAIN_TREE.forEach(s=>s.nodes.forEach(n=>{total++; if(st.done[n.id])done++}));
  const p=total?Math.round(done/total*100):0;
  // 找当前该学的
  let cur=null;
  for(const s of DOMAIN_TREE){
    for(const n of s.nodes){ if(!st.done[n.id]){ cur={s:s,n:n}; break; } }
    if(cur) break;
  }
  // 本周
  let week=null;
  for(const w of DOMAIN_PATH){
    if(w.nodes.some(id=>!st.done[id])){ week=w; break; }
  }
  return `
  <div class="bm-hero">
    <div class="bm-h-t">${DOMAIN_META.name}</div>
    <div class="bm-h-s">${DOMAIN_META.subtitle}</div>
    <div class="bm-prog">
      <div class="bm-p-bar"><i style="width:${p}%"></i></div>
      <div class="bm-p-txt">${done} / ${total} 个知识点　·　${p}%</div>
    </div>
  </div>

  ${cur?`
  <div class="card bm-next" onclick="go('map');setTimeout(function(){openLesson('${cur.n.id}')},60)">
    <div class="bmn-lbl">继续学习</div>
    <div class="bmn-title">${cur.n.t}</div>
    <div class="bmn-stage">${cur.s.num}、${cur.s.title}</div>
    <div class="bmn-go">开始 ›</div>
  </div>`:`
  <div class="card" style="text-align:center;padding:30px 20px">
    <div style="font-size:40px;margin-bottom:10px">🎉</div>
    <div style="font-size:17px;font-weight:700">全部学完了</div>
    <div class="muted" style="margin-top:8px;font-size:12.5px;line-height:1.7">
      现在去拿一门真实的生意练手。<br>用「五步拆解法」写出它的单位经济学结论。</div>
  </div>`}

  ${week?`
  <div class="card">
    <div class="sec-t" style="margin-bottom:9px">本周任务</div>
    <div class="bmw-h" style="margin-bottom:9px">
      <span class="bmw-n">${week.w}</span>
      <span class="bmw-f">${week.focus}</span>
    </div>
    <div class="bmw-task"><b>动手任务</b>${week.task}</div>
  </div>`:''}

  <div class="card">
    <div class="sec-t" style="margin-bottom:10px">七个阶段</div>
    ${DOMAIN_TREE.map(s=>{
      const d=s.nodes.filter(n=>st.done[n.id]).length;
      const full=d===s.nodes.length;
      return `<div class="bmh-stage ${full?'done':''}"
        onclick="go('map');setTimeout(function(){setBmTab('tree');bmFold('${s.id}')},60)">
        <div class="bmh-num">${s.num}</div>
        <div class="bmh-mid">
          <div class="bmh-t">${s.title}</div>
          <div class="bmh-m">${d}/${s.nodes.length}　·　${s.src}</div>
        </div>
        <div class="bmh-bar"><i style="width:${d/s.nodes.length*100}%"></i></div>
      </div>`;
    }).join('')}
  </div>`;
}
