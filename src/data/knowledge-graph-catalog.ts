import type { Dimension } from './assessment-types'
import type { SubjectName } from './subject-task-map'

export interface KnowledgeGraphTopic {
  name: string
  score: string
  /** 完成这个二级知识任务时，最主要会用到的元能力。 */
  abilityDimensions?: readonly Dimension[]
  /** 不是主要元能力，但可以帮助学生进入任务的元能力。 */
  entryDimensions?: readonly Dimension[]
}

export interface KnowledgeGraphModule {
  subject: SubjectName
  name: string
  score: string
  topics: readonly KnowledgeGraphTopic[]
  taskIds: readonly string[]
}

const topics = (...rows: string[]): KnowledgeGraphTopic[] => rows.map((row) => {
  const [name, score = '未标分', dimensions = '', entry = ''] = row.split('@@')
  const abilityDimensions = dimensions.split('|').filter(Boolean) as Dimension[]
  const entryDimensions = entry.split('|').filter(Boolean) as Dimension[]
  return {
    name,
    score,
    ...(abilityDimensions.length ? { abilityDimensions } : {}),
    ...(entryDimensions.length ? { entryDimensions } : {}),
  }
})

const module = (
  subject: SubjectName,
  name: string,
  score: string,
  taskIds: readonly string[],
  ...rows: string[]
): KnowledgeGraphModule => ({ subject, name, score, taskIds, topics: topics(...rows) })

/**
 * 2027 届各科知识图谱的一级模块、二级课次/专题和原表分值。
 * 分值只用于解释模块规模，不参与元能力匹配、策略分组或排序。
 */
export const knowledgeGraphCatalog: readonly KnowledgeGraphModule[] = [
  module('语文', '现代文阅读', '35分', ['chinese-modern-reading-structure'], '小说（文学类文本小说散文2选1）+戏剧@@16分', '散文（文学类文本小说散文2选1）@@16分', '信息文@@19分'),
  module('语文', '古诗文阅读', '37分', ['chinese-classical-translation', 'chinese-poetry-emotion'], '文言文@@20分', '诗歌@@9分', '名篇名句默写@@6分'),
  module('语文', '语言文字运用', '18分', ['chinese-modern-reading-structure', 'chinese-writing-argument'], '语言文字运用@@18分'),
  module('语文', '作文', '60分', ['chinese-writing-argument'], '作文@@60分'),

  module('数学', '初高衔接', '10分', ['math-function-graph', 'math-sequence-reasoning'], '常见结论@@5分', '指对运算@@5分', '一次函数的图像和性质@@3分', '二次函数的性质与图象@@2分', '不等式性质@@5分', '一元二次不等式@@未标分', '其他不等式@@未标分'),
  module('数学', '集合与常用逻辑用语', '5分', ['math-sequence-reasoning'], '集合@@3分', '常用逻辑用语@@2分'),
  module('数学', '基本不等式', '5分', ['math-function-graph'], '基本不等式@@未标分'),
  module('数学', '平面向量', '5分', ['math-geometry-structure'], '向量的概念与线性运算@@2分', '向量的坐标表示法和运算@@3分'),
  module('数学', '复数', '5分', ['math-function-graph']),
  module('数学', '三角函数与解三角形', '18分', ['math-function-graph', 'math-geometry-structure'], '三角函数基础@@5分', '三角函数图像与性质@@未标分', '正余弦定理@@13分'),
  module('数学', '数列', '17分', ['math-sequence-reasoning'], '等差数列@@5分', '等比数列@@5分', '数列求通项@@7分', '数列求和@@未标分'),
  module('数学', '空间向量与立体几何空间几何体', '20分', ['math-geometry-structure'], '空间几何体的结构及表面积与体积@@5分', '点、直线、平面之间的位置关系@@6分', '空间向量与立体几何@@9分'),
  module('数学', '计数原理与概率统计', '23分', ['math-probability-statistics'], '统计@@5分', '统计案例@@6分', '计数原理@@5分', '概率@@3分', '随机变量及其分布@@4分'),
  module('数学', '函数与导数', '25分', ['math-function-graph'], '函数及其性质@@5分', '指对幂函数@@5分', '函数的应用@@5分', '导数及其应用@@10分'),
  module('数学', '平面解析几何', '27分', ['math-geometry-structure', 'math-function-graph'], '直线与方程@@5分', '圆与方程@@5分', '椭圆@@4分', '双曲线@@未标分', '抛物线@@3分', '拓展：直线与圆锥曲线的位置关系@@6分'),

  module('英语', '核心词汇', '基础模块', ['english-vocabulary-recall'], '初阶词汇@@基础@@memory@@language', '中阶词汇@@基础@@memory@@language', '高阶词汇@@基础@@memory@@language'),
  module('英语', '基础语法', '4分', ['english-reading-structure'], '五大句子类型@@2分', '八大句子成分@@2分'),
  module('英语', '语法填空', '15分', ['english-reading-structure', 'english-vocabulary-recall'], '名词@@1分', '形容词&副词@@2分', '动词@@4分', '介词@@1分', '代词&冠词@@2分', '连词@@2分'),
  module('英语', '阅读', '37.5分', ['english-reading-structure'], '总论@@3分', '长难句@@3分', '细节理解@@11分', '推理判断@@7分', '词义猜测@@3分', '主旨大意&选标题@@3分'),
  module('英语', '七选五', '12.5分', ['english-reading-structure'], '总论@@2分', '匹配关系@@2分', '匹配逻辑@@4分', '匹配句式+功能@@2分'),
  module('英语', '完形', '15分', ['english-reading-structure', 'english-vocabulary-recall'], '对应原文@@3分', '感情色彩@@2分', '逻辑关系@@2分', '熟词僻义@@1分', '动词性质&固定搭配@@2分', '动作衔接@@2分'),
  module('英语', '应用文写作', '15分', ['english-writing-expression'], '应用文写作思路@@3分', '观点类应用文写作@@4分', '信息类应用文写作@@3分'),
  module('英语', '读后续写', '25分', ['english-writing-expression', 'english-reading-structure'], '读后续写情绪描写@@5分', '读后续写动作描写@@5分', '读后续写句式升级@@5分'),
  module('英语', '听力', '30分', ['english-reading-structure', 'english-vocabulary-recall'], '听力基础元能力--语音现象@@5分', '听力-短对话@@5分', '听力-长对话&独白@@10分', '听力真题答案定位填空特训@@7分'),

  module('日语', '听力模块', '30分', ['japanese-reading-structure', 'japanese-vocabulary-grammar'], '日常生活@@3分', '时间、数量@@6分', '人物、状态描述@@4.5分', '校园、职场@@3分', '场所@@4.5分', '动作行为@@6分', '原因、理由@@3分'),
  module('日语', '基础句型结构（语言知识运用1）', '30分', ['japanese-vocabulary-grammar'], '判断句@@0分', '指示代词@@0~1.5分', '动词基础@@1.5~3分', '存在动词@@0~1.5分', '基本助词1@@1.5分', '基本助词2@@1.5分', '物品授受@@0~1.5分'),
  module('日语', '形容词句法功能（语言知识运用2）', '未标分', ['japanese-vocabulary-grammar'], '数量词@@0分', '一类形容词@@0~3分', '二类形容词@@0~3分', '形容词て形@@0~1.5分', '变化句@@0~1.5分', '基本助词3@@1.5分', '比较句型@@0~1.5分'),
  module('日语', '动词活用与简体表达（语言知识运用3）', '未标分', ['japanese-vocabulary-grammar'], '动词原形@@0~1.5分', '动词ない形@@0~1.5分', '动词て形@@0~1.5分', '动词た形@@0~1.5分', '敬体与简体@@0~3分', '简体形基本句型1@@0~1.5分', '简体形基本句型2@@0~1.5分'),
  module('日语', '动词的扩展表达与运用（语言知识运用4）', '未标分', ['japanese-vocabulary-grammar'], '假定语法1@@1.5分', '假定语法2@@1.5分', '动词命令形@@0~1.5分', '动词意志形@@0~1.5分', '样态语法1@@0~3分', '样态语法2@@0~3分'),
  module('日语', '动词语态与功能转化（语言知识运用5）', '未标分', ['japanese-vocabulary-grammar'], '动词可能形@@0~1.5分', '补助动词1@@0~3分', '补助动词2@@0~3分', '被动句@@1.5~3分', '使役句@@1.5~3分'),
  module('日语', '助词（语言知识运用6）', '未标分', ['japanese-vocabulary-grammar'], '格助词@@0~4.5分', '接续助词@@0~1.5分', '副助词@@0~1.5分'),
  module('日语', '动词（语言知识运用7）', '未标分', ['japanese-vocabulary-grammar'], '动词变形与自他动词@@0~4.5分', '补助动词总结@@0~1.5分', '复合词总结@@0~3分', '授受动词总结@@0~1.5分'),
  module('日语', '形容词（语言知识运用8）', '未标分', ['japanese-vocabulary-grammar'], '形容词总结@@1.5~4.5分'),
  module('日语', '助动词（语言知识运用9）', '未标分', ['japanese-vocabulary-grammar'], '愿望表达@@0~1.5分', '样态语法@@0~3分', 'ないで・なくて@@0~1.5分', '目的表达@@0~3分'),
  module('日语', '形式名词（语言知识运用10）', '未标分', ['japanese-vocabulary-grammar'], '形式名词@@0~1.5分'),
  module('日语', '敬语（语言知识运用11）', '未标分', ['japanese-vocabulary-grammar'], '敬语@@0~1.5分'),
  module('日语', '单词和句型（语言知识运用10）', '未标分', ['japanese-vocabulary-grammar'], '句型@@3~6分', '单词@@3~6分'),
  module('日语', '阅读模块', '50分', ['japanese-reading-structure'], '连词及内容填空@@5分', '指示代词@@5分', '原因、理由@@12.5分', '信息理解@@17.5分', '主旨观点@@10分'),
  module('日语', '应用文主要格式', '10分', ['japanese-writing-expression'], '书信@@0~10分', '通知@@0~10分', '演讲稿@@0~10分', '邮件@@0~10分', '日记@@0~10分'),
  module('日语', '应用文拓展文体', '未标分', ['japanese-writing-expression'], '书信拓展文体@@0~10分', '通知拓展文体@@0~10分', '演讲稿拓展文体@@0~10分'),
  module('日语', '大作文模块', '30分', ['japanese-writing-expression'], '记叙议论文@@0~30分', '议论观点文@@0~30分', '图表说明文@@0~30分'),

  module('物理', '运动的描述与匀变速直线运动', '3.5分', ['physics-motion-graph'], '运动学基本概念@@1.5分', '匀变速直线运动规律@@2分'),
  module('物理', '相互作用与牛顿定律应用', '4.5分', ['physics-force-model'], '力与受力分析@@1分', '共点力平衡@@1分', '牛顿运动定律@@2.5分'),
  module('物理', '曲线运动、万有引力与宇宙航行', '7分', ['physics-motion-graph', 'physics-force-model'], '抛体运动@@2分', '圆周运动@@2分', '万有引力与航天@@3分'),
  module('物理', '能量与动量守恒', '10分', ['physics-energy-momentum'], '功和能@@6分', '动量与碰撞@@4分'),
  module('物理', '机械振动与机械波', '2.5分', ['physics-motion-graph'], '机械振动与机械波@@2.5分'),
  module('物理', '静电场', '6分', ['physics-electric-field'], '电场力的性质与能的性质@@2.5分', '电容器与带电粒子在电场中@@3.5分'),
  module('物理', '恒定电流、交变电流与变压器', '17分', ['physics-electric-field', 'physics-experiment'], '电路分析@@2分', '电学实验@@9分', '交变电流与变压器@@6分'),
  module('物理', '磁场与电磁感应', '19分', ['physics-electric-field'], '磁场与安培力@@3.5分', '带电粒子在磁场中的运动@@4.5分', '电磁感应@@3分', '电磁感应中的导轨模型@@8分'),
  module('物理', '热学与光学', '14.5分', ['physics-energy-momentum', 'physics-motion-graph'], '分子动理论与气体@@9分', '光学@@5.5分'),
  module('物理', '近代物理', '10分', ['physics-energy-momentum'], '波粒二象性与光电效应@@4分', '原子与原子核@@6分'),
  module('物理', '运动与力学实验', '6分', ['physics-experiment'], '力学实验@@6分'),

  module('化学', '化学基本概念与化学实验基础知识', '12分', ['chemistry-reaction-network', 'chemistry-experiment'], '化学物质及其变化@@6分', '化学计量与简单计算@@3分', '化学实验基础知识@@3分'),
  module('化学', '元素及其化合物', '22分', ['chemistry-element-properties', 'chemistry-reaction-network'], '金属及其化合物@@12分', '非金属及其化合物@@10分'),
  module('化学', '物质的结构与性质', '21分', ['chemistry-element-properties'], '原子结构与性质@@5分', '分子结构与性质@@8分', '晶体结构与性质@@7分'),
  module('化学', '化学反应原理', '22分', ['chemistry-equilibrium-change'], '化学反应与能量转化@@3分', '化学反应速率与平衡@@16分', '水溶液中的离子反应与平衡@@3分'),
  module('化学', '有机化学', '23分', ['chemistry-element-properties', 'chemistry-reaction-network'], '有机化合物的结构@@3分', '烃的衍生物@@12分', '有机化合物综合应用@@8分'),

  module('生物', '模块一 细胞基础内容', '18分', ['biology-structure-function'], '第一讲 细胞中的元素和化合物@@2分', '第二讲 细胞学基础@@2分', '第三讲 细胞的结构@@6分', '第四讲 物质进出细胞的方式@@6分'),
  module('生物', '模块二 细胞代谢', '18分', ['biology-structure-function', 'biology-process-regulation'], '第五讲 ATP和酶@@4分', '第六讲 细胞呼吸@@4分', '第七讲 光合作用@@8分', '第八讲 代谢综合@@2分'),
  module('生物', '模块三 细胞的生命历程', '8分', ['biology-structure-function'], '第九讲 有丝分裂和减数分裂@@4分', '第十讲 细胞分化、衰老、凋亡和癌变@@4分'),
  module('生物', '模块四 遗传学', '16分', ['biology-genetics'], '第十一讲 分离定律@@4分', '第十二讲 自由组合定律@@4分', '第十三讲 伴性遗传@@2分', '第十四讲 证明DNA是主要遗传物质@@2分', '第十五讲 DNA的分子结构及复制@@2分', '第十六讲 基因的表达@@2分'),
  module('生物', '模块五 变异与育种', '6分', ['biology-genetics'], '第十七讲 变异与育种@@2分', '第十八讲 进化和基因频率的计算@@4分'),
  module('生物', '模块六 稳态与调节', '12分', ['biology-process-regulation'], '第十九讲 内环境及其稳态@@1分', '第二十讲 神经调节@@3分', '第二十一讲 体液调节@@2分', '第二十二讲 神经调节和体液调节实例@@2分', '第二十三讲 免疫调节@@2分', '第二十四讲 植物激素@@2分'),
  module('生物', '模块七 生物与环境', '12分', ['biology-process-regulation'], '第二十五讲 种群@@3分', '第二十六讲 群落@@3分', '第二十七讲 生态系统@@4分', '第二十八讲 人类与环境@@2分'),
  module('生物', '模块八 生物技术与工程', '10分', ['biology-experiment'], '第二十九讲 发酵工程@@2分', '第三十讲 植物细胞工程@@2分', '第三十一讲 动物细胞工程@@2分', '第三十二讲 基因工程@@4分'),

  module('历史', '中国古代史', '27分', ['history-time-context', 'history-cause-change'], '中华文明的起源与早期国家（远古—前771）@@3分', '诸侯纷争与变法运动（前770—前221）@@3分', '秦统一多民族封建国家的建立（前221—前207）@@2分', '两汉——统一多民族封建国家的巩固（前202—220）@@4分', '三国两晋南北朝——中华文明的曲折发展（220—589）@@3分', '隋唐时期——中华文明的繁荣（581—907）@@3分', '辽宋夏金元时期——中华文明的成熟与高度发展（916—1368）@@4分', '明清（前期）时期——中华文明的鼎盛与危机（1368—1840）@@5分'),
  module('历史', '中国近代史', '20分', ['history-time-context', 'history-cause-change'], '旧民主主义革命时期（1840—1919）@@10分', '新民主主义革命时期（1919—1949）@@10分'),
  module('历史', '中国现代史', '10分', ['history-time-context', 'history-cause-change'], '新中国的成立与社会主义建设时期（1949—1978）@@4分', '社会主义建设新时期——改革开放（1978—）@@6分'),
  module('历史', '世界古代史', '5分', ['history-time-context'], '上古时期（5世纪以前）——古代文明的产生与发展@@2分', '中古时期（5—15世纪）——世界各区域多元文明的发展@@3分'),
  module('历史', '世界近现代史', '35分', ['history-time-context', 'history-cause-change'], '走向整体的世界@@6分', '欧洲思想解放运动及资本主义制度的确立@@5分', '工业革命与马克思主义的诞生@@4分', '近代世界的政治、经济和文化（15世纪—19世纪末20世纪初）@@6分', '两次世界大战、十月革命与国际秩序的演变@@5分', '20世纪下半叶世界的新变化（1945—）@@5分', '二战以来的经济与文化@@4分'),
  module('历史', '史学素养', '3分', ['history-material-inference'], '史学素养@@3分'),

  module('政治', '中国特色社会主义', '10分', ['politics-concept-network'], '人类社会发展进程与趋势@@2分', '中国特色社会主义的开创和发展@@8分'),
  module('政治', '经济与社会', '10分', ['politics-concept-network'], '生产资料所有制与经济体制@@5分', '经济发展和社会进步@@5分'),
  module('政治', '政治与法治', '17分', ['politics-concept-network', 'politics-material-reasoning'], '党的领导@@5分', '人民当家作主@@6分', '全面依法治国@@6分'),
  module('政治', '哲学与文化', '18分', ['politics-concept-network', 'politics-material-reasoning'], '探索世界与把握规律@@7分', '认识世界与价值选择@@7分', '文化传承与文化创新@@4分'),
  module('政治', '当代国际政治与经济', '15分', ['politics-concept-network', 'politics-material-reasoning'], '各具特色的国家@@3分', '政治多极化@@6分', '经济全球化@@4分', '国际组织@@2分'),
  module('政治', '法律与生活', '15分', ['politics-concept-network', 'politics-subjective-answer'], '民事权利与民事义务@@7分', '家庭与婚姻@@2分', '就业与创业@@2分', '社会争议解决@@4分'),
  module('政治', '逻辑与思维', '15分', ['politics-material-reasoning', 'politics-subjective-answer'], '树立科学思维观念@@3分', '遵循逻辑思维规则@@4分', '运用辩证思维方法@@4分', '提高创新思维元能力@@4分'),

  module('地理', '模块一 内外力作用与地貌', '10分', ['geography-process-chain', 'geography-map-space'], '岩石圈物质循环@@2分', '内力作用与地貌@@4分', '外力作用与地貌@@4分'),
  module('地理', '模块二 大气与气候', '22分', ['geography-process-chain', 'geography-data-chart'], '大气@@3分', '热力环流@@2分', '气压带风带@@4分', '季风环流@@4分', '全球气候类型@@5分', '天气系统@@4分'),
  module('地理', '模块三 水循环', '6分', ['geography-process-chain'], '水循环@@1分', '陆地水体@@2分', '海洋水体@@3分'),
  module('地理', '模块四 自然地理整体性与差异性', '16分', ['geography-process-chain', 'geography-map-space'], '自然地理整体性@@13分', '自然地理差异性@@3分'),
  module('地理', '模块五 自然灾害与地理信息技术', '6分', ['geography-map-space'], '自然灾害@@3分', '地理信息技术@@3分'),
  module('地理', '模块六 人口', '4分', ['geography-human-region', 'geography-data-chart'], '人口@@4分'),
  module('地理', '模块七 城镇化', '8分', ['geography-human-region', 'geography-map-space'], '城镇化@@8分'),
  module('地理', '模块八 产业区位因素', '10分', ['geography-human-region'], '产业区位因素@@10分'),
  module('地理', '模块九 交通运输业', '4分', ['geography-human-region', 'geography-map-space'], '交通运输业@@4分'),
  module('地理', '模块十 能源资源开发', '6分', ['geography-human-region', 'geography-process-chain'], '能源产业@@3分', '资源产业@@3分'),
  module('地理', '模块十一 区域发展', '4分', ['geography-human-region'], '我国的区域协调发展战略@@4分'),
  module('地理', '模块十二 地球运动', '4分', ['geography-map-space', 'geography-process-chain'], '自转、公转、月相运动@@4分'),

  module('技术', '数据与计算', '15分', ['technology-data-algorithm'], '进制转化及编码@@2分', '多媒体容量计算@@3分', '人工智能@@2分', 'Python语句的综合应用@@6分', 'pandas模块与数据处理@@2分'),
  module('技术', '信息系统的搭建', '16分', ['technology-system-analysis', 'technology-process-flow'], '信息系统综合应用@@16分'),
  module('技术', '数据与数据结构', '19分', ['technology-data-algorithm'], '常见字符串处理@@3分', '数组与链表的代码实现@@4分', '栈与队列的代码实现@@4分', '排序算法的代码实现@@3分', '二叉树与二分查找的代码实现@@3分', '迭代算法与递归算法@@2分'),
  module('技术', '技术与设计1', '26分', ['technology-design-evaluation'], '技术与设计@@4分', '设计的一般过程@@10分', '人机关系@@4分', '图样绘制与模型制作@@8分'),
  module('技术', '技术与设计2', '10分', ['technology-system-analysis', 'technology-process-flow'], '结构及其设计@@4分', '系统与控制设计@@6分'),
  module('技术', '电子控制技术', '14分', ['technology-system-analysis', 'technology-process-flow'], '电子元器件@@4分', '门电路和触发器@@2分', '二极管和三极管@@2分', '综合电路@@6分'),
]

export const knowledgeGraphForSubject = (subject: SubjectName) => knowledgeGraphCatalog.filter((item) => item.subject === subject)
