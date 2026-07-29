/* ============================================================
   深度卡 UI —— 答题后弹出
   内容：拆解（可读）+ 同义替换 + 真题例句 + 家族词
   ============================================================ */

let DEEP_OPEN = false;
let deepData = null;

function showDeep(wordArr, opt){
  opt = opt || {};
  deepData = deepCard(wordArr);
  deepData._opt = opt;
  DEEP_OPEN = true;
  let host = document.getElementById('deepHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'deepHost';
    document.body.appendChild(host);
  }
  host.innerHTML = deepHTML(deepData);
  document.body.classList.add('deep-lock');
}
function closeDeep(next){
  DEEP_OPEN = false;
  const host = document.getElementById('deepHost');
  if(host) host.innerHTML = '';
  document.body.classList.remove('deep-lock');
  if(next && typeof next === 'function') next();
  else if(deepData && deepData._opt && deepData._opt.onClose) deepData._opt.onClose();
}

function deepHTML(d){
  const o = d._opt || {};
  const tierName = (typeof TIER_INFO!=='undefined' && TIER_INFO[d.tier]) ? TIER_INFO[d.tier].name : '';
  const mark = d.lv===1?'▲':d.lv===2?'◆':'';
  return `
  <div class="deep-mask" onclick="closeDeep()"></div>
  <div class="deep-sheet">
    <div class="deep-grip"></div>

    <div class="deep-hd ${o.correct===false?'bad':o.correct===true?'ok':''}">
      ${o.correct!==undefined?`<div class="deep-res">${o.correct?'✓ 答对了':'✗ 答错了'}</div>`:''}
      <div class="deep-w">
        <span class="dw-t">${d.w}</span>
        <button class="dw-spk" onclick="speak('${esc2(d.w)}')">🔊</button>
        <button class="dw-spk slow" onclick="speakSlow('${esc2(d.w)}')">🐢</button>
      </div>
      ${d.ph?`<div class="deep-ph">${d.ph}</div>`:''}
      <div class="deep-def">${d.def||''}</div>
      ${(mark||tierName)?`<div class="deep-tags">
        ${mark?`<span class="dt ${d.lv===1?'up':'dia'}">${mark} ${d.lv===1?'基础模块新增':'拓展模块新增'}</span>`:''}
        ${tierName?`<span class="dt">${tierName}</span>`:''}
      </div>`:''}
      ${o.rep?`<div class="deep-rep">第 ${o.rep} / ${REPEAT} 遍${o.rep>=REPEAT?'　✓ 本轮完成':''}</div>`:''}
    </div>

    <div class="deep-body">
      ${deepMorph(d)}
      ${deepSent(d)}
      ${deepSyn(d)}
      ${deepAdvice(d)}
    </div>

    <div class="deep-foot">
      <button class="deep-btn" onclick="closeDeep()">${o.btnText||'继续'}</button>
    </div>
  </div>`;
}
function esc2(s){return String(s).replace(/'/g,"\\'").replace(/"/g,'&quot;')}

/* ---------- 构词拆解 ---------- */
function deepMorph(d){
  if(!d.morph.length) return '';
  const kindName={root:'词根',prefix:'前缀',suffix:'后缀'};
  return `
  <div class="deep-sec">
    <div class="ds-t"><i>🧬</i>怎么拆</div>
    ${d.morph.slice(0,2).map(m=>`
      <div class="dm-card">
        <div class="dm-top">
          <span class="dm-kind ${m.kind}">${kindName[m.kind]}</span>
          <span class="dm-key">${m.key}</span>
          <span class="dm-mean">${m.mean}</span>
          <button class="dm-spk" onclick="speak('${esc2(m.key.replace(/[-\/]/g,' '))}')">🔊</button>
        </div>
        <div class="dm-split">${m.split}</div>
        ${m.pos?`<div class="dm-pos">→ 变成${m.pos}</div>`:''}
        ${m.from?`<div class="dm-from">${m.from}</div>`:''}
        ${m.tip?`<div class="dm-tip">${m.tip}</div>`:''}
        ${m.family&&m.family.length?`
          <div class="dm-fam-t">同族词（一起记）</div>
          <div class="dm-fam">
            ${m.family.slice(0,5).map(f=>`
              <div class="dm-fw" onclick="speak('${esc2(f[0])}')">
                <b>${f[0]}</b><span>${f[1]}</span>
              </div>`).join('')}
          </div>`:''}
      </div>`).join('')}
  </div>`;
}

/* ---------- 真题例句 ---------- */
function deepSent(d){
  if(!d.sents.length) return '';
  return `
  <div class="deep-sec">
    <div class="ds-t"><i>📖</i>在句子里记</div>
    ${d.sents.map(s=>`
      <div class="dsn-card">
        <div class="dsn-top">
          <span class="dsn-src">${s.src}</span>
          <button class="dsn-spk" onclick="speak('${esc2(s.sent)}')">🔊</button>
        </div>
        <div class="dsn-en">${hlWord(s.sent, d.w)}</div>
        ${s.cn?`<div class="dsn-cn">${s.cn}</div>`:''}
        ${s.note?`<div class="dsn-note">${s.note}</div>`:''}
      </div>`).join('')}
  </div>`;
}
function hlWord(sent, w){
  const base=String(w).split('/')[0].toLowerCase();
  if(base.length<3) return sent;
  const stem=base.replace(/(e|y)$/,'');
  try{
    const re=new RegExp('\\b('+stem+'[a-z]*)\\b','ig');
    return sent.replace(re,'<b class="hl">$1</b>');
  }catch(e){ return sent; }
}

/* ---------- 同义替换 ---------- */
function deepSyn(d){
  if(!d.syn.length) return '';
  return `
  <div class="deep-sec">
    <div class="ds-t"><i>🔄</i>阅读里的同义替换</div>
    ${d.syn.slice(0,2).map(s=>`
      <div class="dsy-card">
        <div class="dsy-topic">${s.topic}　<span>题干和原文常互换</span></div>
        <div class="dsy-list">
          ${s.others.map(x=>`<span class="dsy-tag" onclick="speak('${esc2(x)}')">${x}</span>`).join('')}
        </div>
        ${s.ex?`<div class="dsy-ex">${s.ex}</div>`:''}
        ${s.note?`<div class="dsy-note">${s.note}</div>`:''}
      </div>`).join('')}
  </div>`;
}


/* ---------- 学法建议卡（兜底） ---------- */
function deepAdvice(d){
  if(!d.advice) return '';
  const a=d.advice;
  return `
  <div class="deep-sec">
    <div class="ds-t"><i>🎯</i>怎么记这个词</div>
    <div class="dav-card">
      <div class="dav-text">${a.text}</div>
      ${a.sibs&&a.sibs.length?`
        <div class="dav-sib-t">同档位的词一起记</div>
        <div class="dav-sibs">
          ${a.sibs.map(s=>`
            <div class="dav-sw" onclick="speak('${esc2(s[0])}')">
              <b>${s[0]}</b><span>${s[1]}</span>
            </div>`).join('')}
        </div>`:''}
      <div class="dav-tip">拼写练习必须动笔。看着眼熟 ≠ 写得出来，
        这是取消选择题之后最大的失分来源。</div>
    </div>
  </div>`;
}
