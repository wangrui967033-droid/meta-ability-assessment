import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const outputUrl = new URL('../docs/production/12-V1.6完整30题与逐题审查.md', import.meta.url)
const server = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })

const difficultyLabel = { easy: '基础', medium: '中等', challenge: '挑战' }
const riskLabel = { low: '低', medium: '中', high: '高' }
const escapeCell = (value) => String(value).replaceAll('|', '／').replaceAll('\n', ' ')
const minutes = (seconds) => Math.floor(seconds / 60) + '分' + String(seconds % 60).padStart(2, '0') + '秒'

try {
  const bankModule = await server.ssrLoadModule('/src/data/meta-bank-v1.6.ts')
  const {MemoryGlyph, memoryGlyphs} = await server.ssrLoadModule('/src/components/MemoryGlyph.tsx')
  const visualDir = new URL('../docs/production/memory-visuals/', import.meta.url)
  await mkdir(visualDir, {recursive:true})
  for (const id of Object.keys(memoryGlyphs)) await writeFile(new URL(id + '.svg', visualDir), renderToStaticMarkup(createElement(MemoryGlyph, {id})))
  const visualRef = id => '![图形](memory-visuals/' + id + '.svg)'
  const bank = bankModule.META_BANK_V16
  const tasks = bankModule.orderedV16Tasks
  const scoredResponses = tasks.reduce((total, task) => total + task.items.length, 0)

  const comparison = [
    ['题库来源', 'V1.5候选题加覆盖层', 'V1.6单一事实来源，同时生成页面、答案与审计'],
    ['任务权重', '多小题按点击数累计', '每任务1分，多小题内部正确率折算'],
    ['语言与推演', '部分语言题承担多条件推理', '语言聚焦句意、组织、表达辨析；推演独立承接逻辑'],
    ['记忆材料', '即时与延迟题可能重复正确材料', '视觉A/B、语义C/D子集隔离，4/5/6项序列独立'],
    ['空间结构', '折叠和长路径负荷较多', '只保留1个展开图，增加补线、拼合与两步路径'],
    ['数理知识依赖', '包含百分比、公式化表达', '使用小整数、非符号数量、变化与新符号规则'],
    ['报告边界', '二级能力容易被理解为精细结论', '五项元能力为主结果，二级能力只作解释性信号'],
    ['时长核算', '主要按30个任务单元估计', '同时核算实际选择次数、材料、操作说明和切换；结论待预测试'],
  ]

  const comparisonTable = comparison.map((row) => '| ' + row.map(escapeCell).join(' | ') + ' |').join('\n')

  const taskDetails = tasks.map((task) => {
    const risk = task.dependencyRisk
    const itemText = task.items.map((question, index) => {
      const options = question.options.map((option) => option.id + '．' + (option.visualId ? visualRef(option.visualId) + '（内部标注：' + option.label + '）' : option.label)).join('　')
      const distractors = question.options
        .filter((option) => option.id !== question.correctAnswer)
        .map((option) => '- ' + option.id + '：' + question.distractorReasons[option.id])
        .join('\n')
      return [
        '#### ' + task.code + '-' + (index + 1),
        '',
        '**学生端题目：** ' + (question.targetVisualId ? '这个图形原来在哪个位置？' : question.text),
        ...(question.targetVisualId ? [visualRef(question.targetVisualId), '内部目标编号：' + question.targetVisualId] : []),
        ...(question.asset ? ['![题目图形](../../src/assets/source-v1.6-quality/' + question.asset + '.svg)'] : []),
        '',
        '**选项：** ' + options,
        '',
        '**正确答案：** ' + question.correctAnswer,
        '',
        '**标准推导：** ' + question.standardDerivation,
        '',
        '**唯一答案检查：** ' + question.uniqueAnswerCheck,
        '',
        '**其他选项不成立：**',
        '',
        distractors,
      ].join('\n')
    }).join('\n\n')
    return [
      '### ' + String(task.position).padStart(2, '0') + '｜' + task.code + '｜' + task.primaryAbility + '·' + task.mechanism,
      '',
      '- 主要测量元能力：' + task.primaryAbility,
      '- 对应二级能力：' + task.mechanism,
      '- 可能同时调用：' + task.secondaryAbilities.join('、'),
      '- 题型：' + task.paradigm,
      '- 为什么能测目标能力：' + task.measurementRationale,
      '- 可能受其他能力影响：' + task.secondaryAbilities.join('、') + '（不作为本题主结论）',
      '- 难度：' + difficultyLabel[task.difficulty],
      '- 预计作答时间：' + task.expectedSeconds + '秒',
      '- 知识依赖风险：' + riskLabel[risk.knowledge.level] + '；' + risk.knowledge.reason,
      '- 阅读依赖风险：' + riskLabel[risk.reading.level] + '；' + risk.reading.reason,
      '- 题型经验风险：' + riskLabel[risk.formatExperience.level] + '；' + risk.formatExperience.reason,
      '- 任务计分：内部' + task.items.length + '次作答先求正确率，再折算为本任务1分',
      '- 学生题干：' + task.prompt,
      '',
      itemText,
    ].join('\n')
  }).join('\n\n')

  const abilities = ['记忆', '语言', '数理', '空间', '推演']
  const coverage = abilities.map((ability) => {
    const abilityTasks = tasks.filter((task) => task.primaryAbility === ability)
    const mechanisms = [...new Set(abilityTasks.map((task) => task.mechanism))]
    const counts = {
      easy: abilityTasks.filter((task) => task.difficulty === 'easy').length,
      medium: abilityTasks.filter((task) => task.difficulty === 'medium').length,
      challenge: abilityTasks.filter((task) => task.difficulty === 'challenge').length,
    }
    return '| ' + [ability, abilityTasks.length, mechanisms.join('、'), counts.easy, counts.medium, counts.challenge, '6分'].join(' | ') + ' |'
  }).join('\n')

  const reviewRows = tasks.map((task) => {
    const unique = task.items.every((question) =>
      question.options.filter((option) => option.id === question.correctAnswer).length === 1
      && Object.keys(question.distractorReasons).length === question.options.length - 1)
    const mobile = task.items.every((question) => Math.max(...question.options.map((option) => option.label.length)) <= 58)
    const confusion = task.primaryAbility === '推演'
      ? (task.paradigm.startsWith('graphic') ? '图形负荷受控' : '非空间主导')
      : task.primaryAbility === '空间' ? '空间操作为核心' : '次要调用已标注'
    return '| ' + [
      task.code,
      task.primaryAbility + '·' + task.mechanism,
      task.measurementRationale,
      task.secondaryAbilities.join('、'),
      unique ? '答案键与解析齐全；非逻辑证明' : '需修订',
      confusion,
      riskLabel[task.dependencyRisk.knowledge.level],
      mobile ? '文字长度符合；需实机复核' : '需修订',
      task.expectedSeconds + '秒',
    ].join(' | ') + ' |'
  }).join('\n')

  const memoryRows = bank.memoryPresentations.map((entry) =>
    '| ' + [entry.id, entry.beforeTask, entry.durationSeconds + '秒', entry.visualIds ? entry.visualIds.map(visualRef).join(' ') : entry.content.join('；')].map(escapeCell).join(' | ') + ' |',
  ).join('\n')

  const markdown = [
    '# 元能力测评 V1.6｜完整30题与逐题审查',
    '',
    '本轮修订：N01由持续显示改为学生点击、图片加载完成后展示8秒，倒计时结束收起后作答；8秒内仍可能计数，不作为纯粹近似数感指标。不改变数理归属和任务计分。中断后明确提示并更换同数量新布局；完整观看后的刷新不重播。M05每题保留六个位置选项，原始正确答案ID及坐标不变。目标仍在下排，跨题位置分布线索尚未消除。新旧呈现版本不直接混比。',
    '取消奇偶任务均分差50个百分点对应的一致性硬门槛；保留描述数值但不作信度估计，不新增两题分差判定规则。保存材料结束时间及六项记忆任务的入题、提交保持间隔；展示中断或时间不可用记为null，时间不进入评分。删除学生端长评分说明，解释边界保留在内部审计及报告首段。',
    '生成日期：2026-09-07；题库交付版本：1.6-student-8s-20260907。题目引导、全部报告板块及页尾改为学生用语；已确认能力名称、正确答案、选项、计分及学科需求值≥3展示规则不变。新版本使用独立会话键，不覆盖旧版作答记录。',
    '',
    '### 选项顺序与记录说明',
    '',
    '本表的A/B/C/D均为题库原始ID，不代表学生看到的固定顺序。新会话生成并保存全部选项顺序（session-options-2）；刷新和继续测评复用原顺序。正确性仍按原始ID判分，每任务满分1分，多次作答取内部正确率。',
    '',
    '普通文字与图形选项按会话重新排列；S01—S04及S06第二题的候选图形整块换位，图中与按钮按相同的A/B/C/D顺序显示，图形内部几何与标记不变。数轴和位置转换图中有意义的点位不移动，仅同步更新展示字母。N01左右判断与M05六格位置板保留真实方位，不进行可能改变题意的空间重排；记录中以spatial-fixed明确标注，不计作已经打乱位置。',
    '',
    '本地记录保存optionOrders及每题optionAudit，包含原始ID、原始位置、展示位置、展示标识和所选项映射。位置使用1起算；M05展示位置按六格板从左到右、从上到下编号。内部复核通过reviewDisplayedOptions按原始ID关联图形、答案和干扰项解释；不要将本表原始字母直接当作学生展示字母。',
    '',
    '当前交付仍为本地联调HTML，尚无接收数据的后台服务。提交接口已携带会话、版本与选项映射字段；正式上线须由服务端登记会话顺序、保存记录并根据服务端题库判分，不能信任客户端提交的正确性或自报映射。新版使用独立存储键，旧版记录不会被删除，但不混入新版继续作答。',
    '',
    '本轮保留30任务、65次作答、计分公式和学科映射规则，未继续增加难度。学生端名称改为“元能力学习画像”，报告将高项标为待验证，并说明各组难度尚未校准，分差不等于能力差距。05保留完整学、背、练、补内容，补充实际动作与试用记录入口。',
    '',
    '学生报告已移除预测试反馈表单、各学科重复试用提醒和页尾口号。已有本机pilotFeedback历史记录保留，不删除作答、计时或选项映射。各组题目尚未完成难度校准，原始得分不可直接解释为跨能力强弱；学生端用简短白话保留这一边界。03展示学科底盘表中需求值≥3的能力，仍按原规则分组，不改评分与映射。',
    '',
    '## 1. 修改前后对照表',
    '',
    '| 项目 | 修改前 | 修改后 |',
    '| --- | --- | --- |',
    comparisonTable,
    '',
    '## 2. 记忆材料呈现与延迟流程',
    '',
    '| 材料 | 呈现时点 | 呈现时间 | 内容 |',
    '| --- | --- | ---: | --- |',
    memoryRows,
    '',
    '视觉位置板中，M01只考VA1—VA3是否出现，M05只考VB1—VB3原始位置；语义材料中，M02只考SC1—SC3即时配对，M04只考SD1—SD3延迟配对。即时题的题干和选项不出现延迟子集。M03的两组序列在S03之前呈现，完成S03与R03两个其他任务后才在M03作答；M06不再选择完整序列，而是在相似干扰中提取第2、4、5位。',
    '',
    '编号仅用于内部审计，不出现在学生可见文字、提示或无障碍名称中。视觉材料与M01选项、M05目标共用SVG。M01直接选图，M05先看图再选位置；语义材料保留虚构对象名称，删除分组编号。去掉外部名称提示并不能阻止学生自行给图形命名，这一策略影响仍需通过预测试访谈记录。',
    '',
    '## 3. 完整30个任务、内部标注与答案解析',
    '',
    taskDetails,
    '',
    '## 4. 五项元能力覆盖与难度分布',
    '',
    '| 元能力 | 任务数 | 二级能力 | 基础 | 中等 | 挑战 | 总分 |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: |',
    coverage,
    '',
    '计分规则：每个任务单元统一1分；每项元能力6分；每项二级能力2分。二级能力只作为解释性信号，不做精细排名或确定性判断。',
    '',
    '## 5. 逐题审查',
    '',
    '| 任务 | 测量目标 | 为什么能测 | 可能受何种能力影响 | 唯一答案 | 能力混淆 | 知识依赖 | 手机可读性 | 预计时间 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | ---: |',
    reviewRows,
    '',
    '审查结论：30个任务均已写入唯一答案检查、完整正向推导和逐项干扰解释。R04只追踪形状与数字两类独立规则，不使用复杂空间旋转；推演保持图形规律、极简符号关系和短文本推理的组合。此处是内容审查结论，不替代预测试数据。',
    '',
    '## 6. 预计总时长',
    '',
    '- 正式任务：' + bank.timeBudget.formalTasksSeconds + '秒（' + minutes(bank.timeBudget.formalTasksSeconds) + '）',
    '- 记忆材料：' + bank.timeBudget.memoryPresentationSeconds + '秒',
    '- 操作说明阅读预留（题内展示，无额外答题）：' + bank.timeBudget.practiceSeconds + '秒',
    '- 页面说明与切换：' + bank.timeBudget.transitionSeconds + '秒',
    '- 实际计分选择次数：' + scoredResponses + '次',
    '- 题库静态估算合计：' + bank.timeBudget.totalExpectedSeconds + '秒（' + minutes(bank.timeBudget.totalExpectedSeconds) + '）',
    '- 学生页显示“预计15～18分钟”，是预估范围，不是实测保证。总体中位数、P90、阅读慢学生用时，以及每题和示例耗时均待预测试验证。',
    '- 时长结论：待预测试验证。静态加总只用于安排测试，不宣称已经满足15分钟目标。',
    '',
    '## 7. 仍需通过预测试验证的问题',
    '',
    '1. 每题实际通过率是否符合基础、中等、挑战的预设顺序。',
    '2. 每个干扰项是否都有足够选择率，能否区分具体误判，而非成为明显废项。',
    '3. ' + scoredResponses + '次实际选择在手机端的中位完成时长及P90时长是否能控制在目标范围。',
    '4. 视觉位置板24秒、语义配对24秒、序列18秒与12秒是否既能理解又不会出现天花板效应。',
    '5. SVG点阵、数轴与空间图形在不同尺寸手机上是否稳定、易辨认；SVG视觉记忆图形是否等大清晰；剩余序列符号在不同系统字体中是否等价。',
    '6. L04、R04、N06、S05、M05五个挑战任务是否形成适度挑战，而不是突然增加阅读或题型经验负担。',
    '7. 记忆即时与延迟子集虽不重合，学生是否仍会用类别线索间接强化延迟材料。',
    '8. 每个二级能力只有两个任务，信号稳定性是否足以用于解释；预测试前不据此排名。',
    '9. 五项元能力分数的内部一致性、重测稳定性和任务间相关结构是否支持当前解释边界。',
    '10. “准确表达”的任务证据是否被正确理解为选择题中的表达判断，而不是开放式表达水平。',
    '',
  ].join('\n')

  await writeFile(outputUrl, markdown)
  console.log('Generated ' + fileURLToPath(outputUrl) + ' with ' + tasks.length + ' tasks and ' + scoredResponses + ' scored responses.')
} finally {
  await server.close()
}
