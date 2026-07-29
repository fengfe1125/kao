/* ============================================================
   题型设计 v6 —— 认识优先
   核心判断：取消选择题后，考的是"在阅读里认出、在句子里会用"，
   不是默写。所以：
   - 主线三遍全部围绕"认 → 辨 → 用"，不强制拼写
   - 拼写作为可选任务，且只针对高频词
   - 拼写本身也提供选择/填空两种形式
   ============================================================ */

/* ---------- 一、主线题型：认 → 辨 → 用 ---------- */
/*
  第1遍  recog  认词：看英文选中文          （最基础）
  第2遍  disc   辨词：看中文选英文 / 形近辨析（防混淆）
  第3遍  use    用词：句子填空选词           （在语境里认）
*/

/* 句子填空题：从例句库取句，挖掉目标词，给选项 */
function makeUseQuestion(wordArr){
  const w = wordArr[0];
  const sents = (typeof sentOf==='function') ? sentOf(w) : [];
  // 找一条含该词的真句子
  const stem = String(w).toLowerCase().split('/')[0];
  let hit = null;
  for(const s of sents){
    if(!s.sent) continue;
    const re = new RegExp('\\b'+stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[a-z]*\\b','i');
    if(re.test(s.sent)){ hit = {sent:s.sent, cn:s.cn||'', src:s.src||'', form:(s.sent.match(re)||[])[0]}; break; }
  }
  if(!hit) return null;

  const blanked = hit.sent.replace(new RegExp('\\b'+hit.form.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b'), '______');
  // 干扰项：同词性、长度接近的词
  const opts = pickUseDistractors(wordArr, hit.form);
  // 词性提示（帮助判断该填什么）
  let posHint = '';
  if(typeof parsePosSmart==='function'){
    const pl = parsePosSmart(wordArr[2]||'');
    if(pl.length && pl[0].poss && pl[0].poss.length){
      const info = (typeof POS_MAP!=='undefined') ? POS_MAP[pl[0].poss[0]] : null;
      if(info) posHint = info.zh;
    }
  }
  return {
    type:'use', form:'choice',
    word: w, wordArr: wordArr,
    q: blanked,
    qcn: hit.cn,
    qsrc: hit.src,
    posHint: posHint,
    options: opts.list,
    answer: opts.answer,
    speakText: hit.sent,
    fullSent: hit.sent,
    hint: wordArr[2]
  };
}
function pickUseDistractors(wordArr, correctForm){
  const V = (typeof VOCAB3000!=='undefined') ? VOCAB3000 : [];
  const def = String(wordArr[2]||'');
  const pos = (def.match(/^([a-z]+\.)/)||[])[1] || '';
  const me = String(wordArr[0]).toLowerCase();
  const cands = [];
  let guard = 0;
  while(cands.length < 3 && guard++ < 400){
    const c = V[Math.floor(Math.random()*V.length)];
    if(!c) continue;
    const cw = String(c[0]).toLowerCase();
    if(cw === me) continue;
    if(cw.includes('/') || cw.includes(' ')) continue;
    if(pos && String(c[2]||'').indexOf(pos) !== 0) continue;
    if(Math.abs(cw.length - me.length) > 4) continue;
    if(cands.some(x=>x.toLowerCase()===cw)) continue;
    cands.push(c[0]);
  }
  while(cands.length < 3){
    const c = V[Math.floor(Math.random()*V.length)];
    if(c && String(c[0]).toLowerCase()!==me && !cands.includes(c[0])) cands.push(c[0]);
  }
  const list = shuffleArr([correctForm].concat(cands));
  return { list: list, answer: correctForm };
}
function shuffleArr(a){
  const r=a.slice();
  for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}
  return r;
}

/* 形近词辨析题：给中文，从形近/义近词里选 */
function makeDiscQuestion(wordArr){
  const q = makeQuestion(wordArr, 'c2e', 'choice');
  q.type = 'disc';
  q.wordArr = wordArr;
  return q;
}

/* ---------- 二、主线：按遍数出题（不含拼写） ---------- */
function mainlineQuestion(wordArr, rep){
  if(rep <= 1){
    const q = makeQuestion(wordArr,'e2c','choice');
    q.type='recog'; q.wordArr=wordArr; return q;
  }
  if(rep === 2){
    return makeDiscQuestion(wordArr);
  }
  // 第3遍：优先句子填空（真正的"会用"）
  const u = makeUseQuestion(wordArr);
  if(u) return u;
  // 没有可用例句时退回辨析
  return makeDiscQuestion(wordArr);
}

/* ---------- 三、拼写：可选任务，只针对高频词 ---------- */
/* 判断一个词值不值得练拼写
   兼容两种词库：
   - VOCAB3000: [w, ph, def, 官方标记(0无/1▲/2◆), 学习档位, 高频分]
   - 旧 ALL_VOCAB: [w, ph, def, 难度等级1-4]
   规则：▲◆ 标记词 / T1骨架 / T2高频基础 / 高频分>=50 / 旧库难度1-2（越小越常用） */
function worthSpelling(wordArr){
  if(!Array.isArray(wordArr)) return false;
  const w = String(wordArr[0]).toLowerCase().split('/')[0];
  // 优先查 3000 词表的权威分层
  if(typeof VOCAB3000!=='undefined'){
    const hit = VOCAB3000.find(x=>String(x[0]).toLowerCase().split('/')[0]===w);
    if(hit){
      const lv=hit[3], tier=hit[4], score=hit[5]||0;
      return lv===1 || lv===2 || tier===1 || tier===2 || score>=50;
    }
  }
  // 回退：旧库难度等级 1-2 视为常用词
  const d = wordArr[3];
  return (typeof d==='number' && d<=2);
}
function spellingPool(){
  const V = (typeof ALL_VOCAB!=='undefined') ? ALL_VOCAB : [];
  const known = S.known || {};
  // 只从"已经认识"的词里挑，避免还没认识就练拼写
  return V.filter(w => known[w[0]] && worthSpelling(w));
}

/* 拼写题：选择 或 填空 */
function makeSpellQuestion(wordArr, form){
  if(form === 'choice'){
    const q = makeQuestion(wordArr, 'spell', 'choice');
    q.type='spell'; q.wordArr=wordArr; return q;
  }
  const q = makeQuestion(wordArr, 'spell', 'blank');
  q.type='spell'; q.wordArr=wordArr;
  return q;
}

/* 首字母提示型填空（比纯默写容易，适合过渡） */
function makeSpellHint(wordArr){
  const w = String(wordArr[0]).split('/')[0];
  const keep = Math.max(1, Math.floor(w.length/3));
  const masked = w.slice(0,keep) + w.slice(keep).replace(/[a-z]/gi,'_');
  const q = makeQuestion(wordArr,'spell','blank');
  q.type='spell'; q.form='blank'; q.wordArr=wordArr;
  q.spellHint = masked;
  return q;
}
