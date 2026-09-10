import type { Dimension } from './assessment-types'
import { knowledgeGraphCatalog, type KnowledgeGraphTopic } from './knowledge-graph-catalog'
import type { MechanismKey, SubjectName } from './subject-task-map'

export interface KnowledgeTaskAbilityMapping {
  primary: readonly Dimension[]
  learningRuleId?: string
  entry: readonly Dimension[]
  typicalAction: string
  mechanisms: readonly MechanismKey[]
  basis: string
  reviewStatus: '图谱已标注' | '待教研复核'
  source: `catalog-reviewed:${string}` | `topic-rule:${string}` | `subject-framework:${SubjectName}`
}

interface TopicRule {
  id: string
  subjects: readonly SubjectName[]
  pattern: RegExp
  primary: readonly Dimension[]
  entry: readonly Dimension[]
  typicalAction: string
  mechanisms: readonly MechanismKey[]
  basis: string
}

const rule = (
  id: string,
  subjects: readonly SubjectName[],
  pattern: RegExp,
  primary: readonly Dimension[],
  entry: readonly Dimension[],
  typicalAction: string,
  mechanisms: readonly MechanismKey[],
  basis: string,
): TopicRule => ({ id, subjects, pattern, primary, entry, typicalAction, mechanisms, basis })

/**
 * 二级任务元能力需求 V1。规则只读取知识任务名称，不读取学生结果，也不读取一级模块名。
 * 标注依据与具体元能力会同步进入教研审核表；待教研确认后可逐条迁入图谱显式字段。
 */
export const knowledgeTaskAbilityRules: readonly TopicRule[] = [
  rule('chinese-information-text', ['语文'], /^信息文$/, ['language'], ['reasoning', 'memory'], '读懂信息、组织材料并根据证据判断', ['理解意思', '组织信息', '发现关系', '推出结论'], '信息文先要求理解和组织文本，推演用于连接证据与结论。'),
  rule('chinese-language-use', ['语文'], /^语言文字运用$/, ['language'], ['reasoning', 'memory'], '结合语境辨析、修改并准确表达', ['理解意思', '组织信息', '准确表达'], '任务直接考查语境理解与语言组织，规则判断和记忆提供支持。'),
  rule('chinese-recall', ['语文'], /默写|名篇名句/, ['memory'], ['language'], '根据提示准确提取已学内容', ['保持信息', '准确提取'], '核心动作是保持并提取已学材料。'),
  rule('chinese-writing', ['语文'], /作文|写作/, ['language'], ['reasoning', 'memory'], '形成观点、组织材料并完成表达', ['组织信息', '准确表达', '推出结论'], '成文的直接要求是组织与表达，推演和材料提取提供支持。'),
  rule('chinese-reading', ['语文'], /小说|戏剧|散文|文言文|诗歌|阅读/, ['language'], ['reasoning', 'memory'], '理解文本、整理线索并形成有依据的判断', ['理解意思', '组织信息', '发现关系'], '阅读首先要求理解和组织文本，再调用推演与记忆。'),

  rule('language-vocabulary-recall', ['英语', '日语'], /词汇|单词|熟词|固定搭配/, ['memory'], ['language'], '识记、辨认并在语境中提取词义或搭配', ['快速记住', '保持信息', '准确提取'], '词汇学习的核心是信息保持与提取，语境理解提供辅助。'),
  rule('language-writing', ['英语', '日语'], /写作|作文|书信|通知|演讲稿|邮件|日记|描写|表达/, ['language'], ['reasoning', 'memory'], '根据交际目的组织信息并准确表达', ['组织信息', '准确表达', '推出结论'], '写作直接要求语言组织与表达，推演和材料提取提供支持。'),
  rule('language-inference', ['英语', '日语'], /推理|逻辑|原因|理由|主旨|观点|选标题|匹配关系/, ['reasoning'], ['language'], '连接上下文证据并推出隐含信息', ['理解意思', '发现关系', '推出结论'], '答案不能直接提取，需要在理解文本后完成推演。'),
  rule('language-grammar', ['英语', '日语'], /语法|句型|助词|动词|形容词|副词|介词|代词|冠词|连词|句子成分/, ['language'], ['memory', 'reasoning'], '识别句法功能并在语境中选择正确形式', ['理解意思', '组织信息', '准确提取'], '语法的直接对象是语言结构，规则提取与关系判断提供支持。'),
  rule('language-reading', ['英语', '日语'], /阅读|长难句|细节|信息理解|内容填空|指示代词|七选五|完形|听力|对话|独白|语音/, ['language'], ['reasoning', 'memory'], '理解语篇、定位信息并整合前后关系', ['理解意思', '组织信息', '发现关系'], '语篇理解是主任务，推演与信息提取用于完成判断。'),

  rule('math-sequence', ['数学'], /数列|通项|求和|等差|等比/, ['reasoning'], ['quantitative', 'memory'], '从项的变化中归纳规律并进行符号推演', ['理解变化', '处理符号', '归纳规律', '推出结论'], '核心动作是从变化中归纳并推出结论，数理与公式提取提供支持。'),
  rule('math-statistics', ['数学'], /概率|统计|计数|随机变量|分布/, ['quantitative'], ['reasoning'], '整理数量信息、建立统计关系并解释结果', ['感知数量', '处理符号', '发现关系', '推出结论'], '核心对象是数据、数量和概率关系，推演用于解释和判断。'),
  rule('math-function-visual', ['数学'], /函数.*(?:图像|图象)|(?:图像|图象).*函数/, ['quantitative'], ['space', 'reasoning'], '把变量关系在式与图之间转换', ['理解变化', '处理符号', '识别结构'], '函数关系以数量变化为主，图像结构可作为固定辅助入口。'),
  rule('math-space', ['数学'], /几何|向量|直线|圆|椭圆|双曲线|抛物线|位置关系/, ['space'], ['reasoning', 'quantitative'], '识别图形结构、位置关系并完成几何推演', ['识别结构', '空间想象', '空间转换', '推出结论'], '任务直接处理图形与位置，推演和数理支持证明与计算。'),
  rule('math-reasoning', ['数学'], /逻辑|导数|应用/, ['reasoning'], ['quantitative'], '根据条件建立关系并逐步推出结论', ['发现关系', '推出结论', '处理符号'], '核心动作是建立条件链并推演，符号处理提供支持。'),
  rule('math-quantitative', ['数学'], /运算|函数|不等式|复数|方程|三角|集合|指对/, ['quantitative'], ['reasoning', 'memory'], '处理符号、数量关系与变量变化', ['感知数量', '理解变化', '处理符号'], '任务直接处理数量、符号和变化，推演与公式提取提供支持。'),

  rule('physics-modern-concepts', ['物理'], /波粒二象性|光电效应|原子|原子核|分子动理论|气体/, ['reasoning'], ['memory', 'quantitative'], '用概念、证据和数量关系解释微观现象', ['准确提取', '发现关系', '推出结论', '处理符号'], '主要依赖概念关系与推演，不把不可见的微观概念直接等同为空间元能力。'),
  rule('physics-energy', ['物理'], /功和能|能量|动量|碰撞|守恒/, ['reasoning'], ['quantitative', 'memory'], '识别状态变化并选择守恒或功能关系推演', ['发现关系', '推出结论', '处理符号', '准确提取'], '核心是判断过程中的关系与守恒条件，数量和规律提取提供支持。'),
  rule('physics-experiment', ['物理'], /实验|误差|读数/, ['reasoning'], ['quantitative', 'memory'], '控制条件、处理数据并依据证据得出结论', ['发现关系', '推出结论', '处理符号'], '实验核心是条件控制和证据推理，不按学生优势临时添加入口。'),
  rule('physics-space', ['物理'], /运动|受力|力与|电场|磁场|电路|光学|振动|方向|轨迹|电容器/, ['space'], ['reasoning', 'quantitative'], '还原对象、方向或结构并建立物理关系', ['识别结构', '空间想象', '空间转换', '发现关系'], '任务直接要求处理对象位置、方向或结构，推演和数理提供支持。'),
  rule('physics-reasoning', ['物理'], /规律|定律|感应|变压器|物理/, ['reasoning'], ['quantitative', 'memory'], '识别适用条件并沿物理关系推出结果', ['发现关系', '推出结论', '处理符号'], '核心动作是条件判断和关系推演。'),

  rule('science-calculation', ['化学', '生物', '技术'], /计算|计量|数量|频率|数据|编码|算法|Python|pandas/, ['quantitative'], ['reasoning'], '处理数量、数据或符号并验证结果', ['感知数量', '理解变化', '处理符号'], '任务对象是数据与数量关系。'),
  rule('science-structure', ['化学', '生物', '技术'], /结构|晶体|细胞|系统|工程|电路|控制/, ['space'], ['reasoning', 'memory'], '识别组成、位置与系统连接', ['识别结构', '空间想象', '发现关系'], '任务直接处理组成结构与连接关系。'),
  rule('science-process', ['化学', '生物', '技术'], /反应|变化|代谢|调节|遗传|进化|实验|应用/, ['reasoning'], ['memory', 'quantitative'], '连接条件、过程与结果并解释变化', ['发现关系', '归纳规律', '推出结论'], '任务核心是过程关系和因果推演。'),

  rule('humanities-source', ['历史', '政治'], /史学|材料|权利|义务|法治|逻辑|思维|争议/, ['reasoning'], ['language', 'memory'], '读懂材料、连接证据并形成判断', ['理解意思', '发现关系', '推出结论'], '材料任务需要以证据支持判断。'),
  rule('humanities-knowledge', ['历史', '政治'], /史|社会|文化|经济|政治|哲学|法律|国家|组织/, ['language'], ['memory', 'reasoning'], '理解概念和材料并组织有依据的表达', ['理解意思', '组织信息', '准确表达'], '直接任务是理解与表达，记忆和推演提供支持。'),
  rule('geography-data', ['地理'], /人口|能源|资源|数据|信息技术/, ['quantitative'], ['reasoning', 'space'], '读取数据、比较变化并联系区域条件', ['感知数量', '理解变化', '发现关系'], '数据变化是直接对象，推演与空间定位提供支持。'),
  rule('geography-space', ['地理'], /地貌|大气|气候|水体|地理|城镇|交通|区域|地球|运动|产业/, ['space'], ['reasoning', 'memory'], '定位空间分布并解释地理过程', ['识别结构', '空间想象', '发现关系'], '地图、位置和区域联系是直接任务对象。'),
]

const subjectFramework: Readonly<Record<SubjectName, Omit<KnowledgeTaskAbilityMapping, 'source' | 'reviewStatus'>>> = {
  语文: { primary: ['language'], entry: ['reasoning', 'memory'], typicalAction: '理解材料并组织表达', mechanisms: ['理解意思', '组织信息', '准确表达'], basis: '学科通用任务框架；具体节点待教研复核。' },
  数学: { primary: ['reasoning'], entry: ['quantitative'], typicalAction: '建立关系并完成推演', mechanisms: ['发现关系', '推出结论', '处理符号'], basis: '学科通用任务框架；具体节点待教研复核。' },
  英语: { primary: ['language'], entry: ['memory', 'reasoning'], typicalAction: '理解语篇并完成表达', mechanisms: ['理解意思', '组织信息', '准确表达'], basis: '学科通用任务框架；具体节点待教研复核。' },
  日语: { primary: ['language'], entry: ['memory', 'reasoning'], typicalAction: '理解语篇并完成表达', mechanisms: ['理解意思', '组织信息', '准确表达'], basis: '学科通用任务框架；具体节点待教研复核。' },
  物理: { primary: ['reasoning'], entry: ['quantitative', 'memory'], typicalAction: '识别条件并沿物理关系推演', mechanisms: ['发现关系', '推出结论', '处理符号'], basis: '学科通用任务框架；具体节点待教研复核。' },
  化学: { primary: ['reasoning'], entry: ['memory', 'quantitative'], typicalAction: '连接条件、反应与结果', mechanisms: ['发现关系', '推出结论', '准确提取'], basis: '学科通用任务框架；具体节点待教研复核。' },
  生物: { primary: ['reasoning'], entry: ['memory', 'space'], typicalAction: '连接结构、过程与结果', mechanisms: ['发现关系', '推出结论', '准确提取'], basis: '学科通用任务框架；具体节点待教研复核。' },
  历史: { primary: ['language'], entry: ['memory', 'reasoning'], typicalAction: '理解史料并组织有证据的解释', mechanisms: ['理解意思', '组织信息', '准确表达'], basis: '学科通用任务框架；具体节点待教研复核。' },
  政治: { primary: ['language'], entry: ['reasoning', 'memory'], typicalAction: '理解情境并用概念组织答案', mechanisms: ['理解意思', '组织信息', '准确表达'], basis: '学科通用任务框架；具体节点待教研复核。' },
  地理: { primary: ['space'], entry: ['reasoning', 'memory'], typicalAction: '定位空间并解释地理过程', mechanisms: ['识别结构', '空间想象', '发现关系'], basis: '学科通用任务框架；具体节点待教研复核。' },
  技术: { primary: ['reasoning'], entry: ['quantitative', 'space'], typicalAction: '设计流程并检查系统结果', mechanisms: ['发现关系', '推出结论', '识别结构'], basis: '学科通用任务框架；具体节点待教研复核。' },
}

export function resolveKnowledgeTaskAbility(subject: SubjectName, moduleName: string, topic: KnowledgeGraphTopic): KnowledgeTaskAbilityMapping {
  const matchedRule = knowledgeTaskAbilityRules.find((item) => item.subjects.includes(subject) && item.pattern.test(topic.name))
  const template = matchedRule ?? subjectFramework[subject]
  const catalogReviewed = Boolean(topic.abilityDimensions?.length)
  return {
    ...template,
    learningRuleId: matchedRule?.id,
    primary: topic.abilityDimensions?.length ? topic.abilityDimensions : template.primary,
    entry: topic.entryDimensions?.length ? topic.entryDimensions : template.entry,
    reviewStatus: catalogReviewed ? '图谱已标注' : '待教研复核',
    source: catalogReviewed
      ? `catalog-reviewed:${subject}/${moduleName}/${topic.name}`
      : matchedRule ? `topic-rule:${matchedRule.id}` : `subject-framework:${subject}`,
  }
}

export function formatKnowledgeTaskScore(score: string): string | null {
  if (!score || /未标/.test(score)) return null
  if (/基础/.test(score)) return '高频'
  if (/[~～\-]/.test(score)) {
    const values = score.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? []
    const upper = Math.max(0, ...values)
    return upper >= 6 ? '高频' : upper >= 2 ? '中频' : '低频'
  }
  const value = score.match(/\d+(?:\.\d+)?/)?.[0]
  return value ? `约${value}分` : null
}

export interface KnowledgeTaskAuditRow {
  subject: SubjectName
  module: string
  task: string
  score: string | null
  typicalAction: string
  mechanisms: readonly MechanismKey[]
  primary: readonly Dimension[]
  supporting: readonly Dimension[]
  basis: string
  reviewStatus: KnowledgeTaskAbilityMapping['reviewStatus']
  source: KnowledgeTaskAbilityMapping['source']
}

export function buildKnowledgeTaskAuditRows(): KnowledgeTaskAuditRow[] {
  return knowledgeGraphCatalog.flatMap((module) => {
    const sourceTopics: readonly KnowledgeGraphTopic[] = module.topics.length ? module.topics : [{ name: module.name, score: module.score }]
    return sourceTopics.map((topic) => {
      const mapping = resolveKnowledgeTaskAbility(module.subject, module.name, topic)
      return {
        subject: module.subject,
        module: module.name,
        task: topic.name,
        score: formatKnowledgeTaskScore(topic.score),
        typicalAction: mapping.typicalAction,
        mechanisms: mapping.mechanisms,
        primary: mapping.primary,
        supporting: mapping.entry,
        basis: mapping.basis,
        reviewStatus: mapping.reviewStatus,
        source: mapping.source,
      }
    })
  })
}
