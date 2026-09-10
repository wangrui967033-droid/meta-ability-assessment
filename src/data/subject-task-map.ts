import type { Dimension, ForeignLanguage } from './assessment-types'

/**
 * 报告的最小落点是「学科中的知识任务」，不是「这门学科适不适合」。
 * 该表只定义图谱节点与所需的元能力组合；学生实际表现由服务端评分后再匹配。
 */
export type SubjectName =
  | '语文'
  | '数学'
  | '英语'
  | '日语'
  | '物理'
  | '化学'
  | '生物'
  | '历史'
  | '政治'
  | '地理'
  | '技术'

export type MechanismKey =
  | '快速记住'
  | '保持信息'
  | '准确提取'
  | '理解意思'
  | '组织信息'
  | '准确表达'
  | '感知数量'
  | '处理符号'
  | '理解变化'
  | '识别结构'
  | '空间想象'
  | '空间转换'
  | '发现关系'
  | '归纳规律'
  | '推出结论'

/** 让报告能把“具体知识任务”说回它对应的一级元能力与二级机制。 */
export const mechanismDimension: Readonly<Record<MechanismKey, Dimension>> = {
  快速记住: 'memory', 保持信息: 'memory', 准确提取: 'memory',
  理解意思: 'language', 组织信息: 'language', 准确表达: 'language',
  感知数量: 'quantitative', 处理符号: 'quantitative', 理解变化: 'quantitative',
  识别结构: 'space', 空间想象: 'space', 空间转换: 'space',
  发现关系: 'reasoning', 归纳规律: 'reasoning', 推出结论: 'reasoning',
}

export interface AbilityWeights {
  memory: number
  language: number
  quantitative: number
  space: number
  reasoning: number
}

export interface SubjectTaskMap {
  id: string
  subject: SubjectName
  /** 图谱的一级模块 / 二级任务 / 三级考点，便于后续精确挂接节点 ID。 */
  knowledgeNodes: readonly string[]
  /** 学生报告里出现的短名称。 */
  taskLabel: string
  /** 在这里更容易被调用到的五元能力组合；五项合计为 1。 */
  abilityWeights: AbilityWeights
  /** 二级机制只用于细化解释与建议选择，不能单独判定学科优势。 */
  mechanisms: readonly MechanismKey[]
  /** 直接给学生的、可立刻开始的一步。 */
  startWith: string
}

const w = (
  memory: number,
  language: number,
  quantitative: number,
  space: number,
  reasoning: number,
): AbilityWeights => ({ memory, language, quantitative, space, reasoning })

export const subjectTaskMap: readonly SubjectTaskMap[] = [
  // 语文
  {
    id: 'chinese-modern-reading-structure', subject: '语文',
    knowledgeNodes: ['现代文阅读', '论述类/实用类文本', '段落关系与论证结构'],
    taskLabel: '现代文阅读的结构和关系', abilityWeights: w(.10, .35, .05, .15, .35),
    mechanisms: ['理解意思', '组织信息', '发现关系'],
    startWith: '先圈每段在做什么，再用箭头连出“观点—理由—结论”。',
  },
  {
    id: 'chinese-classical-translation', subject: '语文',
    knowledgeNodes: ['文言文阅读', '实词虚词', '句式与翻译'],
    taskLabel: '文言文句子翻译', abilityWeights: w(.30, .45, .00, .00, .25),
    mechanisms: ['准确提取', '理解意思', '组织信息'],
    startWith: '先找句子里的动作、人物和关系，再补词义，不要逐字硬译。',
  },
  {
    id: 'chinese-poetry-emotion', subject: '语文',
    knowledgeNodes: ['古诗文阅读', '意象', '情感与手法'],
    taskLabel: '古诗文的画面和情感', abilityWeights: w(.25, .40, .00, .15, .20),
    mechanisms: ['保持信息', '理解意思', '空间想象'],
    startWith: '把诗里的时间、地点、画面先拼出来，再判断情感和手法。',
  },
  {
    id: 'chinese-writing-argument', subject: '语文',
    knowledgeNodes: ['写作', '议论文', '观点—论据—论证'],
    taskLabel: '议论文的立意和展开', abilityWeights: w(.10, .45, .00, .00, .45),
    mechanisms: ['准确表达', '组织信息', '推出结论'],
    startWith: '先写一句明确观点，再列两条理由和对应材料，最后扩成段落。',
  },

  // 数学
  {
    id: 'math-function-graph', subject: '数学',
    knowledgeNodes: ['函数', '函数性质', '函数图像'],
    taskLabel: '函数图像与变化', abilityWeights: w(.05, .05, .30, .30, .30),
    mechanisms: ['理解变化', '空间转换', '发现关系'],
    startWith: '先画出“谁在变、怎么变”，再回到解析式和性质。',
  },
  {
    id: 'math-geometry-structure', subject: '数学',
    knowledgeNodes: ['几何与代数', '平面向量', '几何结构'],
    taskLabel: '几何结构与辅助线', abilityWeights: w(.00, .05, .15, .45, .35),
    mechanisms: ['识别结构', '空间转换', '推出结论'],
    startWith: '先标已知、目标和关键位置，再决定要不要连线、作垂线或转化。',
  },
  {
    id: 'math-probability-statistics', subject: '数学',
    knowledgeNodes: ['概率与统计', '计数原理', '数据分析'],
    taskLabel: '概率统计的处理符号', abilityWeights: w(.05, .10, .45, .05, .35),
    mechanisms: ['感知数量', '处理符号', '归纳规律'],
    startWith: '先把“总数、符合条件的数、怎么分组”写清，再开始算。',
  },
  {
    id: 'math-sequence-reasoning', subject: '数学',
    knowledgeNodes: ['数列', '递推关系', '通项与求和'],
    taskLabel: '数列的规律和推导', abilityWeights: w(.05, .05, .35, .05, .50),
    mechanisms: ['处理符号', '归纳规律', '推出结论'],
    startWith: '先写出前几项和相邻项的变化，再找能重复使用的关系。',
  },

  // 外语：英语和日语共享“语言学习任务”的结构，但节点名称保持各自图谱口径。
  {
    id: 'english-reading-structure', subject: '英语',
    knowledgeNodes: ['阅读理解', '篇章结构', '主旨与推断'],
    taskLabel: '英语阅读的主线和推断', abilityWeights: w(.15, .55, .00, .00, .30),
    mechanisms: ['理解意思', '组织信息', '推出结论'],
    startWith: '先找每段的作用和转折词，再回头做细节题。',
  },
  {
    id: 'english-vocabulary-recall', subject: '英语',
    knowledgeNodes: ['词汇', '词义辨析', '词组搭配'],
    taskLabel: '英语词汇和搭配', abilityWeights: w(.55, .35, .00, .00, .10),
    mechanisms: ['快速记住', '保持信息', '准确提取'],
    startWith: '把词放进短句和同义/反义关系里记，再遮住中文主动想。',
  },
  {
    id: 'english-writing-expression', subject: '英语',
    knowledgeNodes: ['书面表达', '应用文', '读后续写'],
    taskLabel: '英语写作的表达组织', abilityWeights: w(.10, .65, .00, .00, .25),
    mechanisms: ['组织信息', '准确表达', '推出结论'],
    startWith: '先写好每段要完成的任务，再给每段准备一两句能用的表达。',
  },
  {
    id: 'japanese-reading-structure', subject: '日语',
    knowledgeNodes: ['阅读理解', '文章结构', '主旨与推断'],
    taskLabel: '日语阅读的主线和推断', abilityWeights: w(.15, .55, .00, .00, .30),
    mechanisms: ['理解意思', '组织信息', '推出结论'],
    startWith: '先找提示关系的词和每段重点，再处理具体选项。',
  },
  {
    id: 'japanese-vocabulary-grammar', subject: '日语',
    knowledgeNodes: ['词汇', '语法', '助词与句型'],
    taskLabel: '日语词汇、助词和句型', abilityWeights: w(.50, .40, .00, .00, .10),
    mechanisms: ['保持信息', '理解意思', '准确提取'],
    startWith: '把句型放进最短的对比例句里记，隔天再遮住提示自己说出。',
  },
  {
    id: 'japanese-writing-expression', subject: '日语',
    knowledgeNodes: ['写作', '应用文', '表达与衔接'],
    taskLabel: '日语写作的表达组织', abilityWeights: w(.10, .65, .00, .00, .25),
    mechanisms: ['组织信息', '准确表达', '推出结论'],
    startWith: '先列清楚目的、对象和顺序，再用熟悉句型把内容接起来。',
  },

  // 物理：已接入 2027 届物理知识图谱+分值占比。
  {
    id: 'physics-motion-graph', subject: '物理',
    knowledgeNodes: ['运动的描述与匀变速直线运动', '匀变速直线运动规律', '运动图像'],
    taskLabel: '运动图像和变化过程', abilityWeights: w(.05, .05, .30, .35, .25),
    mechanisms: ['理解变化', '空间转换', '处理符号'],
    startWith: '先在图上标出起点、变化和终点，再读公式和数值。',
  },
  {
    id: 'physics-force-model', subject: '物理',
    knowledgeNodes: ['相互作用与牛顿定律应用', '力与受力分析', '共点力平衡/牛二定律应用'],
    taskLabel: '受力分析和动力学模型', abilityWeights: w(.00, .05, .20, .40, .35),
    mechanisms: ['识别结构', '发现关系', '推出结论'],
    startWith: '先画研究对象和全部受力，再判断哪些关系要同时成立。',
  },
  {
    id: 'physics-energy-momentum', subject: '物理',
    knowledgeNodes: ['能量与动量守恒', '动能定理/功能关系', '动量与碰撞'],
    taskLabel: '能量、动量和多过程题', abilityWeights: w(.05, .05, .35, .15, .40),
    mechanisms: ['处理符号', '组织信息', '推出结论'],
    startWith: '先圈定研究对象和全过程，再选守恒、定理或关系式。',
  },
  {
    id: 'physics-electric-field', subject: '物理',
    knowledgeNodes: ['静电场', '恒定电流', '磁场与电磁感应'],
    taskLabel: '电场、电路和磁场方向', abilityWeights: w(.00, .05, .25, .40, .30),
    mechanisms: ['空间转换', '处理符号', '发现关系'],
    startWith: '先画方向、回路或场的分布，再判断量和状态怎样变化。',
  },
  {
    id: 'physics-experiment', subject: '物理',
    knowledgeNodes: ['运动与力学实验', '电学实验', '变量、读数与误差'],
    taskLabel: '物理实验的变量和结论', abilityWeights: w(.10, .25, .25, .10, .30),
    mechanisms: ['组织信息', '处理符号', '推出结论'],
    startWith: '先分清要改什么、测什么、看到什么，再处理数据和误差。',
  },

  // 化学
  {
    id: 'chemistry-reaction-network', subject: '化学',
    knowledgeNodes: ['物质及其变化', '离子反应', '氧化还原反应'],
    taskLabel: '反应关系和转化网络', abilityWeights: w(.10, .15, .25, .15, .35),
    mechanisms: ['识别结构', '发现关系', '推出结论'],
    startWith: '先写清反应前后有哪些粒子和变化，再配平或判断。',
  },
  {
    id: 'chemistry-element-properties', subject: '化学',
    knowledgeNodes: ['物质结构与性质', '元素周期律', '元素化合物'],
    taskLabel: '元素性质和变化规律', abilityWeights: w(.25, .15, .15, .10, .35),
    mechanisms: ['准确提取', '归纳规律', '推出结论'],
    startWith: '把同一族元素的“结构—性质—常见反应”放到一张表里对照。',
  },
  {
    id: 'chemistry-equilibrium-change', subject: '化学',
    knowledgeNodes: ['化学反应原理', '反应速率', '化学平衡'],
    taskLabel: '平衡、速率和条件变化', abilityWeights: w(.05, .10, .30, .15, .40),
    mechanisms: ['理解变化', '发现关系', '推出结论'],
    startWith: '先写“改了什么条件—体系先怎么变—最后往哪边走”。',
  },
  {
    id: 'chemistry-experiment', subject: '化学',
    knowledgeNodes: ['化学实验', '实验方案', '现象、操作与评价'],
    taskLabel: '化学实验的操作和评价', abilityWeights: w(.10, .30, .10, .15, .35),
    mechanisms: ['组织信息', '识别结构', '推出结论'],
    startWith: '把实验拆成“目的—操作—现象—结论—风险”五格再判断。',
  },

  // 生物
  {
    id: 'biology-structure-function', subject: '生物',
    knowledgeNodes: ['细胞的分子组成与结构', '细胞的代谢', '结构与功能'],
    taskLabel: '细胞结构和功能关系', abilityWeights: w(.25, .20, .05, .20, .30),
    mechanisms: ['保持信息', '识别结构', '发现关系'],
    startWith: '先画出结构位置，再用箭头连它的功能和物质去向。',
  },
  {
    id: 'biology-process-regulation', subject: '生物',
    knowledgeNodes: ['稳态与调节', '生命活动的调节', '反馈过程'],
    taskLabel: '调节过程和反馈关系', abilityWeights: w(.15, .20, .10, .15, .40),
    mechanisms: ['组织信息', '理解变化', '推出结论'],
    startWith: '按“刺激—传递—反应—反馈”画过程链，再做题。',
  },
  {
    id: 'biology-genetics', subject: '生物',
    knowledgeNodes: ['遗传与进化', '遗传规律', '变异与育种'],
    taskLabel: '遗传规律和系谱推断', abilityWeights: w(.20, .10, .30, .10, .30),
    mechanisms: ['处理符号', '归纳规律', '推出结论'],
    startWith: '先把已知性状和亲子关系画成图，再列可能情况。',
  },
  {
    id: 'biology-experiment', subject: '生物',
    knowledgeNodes: ['生物技术与工程', '实验与探究', '变量和结论'],
    taskLabel: '生物实验的变量和结论', abilityWeights: w(.10, .25, .20, .05, .40),
    mechanisms: ['组织信息', '处理符号', '推出结论'],
    startWith: '先分实验组、对照组和变量，再判断数据能说明什么。',
  },

  // 历史
  {
    id: 'history-time-context', subject: '历史',
    knowledgeNodes: ['中外历史纲要', '时序', '阶段特征'],
    taskLabel: '历史时序和阶段特征', abilityWeights: w(.35, .25, .00, .15, .25),
    mechanisms: ['保持信息', '识别结构', '发现关系'],
    startWith: '先把事件放回时间线，再看同一阶段发生了哪些变化。',
  },
  {
    id: 'history-material-inference', subject: '历史',
    knowledgeNodes: ['史料实证', '材料解析', '史料与结论'],
    taskLabel: '史料阅读和结论判断', abilityWeights: w(.15, .40, .00, .00, .45),
    mechanisms: ['理解意思', '组织信息', '推出结论'],
    startWith: '先分清材料说了什么、没说什么，再选能被材料支持的结论。',
  },
  {
    id: 'history-cause-change', subject: '历史',
    knowledgeNodes: ['历史解释', '原因、过程与影响', '比较与联系'],
    taskLabel: '历史原因、过程和影响', abilityWeights: w(.15, .30, .00, .00, .55),
    mechanisms: ['组织信息', '发现关系', '推出结论'],
    startWith: '把原因、过程、影响分栏写，再找哪一项真正解释了变化。',
  },

  // 政治
  {
    id: 'politics-concept-network', subject: '政治',
    knowledgeNodes: ['经济与社会', '政治与法治', '哲学与文化'],
    taskLabel: '概念之间的关系', abilityWeights: w(.25, .35, .05, .00, .35),
    mechanisms: ['理解意思', '组织信息', '发现关系'],
    startWith: '把相近概念写成“是什么—和谁不同—能解释什么”的对照。',
  },
  {
    id: 'politics-material-reasoning', subject: '政治',
    knowledgeNodes: ['材料分析', '信息提取', '依据与结论'],
    taskLabel: '材料题的信息和依据', abilityWeights: w(.10, .45, .05, .00, .40),
    mechanisms: ['理解意思', '组织信息', '推出结论'],
    startWith: '先在材料里划出事实、问题和做法，再对应课本里的依据。',
  },
  {
    id: 'politics-subjective-answer', subject: '政治',
    knowledgeNodes: ['主观题', '观点、依据与表达', '学科术语'],
    taskLabel: '主观题的组织和表达', abilityWeights: w(.15, .55, .00, .00, .30),
    mechanisms: ['准确提取', '准确表达', '推出结论'],
    startWith: '每一点先写结论词，再补材料依据，最后检查有没有答到设问。',
  },

  // 地理
  {
    id: 'geography-map-space', subject: '地理',
    knowledgeNodes: ['地图与地理信息技术', '经纬网', '区域定位'],
    taskLabel: '地图、区域和空间定位', abilityWeights: w(.10, .10, .10, .50, .20),
    mechanisms: ['识别结构', '空间转换', '发现关系'],
    startWith: '先定经纬度、海陆和相对位置，再调动区域知识。',
  },
  {
    id: 'geography-process-chain', subject: '地理',
    knowledgeNodes: ['自然地理过程', '大气、水文、地貌', '过程与影响'],
    taskLabel: '自然地理的过程链', abilityWeights: w(.10, .15, .15, .25, .35),
    mechanisms: ['空间转换', '理解变化', '推出结论'],
    startWith: '画“条件→过程→结果→影响”的箭头链，再组织答案。',
  },
  {
    id: 'geography-data-chart', subject: '地理',
    knowledgeNodes: ['地理图表', '统计图', '数据判读'],
    taskLabel: '图表数据和变化判断', abilityWeights: w(.05, .10, .35, .30, .20),
    mechanisms: ['感知数量', '理解变化', '空间转换'],
    startWith: '先看坐标、单位和变化拐点，再说原因和影响。',
  },
  {
    id: 'geography-human-region', subject: '地理',
    knowledgeNodes: ['人文地理', '区域发展', '人地协调'],
    taskLabel: '区域发展和措施分析', abilityWeights: w(.10, .25, .10, .15, .40),
    mechanisms: ['组织信息', '发现关系', '推出结论'],
    startWith: '先分自然条件、人类活动和结果，再判断措施解决哪一个问题。',
  },

  // 技术
  {
    id: 'technology-system-analysis', subject: '技术',
    knowledgeNodes: ['技术与设计', '系统分析', '结构与功能'],
    taskLabel: '系统、结构和功能分析', abilityWeights: w(.05, .15, .15, .35, .30),
    mechanisms: ['识别结构', '组织信息', '发现关系'],
    startWith: '先画出系统由哪些部分组成，再看一个变化会影响谁。',
  },
  {
    id: 'technology-process-flow', subject: '技术',
    knowledgeNodes: ['流程与控制', '流程图', '控制系统'],
    taskLabel: '流程图和控制关系', abilityWeights: w(.05, .15, .20, .25, .35),
    mechanisms: ['空间转换', '理解变化', '推出结论'],
    startWith: '先按顺序画流程，再标输入、判断点和输出。',
  },
  {
    id: 'technology-data-algorithm', subject: '技术',
    knowledgeNodes: ['信息技术', '数据与算法', '程序与问题解决'],
    taskLabel: '算法步骤和数据关系', abilityWeights: w(.05, .10, .35, .15, .35),
    mechanisms: ['处理符号', '归纳规律', '推出结论'],
    startWith: '先用自然语言写清输入、处理和输出，再翻成流程或代码。',
  },
  {
    id: 'technology-design-evaluation', subject: '技术',
    knowledgeNodes: ['设计方案', '模型制作', '方案评价'],
    taskLabel: '设计方案和评价', abilityWeights: w(.05, .25, .10, .30, .30),
    mechanisms: ['识别结构', '组织信息', '推出结论'],
    startWith: '先写清目标和限制，再逐项比较方案是否真的满足。',
  },
]

/** 每个学生只带入一门外语，避免英语、日语同时挤占“投入区”。 */
export const taskMapForStudent = (foreignLanguage: ForeignLanguage): readonly SubjectTaskMap[] =>
  subjectTaskMap.filter((task) => task.subject !== (foreignLanguage === '英语' ? '日语' : '英语'))

export const tasksForSubject = (
  subject: SubjectName,
  foreignLanguage: ForeignLanguage,
): readonly SubjectTaskMap[] => taskMapForStudent(foreignLanguage).filter((task) => task.subject === subject)
