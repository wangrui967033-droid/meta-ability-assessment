import type { Dimension } from './assessment-types'

export interface QuestionOption {
  value: string
  label: string
}

export interface Question {
  id: string
  dimension: Dimension
  representation: Dimension
  pairId?: string
  difficulty: 'easy' | 'medium' | 'challenge'
  prompt: string
  helper: string
  stimulus: string
  options: QuestionOption[]
  answer: string
}

const options = (...labels: string[]): QuestionOption[] => labels.map((label, index) => ({ value: String(index), label }))

export const memoryDeck = [
  { symbol: '△', word: '岚' },
  { symbol: '○', word: '序' },
  { symbol: '□', word: '澄' },
  { symbol: '◇', word: '衡' },
  { symbol: '☆', word: '朔' },
]

export const questions: Question[] = [
  {
    id: 'l1', dimension: 'language', representation: 'language', difficulty: 'easy',
    prompt: '这段话主要想说明什么？', helper: '不用记细节，抓住它真正强调的意思。',
    stimulus: '有人一开始做得很快，却常常漏掉条件；有人起步慢一点，但会先确认任务，再稳稳完成。速度并不是判断学习效果的唯一标准。',
    options: options('学习效果不能只看速度', '做题越慢越容易正确', '遗漏条件是因为记忆不好', '所有任务都应该反复检查'), answer: '0',
  },
  {
    id: 'l2', dimension: 'language', representation: 'language', difficulty: 'medium',
    prompt: '哪句话最准确地保留了原意？', helper: '留意“只有……才……”真正限制了什么。',
    stimulus: '只有先看清信息之间的关系，新的结论才有可靠依据。',
    options: options('看清关系，是推出可靠结论的前提', '只要有结论，就一定看清了关系', '所有关系都能产生新的结论', '可靠结论不需要其他信息'), answer: '0',
  },
  {
    id: 'l3', dimension: 'language', representation: 'language', difficulty: 'challenge',
    prompt: '怎样排列，表达最清楚？', helper: '先交代现象，再解释原因，最后落到做法。',
    stimulus: '①因此先画出结构　②长材料容易让人失去重点　③可以减少理解阻力',
    options: options('②①③', '①②③', '②③①', '③①②'), answer: '0',
  },
  {
    id: 'q1', dimension: 'quantitative', representation: 'quantitative', difficulty: 'easy',
    prompt: '下一个数最可能是多少？', helper: '观察每一步增加了多少。',
    stimulus: '4　→　7　→　13　→　22　→　？',
    options: options('28', '31', '34', '37'), answer: '2',
  },
  {
    id: 'q2', dimension: 'quantitative', representation: 'quantitative', difficulty: 'medium',
    prompt: '输入4时，输出应该是多少？', helper: '找出输入与输出之间始终不变的关系。',
    stimulus: '输入：1　2　3\n输出：3　5　7',
    options: options('8', '9', '10', '11'), answer: '1',
  },
  {
    id: 'q3', dimension: 'quantitative', representation: 'quantitative', difficulty: 'challenge',
    prompt: '哪一种变化保持了原来的比例？', helper: '比较两种数量是不是按同一个倍数变化。',
    stimulus: '原来：深色4格，浅色6格',
    options: options('深色6格，浅色8格', '深色8格，浅色12格', '深色10格，浅色12格', '深色12格，浅色16格'), answer: '1',
  },
  {
    id: 's1', dimension: 'space', representation: 'space', difficulty: 'easy',
    prompt: '箭头顺时针转动90°后是什么方向？', helper: '试着在脑中让它转一次。',
    stimulus: '↖', options: options('↗', '↘', '↙', '↖'), answer: '0',
  },
  {
    id: 's2', dimension: 'space', representation: 'space', difficulty: 'medium',
    prompt: '哪一项是同一个结构旋转后的样子？', helper: '连接关系不变，只改变观察方向。',
    stimulus: '●—▲\n　└■', options: options('▲—●\n■┘', '●—■\n　└▲', '■—▲\n　└●', '▲—■—●'), answer: '0',
  },
  {
    id: 's3', dimension: 'space', representation: 'space', difficulty: 'challenge',
    prompt: '从相反方向看，顺序会变成什么？', helper: '想象自己走到队列另一端。',
    stimulus: '当前视角：◇　○　△　□', options: options('□　△　○　◇', '◇　○　△　□', '□　○　△　◇', '△　□　◇　○'), answer: '0',
  },
  {
    id: 'r1', dimension: 'reasoning', representation: 'reasoning', difficulty: 'easy',
    prompt: '谁一定排在最后？', helper: '把三条关系连成一条顺序。',
    stimulus: '青在白之前；白在墨之前；墨在金之前。', options: options('青', '白', '墨', '金'), answer: '3',
  },
  {
    id: 'r2', dimension: 'reasoning', representation: 'reasoning', difficulty: 'medium',
    prompt: '哪一个结论一定成立？', helper: '只使用题目给出的规则。',
    stimulus: '如果出现△，就一定出现○。现在没有出现○。', options: options('一定没有△', '一定出现了△', '可能同时出现△和○', '无法判断○是否出现'), answer: '0',
  },
  {
    id: 'r3', dimension: 'reasoning', representation: 'reasoning', difficulty: 'challenge',
    prompt: '哪一种安排符合全部条件？', helper: '同时检查相邻关系和位置限制。',
    stimulus: '甲不在第一位；乙紧挨着甲之后；丙不在最后。',
    options: options('甲乙丙', '丙甲乙', '乙丙甲', '丙乙甲'), answer: '1',
  },
  {
    id: 'p1l', pairId: 'pair-order-1', dimension: 'language', representation: 'language', difficulty: 'medium',
    prompt: '谁离终点最远？', helper: '把文字关系整理成顺序。',
    stimulus: '岚在序之前，序在澄之前，三人朝同一终点前进。', options: options('岚', '序', '澄', '无法判断'), answer: '0',
  },
  {
    id: 'p1q', pairId: 'pair-order-1', dimension: 'quantitative', representation: 'quantitative', difficulty: 'medium',
    prompt: '哪一个点离终点最远？', helper: '数轴越小，离右侧终点越远。',
    stimulus: '岚＝2　序＝5　澄＝8　终点＝10', options: options('岚', '序', '澄', '一样远'), answer: '0',
  },
  {
    id: 'p2l', pairId: 'pair-transform-2', dimension: 'language', representation: 'language', difficulty: 'medium',
    prompt: '连续变化两次，最后是什么？', helper: '每一步都使用一次同样的变化规则。',
    stimulus: '规则：方形变圆形，圆形变三角形。开始是方形。', options: options('方形', '圆形', '三角形', '无法判断'), answer: '2',
  },
  {
    id: 'p2s', pairId: 'pair-transform-2', dimension: 'space', representation: 'space', difficulty: 'medium',
    prompt: '沿箭头变化两次，最后是什么？', helper: '从左向右走两步。',
    stimulus: '□　→　○　→　△', options: options('□', '○', '△', '◇'), answer: '2',
  },
  {
    id: 'p3q', pairId: 'pair-rule-3', dimension: 'quantitative', representation: 'quantitative', difficulty: 'medium',
    prompt: '按照规则，下一项是多少？', helper: '每一步都先乘2，再加1。',
    stimulus: '2　→　5　→　11　→　？', options: options('17', '21', '23', '25'), answer: '2',
  },
  {
    id: 'p3r', pairId: 'pair-rule-3', dimension: 'reasoning', representation: 'reasoning', difficulty: 'medium',
    prompt: '按照同样规则，下一项是什么？', helper: '每一步都“复制一倍，再添一个”。',
    stimulus: '●●　→　●●●●●　→　11个●　→　？', options: options('17个', '21个', '23个', '25个'), answer: '2',
  },
  {
    id: 'p4s', pairId: 'pair-cycle-4', dimension: 'space', representation: 'space', difficulty: 'challenge',
    prompt: '再变化一次会出现什么？', helper: '方向每次顺时针转90°，形状按顺序循环。',
    stimulus: '↑□　→　→○　→　↓△　→　？', options: options('←□', '←○', '←△', '↑□'), answer: '0',
  },
  {
    id: 'p4r', pairId: 'pair-cycle-4', dimension: 'reasoning', representation: 'reasoning', difficulty: 'challenge',
    prompt: '按两条规则继续，答案是什么？', helper: '方向和形状分别变化。',
    stimulus: '方向：上→右→下→左；形状：方→圆→三角→方。当前是“下三角”。',
    options: options('左方形', '左圆形', '上方形', '右三角'), answer: '0',
  },
  {
    id: 'm1', dimension: 'memory', representation: 'memory', difficulty: 'easy',
    prompt: '哪个符号对应“岚”？', helper: '回想最开始看到的五组配对。', stimulus: '请从记忆中选择。', options: options('△', '○', '□', '◇'), answer: '0',
  },
  {
    id: 'm2', dimension: 'memory', representation: 'memory', difficulty: 'easy',
    prompt: '“衡”对应哪个符号？', helper: '不用推理，试着把最初的画面调出来。', stimulus: '请从记忆中选择。', options: options('☆', '◇', '○', '□'), answer: '1',
  },
  {
    id: 'm3', dimension: 'memory', representation: 'memory', difficulty: 'medium',
    prompt: '哪个配对是正确的？', helper: '比较符号与词是否一起出现过。', stimulus: '只有一组与最初材料完全相同。', options: options('○—澄', '□—序', '☆—朔', '◇—岚'), answer: '2',
  },
  {
    id: 'm4', dimension: 'memory', representation: 'memory', difficulty: 'medium',
    prompt: '“序”和“澄”的符号依次是什么？', helper: '回想它们在最初五张卡片中的对应。', stimulus: '序 → 澄', options: options('○ → □', '□ → ○', '△ → ◇', '◇ → ☆'), answer: '0',
  },
  {
    id: 'm5', dimension: 'memory', representation: 'memory', difficulty: 'challenge',
    prompt: '哪一个词对应星形符号？', helper: '这是最后一次记忆回访。', stimulus: '☆', options: options('岚', '澄', '衡', '朔'), answer: '3',
  },
]
