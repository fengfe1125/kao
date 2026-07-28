/* ============================================================
   英语学习引擎
   1. speak()      — Web Speech 朗读（iOS voices 异步加载已处理）
   2. SRS          — SM-2 间隔重复算法
   3. 测试模式      — 拼写 / 英译汉 / 汉译英，各支持选择题与填空题
   ============================================================ */

/* ---------------- 朗读 ---------------- */
const Speech = (()=>{
  let voices=[], ready=false, best=null;
  function load(){
    voices=speechSynthesis.getVoices()||[];
    if(voices.length){
      // 优先英式/美式母语音色
      const en=voices.filter(v=>/^en(-|_)?/i.test(v.lang));
      best = en.find(v=>/^en-US/i.test(v.lang)&&/samantha|alex|female/i.test(v.name))
          || en.find(v=>/^en-GB/i.test(v.lang))
          || en.find(v=>/^en-US/i.test(v.lang))
          || en[0] || null;
      ready=true;
    }
  }
  load();
  if(typeof speechSynthesis!=='undefined') speechSynthesis.onvoiceschanged=load;
  return {
    ok(){return typeof speechSynthesis!=='undefined'},
    say(text,rate){
      if(!this.ok()) return false;
      try{
        if(!ready) load();
        speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance(text);
        u.lang=(best&&best.lang)||'en-US';
        if(best) u.voice=best;
        u.rate=rate||0.9; u.pitch=1; u.volume=1;
        speechSynthesis.speak(u);
        return true;
      }catch(e){return false}
    },
    stop(){try{speechSynthesis.cancel()}catch(e){}}
  };
})();

function speak(w,rate){
  if(!Speech.say(w,rate)) toast('当前环境不支持朗读');
}
/* 慢速朗读 */
function speakSlow(w){speak(w,0.55)}

/* ---------------- SM-2 记忆曲线 ---------------- */
/* 卡片状态: {ef:难度因子, n:连续答对次数, iv:间隔天数, due:到期时间戳, seen:总复习次数, wrong:错误次数} */
const SRS = {
  MIN_EF: 1.3,
  /* 首次接触 */
  init(){
    return {ef:2.5, n:0, iv:0, due:Date.now(), seen:0, wrong:0};
  },
  /* q: 0=完全不会 1=模糊 2=犹豫答对 3=脱口而出 */
  grade(card, q){
    const c = card ? {...card} : this.init();
    c.seen = (c.seen||0) + 1;

    if(q < 2){
      // 答错：重置连击，短期内重新出现
      c.n = 0;
      c.iv = q === 0 ? 0 : 1;      // 完全不会 → 当天再来；模糊 → 明天
      c.wrong = (c.wrong||0) + 1;
    } else {
      c.n = (c.n||0) + 1;
      if(c.n === 1)      c.iv = 1;
      else if(c.n === 2) c.iv = 3;
      else               c.iv = Math.round((c.iv||1) * c.ef);
      if(c.iv > 180) c.iv = 180;   // 上限半年
    }
    // EF 调整（SM-2 公式，q 映射到 0-5 区间）
    const q5 = [0,2,4,5][q];
    c.ef = (c.ef||2.5) + (0.1 - (5-q5)*(0.08 + (5-q5)*0.02));
    if(c.ef < this.MIN_EF) c.ef = this.MIN_EF;

    c.due = Date.now() + c.iv*864e5;
    c.last = Date.now();
    return c;
  },
  isDue(card){ return !card || !card.due || card.due <= Date.now(); },
  /* 掌握判定：连续答对3次以上且间隔≥7天 */
  mastered(card){ return card && card.n >= 3 && card.iv >= 7; }
};

/* 取出今日应复习的词：优先到期的旧词，不足则补新词 */
function dueQueue(limit){
  limit = limit || 20;
  const rec = S.srs || {};
  const due=[], fresh=[];
  for(const w of ALL_VOCAB){
    const k=w[0], c=rec[k];
    if(!c){ fresh.push(w); }
    else if(SRS.isDue(c)){ due.push([w,c.due||0]); }
  }
  due.sort((a,b)=>a[1]-b[1]);
  const out = due.slice(0,limit).map(x=>x[0]);
  if(out.length < limit){
    // 新词按等级由易到难补充
    // 高频核心词优先（VOCAB 是核心库），但每次随机打乱，避免 ABC 顺序
    const core=fresh.filter(w=>VOCAB.some(v=>v[0]===w[0]));
    const ext=fresh.filter(w=>!VOCAB.some(v=>v[0]===w[0]));
    const mix=a=>a.sort(()=>Math.random()-.5);
    mix(core); mix(ext);
    out.push(...core.slice(0, limit-out.length));
    if(out.length<limit) out.push(...ext.slice(0,limit-out.length));
  }
  return out;
}
function srsStats(){
  const rec=S.srs||{};
  let learning=0, mastered=0, dueNow=0;
  for(const k in rec){
    const c=rec[k];
    if(SRS.mastered(c)) mastered++; else learning++;
    if(SRS.isDue(c)) dueNow++;
  }
  const newLeft = ALL_VOCAB.length - Object.keys(rec).length;
  return {learning, mastered, dueNow, newLeft, total:ALL_VOCAB.length};
}

/* ---------------- 熟练度分级 ----------------
   0 新词   未接触
   1 陌生   见过但答错过 / 连击0
   2 模糊   连击1-2，间隔短
   3 熟悉   连击>=3 或 间隔>=7
   4 牢固   连击>=5 且 间隔>=21
------------------------------------------------ */
const FAM = [
  {lv:0, name:'新词',  color:'#c3ccd6', desc:'还没背过'},
  {lv:1, name:'陌生',  color:'#b85c62', desc:'答错过，需要重点攻'},
  {lv:2, name:'模糊',  color:'#c9992e', desc:'有印象但不牢'},
  {lv:3, name:'熟悉',  color:'#5b8fb0', desc:'基本记住了'},
  {lv:4, name:'牢固',  color:'#4f8a6b', desc:'长期记忆'}
];
function famOf(word){
  const c=(S.srs||{})[word];
  if(!c) return 0;
  if((c.n||0)>=5 && (c.iv||0)>=21) return 4;
  if((c.n||0)>=3 || (c.iv||0)>=7)  return 3;
  if((c.n||0)>=1) return 2;
  return 1;                       // 见过但连击为0（答错过）
}
function famStats(){
  const out=[0,0,0,0,0];
  for(const w of ALL_VOCAB) out[famOf(w[0])]++;
  return out;
}

/* ---------------- 自适应题型 ----------------
   熟练度越低 → 越容易的题型（先认再选再写）
   0 新词  : 学习卡（先认识，不考）
   1 陌生  : 英译汉 选择   （最容易：看英文选中文）
   2 模糊  : 汉译英 选择 / 拼写选择  （中等）
   3 熟悉  : 汉译英 填空   （要能写出来）
   4 牢固  : 拼写填空（听音拼写，最难）
------------------------------------------------ */
function adaptiveQuestion(word){
  const f=famOf(word[0]);
  const c=(S.srs||{})[word[0]];
  const wrong=(c&&c.wrong)||0;
  let type,form;
  if(f<=1){
    type='e2c'; form='choice';
  } else if(f===2){
    // 错得多的仍给选择题，错得少的开始上拼写辨析
    if(wrong>=2){ type='e2c'; form='choice'; }
    else { type = Math.random()<0.5?'c2e':'spell'; form='choice'; }
  } else if(f===3){
    type = Math.random()<0.6?'c2e':'e2c'; form='blank';
  } else {
    type='spell'; form='blank';
  }
  const q=makeQuestion(word,type,form);
  q.fam=f;
  return q;
}
/* 新词学习卡（不算测试，只是认识） */
function studyCard(word){
  return {study:true, word:word[0], ph:word[1], mean:word[2], lv:word[3], speakText:word[0], fam:0};
}

/* ---------------- 每日计划 ---------------- */
function planToday(){
  const goal=(S.plan&&S.plan.goal)||30;
  const ratio=(S.plan&&S.plan.newRatio)||0.4;   // 新词占比
  const rec=S.srs||{};
  // 到期复习词（按到期时间升序）
  const due=[];
  for(const w of ALL_VOCAB){
    const c=rec[w[0]];
    if(c && SRS.isDue(c)) due.push([w,c.due||0]);
  }
  due.sort((a,b)=>a[1]-b[1]);
  const dueWords=due.map(x=>x[0]);
  // 新词（按等级由易到难）
  const freshAll=ALL_VOCAB.filter(w=>!rec[w[0]]);
  const freshCore=freshAll.filter(w=>VOCAB.some(v=>v[0]===w[0])).sort(()=>Math.random()-.5);
  const freshExt=freshAll.filter(w=>!VOCAB.some(v=>v[0]===w[0])).sort(()=>Math.random()-.5);
  const fresh=freshCore.concat(freshExt);

  let nNew=Math.round(goal*ratio);
  let nRev=goal-nNew;
  if(dueWords.length<nRev){ nRev=dueWords.length; nNew=Math.min(goal-nRev, fresh.length); }
  if(fresh.length<nNew){ nNew=fresh.length; nRev=Math.min(goal-nNew, dueWords.length); }
  return {
    goal,
    review: dueWords.slice(0,nRev),
    fresh:  fresh.slice(0,nNew),
    dueTotal: dueWords.length,
    freshTotal: fresh.length
  };
}
/* 今日进度 */
function todayLog(){
  const d=today();
  S.log=S.log||{};
  S.log[d]=S.log[d]||{new:[],review:[],right:0,wrong:0};
  return S.log[d];
}
function logWord(word, isNew, correct){
  const t=todayLog();
  const arr=isNew?t.new:t.review;
  if(arr.indexOf(word)<0) arr.push(word);
  if(correct) t.right++; else t.wrong++;
}
function todayCount(){
  const t=todayLog();
  return t.new.length+t.review.length;
}
/* 最近 N 天学习量 */
function recentDays(n){
  const out=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(Date.now()-i*864e5).toISOString().slice(0,10);
    const r=(S.log||{})[d];
    out.push({date:d, n:r?(r.new.length+r.review.length):0,
      newN:r?r.new.length:0, revN:r?r.review.length:0,
      right:r?r.right:0, wrong:r?r.wrong:0});
  }
  return out;
}

/* ---------------- 干扰项生成 ---------------- */
/* 同首字母 / 同长度 / 同等级优先，做出有迷惑性的选项 */
function distractors(word, n, byMeaning){
  const [w,,mean,lv]=word;
  const pool=ALL_VOCAB.filter(x=>x[0]!==w);
  const score=x=>{
    let s=0;
    if(x[3]===lv) s+=3;
    if(x[0][0]===w[0]) s+=2;
    if(Math.abs(x[0].length-w.length)<=2) s+=2;
    // 词性相同（取释义开头的 n./v./a. 等）
    const p1=(mean.match(/^[a-z]+\./)||[''])[0];
    const p2=(x[2].match(/^[a-z]+\./)||[''])[0];
    if(p1&&p1===p2) s+=3;
    return s + Math.random()*2;
  };
  return pool.map(x=>[x,score(x)]).sort((a,b)=>b[1]-a[1])
    .slice(0, n*4).sort(()=>Math.random()-0.5).slice(0,n).map(x=>x[0]);
}
const shuffle=a=>a.map(x=>[x,Math.random()]).sort((p,q)=>p[1]-q[1]).map(x=>x[0]);

/* ---------------- 出题 ---------------- */
/* type: e2c(英译汉) c2e(汉译英) spell(拼写)
   form: choice(选择) blank(填空)                              */
function makeQuestion(word, type, form){
  const [w,ph,mean]=word;
  if(type==='e2c'){
    if(form==='choice'){
      const ds=distractors(word,3);
      return {type,form,word:w,ph,ask:w,askSub:ph,
        title:'选出正确的中文释义',
        options:shuffle([mean,...ds.map(d=>d[2])]), answer:mean, speakText:w};
    }
    return {type,form,word:w,ph,ask:w,askSub:ph,
      title:'写出这个单词的中文意思',answer:mean,speakText:w,fuzzy:true};
  }
  if(type==='c2e'){
    if(form==='choice'){
      const ds=distractors(word,3);
      return {type,form,word:w,ph,ask:mean,
        title:'选出对应的英文单词',
        options:shuffle([w,...ds.map(d=>d[0])]),answer:w,speakText:w};
    }
    return {type,form,word:w,ph,ask:mean,
      title:'写出对应的英文单词',answer:w,speakText:w};
  }
  // spell 拼写
  if(form==='choice'){
    // 生成形近拼写干扰项
    const wrong=new Set();
    const mk=()=>{
      const a=w.split(''); const i=1+Math.floor(Math.random()*(a.length-1));
      const r=Math.random();
      if(r<0.34){ a.splice(i,1); }
      else if(r<0.67){ a[i]=a[i]==='e'?'a':(a[i]==='a'?'e':(a[i]==='i'?'e':'a')); }
      else { a.splice(i,0,a[i]); }
      return a.join('');
    };
    let guard=0;
    while(wrong.size<3 && guard++<60){ const c=mk(); if(c!==w) wrong.add(c); }
    while(wrong.size<3){ wrong.add(w+'e'.repeat(wrong.size+1)); }
    return {type,form,word:w,ph,ask:mean,askSub:ph,
      title:'选出拼写正确的单词',
      options:shuffle([w,...[...wrong]]),answer:w,speakText:w};
  }
  return {type,form,word:w,ph,ask:mean,askSub:ph,
    title:'根据释义与读音拼写单词',answer:w,speakText:w,spell:true};
}

/* 答案比对 */
function checkAnswer(q, input){
  const norm=s=>String(s).trim().toLowerCase().replace(/\s+/g,' ');
  const a=norm(q.answer), v=norm(input);
  if(!v) return false;
  if(a===v) return true;
  if(q.fuzzy){
    // 中文释义：去掉词性前缀与标点后，只要包含主要义项即可
    const clean=s=>s.replace(/^[a-z]+\.\s*/,'').replace(/[，,；;（）()]/g,' ').trim();
    const ca=clean(a), cv=clean(v);
    if(!cv) return false;
    if(ca===cv) return true;
    return ca.split(/\s+/).some(part=>part.length>=1 && cv.includes(part))
        || cv.split(/\s+/).some(part=>part.length>=1 && ca.includes(part));
  }
  return false;
}
