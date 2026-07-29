/* ============================================================
   2026 真题题型训练引擎
   依据：湖北省专升本《大学英语》考试要求（无选择题、无判断题）
   五大题型：语法填空20 / 连词成句12 / 阅读理解40 / 完成句子18 / 写作10
   ============================================================ */

/* ---------- 一、题型元数据 ---------- */
const EXAM2026 = {
  total: 100, minutes: 120,
  parts: [
    {id:'gap',   name:'语法综合填空', n:10, per:2, score:20, time:15,
     desc:'一篇短文挖10个空。给提示词的填正确形式，不给的填功能词。',
     skill:'词形变化 + 介词/连词/冠词'},
    {id:'order', name:'连词成句',     n:6,  per:2, score:12, time:12,
     desc:'给若干打乱的词，组成语法正确、语义通顺的句子。',
     skill:'句子成分 + 语序 + 固定结构'},
    {id:'read',  name:'阅读理解',     n:20, per:2, score:40, time:45,
     desc:'4篇短文，回答问题或填词。答案要自己写，不是选。',
     skill:'定位 + 同义替换 + 归纳'},
    {id:'trans', name:'完成句子',     n:6,  per:3, score:18, time:20,
     desc:'给中文和英文半句，补全缺失部分。',
     skill:'固定搭配 + 语法结构'},
    {id:'write', name:'书面表达',     n:1,  per:10,score:10, time:25,
     desc:'应用文为主（书信/通知/邮件），约100词。',
     skill:'模板 + 连接词 + 无低级错误'}
  ]
};

/* ---------- 二、语法填空：词形变化规则库 ---------- */
const MORPH = {
  // 形容词 → 副词
  adv: {
    rule:'形容词变副词',
    ex:[['proud','proudly'],['careful','carefully'],['happy','happily'],
        ['true','truly'],['terrible','terribly'],['full','fully'],
        ['easy','easily'],['possible','possibly'],['simple','simply']],
    tip:'一般加 -ly；辅音+y 改 i 加 ly；-le 结尾去 e 加 y；true→truly 特殊'
  },
  // 动词 → 名词
  n_from_v: {
    rule:'动词变名词',
    ex:[['develop','development'],['achieve','achievement'],['decide','decision'],
        ['discuss','discussion'],['describe','description'],['choose','choice'],
        ['succeed','success'],['arrive','arrival'],['explain','explanation'],
        ['prepare','preparation'],['inform','information'],['produce','production']],
    tip:'-ment / -sion / -tion / -al / -ance 是最常见的五种'
  },
  // 形容词 → 名词
  n_from_adj: {
    rule:'形容词变名词',
    ex:[['happy','happiness'],['difficult','difficulty'],['able','ability'],
        ['safe','safety'],['strong','strength'],['long','length'],
        ['true','truth'],['wide','width'],['deep','depth'],['high','height']],
    tip:'-ness / -ty / -th 三类；strong→strength、long→length 属于变元音'
  },
  // 名词/动词 → 形容词
  adj: {
    rule:'变形容词',
    ex:[['care','careful'],['use','useful'],['danger','dangerous'],
        ['nature','natural'],['friend','friendly'],['health','healthy'],
        ['create','creative'],['depend','dependent'],['comfort','comfortable'],
        ['success','successful'],['interest','interesting/interested']],
    tip:'-ful/-ous/-al/-ly/-y/-ive/-able；-ing修饰物，-ed修饰人'
  },
  // 否定前缀
  neg: {
    rule:'否定前缀',
    ex:[['possible','impossible'],['fair','unfair'],['agree','disagree'],
        ['correct','incorrect'],['legal','illegal'],['regular','irregular'],
        ['patient','impatient'],['able','unable'],['honest','dishonest']],
    tip:'im-(m/p前) / in- / un- / dis- / il-(l前) / ir-(r前)'
  },
  // 比较级最高级
  cmp: {
    rule:'比较级与最高级',
    ex:[['good','better/best'],['bad','worse/worst'],['many','more/most'],
        ['little','less/least'],['far','farther/furthest'],
        ['big','bigger/biggest'],['easy','easier/easiest'],
        ['important','more important/most important']],
    tip:'单音节加 -er/-est；多音节用 more/most；不规则必须背'
  }
};

/* ---------- 三、语法填空题库（真题风格） ---------- */
const GAP_ITEMS = [
  {id:'g1', title:'Slow Travel in China', src:'2026真题',
   text:[
     {t:'Not long ago, travelling in China felt like a race. Young people used to talk '},
     {b:1, hint:'proud', ans:['proudly'], why:'talk 是动词，修饰动词要用副词。proud 是形容词，副词形式 proudly。'},
     {t:' about how they visited countless places in a very short time with little rest. This "boot camp" style of travel '},
     {b:2, hint:'be', ans:['is'], why:'主语 This style 是单数第三人称，讲当前状况用一般现在时，故填 is。'},
     {t:' losing its appeal. Instead of '},
     {b:3, hint:'rush', ans:['rushing'], why:'Instead of 是介词短语，of 后接动名词，故填 rushing。'},
     {t:' from one tourist spot to another, slow travellers spend more time in '},
     {b:4, hint:'few', ans:['fewer'], why:'与 more time 对比，且 places 可数，用 few 的比较级 fewer。'},
     {t:' places. They prefer to stay longer in one city, walk through old streets, and taste the food '},
     {b:5, hint:'', ans:['that','which'], why:'先行词 food 是物，后面缺主语，用关系代词 that 或 which。'},
     {t:' locals eat every day. The change reflects a '},
     {b:6, hint:'deep', ans:['deeper'], why:'与前文对比，表示"更深层的"渴望，用比较级 deeper。'},
     {t:' desire for real experiences '},
     {b:7, hint:'', ans:['rather'], why:'rather than 意为"而不是"，是固定搭配。'},
     {t:' than photos. Many travellers say they feel more '},
     {b:8, hint:'relax', ans:['relaxed'], why:'描述人的感受用 -ed 形式，relaxed 表示"感到放松的"。'},
     {t:' and learn more about '},
     {b:9, hint:'they', ans:['themselves'], why:'主语是 they，动作反射回主语自身，用反身代词 themselves。'},
     {t:' during such trips. Experts believe this trend will '},
     {b:10, hint:'continue', ans:['continue'], why:'will 是情态动词，后接动词原形，故填 continue。'},
     {t:' to grow.'}
   ]},
  {id:'g2', title:'Exercise and the Brain', src:'2026真题改编',
   text:[
     {t:'Scientists have long known that exercise is good for the body. But a new study shows it is '},
     {b:1, hint:'equal', ans:['equally'], why:'修饰形容词 important 要用副词 equally。'},
     {t:' important for the brain. Researchers studied more than 2,000 adults '},
     {b:2, hint:'', ans:['who','that'], why:'先行词 adults 是人，后面缺主语，用 who 或 that。'},
     {t:' exercised regularly. They found that in people who exercised often, brain areas for feelings and stress '},
     {b:3, hint:'be', ans:['were'], why:'从句主语 brain areas 是复数，且全文用过去时叙述研究，填 were。'},
     {t:' closely connected. Regular exercise helps '},
     {b:4, hint:'reduce', ans:['reduce'], why:'help 后接动词原形或 to do，此处填 reduce。'},
     {t:' anxiety and improve mood. Adults who walk '},
     {b:5, hint:'brisk', ans:['briskly'], why:'修饰动词 walk 用副词 briskly。'},
     {t:' for thirty minutes a day have a '},
     {b:6, hint:'low', ans:['lower'], why:'与不运动的人相比，用比较级 lower。'},
     {t:' risk of heart disease. The '},
     {b:7, hint:'research', ans:['researchers'], why:'指做研究的人，且后接复数动词 pointed，填 researchers。'},
     {t:' pointed out that physical activity also '},
     {b:8, hint:'benefit', ans:['benefits'], why:'主语 activity 是第三人称单数，一般现在时加 s。'},
     {t:' memory. So if you want to keep your mind sharp, '},
     {b:9, hint:'', ans:['do',"don't"], why:'祈使句表建议。此处根据上下文表肯定建议，填 do（强调）或按语境。'},
     {t:' not sit all day. Even a short walk can make a '},
     {b:10, hint:'differ', ans:['difference'], why:'make a difference 是固定搭配，意为"有影响"。'},
     {t:'.'}
   ]}
];

/* ---------- 四、连词成句题库 ---------- */
const ORDER_ITEMS = [
  {id:'o1', words:['The 15th Five-Year Plan','sets','the clear direction','for','China\'s development'],
   ans:"The 15th Five-Year Plan sets the clear direction for China's development.",
   why:'主语 The 15th Five-Year Plan + 谓语 sets + 宾语 the clear direction + for 引出对象。',
   src:'2026真题'},
  {id:'o2', words:['It','is','important','that','we','follow','the rules'],
   ans:'It is important that we follow the rules.',
   why:'It 作形式主语，that 从句是真正主语。important 后从句谓语用动词原形（虚拟语气）。'},
  {id:'o3', words:['There','is','no point','in','worrying','about','things'],
   ans:'There is no point in worrying about things.',
   why:'There be 句型 + no point in doing sth（做某事没意义），in 是介词后接动名词。'},
  {id:'o4', words:['Not only','did','he','finish','the task','but also','he','helped','others'],
   ans:'Not only did he finish the task but also he helped others.',
   why:'Not only 位于句首，前半句要部分倒装：助动词 did 提到主语前，动词用原形。'},
  {id:'o5', words:['Only','by','working hard','can','we','achieve','our goals'],
   ans:'Only by working hard can we achieve our goals.',
   why:'Only + 状语位于句首，主句部分倒装，情态动词 can 提到主语 we 之前。'},
  {id:'o6', words:['The harder','you','work','the more progress','you','will make'],
   ans:'The harder you work, the more progress you will make.',
   why:'the + 比较级, the + 比较级 结构，表示"越…越…"，两个分句都用陈述语序。'},
  {id:'o7', words:['It','was','not until','he','finished','his homework','that','he','went to bed'],
   ans:'It was not until he finished his homework that he went to bed.',
   why:'It is/was not until... that... 强调句型，被强调部分是 not until 引导的时间状语。'},
  {id:'o8', words:['Compared with','last year','the sales','have increased','by','twenty percent'],
   ans:'Compared with last year, the sales have increased by twenty percent.',
   why:'Compared with 作状语置于句首，主句主语是 the sales，用现在完成时表变化。'},
  {id:'o9', words:['Having finished','his work','he','went','home'],
   ans:'Having finished his work, he went home.',
   why:'现在分词完成式作状语，表示动作发生在主句之前；逻辑主语与主句主语一致。'},
  {id:'o10', words:['I','would appreciate','it','if','you','could give','me','an early reply'],
   ans:'I would appreciate it if you could give me an early reply.',
   why:'appreciate 后必须接 it 作形式宾语，真正宾语是 if 从句；书信常用礼貌表达。'}
];

/* ---------- 五、完成句子（翻译填空）题库 ---------- */
const TRANS_ITEMS = [
  {id:'t1', cn:'众所周知，中国是一个发展中国家。',
   en:'______, China is a developing country.', ans:['As is known to all','As we all know'],
   why:'As is known to all 是固定句型，as 引导非限制性定语从句，指代整个主句。'},
  {id:'t2', cn:'我宁愿你现在待在家里，因为天气很糟糕。',
   en:'I would rather you ______ at home now, for the weather is terrible.', ans:['stayed'],
   why:'would rather 后接从句时用虚拟语气，表示与现在事实相反用过去式 stayed。'},
  {id:'t3', cn:'我一进房间电话就响了。',
   en:'Hardly ______ I entered the room when the phone rang.', ans:['had'],
   why:'Hardly... when... 固定句型。Hardly 置句首要部分倒装，且用过去完成时 had entered。'},
  {id:'t4', cn:'我们班学生的数量是五十，其中有一些来自农村。',
   en:'The number of students in our class ______ fifty.', ans:['is'],
   why:'the number of + 复数名词，谓语用单数（强调"数量"）；a number of 才用复数。'},
  {id:'t5', cn:'随着科技的发展，我们的生活变得比以前更方便了。',
   en:'______ the development of technology, our life has become more convenient.', ans:['With'],
   why:'With + 名词 表示"随着…"，作伴随状语，是写作高频开头。'},
  {id:'t6', cn:'他建议我们早点出发以避免交通堵塞。',
   en:'He suggested that we ______ start early to avoid the traffic jam.', ans:['should','(should)'],
   why:'suggest 表"建议"时，从句用 (should) + 动词原形，should 可省略。'},
  {id:'t7', cn:'如果我知道答案，我就会告诉你了。',
   en:'If I ______ known the answer, I would have told you.', ans:['had'],
   why:'与过去事实相反的虚拟：从句 had done，主句 would have done。'},
  {id:'t8', cn:'这本书是一位著名作家写的，值得一读。',
   en:'The book, which was written by a famous author, is ______ reading.', ans:['worth'],
   why:'be worth doing 意为"值得做"，worth 后接动名词主动形式表被动含义。'},
  {id:'t9', cn:'环境保护已成为一个值得我们关注的严重问题。',
   en:'Environmental protection has become a serious problem which ______ our attention.', ans:['deserves'],
   why:'定语从句主语是 which（指 problem，单数），谓语用第三人称单数 deserves。'},
  {id:'t10', cn:'期待您的回复。',
   en:'______ forward to hearing from you.', ans:['Looking','I am looking'],
   why:'look forward to 中 to 是介词，后接动名词 hearing；书信结尾固定表达。'},
  {id:'t11', cn:'我写信是想申请贵报上刊登的那个职位。',
   en:'I am writing to ______ for the position advertised in your newspaper.', ans:['apply'],
   why:'apply for 意为"申请"；I am writing to... 是应用文开头万能句。'},
  {id:'t12', cn:'一方面它能省钱，另一方面它保护环境。',
   en:'On the one hand it can save money; on the ______ hand it protects the environment.', ans:['other'],
   why:'on the one hand... on the other hand... 固定搭配，表示"一方面…另一方面…"。'}
];

/* ---------- 六、阅读理解题库 ---------- */
const READ_ITEMS = [
  {id:'r1', title:'Slow Travel', src:'2026真题',
   text:`Not long ago, traveling in China meant racing from one spot to another. Today, a different kind of travel has become popular: "slow travel". Instead of rushing from one tourist spot to another, slow travelers spend more time in fewer places.

They prefer to stay longer in one city, walk through old streets, talk with local people, and taste the food that locals eat every day. Some even volunteer on farms or work in small guesthouses in exchange for a place to stay.

Experts say this change reflects a deeper desire for real experiences rather than photos. "Visiting ten cities in a short time leaves little memory," said one researcher. "Staying in one place for a week gives you something you keep."

In China, slow travel is growing especially among young people. Some spend a year exploring rural areas. They say they feel more relaxed and learn more about themselves during such trips.`,
   qs:[
     {q:'What is the main idea of slow travel?', ans:'Staying longer in fewer places to get real experiences.',
      why:'第二段首句 "They prefer to stay longer in one city" 与第三段 "a deeper desire for real experiences" 合并作答。'},
     {q:'What do some slow travelers do in exchange for a place to stay?', ans:'They volunteer on farms or work in small guesthouses.',
      why:'第二段末句原文定位，注意 in exchange for 前面的内容就是答案。'},
     {q:'According to the researcher, what does visiting ten cities in a short time leave?', ans:'Little memory.',
      why:'第三段引语中直接给出 "leaves little memory"。'},
     {q:'Who is slow travel especially popular with in China?', ans:'Young people.',
      why:'第四段首句 "growing especially among young people"。'},
     {q:'How do young travelers feel during such trips?', ans:'They feel more relaxed and learn more about themselves.',
      why:'第四段末句直接引用，注意保留 more。'}
   ]},
  {id:'r2', title:'Exercise and Mental Health', src:'仿真',
   text:`For years, doctors have told us that exercise keeps the body healthy. Now researchers say it also protects the mind.

A study of 2,000 adults found that those who exercised at least three times a week reported lower levels of anxiety. Brain scans showed that in these people, the areas controlling emotion and stress were more closely connected.

The type of exercise mattered less than people expected. Walking briskly for thirty minutes had almost the same effect as running for twenty. What mattered most was doing it regularly.

However, the researchers warned that exercise is not a cure for serious mental illness. "It helps," said Dr. Liu, "but it should not replace professional treatment."`,
   qs:[
     {q:'How many adults took part in the study?', ans:'2,000 adults.',
      why:'第二段首句直接给出数字，注意问 how many 要答具体数量。'},
     {q:'What did brain scans show about people who exercised regularly?', ans:'The areas controlling emotion and stress were more closely connected.',
      why:'第二段末句，注意改写时保持被动或原结构。'},
     {q:'Which mattered more, the type of exercise or doing it regularly?', ans:'Doing it regularly.',
      why:'第三段末句 "What mattered most was doing it regularly"。'},
     {q:'What warning did the researchers give?', ans:'Exercise is not a cure for serious mental illness and should not replace professional treatment.',
      why:'第四段整合，两个要点都要答到。'},
     {q:'Walking briskly for thirty minutes had almost the same effect as what?', ans:'Running for twenty minutes.',
      why:'第三段中句，注意补全 minutes。'}
   ]}
];

/* ---------- 七、写作模板 ---------- */
const WRITE_TPL = [
  {id:'w1', type:'申请信', scene:'求职 / 申请职位或名额',
   frame:[
     ['开头','I am writing to apply for the position of ______ advertised in ______.'],
     ['自我介绍','I am a student majoring in ______ at ______ College.'],
     ['优势1','First, I have a good command of ______.'],
     ['优势2','Second, I have taken part in ______, which has improved my ______.'],
     ['结尾','I would appreciate it if you could give me an early reply. Looking forward to hearing from you.']
   ],
   words:['apply for','major in','have a good command of','take part in','would appreciate it if']},
  {id:'w2', type:'建议信', scene:'给他人提建议',
   frame:[
     ['开头','I am sorry to hear that you are troubled by ______. Here are some suggestions.'],
     ['建议1','First of all, you had better ______.'],
     ['建议2','What is more, it would be helpful if you could ______.'],
     ['建议3','Last but not least, never ______.'],
     ['结尾','I hope these suggestions will be of some help to you.']
   ],
   words:['be troubled by','had better','what is more','last but not least','be of help']},
  {id:'w3', type:'邀请信', scene:'邀请参加活动',
   frame:[
     ['开头','On behalf of ______, I would like to invite you to ______.'],
     ['时间地点','The activity will be held at ______ on ______.'],
     ['活动内容','During the activity, we will ______.'],
     ['期待','It would be a great honour if you could come.'],
     ['结尾','Please let me know your decision as soon as possible.']
   ],
   words:['on behalf of','would like to invite','be held','it would be a great honour','as soon as possible']},
  {id:'w4', type:'通知', scene:'发布活动通知',
   frame:[
     ['标题','Notice'],
     ['事由','In order to ______, our school will hold ______.'],
     ['时间地点','The activity is scheduled at ______ on ______.'],
     ['要求','All the students are required to ______.'],
     ['落款','Please be on time. The Students\' Union']
   ],
   words:['in order to','be scheduled at','be required to','be on time']},
  {id:'w5', type:'议论文', scene:'谈看法 / 利弊',
   frame:[
     ['引入','Nowadays, ______ has become a hot topic among ______.'],
     ['观点1','On the one hand, ______.'],
     ['观点2','On the other hand, ______.'],
     ['个人看法','As far as I am concerned, ______.'],
     ['结尾','In conclusion, I firmly believe that with our joint efforts, ______.']
   ],
   words:['hot topic','on the one hand','as far as I am concerned','in conclusion','joint efforts']}
];

/* ---------- 八、评分与判断 ---------- */
function normAns(s){
  return String(s||'').trim().toLowerCase()
    .replace(/[.,!?;:'"]/g,'').replace(/\s+/g,' ');
}
function checkGap(input, answers){
  const u=normAns(input);
  if(!u) return {ok:false, near:false};
  const ok=answers.some(a=>normAns(a)===u);
  if(ok) return {ok:true, near:false};
  // 接近判定：编辑距离1
  const near=answers.some(a=>{
    const b=normAns(a);
    if(Math.abs(b.length-u.length)>1) return false;
    let d=0,i=0,j=0;
    while(i<b.length&&j<u.length){
      if(b[i]===u[j]){i++;j++;continue;}
      d++; if(d>1) return false;
      if(b.length>u.length)i++; else if(b.length<u.length)j++; else {i++;j++;}
    }
    return d+Math.abs(b.length-i)+Math.abs(u.length-j)<=1;
  });
  return {ok:false, near:near};
}
function checkOrder(input, ans){
  const u=normAns(input), a=normAns(ans);
  if(u===a) return {ok:true, score:1};
  // 词序全对但标点/大小写差异已被 norm 处理；再看词是否齐全
  const uw=u.split(' ').sort().join(' '), aw=a.split(' ').sort().join(' ');
  if(uw===aw) return {ok:false, score:0.5, msg:'单词都对，但语序不对'};
  return {ok:false, score:0, msg:'有单词遗漏或多余'};
}
function checkRead(input, ans){
  const u=normAns(input), a=normAns(ans);
  if(!u) return {score:0, msg:'未作答'};
  if(u===a) return {score:1, msg:'完全正确'};
  // 关键词覆盖率
  const stop=new Set(['the','a','an','is','are','was','were','to','of','in','on','for','and','they','he','she','it','that','this']);
  const key=a.split(' ').filter(w=>w.length>2&&!stop.has(w));
  const hit=key.filter(w=>u.includes(w)).length;
  const rate=key.length?hit/key.length:0;
  if(rate>=0.7) return {score:1, msg:'意思正确'};
  if(rate>=0.4) return {score:0.5, msg:'答到部分要点'};
  return {score:0, msg:'要点不足'};
}
