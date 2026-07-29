/* ============================================================
   词性解析 + 句中查词
   1) 从释义里拆出词性，单独标注
   2) 句子里每个词可点：弹出释义 + 朗读
   ============================================================ */

/* ---------- 一、词性解析 ---------- */
const POS_MAP = {
  'n':   {zh:'名词',   en:'noun',        color:'#5b8fb0'},
  'v':   {zh:'动词',   en:'verb',        color:'#4f8a6b'},
  'adj': {zh:'形容词', en:'adjective',   color:'#c9992e'},
  'a':   {zh:'形容词', en:'adjective',   color:'#c9992e'},
  'adv': {zh:'副词',   en:'adverb',      color:'#b5703c'},
  'ad':  {zh:'副词',   en:'adverb',      color:'#b5703c'},
  'prep':{zh:'介词',   en:'preposition', color:'#8e99a6'},
  'conj':{zh:'连词',   en:'conjunction', color:'#8e99a6'},
  'pron':{zh:'代词',   en:'pronoun',     color:'#8e99a6'},
  'num': {zh:'数词',   en:'numeral',     color:'#8e99a6'},
  'art': {zh:'冠词',   en:'article',     color:'#8e99a6'},
  'int': {zh:'感叹词', en:'interjection',color:'#8e99a6'},
  'aux': {zh:'助动词', en:'auxiliary',   color:'#8e99a6'},
  'modal':{zh:'情态动词',en:'modal',     color:'#8e99a6'},
  'phr': {zh:'短语',   en:'phrase',      color:'#b85c62'},
  'abbr':{zh:'缩写',   en:'abbreviation',color:'#8e99a6'}
};

/* 把 "n./v. 提供，出价" 拆成 [{pos, zh, def}] */
function parsePos(def){
  const raw = String(def||'').trim();
  if(!raw) return [];
  const out = [];
  // 匹配位于词首或分隔符后的词性标记，如 "n." "adj." "prep."
  const re = /(?:^|[\s；;，,])([a-z]{1,5})\.(?=\s|$|[^a-z])/gi;
  const marks = [];
  let m;
  while((m = re.exec(raw)) !== null){
    const tag = m[1].toLowerCase();
    if(POS_MAP[tag]){
      marks.push({idx:m.index, end:re.lastIndex, tag:tag});
    }
  }
  if(!marks.length) return [{pos:null, zh:'', def:raw}];
  for(let i=0;i<marks.length;i++){
    const cur = marks[i], next = marks[i+1];
    let text = raw.slice(cur.end, next ? next.idx : raw.length);
    // 去掉紧跟的斜杠（"n./v." 中 n. 后面的 /）
    text = text.replace(/^\s*\/\s*/,'').replace(/^[\s；;，,]+|[\s；;，,]+$/g,'');
    out.push({pos:cur.tag, zh:POS_MAP[cur.tag].zh, color:POS_MAP[cur.tag].color, def:text});
  }
  return out;
}

/* 处理 "n./v. xxx" 这种斜杠合并写法 */
function parsePosSmart(def){
  const raw = String(def||'').trim();
  if(!raw) return [];
  // 把 "n./v." → "n. v. "，"n./adj." 同理；支持连续多个
  let norm = raw;
  for(let k=0;k<3;k++){
    norm = norm.replace(/\b([a-z]+)\.\/([a-z]+)\./gi, (s,a,b)=>{
      if(POS_MAP[a.toLowerCase()] && POS_MAP[b.toLowerCase()]) return a+'. '+b+'. ';
      return s;
    });
  }
  const list = parsePos(norm);
  // 相邻且释义为空的词性，合并到后一条（如 "n. v. 尊敬" → n/v: 尊敬）
  const cleaned = [];
  let pending = [];
  list.forEach(x=>{
    if(x.pos && (!x.def || !x.def.trim())){ pending.push(x.pos); return; }
    const poss = pending.concat(x.pos?[x.pos]:[]);
    pending = [];
    cleaned.push({poss:poss, def:x.def, zh:x.zh, color:x.color});
  });
  if(pending.length && cleaned.length){
    cleaned[cleaned.length-1].poss = cleaned[cleaned.length-1].poss.concat(pending);
  }
  // 合并同释义
  const merged = [];
  cleaned.forEach(x=>{
    const same = merged.find(y=>y.def===x.def);
    if(same){ x.poss.forEach(p=>{ if(!same.poss.includes(p)) same.poss.push(p); }); }
    else merged.push({poss:x.poss.slice(), def:x.def, zh:x.zh, color:x.color});
  });
  return merged.length?merged:[{poss:[], def:raw}];
}

/* 词性徽章 HTML */
function posBadges(def){
  const list = parsePosSmart(def);
  if(!list.length) return '';
  const tags = [];
  list.forEach(x=>{
    x.poss.forEach(p=>{
      const info = POS_MAP[p];
      if(info && !tags.some(t=>t.p===p)) tags.push({p:p, info:info});
    });
  });
  if(!tags.length) return '';
  return tags.map(t=>
    `<span class="pos-badge" style="background:${t.info.color}1a;color:${t.info.color}">
      ${t.info.zh}</span>`).join('');
}

/* 按词性分行的释义 HTML */
function defByPos(def){
  const list = parsePosSmart(def);
  if(!list.length) return `<div class="dp-line">${def||''}</div>`;
  if(list.length===1 && !list[0].poss.length){
    return `<div class="dp-line">${list[0].def}</div>`;
  }
  return list.map(x=>{
    const badge = x.poss.map(p=>{
      const i=POS_MAP[p];
      return `<span class="dp-tag" style="background:${i.color}1a;color:${i.color}">${i.zh}</span>`;
    }).join('');
    return `<div class="dp-line">${badge}<span class="dp-def">${x.def}</span></div>`;
  }).join('');
}

/* ---------- 二、句中查词 ---------- */
let _LOOKUP = null;
function lookupIndex(){
  if(_LOOKUP) return _LOOKUP;
  _LOOKUP = new Map();
  const put=(k,v)=>{ const kk=String(k).toLowerCase(); if(!_LOOKUP.has(kk)) _LOOKUP.set(kk,v); };
  const src = (typeof VOCAB3000!=='undefined')?VOCAB3000:[];
  src.forEach(x=>{
    String(x[0]).split('/').forEach(p=>put(p.trim(), {w:x[0], ph:x[1], def:x[2]}));
  });
  if(typeof ALL_VOCAB!=='undefined'){
    ALL_VOCAB.forEach(x=>{
      String(x[0]).split('/').forEach(p=>put(p.trim(), {w:x[0], ph:x[1], def:x[2]}));
    });
  }
  return _LOOKUP;
}

/* 常见变形还原：去 s/es/ed/ing/er/est/ly 等 */
function baseForms(word){
  const w = String(word).toLowerCase().replace(/[^a-z-]/g,'');
  const out = [w];
  const push = x => { if(x && x.length>=2 && !out.includes(x)) out.push(x); };
  // 复数 / 三单
  if(w.endsWith('ies')){ push(w.slice(0,-3)+'y'); push(w.slice(0,-2)); push(w.slice(0,-1)); }
  if(w.endsWith('ves')){ push(w.slice(0,-3)+'f'); push(w.slice(0,-3)+'fe'); }
  if(w.endsWith('ses')||w.endsWith('xes')||w.endsWith('ches')||w.endsWith('shes')){ push(w.slice(0,-2)); }
  if(w.endsWith('es')){ push(w.slice(0,-2)); push(w.slice(0,-1)); }
  if(w.endsWith('s')&&!w.endsWith('ss')&&!w.endsWith('us')){ push(w.slice(0,-1)); }
  // 过去式 / 过去分词
  if(w.endsWith('ied')){ push(w.slice(0,-3)+'y'); }
  if(w.endsWith('ed')){
    push(w.slice(0,-2)); push(w.slice(0,-1));
    if(w.length>4 && w[w.length-3]===w[w.length-4]) push(w.slice(0,-3));
  }
  // 现在分词
  if(w.endsWith('ing')){
    push(w.slice(0,-3)); push(w.slice(0,-3)+'e');
    if(w.length>5 && w[w.length-4]===w[w.length-5]) push(w.slice(0,-4));
  }
  // 比较级 / 最高级
  if(w.endsWith('ier')){ push(w.slice(0,-3)+'y'); }
  if(w.endsWith('iest')){ push(w.slice(0,-4)+'y'); }
  if(w.endsWith('er')){
    push(w.slice(0,-2)); push(w.slice(0,-1));
    if(w.length>4 && w[w.length-3]===w[w.length-4]) push(w.slice(0,-3));
  }
  if(w.endsWith('est')){
    push(w.slice(0,-3)); push(w.slice(0,-2));
    if(w.length>5 && w[w.length-4]===w[w.length-5]) push(w.slice(0,-4));
  }
  // 副词
  if(w.endsWith('ily')){ push(w.slice(0,-3)+'y'); }
  if(w.endsWith('ally')){ push(w.slice(0,-4)); push(w.slice(0,-2)); }
  if(w.endsWith('ly')){ push(w.slice(0,-2)); push(w.slice(0,-2)+'e'); }
  // 名词化后再复数：tourists → tourist
  if(w.endsWith('sts')){ push(w.slice(0,-1)); }
  return out;
}
function lookupWord(word){
  const idx = lookupIndex();
  for(const f of baseForms(word)){
    if(idx.has(f)) return Object.assign({}, idx.get(f), {matched:f});
  }
  return null;
}

/* 把句子渲染成可点击的词 */
function clickableSentence(sent, highlight){
  const hl = String(highlight||'').toLowerCase().split('/')[0];
  const hlBases = hl ? baseForms(hl) : [];
  // 用正则切出单词与非单词片段，保留标点
  const parts = String(sent).split(/([A-Za-z]+(?:'[A-Za-z]+)?)/);
  return parts.map(p=>{
    if(!/^[A-Za-z]/.test(p)) return esc(p);
    const low = p.toLowerCase();
    const isHl = hlBases.length && baseForms(low).some(b=>hlBases.includes(b));
    const hit = lookupWord(p);
    const cls = 'sw' + (isHl?' hl':'') + (hit?'':' no');
    return `<span class="${cls}" onclick="tapWord('${esc2(p)}',event)">${esc(p)}</span>`;
  }).join('');
}

/* 点击单词：朗读 + 弹出释义气泡 */
function tapWord(word, ev){
  if(ev){ ev.stopPropagation(); }
  speak(word);
  const hit = lookupWord(word);
  showWordPop(word, hit, ev);
}
function showWordPop(word, hit, ev){
  let pop = document.getElementById('wordPop');
  if(!pop){
    pop = document.createElement('div');
    pop.id = 'wordPop';
    document.body.appendChild(pop);
  }
  if(!hit){
    pop.innerHTML = `<div class="wp-box">
      <div class="wp-w">${esc(word)}<button class="wp-spk" onclick="speak('${esc2(word)}')">🔊</button></div>
      <div class="wp-none">词表里没有这个词</div>
    </div>`;
  } else {
    pop.innerHTML = `<div class="wp-box">
      <div class="wp-w">${esc(hit.w)}
        <button class="wp-spk" onclick="speak('${esc2(hit.w)}')">🔊</button>
        <button class="wp-spk" onclick="speakSlow('${esc2(hit.w)}')">🐢</button>
      </div>
      ${hit.ph?`<div class="wp-ph">${esc(hit.ph)}</div>`:''}
      <div class="wp-def">${defByPos(hit.def)}</div>
      ${hit.derived?`<div class="wp-form">
        ${esc(hit.derived.base)} + ${esc(hit.derived.key)} → ${esc(word)}
        <br><span class="wp-dim">${esc(hit.derived.kind)} ${esc(hit.derived.key)} 表示「${esc(hit.derived.mean)}」${hit.derived.pos?'，构成'+esc(hit.derived.pos):''}</span>
      </div>`
      : (hit.matched && hit.matched!==String(word).toLowerCase()
        ? `<div class="wp-form">句中形式 <b>${esc(word)}</b>　原形 <b>${esc(hit.matched)}</b></div>`:'')}
    </div>`;
  }
  pop.className = 'wp-wrap on';
  // 定位：优先显示在点击位置上方，空间不足则显示在下方
  const y = (ev && typeof ev.clientY === 'number') ? ev.clientY : window.innerHeight * 0.5;
  const box = pop.querySelector('.wp-box');
  const place = () => {
    const h = box ? box.offsetHeight : 130;
    let top = y - h - 14;
    if(top < 10) top = Math.min(y + 26, window.innerHeight - h - 10);
    if(top < 10) top = 10;
    pop.style.top = top + 'px';
  };
  place();
  requestAnimationFrame(place);
  clearTimeout(window._wpT);
  window._wpT = setTimeout(closeWordPop, 4500);
}
function closeWordPop(){
  const pop = document.getElementById('wordPop');
  if(pop) pop.className = 'wp-wrap';
}
document.addEventListener('click', function(e){
  if(!e.target.closest || (!e.target.closest('.sw') && !e.target.closest('#wordPop'))) closeWordPop();
}, true);


/* ---------- 三、功能词与常见派生词兜底 ---------- */
/* 句子里的虚词、常见派生词也要能点开，否则阅读时会有"死词" */
const FUNC_WORDS = {
  'the':['art.','定冠词，特指'],'a':['art.','不定冠词，一个'],'an':['art.','不定冠词，一个'],
  'is':['v.','be动词，第三人称单数现在时'],'are':['v.','be动词，复数/第二人称现在时'],
  'was':['v.','be动词，单数过去式'],'were':['v.','be动词，复数过去式'],
  'am':['v.','be动词，第一人称现在时'],'be':['v.','是，存在'],'been':['v.','be的过去分词'],
  'being':['v.','be的现在分词'],
  'do':['aux.','助动词，构成疑问和否定'],'does':['aux.','助动词第三人称单数'],
  'did':['aux.','助动词过去式'],'done':['v.','do的过去分词'],
  'have':['v.','有；助动词构成完成时'],'has':['v.','have第三人称单数'],
  'had':['v.','have的过去式/过去分词'],'having':['v.','have的现在分词'],
  'will':['modal','将要'],'would':['modal','将会；愿意（will的过去式）'],
  'can':['modal','能够'],'could':['modal','能够（can的过去式）；委婉请求'],
  'shall':['modal','将要；应该'],'should':['modal','应该'],
  'may':['modal','可以；可能'],'might':['modal','可能（may的过去式）'],
  'must':['modal','必须'],
  'of':['prep.','…的'],'to':['prep.','到；动词不定式符号'],'in':['prep.','在…里'],
  'on':['prep.','在…上'],'at':['prep.','在（地点/时间点）'],'for':['prep.','为了；因为'],
  'with':['prep.','和…一起；用'],'from':['prep.','从'],'by':['prep.','通过；被'],
  'about':['prep.','关于；大约'],'as':['prep./conj.','作为；当…时'],
  'into':['prep.','进入'],'over':['prep.','在…上方；超过'],'under':['prep.','在…下面'],
  'through':['prep.','穿过；通过'],'during':['prep.','在…期间'],'between':['prep.','在两者之间'],
  'among':['prep.','在…之中'],'without':['prep.','没有'],'within':['prep.','在…之内'],
  'against':['prep.','反对；靠着'],'across':['prep.','穿过'],'along':['prep.','沿着'],
  'after':['prep./conj.','在…之后'],'before':['prep./conj.','在…之前'],
  'and':['conj.','和'],'or':['conj.','或者'],'but':['conj.','但是'],
  'so':['conj./adv.','因此；如此'],'because':['conj.','因为'],'if':['conj.','如果；是否'],
  'that':['conj./pron.','那；引导从句'],'which':['pron.','哪一个；引导定语从句'],
  'who':['pron.','谁；引导定语从句'],'whom':['pron.','谁（宾格）'],'whose':['pron.','谁的'],
  'what':['pron.','什么'],'when':['conj./adv.','当…时；什么时候'],
  'where':['conj./adv.','在哪里'],'while':['conj.','当…时；然而'],
  'than':['conj.','比'],'though':['conj.','虽然'],'although':['conj.','尽管'],
  'this':['pron.','这个'],'these':['pron.','这些'],'those':['pron.','那些'],
  'it':['pron.','它'],'its':['pron.','它的'],'they':['pron.','他们'],
  'them':['pron.','他们（宾格）'],'their':['pron.','他们的'],'theirs':['pron.','他们的'],
  'he':['pron.','他'],'him':['pron.','他（宾格）'],'his':['pron.','他的'],
  'she':['pron.','她'],'her':['pron.','她的；她（宾格）'],'hers':['pron.','她的'],
  'we':['pron.','我们'],'us':['pron.','我们（宾格）'],'our':['pron.','我们的'],
  'you':['pron.','你，你们'],'your':['pron.','你的'],'yours':['pron.','你的'],
  'i':['pron.','我'],'me':['pron.','我（宾格）'],'my':['pron.','我的'],'mine':['pron.','我的'],
  'not':['adv.','不'],'no':['adv./adj.','不；没有'],'very':['adv.','很'],
  'too':['adv.','太；也'],'also':['adv.','也'],'only':['adv.','只'],
  'just':['adv.','只是；刚才'],'even':['adv.','甚至'],'still':['adv.','仍然'],
  'yet':['adv.','还；已经'],'already':['adv.','已经'],'always':['adv.','总是'],
  'never':['adv.','从不'],'often':['adv.','经常'],'sometimes':['adv.','有时'],
  'usually':['adv.','通常'],'more':['adv./adj.','更多'],'most':['adv./adj.','最'],
  'much':['adv./adj.','许多'],'many':['adj.','许多'],'some':['adj./pron.','一些'],
  'any':['adj./pron.','任何'],'all':['adj./pron.','全部'],'each':['adj./pron.','每个'],
  'every':['adj.','每个'],'both':['adj./pron.','两者都'],'other':['adj.','其他的'],
  'another':['adj./pron.','另一个'],'such':['adj.','这样的'],'same':['adj.','相同的'],
  'own':['adj./v.','自己的；拥有'],'here':['adv.','这里'],'there':['adv.','那里'],
  'now':['adv.','现在'],'then':['adv.','然后'],'today':['adv./n.','今天'],
  'how':['adv.','怎样'],'why':['adv.','为什么'],'up':['adv./prep.','向上'],
  'down':['adv./prep.','向下'],'out':['adv.','出'],'off':['adv.','离开；关闭'],
  'back':['adv./n.','向后；背部'],'away':['adv.','离开'],'again':['adv.','再一次'],
  'once':['adv./conj.','一次；一旦'],'ago':['adv.','以前'],'well':['adv./adj.','好；健康的'],
  'first':['adv./adj.','首先；第一的'],'last':['adj./v.','最后的；持续'],
  'next':['adj./adv.','下一个'],'new':['adj.','新的'],'old':['adj.','老的；旧的'],
  'good':['adj.','好的'],'better':['adj./adv.','更好的'],'best':['adj./adv.','最好的'],
  'long':['adj./adv.','长的；长久地'],'little':['adj.','小的；少的'],'few':['adj.','很少的'],
  'less':['adj./adv.','更少'],'least':['adj./adv.','最少'],'own':['adj.','自己的']
};
function funcLookup(word){
  const w=String(word).toLowerCase().replace(/[^a-z']/g,'');
  const hit=FUNC_WORDS[w];
  if(!hit) return null;
  return {w:word, ph:'', def:hit[0]+' '+hit[1], matched:w, isFunc:true};
}

/* 派生词兜底：认不出原形时，用构词法解释 */
function derivedLookup(word){
  if(typeof autoMorph!=='function') return null;
  const m=autoMorph(word);
  if(!m.length) return null;
  const base=m[0].base;
  const idx=lookupIndex();
  const bi=base?idx.get(base):null;
  if(!bi) return null;
  const kind=m[0].kind==='suffix'?'后缀':'前缀';
  return {
    w: word, ph:'',
    def: bi.def,
    matched: base,
    derived: {key:m[0].key, kind:kind, base:base, baseDef:bi.def, mean:m[0].mean, pos:m[0].pos||''}
  };
}

/* 增强 lookupWord：词表 → 功能词 → 派生词 */
(function patchLookup(){
  const _l=lookupWord;
  lookupWord=function(word){
    const hit=_l(word);
    if(hit) return hit;
    const f=funcLookup(word);
    if(f) return f;
    return derivedLookup(word);
  };
})();


/* ---------- 四、不规则动词与专有名词 ---------- */
const IRREGULAR = {
  'was':'be','were':'be','been':'be','am':'be','is':'be','are':'be',
  'went':'go','gone':'go','did':'do','done':'do','had':'have','has':'have',
  'said':'say','made':'make','took':'take','taken':'take','came':'come',
  'saw':'see','seen':'see','got':'get','gotten':'get','gave':'give','given':'give',
  'knew':'know','known':'know','thought':'think','found':'find','told':'tell',
  'became':'become','left':'leave','felt':'feel','brought':'bring','began':'begin',
  'begun':'begin','kept':'keep','held':'hold','wrote':'write','written':'write',
  'stood':'stand','heard':'hear','let':'let','meant':'mean','met':'meet',
  'ran':'run','paid':'pay','sat':'sit','spoke':'speak','spoken':'speak',
  'lay':'lie','led':'lead','grew':'grow','grown':'grow','lost':'lose',
  'fell':'fall','fallen':'fall','sent':'send','built':'build','understood':'understand',
  'drew':'draw','drawn':'draw','broke':'break','broken':'break','spent':'spend',
  'cut':'cut','rose':'rise','risen':'rise','driven':'drive','drove':'drive',
  'bought':'buy','wore':'wear','worn':'wear','chose':'choose','chosen':'choose',
  'ate':'eat','eaten':'eat','sold':'sell','taught':'teach','caught':'catch',
  'threw':'throw','thrown':'throw','flew':'fly','flown':'fly','won':'win',
  'wore':'wear','slept':'sleep','swam':'swim','swum':'swim','sang':'sing',
  'sung':'sing','drank':'drink','drunk':'drink','rode':'ride','ridden':'ride',
  'shown':'show','showed':'show','put':'put','read':'read','set':'set',
  'children':'child','men':'man','women':'woman','feet':'foot','teeth':'tooth',
  'people':'person','mice':'mouse','geese':'goose','lives':'life',
  'wives':'wife','knives':'knife','leaves':'leaf','shelves':'shelf',
  'better':'good','best':'good','worse':'bad','worst':'bad','more':'many','most':'many'
};
const PROPER = {
  'china':'中国','chinese':'中国的；中文','beijing':'北京','wuhan':'武汉',
  'shanghai':'上海','hubei':'湖北','english':'英语；英国的','america':'美国',
  'american':'美国的','britain':'英国','british':'英国的','japan':'日本',
  'europe':'欧洲','asia':'亚洲','africa':'非洲','india':'印度','russia':'俄罗斯',
  'confucius':'孔子','xian':'西安','monday':'星期一','tuesday':'星期二',
  'wednesday':'星期三','thursday':'星期四','friday':'星期五','saturday':'星期六',
  'sunday':'星期日','january':'一月','february':'二月','march':'三月',
  'april':'四月','may':'五月','june':'六月','july':'七月','august':'八月',
  'september':'九月','october':'十月','november':'十一月','december':'十二月',
  'gen':'（Gen Z 指Z世代）','dr':'博士；医生','mr':'先生','mrs':'夫人','ms':'女士'
};

(function patchLookup2(){
  const _l = lookupWord;
  lookupWord = function(word){
    const w = String(word).toLowerCase().replace(/[^a-z']/g,'');
    // 不规则变形优先
    if(IRREGULAR[w]){
      const base = IRREGULAR[w];
      const idx = lookupIndex();
      const bi = idx.get(base);
      if(bi) return Object.assign({}, bi, {matched:base, irregular:true});
    }
    const hit = _l(word);
    if(hit) return hit;
    // 专有名词
    if(PROPER[w]) return {w:word, ph:'', def:'n. '+PROPER[w], matched:w, isProper:true};
    return null;
  };
})();


/* ---------- 五、例句常用词补充（不在考纲但阅读会遇到） ---------- */
const EXTRA_LEX = {
  'tourist':['n.','游客，旅游者'],
  'tourism':['n.','旅游业'],
  'brisk':['adj.','轻快的，敏捷的'],
  'thirty':['num.','三十'],
  'twenty':['num.','二十'],
  'fifty':['num.','五十'],
  'forty':['num.','四十'],
  'sixty':['num.','六十'],
  'guesthouse':['n.','小旅馆，招待所'],
  'countless':['adj.','无数的'],
  'boot':['n.','靴子（boot camp 新兵训练营）'],
  'camp':['n./v.','营地；露营'],
  'appeal':['n./v.','吸引力；呼吁'],
  'defining':['adj.','决定性的，标志性的'],
  'emerging':['adj.','新兴的，正在出现的'],
  'traveller':['n.','旅行者'],
  'traveler':['n.','旅行者（美式）'],
  'travelling':['v.','travel 的现在分词'],
  'anxiety':['n.','焦虑，不安'],
  'briskly':['adv.','轻快地'],
  'researcher':['n.','研究人员'],
  'scan':['n./v.','扫描'],
  'genuine':['adj.','真正的，真诚的'],
  'rural':['adj.','乡村的，农村的'],
  'urban':['adj.','城市的'],
  'volunteer':['n./v.','志愿者；自愿做'],
  'exchange':['n./v.','交换，交流'],
  'locals':['n.','当地人（local 的复数）'],
  'photo':['n.','照片'],
  'photos':['n.','照片（复数）'],
  'spot':['n.','地点，景点'],
  'spots':['n.','地点（复数）'],
  'rush':['v./n.','匆忙，仓促'],
  'rushing':['v.','rush 的现在分词'],
  'stress':['n./v.','压力；强调'],
  'mood':['n.','心情，情绪'],
  'memory':['n.','记忆，回忆'],
  'expert':['n.','专家'],
  'experts':['n.','专家（复数）'],
  'deeper':['adj.','更深的（deep 的比较级）'],
  'fewer':['adj.','更少的（few 的比较级）'],
  'longer':['adj./adv.','更长的（long 的比较级）'],
  'lower':['adj./v.','更低的；降低'],
  'proudly':['adv.','自豪地'],
  'relaxed':['adj.','放松的'],
  'reflects':['v.','reflect 的第三人称单数'],
  'benefits':['n./v.','益处；有益于'],
  'connected':['adj.','相连的'],
  'closely':['adv.','紧密地'],
  'regular':['adj.','规律的，定期的'],
  'regularly':['adv.','有规律地'],
  'physical':['adj.','身体的，物质的'],
  'activity':['n.','活动'],
  'concentration':['n.','注意力，集中'],
  'minute':['n.','分钟'],
  'minutes':['n.','分钟（复数）'],
  'heart':['n.','心，心脏'],
  'disease':['n.','疾病'],
  'adult':['n.','成年人'],
  'adults':['n.','成年人（复数）'],
  'brain':['n.','大脑'],
  'areas':['n.','区域（复数）'],
  'feelings':['n.','感受，情感'],
  'plan':['n./v.','计划'],
  'sets':['v.','set 的第三人称单数'],
  'direction':['n.','方向'],
  'development':['n.','发展'],
  'company':['n.','公司'],
  'rules':['n.','规则（复数）'],
  'terrible':['adj.','糟糕的，可怕的'],
  'weather':['n.','天气'],
  'phone':['n./v.','电话'],
  'rang':['v.','ring 的过去式，响'],
  'developing':['adj.','发展中的'],
  'countryside':['n.','乡村'],
  'technology':['n.','科技'],
  'convenient':['adj.','方便的'],
  'homework':['n.','家庭作业'],
  'progress':['n.','进步'],
  'goals':['n.','目标（复数）'],
  'traffic':['n.','交通'],
  'jam':['n.','堵塞；果酱'],
  'author':['n.','作者'],
  'famous':['adj.','著名的'],
  'reading':['n./v.','阅读'],
  'touch':['n./v.','接触，联系'],
  'decision':['n.','决定'],
  'position':['n.','职位，位置'],
  'advertised':['v.','advertise 的过去分词，登广告'],
  'newspaper':['n.','报纸'],
  'reply':['n./v.','回复'],
  'invitation':['n.','邀请'],
  'meeting':['n.','会议'],
  'inform':['v.','通知'],
  'attend':['v.','参加，出席'],
  'environmental':['adj.','环境的'],
  'protection':['n.','保护'],
  'deserves':['v.','deserve 的第三人称单数'],
  'attention':['n.','注意力'],
  'effective':['adj.','有效的'],
  'measures':['n.','措施（复数）'],
  'protects':['v.','protect 的第三人称单数'],
  'environment':['n.','环境'],
  'conclusion':['n.','结论'],
  'firmly':['adv.','坚定地'],
  'joint':['adj.','共同的'],
  'efforts':['n.','努力（复数）'],
  'situation':['n.','情况'],
  'improve':['v.','改善'],
  'race':['n./v.','赛跑；竞赛'],
  'style':['n.','风格，方式'],
  'losing':['v.','lose 的现在分词'],
  'instead':['adv.','代替，反而'],
  'streets':['n.','街道（复数）'],
  'taste':['v./n.','品尝；味道'],
  'farms':['n.','农场（复数）'],
  'desire':['n./v.','渴望'],
  'experiences':['n.','经历（复数）'],
  'trend':['n.','趋势'],
  'continue':['v.','继续'],
  'themselves':['pron.','他们自己'],
  'trips':['n.','旅行（复数）'],
  'exercised':['v.','exercise 的过去式'],
  'exercising':['v.','exercise 的现在分词'],
  'walk':['v./n.','走，散步'],
  'walking':['v.','walk 的现在分词'],
  'risk':['n./v.','风险'],
  'pointed':['v.','point 的过去式'],
  'sharp':['adj.','锋利的；敏锐的'],
  'evidence':['n.','证据'],
  'blame':['v./n.','责怪'],
  'confidence':['n.','信心'],
  'roots':['n.','根（复数）'],
  'concept':['n.','概念'],
  'beginners':['n.','初学者（复数）'],
  'slight':['adj.','轻微的'],
  'accident':['n.','事故'],
  'careless':['adj.','粗心的'],
  'driving':['n./v.','驾驶'],
  'hospital':['n.','医院'],
  'ahead':['adv.','在前面，提前'],
  'figures':['n.','数字（复数）'],
  'stealing':['v.','steal 的现在分词，偷'],
  'forests':['n.','森林（复数）'],
  'harm':['n./v.','伤害'],
  'street':['n.','街道'],
  'expected':['v.','expect 的过去式'],
  'cost':['n./v.','花费'],
  'courage':['n.','勇气'],
  'honesty':['n.','诚实'],
  'private':['adj.','私人的'],
  'affair':['n.','事务'],
  'waste':['v./n.','浪费'],
  'lonely':['adj.','孤独的'],
  'river':['n.','河流'],
  'hour':['n.','小时'],
  'arrived':['v.','arrive 的过去式'],
  'raining':['v.','rain 的现在分词'],
  'scenery':['n.','风景'],
  'hours':['n.','小时（复数）'],
  'coming':['adj./v.','即将到来的'],
  'spelling':['n.','拼写'],
  'generations':['n.','世代（复数）'],
  'contribute':['v.','贡献'],
  'history':['n.','历史'],
  'internet':['n.','互联网'],
  'parents':['n.','父母'],
  'means':['v./n.','意味着；方法'],
  'rule':['n./v.','规则'],
  'entrance':['n.','入口；入学'],
  'examination':['n.','考试'],
  'trying':['v.','try 的现在分词'],
  'carelessness':['n.','粗心'],
  'perfect':['adj./v.','完美的'],
  'term':['n.','学期；术语'],
  'practice':['n./v.','练习'],
  'habits':['n.','习惯（复数）'],
  'library':['n.','图书馆'],
  'popular':['adj.','受欢迎的'],
  'nervous':['adj.','紧张的'],
  'exams':['n.','考试（复数）'],
  'cities':['n.','城市（复数）'],
  'festivals':['n.','节日（复数）'],
  'preserving':['v.','preserve 的现在分词，保护'],
  'memorise':['v.','记住，背诵'],
  'businessman':['n.','商人'],
  'crossing':['n./v.','穿过；人行横道'],
  'slow':['adj./v.','慢的；减速'],
  'travel':['n./v.','旅行'],
  'quality':['n.','质量'],
  'service':['n.','服务'],
  'goal':['n.','目标'],
  'patience':['n.','耐心'],
  'method':['n.','方法'],
  'skills':['n.','技能（复数）'],
  'writing':['n./v.','写作'],
  'shoppers':['n.','购物者（复数）'],
  'online':['adj./adv.','在线的'],
  'sharply':['adv.','急剧地'],
  'plastic':['adj./n.','塑料的'],
  'bags':['n.','袋子（复数）'],
  'students':['n.','学生（复数）'],
  'free':['adj.','免费的；自由的'],
  'lunch':['n.','午餐'],
  'problem':['n.','问题'],
  'carefully':['adv.','仔细地'],
  'worked':['v.','work 的过去式'],
  'hard':['adj./adv.','努力的；困难的'],
  'always':['adv.','总是'],
  'decisions':['n.','决定（复数）'],
  'job':['n.','工作'],
  'requires':['v.','require 的第三人称单数'],
  'great':['adj.','极大的'],
  'doctor':['n.','医生'],
  'suggested':['v.','suggest 的过去式'],
  'take':['v.','拿；采取'],
  'coffee':['n.','咖啡'],
  'early':['adj./adv.','早的'],
  'avoid':['v.','避免'],
  'success':['n.','成功'],
  'depends':['v.','depend 的第三人称单数'],
  'work':['n./v.','工作'],
  'suddenly':['adv.','突然'],
  'realised':['v.','realise 的过去式'],
  'left':['v./adj.','leave 的过去式；左边的'],
  'keys':['n.','钥匙（复数）'],
  'words':['n.','词语（复数）'],
  'children':['n.','孩子（复数）'],
  'accidents':['n.','事故（复数）'],
  'positive':['adj.','积极的'],
  'health':['n.','健康'],
  'mind':['n./v.','头脑；介意'],
  'language':['n.','语言'],
  'real':['adj.','真实的'],
  'challenge':['n./v.','挑战'],
  'practise':['v.','练习'],
  'opportunity':['n.','机会'],
  'rich':['adj.','丰富的；富有的'],
  'teaching':['n./v.','教学'],
  'power':['n.','力量'],
  'ability':['n.','能力'],
  'solve':['v.','解决'],
  'difficult':['adj.','困难的'],
  'problems':['n.','问题（复数）'],
  'please':['v./int.','请；使高兴'],
  'pay':['v.','支付；给予'],
  'future':['n./adj.','未来'],
  'protect':['v.','保护'],
  'everyone':['pron.','每个人'],
  'society':['n.','社会'],
  'culture':['n.','文化'],
  'long':['adj.','长的'],
  'changed':['v.','change 的过去式'],
  'live':['v./adj.','居住；现场的'],
  'useful':['adj.','有用的'],
  'information':['n.','信息'],
  'important':['adj.','重要的'],
  'understand':['v.','理解'],
  'explain':['v.','解释'],
  'describe':['v.','描述'],
  'picture':['n.','图画'],
  'discussed':['v.','discuss 的过去式'],
  'decided':['v.','decide 的过去式'],
  'study':['v./n.','学习；研究'],
  'abroad':['adv.','在国外'],
  'choose':['v.','选择'],
  'either':['pron./adv.','两者之一'],
  'books':['n.','书（复数）'],
  'preparing':['v.','prepare 的现在分词'],
  'keep':['v.','保持'],
  'succeed':['v.','成功'],
  'failed':['v.','fail 的过去式'],
  'makes':['v.','make 的第三人称单数'],
  'made':['v.','make 的过去式'],
  'this':['pron.','这个'],
  'learn':['v.','学习'],
  'learning':['n./v.','学习'],
  'without':['prep.','没有'],
  'necessary':['adj.','必要的'],
  'healthy':['adj.','健康的'],
  'possible':['adj.','可能的'],
  'finish':['v.','完成'],
  'available':['adj.','可获得的'],
  'young':['adj.','年轻的'],
  'people':['n.','人们'],
  'common':['adj.','常见的'],
  'feel':['v.','感觉'],
  'serious':['adj.','严重的'],
  'pollution':['n.','污染'],
  'modern':['adj.','现代的'],
  'life':['n.','生活'],
  'before':['prep./conj.','在…之前'],
  'traditional':['adj.','传统的'],
  'worth':['adj.','值得的'],
  'way':['n.','方式，方法'],
  'words':['n.','词（复数）'],
  'successful':['adj.','成功的'],
  'confident':['adj.','自信的'],
  'better':['adj./adv.','更好的'],
  'teachers':['n.','老师（复数）'],
  'slow':['adj.','慢的'],
  'learners':['n.','学习者（复数）'],
  'local':['adj./n.','当地的；当地人'],
  'friendly':['adj.','友好的'],
  'visitors':['n.','游客（复数）'],
  'eating':['v.','eat 的现在分词'],
  'vegetables':['n.','蔬菜（复数）'],
  'helps':['v.','help 的第三人称单数'],
  'stay':['v.','停留，保持'],
  'reduces':['v.','reduce 的第三人称单数'],
  'proved':['v.','prove 的过去式'],
  'find':['v.','找到'],
  'easy':['adj.','容易的'],
  'solution':['n.','解决办法'],
  'main':['adj.','主要的'],
  'reason':['n.','原因'],
  'failure':['n.','失败'],
  'laziness':['n.','懒惰'],
  'purpose':['n.','目的'],
  'discuss':['v.','讨论'],
  'result':['n./v.','结果'],
  'chance':['n.','机会'],
  'example':['n.','例子'],
  'start':['v./n.','开始'],
  'simple':['adj.','简单的'],
  'advantage':['n.','优点'],
  'flexibility':['n.','灵活性'],
  'disadvantage':['n.','缺点'],
  'costs':['v./n.','花费'],
  'short':['adj.','短的'],
  'make':['v.','做，使'],
  'difference':['n.','差别，影响'],
  'attention':['n.','注意'],
  'money':['n.','钱'],
  'spent':['v.','spend 的过去式'],
  'project':['n.','项目'],
  'class':['n.','班级；课'],
  'fifty':['num.','五十'],
  'advanced':['adj.','高级的'],
  'product':['n.','产品'],
  'meets':['v.','meet 的第三人称单数'],
  'international':['adj.','国际的'],
  'standards':['n.','标准（复数）'],
  'condition':['n.','条件，状况'],
  'give':['v.','给'],
  'getting':['v.','get 的现在分词'],
  'applied':['v.','apply 的过去式'],
  'manager':['n.','经理'],
  'chose':['v.','choose 的过去式'],
  'career':['n.','职业'],
  'college':['n.','大学，学院'],
  'want':['v.','想要'],
  'admitted':['v.','admit 的过去式'],
  'key':['adj./n.','关键的；钥匙'],
  'university':['n.','大学'],
  'holds':['v.','hold 的第三人称单数'],
  'degree':['n.','学位；程度'],
  'engineering':['n.','工程学'],
  'employs':['v.','employ 的第三人称单数'],
  'workers':['n.','工人（复数）'],
  'interview':['n./v.','面试'],
  'morning':['n.','早晨'],
  'salary':['n.','薪水'],
  'high':['adj.','高的'],
  'meaningful':['adj.','有意义的'],
  'manages':['v.','manage 的第三人称单数'],
  'team':['n.','团队'],
  'six':['num.','六'],
  'organised':['v.','organise 的过去式'],
  'charity':['n.','慈善'],
  'sale':['n.','销售'],
  'many':['adj.','许多'],
  'schools':['n.','学校（复数）'],
  'donated':['v.','donate 的过去式，捐赠'],
  'responsibility':['n.','责任'],
  'earth':['n.','地球'],
  'attitude':['n.','态度'],
  'overcome':['v.','克服'],
  'difficulties':['n.','困难（复数）'],
  'opinion':['n.','看法'],
  'best':['adj.','最好的'],
  'policy':['n.','政策'],
  'quite':['adv.','相当'],
  'agree':['v.','同意'],
  'said':['v.','say 的过去式'],
  'argued':['v.','argue 的过去式'],
  'about':['prep.','关于'],
  'believe':['v.','相信'],
  'pays':['v.','pay 的第三人称单数'],
  'remember':['v.','记得'],
  'turn':['v./n.','转；轮到'],
  'lights':['n.','灯（复数）'],
  'leave':['v.','离开'],
  'forget':['v.','忘记'],
  'bring':['v.','带来'],
  'card':['n.','卡片'],
  'noticed':['v.','notice 的过去式'],
  'looked':['v.','look 的过去式'],
  'tired':['adj.','疲倦的'],
  'recognise':['v.','认出'],
  'first':['adv./adj.','首先；第一的'],
  'compared':['v.','compare 的过去分词'],
  'year':['n.','年'],
  'sales':['n.','销售额'],
  'increased':['v.','increase 的过去式'],
  'contrast':['n./v.','对比'],
  'faster':['adj.','更快的'],
  'includes':['v.','include 的第三人称单数'],
  'price':['n.','价格'],
  'breakfast':['n.','早餐'],
  'contains':['v.','contain 的第三人称单数'],
  'drink':['n./v.','饮料；喝'],
  'sugar':['n.','糖'],
  'factory':['n.','工厂'],
  'produces':['v.','produce 的第三人称单数'],
  'electronic':['adj.','电子的'],
  'products':['n.','产品（复数）'],
  'creates':['v.','create 的第三人称单数'],
  'jobs':['n.','工作（复数）'],
  'every':['adj.','每个'],
  'building':['n./v.','建筑；建造'],
  'campus':['n.','校园'],
  'wild':['adj.','野生的'],
  'animals':['n.','动物（复数）'],
  'washing':['n./v.','洗'],
  'hands':['n.','手（复数）'],
  'prevent':['v.','预防'],
  'diseases':['n.','疾病（复数）'],
  'teacher':['n.','老师'],
  'encouraged':['v.','encourage 的过去式'],
  'going':['v.','go 的现在分词'],
  'allow':['v.','允许'],
  'late':['adj./adv.','晚的'],
  'accepted':['v.','accept 的过去式'],
  'pleasure':['n.','愉快'],
  'refused':['v.','refuse 的过去式'],
  'dream':['n./v.','梦想'],
  'received':['v.','receive 的过去式'],
  'letter':['n.','信'],
  'yesterday':['adv./n.','昨天'],
  'offered':['v.','offer 的过去式'],
  'part':['n.','部分'],
  'time':['n.','时间'],
  'spends':['v.','spend 的第三人称单数'],
  'trip':['n.','旅行'],
  'nearly':['adv.','将近'],
  'thousand':['num.','千'],
  'yuan':['n.','元'],
  'save':['v.','节约'],
  'water':['n.','水'],
  'daily':['adj.','日常的'],
  'afford':['v.','买得起'],
  'expensive':['adj.','昂贵的'],
  'rain':['n./v.','雨'],
  'continued':['v.','continue 的过去式'],
  'night':['n.','夜晚'],
  'stopped':['v.','stop 的过去式'],
  'smoking':['n./v.','吸烟'],
  'finished':['v.','finish 的过去式'],
  'dinner':['n.','晚餐'],
  'took':['v.','take 的过去式'],
  'month':['n.','月'],
  'complete':['v./adj.','完成；完整的'],
  'starts':['v.','start 的第三人称单数'],
  'nine':['num.','九'],
  'returned':['v.','return 的过去式'],
  'home':['n./adv.','家'],
  'arrived':['v.','arrive 的过去式'],
  'station':['n.','车站'],
  'helps':['v.','帮助'],
  'different':['adj.','不同的'],
  'cultures':['n.','文化（复数）'],
  'visited':['v.','visit 的过去式'],
  'palace':['n.','宫殿'],
  'museum':['n.','博物馆'],
  'summer':['n.','夏天'],
  'stayed':['v.','stay 的过去式'],
  'small':['adj.','小的'],
  'week':['n.','周'],
  'rainbow':['n.','彩虹'],
  'appeared':['v.','appear 的过去式'],
  'itself':['pron.','它自己'],
  'happened':['v.','happen 的过去式'],
  'keeps':['v.','keep 的第三人称单数'],
  'growing':['v.','grow 的现在分词'],
  'prices':['n.','价格（复数）'],
  'fallen':['v.','fall 的过去分词'],
  'since':['prep./conj.','自从；因为'],
  'sun':['n.','太阳'],
  'rises':['v.','rise 的第三人称单数'],
  'east':['n.','东方']
};
(function patchLookup3(){
  const _l = lookupWord;
  lookupWord = function(word){
    const hit = _l(word);
    if(hit) return hit;
    const w = String(word).toLowerCase().replace(/[^a-z']/g,'');
    if(EXTRA_LEX[w]) return {w:word, ph:'', def:EXTRA_LEX[w][0]+' '+EXTRA_LEX[w][1],
      matched:w, isExtra:true};
    // 再试还原形式
    for(const f of baseForms(w)){
      if(EXTRA_LEX[f]) return {w:f, ph:'', def:EXTRA_LEX[f][0]+' '+EXTRA_LEX[f][1],
        matched:f, isExtra:true};
    }
    return null;
  };
})();

/* 末批补充 */
Object.assign(EXTRA_LEX, {
  'two':['num.','二'],'three':['num.','三'],'four':['num.','四'],'five':['num.','五'],
  'six':['num.','六'],'seven':['num.','七'],'eight':['num.','八'],'nine':['num.','九'],
  'ten':['num.','十'],'cannot':['modal','不能（can not 的合写）'],
  'scientists':['n.','科学家（复数）'],'contributions':['n.','贡献（复数）'],
  'fought':['v.','fight 的过去式，战斗'],'french':['adj./n.','法语的；法语'],
  'blew':['v.','blow 的过去式，吹'],'introduction':['n.','介绍'],
  'delivery':['n.','递送，配送'],'smokers':['n.','吸烟者（复数）'],
  'meaningless':['adj.','无意义的'],'laid':['v.','lay 的过去式，放置'],
  'unattended':['adj.','无人看管的'],'alphabetical':['adj.','按字母顺序的'],
  'apology':['n.','道歉'],'xi':['n.','（Xi\'an 西安）'],
  'application':['n.','申请；应用'],'unanswered':['adj.','未回答的'],
  'trifles':['n.','琐事'],'firemen':['n.','消防员（复数）'],
  'rescued':['v.','rescue 的过去式，营救'],'temptation':['n.','诱惑'],
  'resist':['v.','抵抗'],'wore':['v.','wear 的过去式，穿'],
  'struck':['v.','strike 的过去式，敲'],'clock':['n.','钟'],
  'twelve':['num.','十二'],'survived':['v.','survive 的过去式'],
  'plants':['n.','植物（复数）'],'cold':['n./adj.','寒冷'],
  'sunrise':['n.','日出'],'together':['adv.','一起'],
  'dress':['n./v.','连衣裙；穿衣'],'party':['n.','聚会'],
  'rubbish':['n.','垃圾'],'everywhere':['adv.','到处'],
  'patients':['n.','病人（复数）'],'care':['n./v.','关心，照料'],
  'engineer':['n.','工程师'],'trained':['v.','train 的过去式，训练'],
  'goods':['n.','商品'],'supplies':['v./n.','供应'],
  'stress':['n.','压力'],'suffer':['v.','受苦'],
  'exercise':['n./v.','锻炼'],'doubled':['v.','double 的过去式，翻倍'],
  'income':['n.','收入'],'appreciate':['v.','感激'],
  'behalf':['n.','代表'],'invite':['v.','邀请'],
  'wonder':['v.','想知道'],'success':['n.','成功'],
  'wish':['v./n.','希望'],'welcome':['v./adj.','欢迎'],
  'watched':['v.','watch 的过去式'],'warned':['v.','warn 的过去式，警告'],
  'cure':['n./v.','治愈'],'mental':['adj.','心理的'],
  'illness':['n.','疾病'],'replace':['v.','取代'],
  'professional':['adj.','专业的'],'treatment':['n.','治疗'],
  'waited':['v.','wait 的过去式'],'half':['n./adj.','一半'],
  'value':['v./n.','珍惜；价值'],'vary':['v.','不同'],
  'shop':['n./v.','商店'],'visit':['v./n.','参观'],
  'volunteer':['v./n.','志愿'],'wait':['v.','等待'],
  'wake':['v.','醒来'],'wall':['n.','墙'],'warm':['adj.','温暖的'],
  'wash':['v.','洗'],'wave':['n./v.','波浪；挥手'],
  'website':['n.','网站'],'wedding':['n.','婚礼'],
  'weekend':['n.','周末'],'west':['n.','西方'],'wet':['adj.','湿的'],
  'wheel':['n.','轮子'],'white':['adj.','白色的'],'wind':['n.','风'],
  'window':['n.','窗户'],'wine':['n.','酒'],'winter':['n.','冬天'],
  'wood':['n.','木头'],'worry':['v.','担心'],'wrong':['adj.','错误的'],
  'young':['adj.','年轻的'],'zero':['num.','零']
});
