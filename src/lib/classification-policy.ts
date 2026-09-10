// 待真实学生数据校准的原型阈值；不是科学常模或能力分界线。
// 后续依据“学生测评表现 × 对应学习任务表现”的效度验证调整。
export interface ClassificationPolicy { readonly supportThreshold: number; readonly minimumRepeatedEvidence?: number }
export const classificationPolicy: ClassificationPolicy = Object.freeze({ supportThreshold: 0.75, minimumRepeatedEvidence: 2 })
