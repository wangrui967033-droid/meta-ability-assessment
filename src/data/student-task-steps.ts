import {knowledgeTaskAbilityRules} from './knowledge-task-ability-map'
import type {SubjectName} from './subject-task-map'

// Presentation-only first steps; never used to score or classify a student.
const steps:Record<string,string>={
 'chinese-information-text':'先圈出题目问的内容，再在原文中划出相关句子，对照选项检查有没有改了意思。',
 'chinese-language-use':'先读前后两句话，弄清要表达什么，再比较不同说法。',
 'chinese-recall':'先按提示背出或写出原句，再对照原文检查漏字和错字。',
 'chinese-writing':'先用一句话写清自己的观点，再列出能支持它的材料。',
 'chinese-reading':'先看题目问的是人物、事情还是一句话的意思，再找到相关段落，用原文里的细节回答。',
 'language-vocabulary-recall':'先把单词放进句子里理解，再遮住释义，试着说出它的意思。',
 'language-writing':'先写清给谁看、要说什么，再列出要点。',
 'language-inference':'先划出与问题有关的两三句话，再逐个检查选项：原文有哪些词句能支持它？',
 'language-grammar':'先找出句子中的主语和谓语，再看空格前后的词，判断该填什么词、用什么形式。',
 'language-reading':'先弄清谁在说什么，再找到与问题有关的原句。',
 'math-sequence':'先写出前几项，比较相邻两项怎样变化，再检查猜想是否成立。',
 'math-statistics':'先写下题目要求的量，把要用的数据列在一起，再写出对应的计算式。',
 'math-function-visual':'先在图上标出关键点，再把图中的变化与式子对应起来。',
 'math-space':'先画图标出已知条件，再把图中的关系写成式子。',
 'math-reasoning':'先列出已知条件和要证明的结论，再写清第一步的依据。',
 'math-quantitative':'先写清每个数或字母代表什么，再把数量之间的关系列出来。',
 'physics-modern-concepts':'先列出题目描述的现象，再找出能解释它的概念或规律。',
 'physics-energy':'先写清研究哪个物体、开始和结束时的速度或高度，再检查过程中的受力，判断能用哪条规律。',
 'physics-experiment':'先分清改变什么、保持什么不变、测量什么，再看数据。',
 'physics-space':'先画出对象、方向和位置，再标上已知条件。',
 'physics-reasoning':'先写出规律的使用条件，再逐条核对题目是否满足。',
 'science-calculation':'先列出已知数据、单位和所求，再写出它们的关系。',
 'science-structure':'先照着图标出各部分的名称，用线连出它们的联系，再在旁边写一句各自的作用。',
 'science-process':'先写下开始和结束时发生了什么，用箭头补上中间几步，再在箭头旁写出变化的原因。',
 'humanities-source':'先圈出材料中的时间、人物和事件，再对照题目写出观点，并在后面补一句材料依据。',
 'humanities-knowledge':'先用自己的话解释相关概念，再找出材料中对应的内容。',
 'geography-data':'先看图表的标题和单位，圈出最高、最低或变化最大的地方，再用题目给的当地条件解释原因。',
 'geography-space':'先在图上找到位置、读懂图例，再联系当地条件分析。',
}
export function studentTaskStep(subject:SubjectName,topicName:string):string{
 const rule=knowledgeTaskAbilityRules.find(r=>r.subjects.includes(subject)&&r.pattern.test(topicName))
 return rule && steps[rule.id] ? steps[rule.id] : '先圈出题目要求你求什么或解释什么，再把相关条件列在旁边，写下能用到的一条知识或公式。'
}
