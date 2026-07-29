/* ============================================================
   深度学习引擎 v5
   1) 三遍循环：新词当轮必须答对 3 次（间隔递增）才算过
   2) 答题后弹出深度卡：词根词缀 + 同义替换 + 真题例句
   3) 词根词缀可朗读、有翻译与用法
   4) 复习词同样走深度卡，符合记忆曲线
   ============================================================ */

/* ---------- 一、词 → 词根/词缀 反向索引 ---------- */
let WORD_MORPH = null;
function buildMorphIndex(){
  if(WORD_MORPH) return WORD_MORPH;
  WORD_MORPH = {};
  // 词根派生词
  ROOTS.forEach(r=>{
    r.words.forEach(w=>{
      const k=w[0].toLowerCase();
      (WORD_MORPH[k]=WORD_MORPH[k]||[]).push({
        kind:'root', key:r.r, mean:r.mean, from:r.from,
        split:w[1], def:w[2], tip:r.tip,
        family:r.words.filter(x=>x[0]!==w[0]).map(x=>[x[0],x[2]])
      });
    });
  });
  // 前缀
  PREFIXES.forEach(p=>{
    p.ex.forEach(e=>{
      const parts=e[0].split('→');
      if(parts.length<2) return;
      const k=parts[1].trim().toLowerCase();
      (WORD_MORPH[k]=WORD_MORPH[k]||[]).push({
        kind:'prefix', key:p.p, mean:p.mean,
        split:e[0], def:e[1], tip:p.note,
        family:p.ex.filter(x=>x[0]!==e[0]).map(x=>[x[0].split('→')[1]||x[0],x[1]])
      });
    });
  });
  // 后缀
  SUFFIXES.forEach(s=>{
    s.ex.forEach(e=>{
      const parts=e[0].split('→');
      if(parts.length<2) return;
      parts[1].split('/').forEach(one=>{
        const k=one.trim().toLowerCase();
        (WORD_MORPH[k]=WORD_MORPH[k]||[]).push({
          kind:'suffix', key:s.s, mean:s.mean, pos:s.pos,
          split:e[0], def:e[1], tip:s.note,
          family:s.ex.filter(x=>x[0]!==e[0]).map(x=>[(x[0].split('→')[1]||x[0]).split('/')[0],x[1]])
        });
      });
    });
  });
  return WORD_MORPH;
}
function morphOf(word){
  const idx=buildMorphIndex();
  const k=String(word||'').toLowerCase().split('/')[0];
  return idx[k]||[];
}

/* ---------- 二、词 → 同义替换组 ---------- */
let WORD_SYN=null;
function buildSynIndex(){
  if(WORD_SYN) return WORD_SYN;
  WORD_SYN={};
  SYNONYMS.forEach(s=>{
    const all=[s.core].concat(s.words);
    all.forEach(w=>{
      const k=w.toLowerCase().split(' ')[0];
      (WORD_SYN[k]=WORD_SYN[k]||[]).push({
        topic:s.topic, core:s.core,
        others:all.filter(x=>x.toLowerCase()!==w.toLowerCase()),
        ex:s.ex, note:s.note||''
      });
    });
  });
  return WORD_SYN;
}
function synOf(word){
  const idx=buildSynIndex();
  const k=String(word||'').toLowerCase().split('/')[0];
  return idx[k]||[];
}

/* ---------- 三、词 → 真题例句 ---------- */
let WORD_SENT=null;
function buildSentIndex(){
  if(WORD_SENT) return WORD_SENT;
  WORD_SENT={};
  const add=(w,o)=>{const k=w.toLowerCase();(WORD_SENT[k]=WORD_SENT[k]||[]).push(o)};
  // 真题词汇表
  EXAM_WORDS.forEach(e=>{
    add(e.w.split(' ')[0], {sent:e.sent, src:e.src, note:e.note, cn:e.def});
  });
  // 语法填空原文（还原挖空为正确答案，学习时看完整句）
  GAP_ITEMS.forEach(g=>{
    let buf='';
    g.text.forEach(seg=>{ buf += seg.t ? seg.t : (seg.ans&&seg.ans[0] ? seg.ans[0] : ''); });
    buf.split(/(?<=\.)\s+/).forEach(s=>{
      const clean=s.trim(); if(clean.length<25) return;
      clean.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).forEach(w=>{
        if(w.length<4) return;
        if((WORD_SENT[w]||[]).some(x=>x.sent===clean)) return;
        add(w,{sent:clean, src:g.src+'·'+g.title, note:'', cn:''});
      });
    });
  });
  // 完成句子
  TRANS_ITEMS.forEach(t=>{
    const full=t.en.replace('______', t.ans[0]);
    full.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).forEach(w=>{
      if(w.length<4) return;
      if((WORD_SENT[w]||[]).some(x=>x.sent===full)) return;
      add(w,{sent:full, src:'完成句子', note:t.why, cn:t.cn});
    });
  });
  // 阅读原文
  READ_ITEMS.forEach(r=>{
    r.text.split(/\n+/).forEach(para=>{
      para.split(/(?<=\.)\s+/).forEach(s=>{
        const clean=s.trim(); if(clean.length<30||clean.length>170) return;
        clean.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).forEach(w=>{
          if(w.length<5) return;
          if((WORD_SENT[w]||[]).length>=2) return;
          if((WORD_SENT[w]||[]).some(x=>x.sent===clean)) return;
          add(w,{sent:clean, src:r.src+'·阅读', note:'', cn:''});
        });
      });
    });
  });
  return WORD_SENT;
}
function sentOf(word){
  const idx=buildSentIndex();
  const k=String(word||'').toLowerCase().split('/')[0];
  return (idx[k]||[]).slice(0,3);
}

/* ---------- 四、深度卡数据组装 ---------- */
function deepCard(wordArr){
  const w = Array.isArray(wordArr)?wordArr[0]:wordArr;
  const item = Array.isArray(wordArr)?wordArr:null;
  // 官方标记与档位以 VOCAB3000 为准（旧库第4位是难度等级，含义不同）
  let lv=0, tier=0;
  if(typeof VOCAB3000!=='undefined'){
    const key=String(w).toLowerCase().split('/')[0];
    const hit=VOCAB3000.find(x=>String(x[0]).toLowerCase().split('/')[0]===key);
    if(hit){ lv=hit[3]; tier=hit[4]; }
  }
  return {
    w: w,
    ph: item?item[1]:'',
    def: item?item[2]:'',
    lv: lv,
    tier: tier,
    morph: morphOf(w),
    syn: synOf(w),
    sents: sentOf(w)
  };
}
function hasDeep(wordArr){
  const d=deepCard(wordArr);
  return d.morph.length||d.syn.length||d.sents.length;
}

/* ---------- 五、三遍循环调度 ---------- */
/* 规则：新词在本轮内必须答对 REPEAT 次才算完成
   两次之间至少间隔 GAP 道其他题，避免刚看完就答（短期记忆作弊） */
const REPEAT = 3;
const GAP = 4;

function makeQueue(plan){
  // plan = {news:[...], reviews:[...]}
  const q=[];
  // 新词：学习卡 + 第1遍
  plan.news.forEach(w=>{
    q.push({kind:'study', word:w, rep:0});
    q.push({kind:'quiz', word:w, rep:1, isNew:true, afterStudy:true});
  });
  // 复习词：直接出题（复习词也要 2 遍）
  plan.reviews.forEach(w=>{
    q.push({kind:'quiz', word:w, rep:1, isNew:false});
  });
  return shuffleKeepStudy(q);
}
// 打乱但保证 study 紧跟它的第一次 quiz
function shuffleKeepStudy(q){
  const pairs=[], singles=[];
  for(let i=0;i<q.length;i++){
    if(q[i].kind==='study'&&q[i+1]&&q[i+1].word[0]===q[i].word[0]){
      pairs.push([q[i],q[i+1]]); i++;
    } else singles.push(q[i]);
  }
  const all=pairs.concat(singles.map(x=>[x]));
  for(let i=all.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[all[i],all[j]]=[all[j],all[i]]}
  return all.flat();
}

/* 答对后：若未满 REPEAT 遍，把该词重新插回队列后方 */
function scheduleRepeat(queue, curIdx, task, targetRep){
  const nextRep = task.rep + 1;
  if(nextRep > targetRep) return queue;
  // 插入位置：当前之后至少 GAP 个
  let pos = Math.min(curIdx + 1 + GAP + Math.floor(Math.random()*3), queue.length);
  const nt = {kind:'quiz', word:task.word, rep:nextRep,
              isNew:task.isNew, afterStudy:false};
  queue.splice(pos, 0, nt);
  return queue;
}
/* 答错：本词重来，遍数归零，插到较近位置 */
function scheduleRetry(queue, curIdx, task){
  const nt={kind:'quiz', word:task.word, rep:1, isNew:task.isNew, afterStudy:false, retry:true};
  const pos=Math.min(curIdx+1+2+Math.floor(Math.random()*2), queue.length);
  queue.splice(pos,0,nt);
  return queue;
}

/* ---------- 六、按遍数选题型（难度递增） ---------- */
function questionByRep(wordArr, rep, famLevel){
  // 第1遍：认（英译汉，最易）
  // 第2遍：想（汉译英 或 选择拼写）
  // 第3遍：写（拼写填空，最难）
  const w=wordArr;
  if(rep<=1) return buildQ(w,'e2c','choice');
  if(rep===2){
    return famLevel>=3 ? buildQ(w,'c2e','blank') : buildQ(w,'c2e','choice');
  }
  return buildQ(w,'spell','blank');
}


/* ---------- 七、补充例句库（覆盖高频词，全部为考试语域） ---------- */
const EXTRA_SENTS = [
  ['important','Education plays an important role in personal development.','教育在个人发展中起重要作用。'],
  ['develop','China has developed rapidly over the past forty years.','中国在过去四十年里发展迅速。'],
  ['improve','Reading every day can improve your writing skills.','每天阅读能提高你的写作能力。'],
  ['increase','The number of online shoppers has increased sharply.','网购人数急剧增加。'],
  ['reduce','We should reduce the use of plastic bags.','我们应该减少塑料袋的使用。'],
  ['provide','The school provides students with free lunch.','学校为学生提供免费午餐。'],
  ['consider','You should consider the problem carefully.','你应该仔细考虑这个问题。'],
  ['achieve','He worked hard to achieve his goal.','他努力工作以实现目标。'],
  ['support','My parents always support my decisions.','我父母总是支持我的决定。'],
  ['require','This job requires great patience.','这份工作需要极大的耐心。'],
  ['suggest','The doctor suggested that he take more exercise.','医生建议他多锻炼。'],
  ['prefer','I prefer tea to coffee.','比起咖啡我更喜欢茶。'],
  ['avoid','We left early to avoid the traffic jam.','我们早早出发以避开交通堵塞。'],
  ['depend','Success depends on hard work.','成功取决于努力。'],
  ['realise','I suddenly realised that I had left my keys at home.','我突然意识到把钥匙落在家里了。'],
  ['express','It is hard to express my feelings in words.','很难用语言表达我的感受。'],
  ['influence','Parents have a great influence on their children.','父母对孩子有很大影响。'],
  ['cause','Careless driving causes many accidents.','粗心驾驶造成许多事故。'],
  ['result','His hard work resulted in great success.','他的努力带来了巨大成功。'],
  ['effect','Exercise has a positive effect on health.','锻炼对健康有积极影响。'],
  ['benefit','Reading benefits both mind and heart.','阅读对心智和心灵都有益。'],
  ['challenge','Learning a new language is a real challenge.','学习一门新语言是真正的挑战。'],
  ['opportunity','This is a good opportunity to practise English.','这是练习英语的好机会。'],
  ['experience','She has rich experience in teaching.','她有丰富的教学经验。'],
  ['knowledge','Knowledge is power.','知识就是力量。'],
  ['ability','He has the ability to solve difficult problems.','他有能力解决难题。'],
  ['attention','Please pay attention to your spelling.','请注意你的拼写。'],
  ['environment','We must protect the environment for future generations.','我们必须为子孙后代保护环境。'],
  ['pollution','Air pollution has become a serious problem.','空气污染已成为严重问题。'],
  ['society','Everyone should contribute to society.','每个人都应该为社会做贡献。'],
  ['culture','Chinese culture has a long history.','中国文化历史悠久。'],
  ['technology','Technology has changed the way we live.','科技改变了我们的生活方式。'],
  ['information','You can find useful information on the Internet.','你可以在网上找到有用的信息。'],
  ['communicate','It is important to communicate with your parents.','与父母沟通很重要。'],
  ['understand','I cannot understand what he means.','我无法理解他的意思。'],
  ['explain','Could you explain this rule to me?','你能给我解释一下这条规则吗？'],
  ['describe','Please describe the picture in your own words.','请用自己的话描述这幅图。'],
  ['discuss','We discussed the plan for two hours.','我们讨论这个计划两个小时。'],
  ['decide','She decided to study abroad.','她决定出国留学。'],
  ['choose','You can choose either of the two books.','这两本书你可以任选一本。'],
  ['prepare','I am preparing for the entrance examination.','我正在准备入学考试。'],
  ['succeed','If you keep trying, you will succeed.','如果你不断尝试，你会成功的。'],
  ['fail','He failed the exam because of carelessness.','他因粗心而考试不及格。'],
  ['practice','Practice makes perfect.','熟能生巧。'],
  ['progress','You have made great progress this term.','这学期你进步很大。'],
  ['difficult','It is difficult to learn English well without practice.','不练习很难学好英语。'],
  ['necessary','It is necessary for us to keep healthy habits.','我们有必要保持健康的习惯。'],
  ['possible','It is possible to finish the work today.','今天完成这项工作是可能的。'],
  ['available','The book is available in the library.','这本书在图书馆可以借到。'],
  ['popular','Slow travel is becoming popular among young people.','慢旅行在年轻人中越来越流行。'],
  ['common','It is common for students to feel nervous before exams.','学生考前紧张很常见。'],
  ['serious','Air pollution is a serious problem in big cities.','空气污染是大城市的严重问题。'],
  ['modern','Modern life is much more convenient than before.','现代生活比以前方便得多。'],
  ['traditional','Traditional festivals are worth preserving.','传统节日值得保留。'],
  ['effective','This is an effective way to memorise words.','这是记单词的有效方法。'],
  ['successful','He is a successful businessman.','他是一位成功的商人。'],
  ['confident','Be confident and you will do better.','自信一点，你会做得更好。'],
  ['careful','Be careful when you cross the street.','过马路时要小心。'],
  ['patient','Teachers should be patient with slow learners.','老师应该对学得慢的学生有耐心。'],
  ['friendly','The local people are very friendly to visitors.','当地人对游客非常友好。'],
  ['healthy','Eating vegetables helps you stay healthy.','吃蔬菜有助于保持健康。'],
  ['exercise','Regular exercise reduces stress.','规律锻炼能减轻压力。'],
  ['method','This method has proved to be useful.','这个方法已被证明有用。'],
  ['problem','We must find a way to solve this problem.','我们必须找到解决这个问题的办法。'],
  ['solution','There is no easy solution to the problem.','这个问题没有简单的解决办法。'],
  ['reason','The main reason for his failure was laziness.','他失败的主要原因是懒惰。'],
  ['purpose','The purpose of the meeting is to discuss the plan.','会议的目的是讨论计划。'],
  ['result','As a result, he lost the chance.','结果，他失去了机会。'],
  ['example','For example, we can start with simple words.','例如，我们可以从简单的词开始。'],
  ['advantage','One advantage of online learning is flexibility.','在线学习的一个优点是灵活。'],
  ['disadvantage','The disadvantage is that it costs too much.','缺点是花费太大。'],
  ['difference','Even a short walk can make a difference.','即使短途散步也会带来改变。'],
  ['quality','We should pay attention to the quality of life.','我们应该关注生活质量。'],
  ['amount','A large amount of money was spent on the project.','大量资金花在了这个项目上。'],
  ['number','The number of students in our class is fifty.','我们班学生人数是五十。'],
  ['level','His English is at an advanced level.','他的英语达到了高级水平。'],
  ['standard','The product meets international standards.','该产品符合国际标准。'],
  ['condition','Under no condition should you give up.','无论如何你都不应该放弃。'],
  ['situation','The situation is getting better.','情况正在好转。'],
  ['position','He applied for the position of manager.','他申请了经理职位。'],
  ['career','She chose teaching as her career.','她选择教书作为职业。'],
  ['graduate','After I graduate from college, I want to work in a hospital.','大学毕业后我想在医院工作。'],
  ['university','He was admitted to a key university.','他被一所重点大学录取了。'],
  ['degree','She holds a degree in engineering.','她拥有工程学学位。'],
  ['employ','The company employs over 500 workers.','这家公司雇用五百多名工人。'],
  ['interview','I have a job interview tomorrow morning.','我明天上午有一场求职面试。'],
  ['salary','The salary is not high, but the work is meaningful.','薪水不高，但工作有意义。'],
  ['manage','She manages a small team of six people.','她管理着一个六人的小团队。'],
  ['organise','The students organised a charity sale.','学生们组织了一场义卖。'],
  ['volunteer','Many young people volunteer in rural schools.','许多年轻人在农村学校做志愿者。'],
  ['charity','They donated the money to charity.','他们把钱捐给了慈善机构。'],
  ['responsibility','It is our responsibility to protect the earth.','保护地球是我们的责任。'],
  ['attitude','A positive attitude helps you overcome difficulties.','积极的态度帮助你克服困难。'],
  ['opinion','In my opinion, honesty is the best policy.','在我看来，诚实是上策。'],
  ['agree','I quite agree with what you said.','我完全同意你说的话。'],
  ['argue','They argued about the plan for a long time.','他们就这个计划争论了很久。'],
  ['believe','I firmly believe that hard work pays off.','我坚信努力会有回报。'],
  ['remember','Remember to turn off the lights before you leave.','离开前记得关灯。'],
  ['forget','Don\'t forget to bring your ID card.','别忘了带身份证。'],
  ['notice','I noticed that he looked tired.','我注意到他看起来很累。'],
  ['recognise','I did not recognise him at first.','我起初没认出他来。'],
  ['compare','Compared with last year, the sales have increased.','与去年相比，销售额增加了。'],
  ['contrast','In contrast, city life is much faster.','相比之下，城市生活节奏快得多。'],
  ['include','The price includes breakfast.','价格包含早餐。'],
  ['contain','This drink contains no sugar.','这种饮料不含糖。'],
  ['produce','The factory produces electronic products.','这家工厂生产电子产品。'],
  ['create','Technology creates new jobs every year.','科技每年创造新的工作岗位。'],
  ['build','They are building a new library on campus.','他们正在校园里建一座新图书馆。'],
  ['protect','We should protect wild animals.','我们应该保护野生动物。'],
  ['prevent','Washing hands can prevent diseases.','洗手能预防疾病。'],
  ['encourage','My teacher encouraged me to keep going.','老师鼓励我坚持下去。'],
  ['allow','My parents do not allow me to stay up late.','父母不允许我熬夜。'],
  ['accept','He accepted the invitation with pleasure.','他愉快地接受了邀请。'],
  ['refuse','She refused to give up her dream.','她拒绝放弃自己的梦想。'],
  ['receive','I received your letter yesterday.','我昨天收到了你的信。'],
  ['offer','They offered me a part-time job.','他们给我提供了一份兼职工作。'],
  ['spend','He spends two hours a day reading.','他每天花两小时阅读。'],
  ['cost','The trip cost me nearly a thousand yuan.','这次旅行花了我将近一千元。'],
  ['save','We should save water in our daily life.','我们日常生活中应该节约用水。'],
  ['waste','Do not waste time on meaningless things.','不要把时间浪费在无意义的事上。'],
  ['afford','I cannot afford such an expensive phone.','我买不起这么贵的手机。'],
  ['continue','The rain continued all night.','雨下了一整夜。'],
  ['stop','He stopped smoking for his health.','为了健康他戒烟了。'],
  ['finish','I finished my homework before dinner.','我晚饭前完成了作业。'],
  ['complete','It took him a month to complete the project.','他花了一个月完成这个项目。'],
  ['start','The meeting starts at nine o\'clock.','会议九点开始。'],
  ['return','He returned home late last night.','他昨晚很晚才回家。'],
  ['arrive','We arrived at the station on time.','我们准时到达车站。'],
  ['travel','Travelling helps us learn about different cultures.','旅行帮助我们了解不同的文化。'],
  ['visit','I visited the Palace Museum last summer.','去年夏天我参观了故宫。'],
  ['stay','They stayed in a small guesthouse for a week.','他们在一家小旅馆住了一周。'],
  ['appear','A rainbow appeared after the rain.','雨后出现了一道彩虹。'],
  ['disappear','The problem will not disappear by itself.','问题不会自己消失。'],
  ['happen','What happened to you yesterday?','你昨天怎么了？'],
  ['change','The change reflects a deeper desire for real experiences.','这一变化反映了对真实体验更深的渴望。'],
  ['grow','The number of tourists keeps growing.','游客数量持续增长。'],
  ['fall','Prices have fallen since last month.','物价自上月以来已经下降。'],
  ['rise','The sun rises in the east.','太阳从东方升起。'],
  ['reflect','The change reflects a deeper desire for real experiences.','这一变化反映了对真实体验更深的渴望。'],
  ['emerge','Slow travel is emerging as a defining trend.','慢旅行正成为一种标志性趋势。'],
  ['trend','This trend will continue to grow.','这一趋势将持续增长。']
];

// 把补充例句并入索引
(function mergeExtra(){
  const _b=buildSentIndex;
  buildSentIndex=function(){
    const idx=_b();
    if(idx.__merged) return idx;
    EXTRA_SENTS.forEach(e=>{
      const k=e[0].toLowerCase();
      idx[k]=idx[k]||[];
      if(!idx[k].some(x=>x.sent===e[1])) idx[k].unshift({sent:e[1], src:'考试例句', note:'', cn:e[2]});
    });
    idx.__merged=true;
    return idx;
  };
})();


/* ---------- 八、通用构词识别（自动拆解，兜底覆盖） ---------- */
/* 说明：手工词库只覆盖高频例词。这里用规则自动识别后缀/前缀，
   让绝大多数词都能给出"怎么拆"，避免深度卡开天窗。 */

const AUTO_SUF = [
  // [后缀, 词性, 含义, 还原规则(把后缀去掉后可能的原形)]
  ['ation','名词','动作、过程、结果', s=>[s+'e', s, s+'ate']],
  ['ition','名词','动作、状态',       s=>[s+'e', s]],
  ['ution','名词','动作、状态',       s=>[s+'e', s]],
  ['sion', '名词','动作、状态',       s=>[s+'d', s+'de', s+'t', s]],
  ['tion', '名词','动作、状态',       s=>[s+'te', s+'t', s]],
  ['ment', '名词','动作的结果或手段', s=>[s]],
  ['ness', '名词','性质、状态',       s=>[s, s.replace(/i$/,'y')]],
  ['ity',  '名词','性质、程度',       s=>[s+'e', s, s.replace(/il$/,'le')]],
  ['ance', '名词','性质、状态',       s=>[s, s+'e']],
  ['ence', '名词','性质、状态',       s=>[s, s+'e']],
  ['ship', '名词','身份、状态、关系', s=>[s]],
  ['hood', '名词','时期、身份',       s=>[s]],
  ['dom',  '名词','领域、状态',       s=>[s]],
  ['ist',  '名词','从事…的人',        s=>[s, s+'e', s.replace(/$/,'y')]],
  ['ian',  '名词','…的人',            s=>[s, s+'y']],
  ['ee',   '名词','受动作的人',       s=>[s, s+'e']],
  ['ure',  '名词','动作、结果',       s=>[s, s+'e']],
  ['age',  '名词','行为、总称',       s=>[s, s+'e']],
  ['ery',  '名词','场所、行为',       s=>[s, s+'e']],
  ['ory',  '名词/形容词','场所；有…性质的', s=>[s, s+'e']],
  ['ful',  '形容词','充满…的',        s=>[s, s.replace(/i$/,'y')]],
  ['less', '形容词','没有…的',        s=>[s, s.replace(/i$/,'y')]],
  ['able', '形容词','能够…的、可被…的', s=>[s, s+'e', s.replace(/i$/,'y')]],
  ['ible', '形容词','能够…的',        s=>[s, s+'e']],
  ['ous',  '形容词','有…性质的',      s=>[s, s+'e', s.replace(/i$/,'y')]],
  ['ious', '形容词','有…性质的',      s=>[s, s+'e', s+'y']],
  ['ive',  '形容词','有…倾向的',      s=>[s, s+'e', s+'t']],
  ['ical', '形容词','…的',            s=>[s, s+'y']],
  ['al',   '形容词','…的、有关…的',   s=>[s, s+'e']],
  ['ary',  '形容词/名词','…的',       s=>[s, s+'e']],
  ['ant',  '形容词/名词','…的；…的人', s=>[s, s+'e']],
  ['ent',  '形容词/名词','…的；…的人', s=>[s, s+'e']],
  ['ish',  '形容词','有点…的、…族的', s=>[s]],
  ['like', '形容词','像…的',          s=>[s]],
  ['ly',   '副词/形容词','以…方式；有…特性的', s=>[s, s.replace(/i$/,'y'), s+'le']],
  ['ward', '副词','朝…方向',          s=>[s]],
  ['wards','副词','朝…方向',          s=>[s]],
  ['ize',  '动词','使…化',            s=>[s, s+'e']],
  ['ise',  '动词','使…化',            s=>[s, s+'e']],
  ['ify',  '动词','使…化',            s=>[s, s+'e', s+'y']],
  ['en',   '动词','使变得…',          s=>[s, s+'e']],
  ['ate',  '动词','使…、做…',         s=>[s, s+'e']]
];
const AUTO_PRE = [
  ['un',    '不、非（否定）'],
  ['im',    '不、非（否定，用于 m/p/b 前）'],
  ['in',    '不、非（否定）；向内'],
  ['il',    '不、非（否定，用于 l 前）'],
  ['ir',    '不、非（否定，用于 r 前）'],
  ['dis',   '不、相反；分开、去除'],
  ['non',   '非、不'],
  ['mis',   '错误地'],
  ['re',    '再、重新；回'],
  ['pre',   '预先、在前'],
  ['post',  '在后'],
  ['fore',  '在前、预先'],
  ['ex',    '向外、出；前任'],
  ['inter', '在…之间、相互'],
  ['intro', '向内'],
  ['trans', '横过、转变'],
  ['sub',   '在下、次于'],
  ['super', '超级、在上'],
  ['over',  '过度、超过'],
  ['under', '在下、不足'],
  ['out',   '向外、超过'],
  ['up',    '向上'],
  ['down',  '向下'],
  ['co',    '共同、一起'],
  ['con',   '共同、一起'],
  ['com',   '共同、一起'],
  ['de',    '向下、去除、相反'],
  ['di',    '分开、两个'],
  ['pro',   '向前、支持'],
  ['anti',  '反对'],
  ['auto',  '自动、自己'],
  ['multi', '多'],
  ['semi',  '半'],
  ['micro', '微小'],
  ['self',  '自我'],
  ['bi',    '两、双'],
  ['tri',   '三'],
  ['uni',   '单一'],
  ['en',    '使…（构成动词）'],
  ['em',    '使…（构成动词）'],
  ['ab',    '离开'],
  ['ad',    '朝向'],
  ['be',    '使…、在…']
];

/* 词表快速查找（判断还原后的原形是否真实存在） */
let _VSET=null;
function vocabSet(){
  if(_VSET) return _VSET;
  _VSET=new Set();
  try{
    const src = (typeof VOCAB3000!=='undefined')?VOCAB3000:
                (typeof ALL_VOCAB!=='undefined'?ALL_VOCAB:[]);
    src.forEach(x=>{
      String(x[0]).toLowerCase().split('/').forEach(p=>_VSET.add(p.trim()));
    });
  }catch(e){}
  return _VSET;
}

function autoMorph(word){
  const w=String(word||'').toLowerCase().split('/')[0].trim();
  if(w.length<5 || !/^[a-z-]+$/.test(w)) return [];
  const V=vocabSet();
  const out=[];

  // 1) 后缀识别：优先匹配最长后缀
  const sufs=AUTO_SUF.slice().sort((a,b)=>b[0].length-a[0].length);
  for(const [suf,pos,mean,restore] of sufs){
    if(!w.endsWith(suf)) continue;
    const stem=w.slice(0,w.length-suf.length);
    if(stem.length<3) continue;
    const cands=restore(stem).concat([stem]);
    const base=cands.find(c=>c&&c!==w&&V.has(c));
    if(base){
      out.push({kind:'suffix', key:'-'+suf, mean:mean, pos:pos,
        split:base+' + -'+suf+' → '+w,
        def:'由「'+base+'」加后缀 -'+suf+' 构成',
        tip:'后缀 -'+suf+' 通常把词变成'+pos+'，表示'+mean+'。认出后缀就能判断词性，这正是语法填空的考点。',
        family:[], auto:true, base:base});
      break;
    }
  }
  // 2) 前缀识别
  const pres=AUTO_PRE.slice().sort((a,b)=>b[0].length-a[0].length);
  for(const [pre,mean] of pres){
    if(!w.startsWith(pre)) continue;
    const rest=w.slice(pre.length);
    if(rest.length<3) continue;
    if(V.has(rest)){
      out.push({kind:'prefix', key:pre+'-', mean:mean,
        split:pre+'- + '+rest+' → '+w,
        def:'由「'+rest+'」加前缀 '+pre+'- 构成',
        tip:'前缀 '+pre+'- 表示「'+mean+'」。前缀改变意思，不改变词性。',
        family:[], auto:true, base:rest});
      break;
    }
  }
  return out;
}

/* 用自动识别兜底 morphOf */
(function patchMorph(){
  const _m=morphOf;
  morphOf=function(word){
    const hit=_m(word);
    if(hit && hit.length) return hit;
    return autoMorph(word);
  };
})();


/* ---------- 九、同族词兜底（同词根/同后缀的词互相关联） ---------- */
/* 对自动识别出的构词，从 3000 词表里找出同后缀/同前缀的真实词作为同族参考 */
let _SUF_GROUP=null, _PRE_GROUP=null;
function buildAffixGroups(){
  if(_SUF_GROUP) return;
  _SUF_GROUP={}; _PRE_GROUP={};
  const src=(typeof VOCAB3000!=='undefined')?VOCAB3000:[];
  const sufs=AUTO_SUF.map(x=>x[0]).sort((a,b)=>b.length-a.length);
  const pres=AUTO_PRE.map(x=>x[0]).sort((a,b)=>b.length-a.length);
  src.forEach(item=>{
    const w=String(item[0]).toLowerCase().split('/')[0];
    if(w.length<5) return;
    for(const s of sufs){
      if(w.endsWith(s)&&w.length-s.length>=3){
        (_SUF_GROUP[s]=_SUF_GROUP[s]||[]).push([item[0],item[2]]);
        break;
      }
    }
    for(const p of pres){
      if(w.startsWith(p)&&w.length-p.length>=3){
        (_PRE_GROUP[p]=_PRE_GROUP[p]||[]).push([item[0],item[2]]);
        break;
      }
    }
  });
}
function fillAutoFamily(m, self){
  buildAffixGroups();
  const key=m.key.replace(/-/g,'');
  const pool=(m.kind==='suffix'?_SUF_GROUP[key]:_PRE_GROUP[key])||[];
  const me=String(self).toLowerCase();
  const picked=[];
  for(let i=0;i<pool.length&&picked.length<5;i++){
    const idx=Math.floor(Math.random()*pool.length);
    const c=pool[idx];
    if(!c) continue;
    if(String(c[0]).toLowerCase()===me) continue;
    if(picked.some(x=>x[0]===c[0])) continue;
    picked.push(c);
  }
  m.family=picked;
  return m;
}

/* ---------- 十、例句兜底：用词库自身释义构造展示句 ---------- */
/* 原则：不编造英文句子（会出错），而是提供"词 + 释义 + 同族词对照"的记忆锚点 */
function fallbackSent(wordArr){
  const w=Array.isArray(wordArr)?wordArr[0]:wordArr;
  const def=Array.isArray(wordArr)?wordArr[2]:'';
  const m=morphOf(w);
  if(m.length && m[0].auto && m[0].base){
    const V=(typeof VOCAB3000!=='undefined')?VOCAB3000:[];
    const baseItem=V.find(x=>String(x[0]).toLowerCase()===m[0].base);
    if(baseItem){
      return [{
        sent: m[0].base + ' → ' + w,
        src: '构词对照',
        cn: baseItem[2] + '　→　' + def,
        note: '记住原形「'+m[0].base+'」，再加上'+m[0].key+'，意思和词性就变了。'
      }];
    }
  }
  return [];
}

/* 把兜底并入 deepCard */
(function patchDeep(){
  const _d=deepCard;
  deepCard=function(wordArr){
    const d=_d(wordArr);
    // 构词：自动识别的补同族词
    d.morph=(d.morph||[]).map(m=>m.auto?fillAutoFamily(Object.assign({},m), d.w):m);
    // 例句：没有真实例句时给构词对照
    if(!d.sents || !d.sents.length){
      d.sents=fallbackSent(wordArr);
    }
    return d;
  };
})();


/* ---------- 十一、终极兜底：保证每张深度卡都有内容 ---------- */
/* 原则：不编造英文例句（可能出错），而是给出确定正确的学习线索：
   1) 同档位近义/同类词对照（帮助建立词群）
   2) 拼写与词形提示
   3) 该词在考纲中的定位与学法建议                       */

function tierAdvice(tier, lv){
  if(lv===1) return '这是 ▲ 基础模块新增词，高职阶段新学内容，是出题人默认的区分度所在。先做到在句子里认得出、用得对；它属于高频词，学完可以在拼写专项里再练一遍。';
  if(lv===2) return '这是 ◆ 拓展模块新增词，面向升学方向。考到就是分差。重点是在阅读里认出它的意思，写作时未必用得上。';
  if(tier===1) return '这是构成句子骨架的核心动词。语法填空常考它的时态变形，建议连同过去式、过去分词一起记。';
  if(tier===2) return '这是阅读和写作中反复出现的高频基础词，做到看见就懂是底线，能写出来更好。';
  return '这是入学阶段应掌握的基础词。能在阅读里认出意思就够了，不必花时间默写，把精力留给 ▲◆ 标记词。';
}

/* 找同类词：同首字母 + 同档位 + 释义词性相近 */
function siblingWords(wordArr){
  const V=(typeof VOCAB3000!=='undefined')?VOCAB3000:[];
  if(!V.length) return [];
  const w=String(wordArr[0]).toLowerCase();
  const def=String(wordArr[2]||'');
  const pos=(def.match(/^([a-z]+\.)/)||[])[1]||'';
  const tier=wordArr[4];
  const out=[];
  for(let i=0;i<V.length&&out.length<5;i++){
    const c=V[Math.floor(Math.random()*V.length)];
    if(!c) continue;
    const cw=String(c[0]).toLowerCase();
    if(cw===w) continue;
    if(c[4]!==tier) continue;
    if(pos && String(c[2]||'').indexOf(pos)!==0) continue;
    if(out.some(x=>x[0]===c[0])) continue;
    out.push([c[0], c[2]]);
  }
  return out;
}

(function patchFinal(){
  const _d=deepCard;
  deepCard=function(wordArr){
    const d=_d(wordArr);
    if(!Array.isArray(wordArr)) return d;
    // 仍然三者皆空 → 补学法卡
    if((!d.morph||!d.morph.length) && (!d.sents||!d.sents.length) && (!d.syn||!d.syn.length)){
      d.advice = {
        text: tierAdvice(d.tier, d.lv),
        sibs: siblingWords(wordArr)
      };
    }
    return d;
  };
})();


/* 合并扩充词根到主库 */
(function mergeRootsExt(){
  if(typeof ROOTS_EXT==='undefined') return;
  if(typeof ROOTS==='undefined') return;
  const have=new Set(ROOTS.map(r=>r.r));
  ROOTS_EXT.forEach(r=>{ if(!have.has(r.r)) ROOTS.push(r); });
  // 清空索引缓存，强制重建
  if(typeof WORD_MORPH!=='undefined') WORD_MORPH=null;
})();
