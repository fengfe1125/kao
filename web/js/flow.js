/* ============================================================
   学习流程 v5 —— 三遍循环 + 深度卡
   覆盖 app.js 中的 planStart / sessGrade / sessNext
   本文件必须在 app.js 之后加载
   ============================================================ */

/* ---------- 队列构建：每个词排入 3 遍 ---------- */
function buildSessQueue(fresh, review){
  const q=[];
  fresh.forEach(w=>{
    q.push({study:true, word:w[0], wordArr:w,
            ph:w[1], mean:w[2], lv:w[3],
            isNew:true, rep:0, speakText:w[0], _pair:true});
    q.push({__pending:true, wordArr:w, isNew:true, rep:1, afterStudy:true});
  });
  review.forEach(w=>{
    q.push({__pending:true, wordArr:w, isNew:false, rep:1});
  });
  // 打乱：study 与其后第一题绑定为一组
  const groups=[], singles=[];
  for(let i=0;i<q.length;i++){
    if(q[i].study && q[i+1] && q[i+1].wordArr && q[i+1].wordArr[0]===q[i].word){
      groups.push([q[i],q[i+1]]); i++;
    } else singles.push([q[i]]);
  }
  const all=groups.concat(singles);
  for(let i=all.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[all[i],all[j]]=[all[j],all[i]]}
  return all.flat();
}

/* 把占位任务实例化为真实题目
   主线：认 → 辨 → 用（不强制拼写）
   拼写：作为可选任务单独进行 */
function realizeTask(t){
  if(!t || !t.__pending) return t;
  const w=t.wordArr, rep=t.rep;
  let q;
  if(t.spellMode){
    // 拼写专项任务
    q = (t.spellForm==='choice') ? makeSpellQuestion(w,'choice')
      : (t.spellForm==='hint')   ? makeSpellHint(w)
      : makeSpellQuestion(w,'blank');
  } else {
    q = mainlineQuestion(w, rep);
  }
  q.fam=(typeof famOf==='function')?famOf(w[0]):0;
  q.isNew=t.isNew; q.afterStudy=!!t.afterStudy; q.rep=rep;
  q.wordArr=w; q.retry=!!t.retry; q.spellMode=!!t.spellMode;
  return q;
}

/* ---------- 启动 ---------- */
function planStart(extra){
  const p=planToday();
  let queue;
  if(extra){
    const pool=ALL_VOCAB.filter(w=>famOf(w[0])>0).sort((a,b)=>famOf(a[0])-famOf(b[0]));
    const pick=shuffle(pool.slice(0,60)).slice(0,10);
    if(!pick.length){toast('还没有学过的词，请先完成今日计划');return}
    queue=buildSessQueue([], pick);
  } else {
    if(!p.fresh.length && !p.review.length){toast('今日没有需要学习的词');return}
    // 一轮最多 8 新词 + 8 复习词，保证三遍都能在本轮走完
    queue=buildSessQueue(p.fresh.slice(0,8), p.review.slice(0,8));
  }
  sess={queue, i:0, answered:false, picked:null, correct:false,
        right:0, wrong:0, extra:!!extra,
        doneWords:{}, totalPlan:queue.length};
  sess.items=queue;              // 兼容旧渲染逻辑
  renderSess();
  const f=curTask();
  if(f && f.study) setTimeout(()=>speak(f.speakText),300);
}
function curTask(){
  if(!sess) return null;
  let t=sess.queue[sess.i];
  if(t && t.__pending){ t=realizeTask(t); sess.queue[sess.i]=t; sess.items=sess.queue; }
  return t;
}
function renderSess(){
  const el=document.getElementById('mapBody');
  if(el) el.innerHTML=enPlan();
  if(typeof syncSubjUI==='function') syncSubjUI();
  window.scrollTo({top:0});
}

/* ---------- 判分 ---------- */
function sessGrade(q){
  sess.answered=true;
  if(sess.correct) sess.right++; else sess.wrong++;
  S.srs=S.srs||{};

  const rep=q.rep||1;
  const isLast = sess.correct && rep>=REPEAT;

  // SRS 只在本轮最后一遍答对时推进间隔；答错立即降级
  if(!sess.correct){
    S.srs[q.word]=SRS.grade(S.srs[q.word],0);
    delete S.known[q.word];
  } else if(isLast){
    const grade=(q.form==='blank')?3:2;
    S.srs[q.word]=SRS.grade(S.srs[q.word],grade);
    S.known[q.word]=1;
  }
  // 中间遍数答对：不动 SRS，只记录进度

  if(isLast || !sess.correct) logWord(q.word, !!q.isNew, sess.correct);
  if(isLast) sess.doneWords[q.word]=1;

  checkStreak(); save(); renderSess(); renderHome();

  // 排下一遍 / 重来
  if(sess.correct){
    if(rep<REPEAT) insertRepeat(q, rep+1);
  } else {
    insertRetry(q);
  }

  // 弹深度卡（关闭后自动进入下一题）
  const wa=q.wordArr||findWordArr(q.word);
  if(wa){
    setTimeout(()=>{
      showDeep(wa, {correct:sess.correct, rep:sess.correct?rep:null,
        btnText: sess.correct?(isLast?'下一个词':'继续'):'我记住了',
        onClose: ()=>{ sessNext(); }});
    }, sess.correct?260:420);
  } else {
    // 没有词条数据时直接进入下一题，避免卡住
    setTimeout(()=>{ sessNext(); }, 400);
  }
  if(!sess.correct) speak(q.speakText);
}
function findWordArr(w){
  if(typeof ALL_VOCAB==='undefined') return null;
  const k=String(w).toLowerCase();
  return ALL_VOCAB.find(x=>String(x[0]).toLowerCase()===k)||null;
}
function insertRepeat(q, nextRep){
  // 保证本轮内一定能做到：插在剩余队列的靠后位置，但不超过末尾
  const remain = sess.queue.length - sess.i - 1;
  const gap = nextRep===2 ? 4 : 6;
  let pos = sess.i + 1 + Math.min(gap, Math.max(1, remain));
  if(pos > sess.queue.length) pos = sess.queue.length;
  sess.queue.splice(pos,0,{__pending:true, wordArr:q.wordArr||findWordArr(q.word),
    isNew:q.isNew, rep:nextRep});
  sess.items=sess.queue;
}
function insertRetry(q){
  const pos=Math.min(sess.i+1+2+Math.floor(Math.random()*2), sess.queue.length);
  sess.queue.splice(pos,0,{__pending:true, wordArr:q.wordArr||findWordArr(q.word),
    isNew:q.isNew, rep:1, retry:true});
  sess.items=sess.queue;
}

/* ---------- 下一题 ---------- */
function sessNext(){
  sess.i++; sess.answered=false; sess.picked=null; sess.correct=false;
  const it=curTask();
  renderSess();
  if(!it) return;
  if(it.study) setTimeout(()=>speak(it.speakText),300);
  else if(it.form==='blank'&&it.type==='spell') setTimeout(()=>speak(it.speakText),350);
}

/* ---------- 学习卡「记住了」也展示深度卡 ---------- */
function studyNext(){
  const t=curTask();
  if(t && t.wordArr){
    showDeep(t.wordArr, {btnText:'开始测试', onClose:()=>{ sessNext(); }});
  } else sessNext();
}


/* ============================================================
   完成页 + 拼写专项（可选）
   ============================================================ */
function planDone(){
  const total=sess.right+sess.wrong;
  const acc=total?Math.round(sess.right/total*100):0;
  const doneN=todayCount(), goal=(S.plan&&S.plan.goal)||30;
  const reach=doneN>=goal;
  const learned=sess.doneWords?Object.keys(sess.doneWords):[];
  // 本轮学过、且值得练拼写的词
  const spellable=learned.map(w=>findWordArr(w)).filter(w=>w&&worthSpelling(w));

  return `<div class="card" style="text-align:center;padding:30px 20px">
    <div style="font-size:42px;margin-bottom:9px">${reach?'🎉':acc>=80?'👍':'💪'}</div>
    <div style="font-size:19px;font-weight:700;margin-bottom:4px">
      ${reach?'今日目标达成':'本轮完成'}</div>
    <div class="muted" style="margin-bottom:4px">
      认识了 ${learned.length} 个词　·　正确率 ${acc}%</div>
    <div class="muted" style="margin-bottom:16px;font-size:12px">
      今日累计 ${doneN} / ${goal} 个${reach?'':'　还差 '+(goal-doneN)+' 个'}</div>
  </div>

  ${spellable.length?`
  <div class="card spell-invite">
    <div class="si-t">要不要顺便练拼写？</div>
    <div class="si-d">这 ${spellable.length} 个是<b>高频词</b>（▲◆ 标记或骨架词），
      写作和翻译填空里可能要自己写出来。<br>
      其余的词只要能在阅读里认出就够了，不用花时间默写。</div>
    <div class="si-words">
      ${spellable.slice(0,12).map(w=>`<span class="si-w">${w[0]}</span>`).join('')}
      ${spellable.length>12?`<span class="si-more">+${spellable.length-12}</span>`:''}
    </div>
    <div class="si-btns">
      <button class="btn" onclick="startSpell('choice')">选拼写<em>看词选正确拼法</em></button>
      <button class="btn" onclick="startSpell('hint')">补全<em>给首字母提示</em></button>
      <button class="btn" onclick="startSpell('blank')">默写<em>听音直接写</em></button>
    </div>
  </div>`:''}

  <div class="row" style="justify-content:center;margin-top:4px">
    <button class="btn ghost" onclick="sessQuit()">查看统计</button>
    <button class="btn ghost" onclick="planStart(true)">再认 10 个</button>
  </div>`;
}

/* 启动拼写专项 */
function startSpell(form){
  const learned=(sess&&sess.doneWords)?Object.keys(sess.doneWords):[];
  let pool=learned.map(w=>findWordArr(w)).filter(w=>w&&worthSpelling(w));
  if(!pool.length) pool=shuffle(spellingPool()).slice(0,10);
  if(!pool.length){toast('还没有可练拼写的高频词');return}
  const queue=pool.map(w=>({__pending:true, wordArr:w, isNew:false, rep:1,
    spellMode:true, spellForm:form}));
  sess={queue, i:0, answered:false, picked:null, correct:false,
        right:0, wrong:0, extra:false, spellRound:true,
        doneWords:{}, totalPlan:queue.length};
  sess.items=queue;
  renderSess();
}

/* 拼写轮结束页 */
function spellDone(){
  const total=sess.right+sess.wrong;
  const acc=total?Math.round(sess.right/total*100):0;
  return `<div class="card" style="text-align:center;padding:32px 20px">
    <div style="font-size:42px;margin-bottom:9px">${acc>=80?'🎯':'📝'}</div>
    <div style="font-size:18px;font-weight:700;margin-bottom:5px">拼写练习完成</div>
    <div class="muted" style="margin-bottom:16px">
      写对 ${sess.right} / ${total}　·　正确率 ${acc}%</div>
    <div class="muted" style="font-size:12px;margin-bottom:18px;line-height:1.7">
      写错的词不用焦虑。<br>只要能在阅读里认出来，选择题和阅读题就不会丢分。</div>
    <button class="btn" onclick="sessQuit()">完成</button>
  </div>`;
}


/* ============================================================
   句子填空题视图 —— 在语境里认词
   ============================================================ */
function useView(q){
  const f=(typeof FAM!=='undefined')?FAM[q.fam||0]:{color:'#888',name:''};
  const shown=sess.answered
    ? q.q.replace('______','<b class="uv-fill">'+esc(q.answer)+'</b>')
    : q.q.replace('______','<span class="uv-blank">______</span>');
  return `
  ${sessBar()}
  <div class="card">
    <div class="spread" style="margin-bottom:10px">
      <span class="muted" style="font-weight:700">选词填空</span>
      <span class="ftag" style="background:${f.color}18;color:${f.color}">${f.name} · 在句中用</span>
    </div>

    <div class="uv-tip">读懂句子，选出最合适的词${q.posHint?'　·　需要填 <b>'+q.posHint+'</b>':''}</div>
    <div class="uv-sent">${shown}</div>
    ${q.qsrc?`<div class="uv-src">${esc(q.qsrc)}</div>`:''}

    <div class="opts" style="margin-top:12px">
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
    </div>

    ${sess.answered?`
      <div class="fb ${sess.correct?'ok':'no'}">
        <div class="fb-h">${sess.correct?'✓ 用对了':'✗ 用错了'}</div>
        <div class="uv-full">${clickableSentence(q.fullSent, q.word)}
          <button class="spk sm" onclick="speak('${esc2(q.fullSent)}')">🔊 整句</button>
        </div>
        <div class="uv-taphint">点句中任意单词可查词并朗读</div>
        ${q.qcn?`<div class="uv-cn">${esc(q.qcn)}</div>`:''}
        <div class="fb-b" style="margin-top:8px">
          <b>${esc(q.word)}</b>　${esc(q.hint||'')}
        </div>
      </div>
      <button class="btn full" style="margin-top:11px" onclick="sessNext()">
        ${sess.i>=sess.queue.length-1?'完成学习':'下一个 ›'}</button>`:''}
  </div>`;
}


/* ============================================================
   新词学习卡 v2 —— 第一屏就给全信息
   词性 / 释义 / 拆解 / 例句 / 同义替换，全部直接展示
   ============================================================ */
function studyView(it){
  const w = it.wordArr || findWordArr(it.word);
  const d = w ? deepCard(w) : null;
  const mark = d && d.lv===1 ? '▲' : d && d.lv===2 ? '◆' : '';
  const tierName = (d && typeof TIER_INFO!=='undefined' && TIER_INFO[d.tier])
    ? TIER_INFO[d.tier].name : '';

  return `
  ${sessBar()}
  <div class="card sv-card">
    <div class="stag">🆕 新词学习</div>

    <div class="sv-head">
      <div class="sv-w">${esc(it.word)}</div>
      ${it.ph?`<div class="sv-ph">${esc(it.ph)}</div>`:''}
      <div class="sv-spk">
        <button class="spk" onclick="speak('${esc2(it.speakText||it.word)}')">🔊 朗读</button>
        <button class="spk" onclick="speakSlow('${esc2(it.speakText||it.word)}')">🐢 慢速</button>
      </div>
      <div class="sv-def">${defByPos(it.mean||'')}</div>
      ${(mark||tierName)?`<div class="sv-tags">
        ${mark?`<span class="dt ${d.lv===1?'up':'dia'}">${mark} ${d.lv===1?'基础模块新增':'拓展模块新增'}</span>`:''}
        ${tierName?`<span class="dt">${tierName}</span>`:''}
      </div>`:''}
    </div>

    ${d?`<div class="sv-body">
      ${deepMorph(d)}
      ${deepSent(d)}
      ${deepSyn(d)}
      ${deepAdvice(d)}
    </div>`:''}

    <div class="sv-foot">
      <div class="sv-hint">看懂之后点下面，马上会考你这个词</div>
      <button class="btn full" onclick="studyNext()">记住了，开始测试 ›</button>
    </div>
  </div>`;
}

/* 学习卡点「记住了」后直接进测试，不再重复弹深度卡 */
function studyNext(){
  sessNext();
}
