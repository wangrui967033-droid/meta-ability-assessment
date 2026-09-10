import type { Dimension } from './assessment-types'
import type { SubjectName } from './subject-task-map'
import type { LeveragePath, RequirementContext } from '../lib/requirement-support'

// V1产品规则草案：由现有任务动作推导，全部待教研复核；不是已验证的补偿关系。
// 先列出不能绕过的要求，再允许具体步骤作为入口。无规则时不凭辅助标签创造路径。
const actions:Record<Dimension,string>={
 memory:'先回想并写下相关概念，再对照材料补全',
 language:'先用自己的话说清题目要求，再找出对应信息',
 quantitative:'先列出已知数量和单位，再写出它们的关系',
 space:'先画出对象和位置，标出题目给出的条件',
 reasoning:'先连接已知条件，写出每一步能推出什么',
}
const rules:Record<string,{essential:Dimension[];paths:Dimension[]}>={
 'chinese-information-text':{essential:['language'],paths:['language','reasoning']},
 'chinese-language-use':{essential:['language'],paths:['language','reasoning']},
 'chinese-recall':{essential:['memory','language'],paths:['language']},
 'chinese-writing':{essential:['language'],paths:['reasoning','memory']},
 'chinese-reading':{essential:['language'],paths:['reasoning','memory']},
 'language-vocabulary-recall':{essential:['memory','language'],paths:['language']},
 'language-writing':{essential:['language'],paths:['reasoning','memory']},
 'language-inference':{essential:['language','reasoning'],paths:['language','reasoning']},
 'language-grammar':{essential:['language'],paths:['memory','reasoning']},
 'language-reading':{essential:['language'],paths:['reasoning','memory']},
 'math-sequence':{essential:['quantitative','reasoning'],paths:['quantitative','reasoning']},
 'math-statistics':{essential:['quantitative'],paths:['reasoning']},
 'math-function-visual':{essential:['quantitative','space'],paths:['space','reasoning']},
 'math-space':{essential:['space','quantitative'],paths:['reasoning','quantitative']},
 'math-reasoning':{essential:['reasoning','quantitative'],paths:['quantitative','reasoning']},
 'math-quantitative':{essential:['quantitative'],paths:['reasoning','memory']},
 'physics-modern-concepts':{essential:['reasoning','memory'],paths:['memory','quantitative']},
 'physics-energy':{essential:['reasoning','quantitative'],paths:['quantitative','memory']},
 'physics-experiment':{essential:['reasoning','quantitative'],paths:['quantitative','memory']},
 'physics-space':{essential:['space','quantitative'],paths:['reasoning','quantitative']},
 'physics-reasoning':{essential:['reasoning','quantitative'],paths:['quantitative','memory']},
 'science-calculation':{essential:['quantitative'],paths:['reasoning']},
 'science-structure':{essential:['space'],paths:['reasoning','memory']},
 'science-process':{essential:['reasoning','memory'],paths:['memory','quantitative']},
 'humanities-source':{essential:['language','reasoning'],paths:['language','memory']},
 'humanities-knowledge':{essential:['language'],paths:['memory','reasoning']},
 'geography-data':{essential:['quantitative','space'],paths:['reasoning','space']},
 'geography-space':{essential:['space'],paths:['reasoning','memory']},
}
const paths=(dimensions:readonly Dimension[]):LeveragePath[]=>dimensions.map(ability=>({ability,action:actions[ability]}))
export function taskLearningContext(ruleId:string|undefined,primary:readonly Dimension[],entry:readonly Dimension[]):RequirementContext{
 const rule=ruleId?rules[ruleId]:undefined
 const required=[...new Set([...primary,...entry])]
 return {essential:[...new Set([...primary,...(rule?.essential??[])])],paths:paths((rule?.paths??[]).filter(d=>required.includes(d)))}
}
const subjectEntrances:Record<SubjectName,Dimension[]>={语文:['language','reasoning'],数学:['quantitative','reasoning','space'],英语:['language','memory'],日语:['language','memory'],物理:['quantitative','reasoning','space'],化学:['reasoning','quantitative','memory'],生物:['memory','reasoning','space'],历史:['language','memory','reasoning'],政治:['language','reasoning','memory'],地理:['space','reasoning','quantitative'],技术:['quantitative','reasoning','space']}
export function subjectLearningContext(subject:SubjectName,primary:readonly Dimension[],required:readonly Dimension[]):RequirementContext{
 return {essential:primary,paths:paths(subjectEntrances[subject].filter(d=>required.includes(d)))}
}
export const learningPathReviewStatus='待教研复核' as const
