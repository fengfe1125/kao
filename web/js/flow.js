/* ============================================================
   学习流程 v5 —— 三遍循环 + 深度卡
   覆盖 app.js 中的 planStart / sessGrade / sessNext
   本文件必须在 app.js 之后加载
   ============================================================ */

/* ---------- 队列构建：每个词排入 3 遍 ---------- */
function buildSessQueue(fresh, review){
  const q=[];
  fresh.forEach(w=>{
    q.push({study:true, word:w[0], wordArr:w, isNew:true, rep:0,
            speakText:w[0], _pair:true});
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

/* 把占位任务实例化为真实题目（按遍数决定难度） */
function realizeTask(t){
  if(!t || !t.__pending) return t;
  const w=t.wordArr, rep=t.rep;
  const fam=(typeof famOf==='function')?famOf(w[0]):0;
  let type, form;
  if(rep<=1){
    // 第1遍：认 —— 看英文选中文，最容易
    type='e2c'; form='choice';
  } else if(rep===2){
    // 第2遍：想 —— 中译英，熟练的直接写，生疏的给选项
    type='c2e'; form=(fam>=3)?'blank':'choice';
  } else {
    // 第3遍：写 —— 听音拼写，最难
    type='spell'; form='blank';
  }
  const q=makeQuestion(w,type,form);
  q.fam=fam;
  q.isNew=t.isNew; q.afterStudy=!!t.afterStudy; q.rep=rep;
  q.wordArr=w; q.retry=!!t.retry;
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
    queue=buildSessQueue(p.fresh, p.review);
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

  // 弹深度卡
  const wa=q.wordArr||findWordArr(q.word);
  if(wa){
    setTimeout(()=>{
      showDeep(wa, {correct:sess.correct, rep:sess.correct?rep:null,
        btnText: sess.correct?(isLast?'下一个词':'继续'):'我记住了'});
    }, sess.correct?260:420);
  }
  if(!sess.correct) speak(q.speakText);
}
function findWordArr(w){
  if(typeof ALL_VOCAB==='undefined') return null;
  const k=String(w).toLowerCase();
  return ALL_VOCAB.find(x=>String(x[0]).toLowerCase()===k)||null;
}
function insertRepeat(q, nextRep){
  const pos=Math.min(sess.i+1+GAP+Math.floor(Math.random()*3), sess.queue.length);
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
