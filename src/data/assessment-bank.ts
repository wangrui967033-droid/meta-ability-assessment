import type { AssessmentTask, DeckItem, Dimension, InteractionDefinition, TaskRole } from './assessment-types'

const choice = (stimulus: string, ...labels: string[]): InteractionDefinition => ({
  type: 'choice',
  stimulus,
  options: labels.map((label, index) => ({ id: String.fromCharCode(97 + index), label })),
})

const task = (
  position: number,
  id: string,
  dimension: Dimension,
  mechanism: string,
  role: TaskRole,
  prompt: string,
  interaction: InteractionDefinition,
  expectedSeconds: number,
  difficulty: AssessmentTask['difficulty'] = 'medium',
  pairId?: string,
): AssessmentTask => ({ id, version: `${id.toLowerCase()}-v1`, position, dimension, mechanism, role, prompt, interaction, expectedSeconds, difficulty, pairId })

export const deckA: DeckItem[] = [
  { id: 'A1', symbol: '△', word: 'NAPO' },
  { id: 'A2', symbol: '○', word: 'LUTI' },
  { id: 'A3', symbol: '□', word: 'MEKA' },
  { id: 'A4', symbol: '◇', word: 'RISO' },
  { id: 'A5', symbol: '☆', word: 'TAVU' },
  { id: 'A6', symbol: '⬟', word: 'PENI' },
]

export const deckB: DeckItem[] = [
  { id: 'B1', symbol: '☾', word: 'SOLA' },
  { id: 'B2', symbol: '✦', word: 'NEMI' },
  { id: 'B3', symbol: '⬢', word: 'KERO' },
  { id: 'B4', symbol: '⬡', word: 'VASI' },
  { id: 'B5', symbol: '◒', word: 'MULO' },
  { id: 'B6', symbol: '◐', word: 'TARI' },
]

export const assessmentTasks: AssessmentTask[] = [
  task(1, 'M-F-01R', 'memory', '快速记住', 'direct', '哪个标签刚才和三角形一起出现？', choice('回想刚才看到的第一组新信息。', 'NAPO', 'LUTI', 'MEKA', 'RISO'), 18, 'easy'),
  task(2, 'L-U-01', 'language', '理解意思', 'direct', '这则通知主要想提醒什么？', choice('资料室本周改为预约进入。没有预约的同学，可以在门口登记后等待空位。', '进入资料室要先预约或登记等待', '资料室本周暂停开放', '只允许老师进入资料室', '登记后一定立刻进入'), 18, 'easy'),
  task(3, 'CR-A1-T', 'language', '理解意思', 'cross-representation', '哪一句最准确地保留了资料卡的意思？', choice('甲组有6人，乙组和丙组各3人；三组一起参加同一项活动。', '甲组人数等于另外两组人数之和', '三组人数完全相同', '乙组人数最多', '甲组人数最少'), 26, 'medium', 'CR-A1'),
  task(4, 'ML-QS-01R', 'quantitative', '感知数量', 'direct', '哪一堆点更多？', choice('左边一堆点分得更开，右边一堆点更密。不要逐个数，只判断大致多少。', '左边更多', '右边更多', '差不多一样多', '无法判断'), 16, 'easy'),
  task(5, 'CR-B1-G', 'space', '识别结构', 'cross-representation', '哪张图的嵌套关系和材料一致？', choice('大框里有一个中框，中框里有一个小圆；小三角在中框外、仍在大框内。', '圆在中框内，三角在大框内', '圆和三角都在中框内', '三角在大框外', '圆在大框外'), 30, 'challenge', 'CR-B1'),
  {
    id: 'IN-RL-01R2', version: 'infer-relation-cooccurrence-lights-v0.4', position: 6, dimension: 'reasoning', mechanism: '发现关系', role: 'direct', difficulty: 'medium', expectedSeconds: 35,
    prompt: '每个按钮都固定控制一盏灯。看三次记录，找出甲、乙、丙各控制哪盏灯。',
    helper: '每行选择一盏灯；记录里的前后顺序不表示一一配对。',
    interaction: {
      type: 'mapping',
      records: [
        { id: 'r1', buttons: ['甲', '乙'], lights: ['三角灯', '圆灯'] },
        { id: 'r2', buttons: ['甲', '丙'], lights: ['圆灯', '方灯'] },
        { id: 'r3', buttons: ['乙', '丙'], lights: ['方灯', '三角灯'] },
      ],
      buttons: [{ id: 'jia', label: '甲' }, { id: 'yi', label: '乙' }, { id: 'bing', label: '丙' }],
      lights: [{ id: 'circle', label: '圆灯' }, { id: 'triangle', label: '三角灯' }, { id: 'square', label: '方灯' }],
    },
  },
  task(7, 'M-H-01', 'memory', '保持信息', 'direct', '把两个标签放到对应图形下面。', { type: 'slots', blocks: [{ id: 'MEKA', label: 'MEKA' }, { id: 'RISO', label: 'RISO' }], slots: [{ id: 'A3', label: '□' }, { id: 'A4', label: '◇' }] }, 22),
  { id: 'SP-IM-08-NEW-01', version: 'spatial-imagine-two-piece-outline-v0.1-precal.2', position: 8, dimension: 'space', mechanism: '空间想象', role: 'direct', difficulty: 'easy', expectedSeconds: 24, prompt: '把两块图形中标着粗短线的边贴在一起。拼好后，只看外边，像哪一张？', helper: '两块都不用转，只在脑中把它们拼起来。', interaction: { type: 'composition', options: [{ id: 'outline-a', label: '图形一' }, { id: 'outline-b', label: '图形二' }, { id: 'outline-c', label: '图形三' }, { id: 'outline-d', label: '图形四' }] } },
  task(9, 'CR-C1-N', 'quantitative', '理解变化', 'cross-representation', '这些变化按什么方式轮流？', choice('长度依次为：5格、8格、7格、10格、9格。', '新增3格、移去1格轮流', '每次新增3格', '每次移去1格', '新增1格、移去3格轮流'), 32, 'challenge', 'CR-C1'),
  task(10, 'L-R-03R', 'language', '组织信息', 'direct', '把三条信息放到合适的位置。', { type: 'slots', blocks: [{ id: 'rain', label: '下午出现降雨' }, { id: 'place', label: '展示地点移到一楼' }, { id: 'time', label: '签到时间是两点' }], slots: [{ id: 'event', label: '发生什么' }, { id: 'change', label: '哪项跟着变' }, { id: 'stable', label: '哪项不变' }] }, 24),
  task(11, 'CR-D2-S', 'space', '空间转换', 'cross-representation', '按两张操作图依次交换卡片，最后顺序是什么？', { type: 'sequence', instruction: '先交换最外两张，再交换中间两张。', items: [{ id: 'circle', label: '○' }, { id: 'triangle', label: '△' }, { id: 'diamond', label: '◇' }, { id: 'pentagon', label: '⬟' }] }, 28, 'medium', 'CR-D2'),
  task(12, 'ML-QR-01', 'quantitative', '处理符号', 'direct', '按照同一关系，输入5时输出是什么？', choice('输入：1、4、5；输出：3、12、？', '10', '12', '15', '20'), 22, 'easy'),
  task(13, 'M-R-01R', 'memory', '准确提取', 'direct', '根据图形和不完整提示，把标签补完整。', { type: 'slots', blocks: [{ id: 'TAVU', label: 'T _ V U' }, { id: 'PENI', label: 'P _ N I' }], slots: [{ id: 'A5', label: '☆' }, { id: 'A6', label: '⬟' }] }, 30, 'challenge'),
  task(14, 'IN-PT-03R', 'reasoning', '归纳规律', 'direct', '哪一项同时保留了两种变化？', choice('每次图形都多一条边，中心标记按空、点、线循环。', '双边框加中心点', '单边框加中心点', '双边框无中心标记', '单边框加中心线'), 20, 'easy'),
  task(15, 'L-E-02R', 'language', '准确表达', 'direct', '把词块排成最清楚的一句话。', { type: 'sequence', instruction: '条件在前，结果在后，转折保留。', items: [{ id: 'if', label: '如果' }, { id: 'diamond', label: '菱形出现' }, { id: 'pause', label: '传送暂停' }, { id: 'but', label: '但记录保留' }] }, 26),
  task(16, 'CR-A1-N', 'quantitative', '处理符号', 'cross-representation', '哪种分组和前面的资料卡表示同一关系？', choice('一个6格长条，旁边有两个3格长条。', '6:3:3', '6:6:3', '3:3:3', '6:2:4'), 26, 'medium', 'CR-A1'),
  task(17, 'SP-ST-03', 'space', '识别结构', 'direct', '哪句话和图里的层级关系一致？', choice('外框里有Q，Q里有R。', 'R在Q里，Q在外框里', 'Q在R里，R在外框里', 'R和Q都在外框外', '外框在R里'), 18, 'easy'),
  task(18, 'M-F-03R', 'memory', '快速记住', 'cross-context', '哪个配对和刚才的材料一致？', choice('请从四组图形和标签中找出原配。', '☾—SOLA', '✦—KERO', '⬢—VASI', '⬡—NEMI'), 20, 'easy'),
  task(19, 'CR-B1-T', 'language', '组织信息', 'cross-representation', '哪句话最清楚地区分主要安排和补充？', choice('主要安排在中框里，补充信息仍在大框里。', '补充信息在主要安排之外，但仍属于整体', '补充信息完全不属于整体', '主要安排和补充信息没有关系', '主要安排在补充信息外'), 28, 'challenge', 'CR-B1'),
  task(20, 'IN-CL-02', 'reasoning', '推出结论', 'direct', '根据已知顺序，哪项一定成立？', choice('甲在乙前，乙在丙前。', '甲在丙前', '丙在甲前', '甲和丙相邻', '无法判断甲和丙'), 18, 'easy'),
  task(21, 'ML-CH-02', 'quantitative', '理解变化', 'direct', '哪一排增加得更多？', choice('A排从12增加到18；B排从20增加到25。', 'A排', 'B排', '一样多', '无法判断'), 25),
  task(22, 'CR-C1-P', 'reasoning', '归纳规律', 'cross-representation', '按同样方式继续，下一步是什么？', choice('标记每次向右3格、向左1格轮流。', '向右3格', '向左1格', '向右2格', '停在原处'), 32, 'challenge', 'CR-C1'),
  task(23, 'SP-TR-01', 'space', '空间转换', 'direct', 'L形顺时针转90度后，缺口朝哪里？', choice('原来缺口朝右上。', '右下', '左下', '左上', '右上'), 18),
  task(24, 'M-H-04R', 'memory', '保持信息', 'direct', '哪两个配对和稍早看到的材料一致？', choice('请回想第二组材料。', '⬢—KERO、⬡—VASI', '⬢—VASI、⬡—KERO', '☾—SOLA、✦—NEMI', '◒—MULO、◐—TARI'), 26),
  task(25, 'L-E-04R', 'language', '准确表达', 'cross-context', '把汇报内容排成更自然的顺序。', { type: 'sequence', instruction: '先总述，最后交代全部归还。', items: [{ id: 'total', label: '今天共借出四件' }, { id: 'same', label: '两件当天归还' }, { id: 'next', label: '两件次日归还' }, { id: 'all', label: '最后全部归还' }] }, 28, 'easy'),
  task(26, 'CR-D2-C', 'reasoning', '推出结论', 'cross-representation', '先按第一条、再按第二条规则交换，最后顺序是什么？', { type: 'sequence', instruction: '交换外侧，再交换中间。', items: [{ id: 'jia', label: '甲' }, { id: 'yi', label: '乙' }, { id: 'bing', label: '丙' }, { id: 'ding', label: '丁' }] }, 28, 'medium', 'CR-D2'),
  task(27, 'ML-QS-04R', 'quantitative', '感知数量', 'cross-context', '哪一个标记最接近四分之三的位置？', choice('一条从0到100的刻度条上有四个位置。', '25', '50', '75', '90'), 22),
  task(28, 'SP-IM-04', 'space', '空间想象', 'cross-context', '两张透明片叠在一起后，哪张图符合？', choice('一张透明片有斜线，另一张有竖线和右上角小点。', '斜线、竖线和右上小点都保留', '只保留斜线', '只保留竖线', '小点移到左下'), 25),
  task(29, 'IN-RL-CTX-NEW-01', 'reasoning', '发现关系', 'cross-context', '哪一个流程符合全部规则？', { type: 'sequence', instruction: '甲要在乙和丙前，丙要在丁前。', items: [{ id: 'jia', label: '甲' }, { id: 'yi', label: '乙' }, { id: 'bing', label: '丙' }, { id: 'ding', label: '丁' }] }, 28),
  task(30, 'M-R-B-NEW-01', 'memory', '准确提取', 'direct', '根据图形的部件和位置，找回刚才对应的标签。', { type: 'slots', blocks: [{ id: 'MULO', label: 'M _ L O' }, { id: 'TARI', label: 'T _ R I' }], slots: [{ id: 'B5', label: '◒' }, { id: 'B6', label: '◐' }] }, 30, 'challenge'),
]

export function validateAssessmentBank(tasks: AssessmentTask[]): string[] {
  const errors: string[] = []
  if (tasks.length !== 30) errors.push('任务数量必须是30')
  const positions = new Set(tasks.map((task) => task.position))
  if (positions.size !== 30 || !Array.from({ length: 30 }, (_, index) => positions.has(index + 1)).every(Boolean)) errors.push('位置必须覆盖01至30')
  const roles: Record<TaskRole, number> = { direct: 0, 'cross-representation': 0, 'cross-context': 0 }
  const dimensions: Record<Dimension, number> = { memory: 0, language: 0, quantitative: 0, space: 0, reasoning: 0 }
  const mechanisms = new Map<string, number>()
  tasks.forEach((task) => {
    roles[task.role] += 1
    dimensions[task.dimension] += 1
    mechanisms.set(task.mechanism, (mechanisms.get(task.mechanism) ?? 0) + 1)
  })
  if (roles.direct !== 17 || roles['cross-representation'] !== 8 || roles['cross-context'] !== 5) errors.push('任务角色分配不符合17/8/5')
  if (Object.values(dimensions).some((count) => count !== 6)) errors.push('一级元能力必须各6题')
  if (mechanisms.size !== 15 || [...mechanisms.values()].some((count) => count !== 2)) errors.push('二级机制必须各2题')
  return errors
}
