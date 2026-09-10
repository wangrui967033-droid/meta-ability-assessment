export type V16Ability = '记忆' | '语言' | '数理' | '空间' | '推演'
export type V16Difficulty = 'easy' | 'medium' | 'challenge'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskNote {
  level: RiskLevel
  reason: string
}

export interface DependencyRisk {
  knowledge: RiskNote
  reading: RiskNote
  formatExperience: RiskNote
}

export interface V16Option {
  visualId?: string
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  label: string
}

export interface V16Item {
  targetVisualId?: string
  text: string
  asset?: string
  options: V16Option[]
  correctAnswer: V16Option['id']
  standardDerivation: string
  uniqueAnswerCheck: string
  distractorReasons: Partial<Record<V16Option['id'], string>>
}

export interface V16Task {
  code: string
  id: string
  position: number
  primaryAbility: V16Ability
  mechanism: string
  secondaryAbilities: V16Ability[]
  dependencyRisk: DependencyRisk
  difficulty: V16Difficulty
  expectedSeconds: number
  paradigm: string
  measurementRationale: string
  prompt: string
  helper: string
  practiceId?: string
  memoryPresentationId?: string
  memoryTargetSubset?: string
  items: V16Item[]
}

export interface MemoryPresentation {
  practiceId?: string
  visualIds?: string[]
  internalIds?: string[]
  id: string
  beforeTask: string
  title: string
  instruction: string
  durationSeconds: number
  content: string[]
}

const optionIds: V16Option['id'][] = ['A', 'B', 'C', 'D', 'E', 'F']

function item(
  text: string,
  labels: string[],
  correctIndex: number,
  standardDerivation: string,
  wrongReasons: string[],
  meta?: { asset?: string; uniqueAnswerCheck?: string; visualOptions?: string[]; targetVisualId?: string },
): V16Item {
  if (labels.length < 2 || labels.length > 6 || labels.length !== wrongReasons.length) {
    throw new Error('每题必须提供2—6个选项，并为每个选项提供对应说明。')
  }
  const activeOptionIds = optionIds.slice(0, labels.length)
  const correctAnswer = activeOptionIds[correctIndex]
  if (!correctAnswer) throw new Error('正确答案索引超出选项范围。')
  return {
    text,
    asset: meta?.asset,
    targetVisualId: meta?.targetVisualId,
    options: labels.map((label, index) => ({ id: activeOptionIds[index], label, visualId: meta?.visualOptions?.[index] })),
    correctAnswer,
    standardDerivation,
    uniqueAnswerCheck: meta?.uniqueAnswerCheck ?? '逐项代入题干条件后，仅正确项同时满足全部条件，其余选项各有一处明确冲突。',
    distractorReasons: Object.fromEntries(
      activeOptionIds
        .map((id, index) => [id, wrongReasons[index]] as const)
        .filter(([id]) => id !== correctAnswer),
    ),
  }
}

const low = (reason: string): RiskNote => ({ level: 'low', reason })
const medium = (reason: string): RiskNote => ({ level: 'medium', reason })
const risks = (
  knowledge: RiskNote,
  reading: RiskNote,
  formatExperience: RiskNote,
): DependencyRisk => ({ knowledge, reading, formatExperience })

type TaskSeed = Omit<V16Task, 'id' | 'position' | 'measurementRationale'>

const rationaleByMechanism: Record<string, string> = {
  '快速记住': '材料只呈现一次，随后立即撤去；正确作答必须保留新图形或虚构配对，而不能从常识补出答案。',
  '保持信息': '目标信息在作答时不再可见，并经过其他任务或较长间隔；得分取决于能否保持指定内容而非重新辨认材料。',
  '准确提取': '目标与相似干扰或位置干扰同时出现；必须从记忆中提取精确特征，只有记住大类不足以作答。',
  '理解意思': '选项系统改变对象、范围、否定或指代；只有准确理解原句边界才能排除近义误读。',
  '组织信息': '句子内容相同但顺序不同；必须依据因果、转折和指代把信息组织成连贯结构。',
  '准确表达': '各选项共享主题但在范围、指代或执行信息上有细微差异；作答要求辨认表达是否完整准确。',
  '感知数量': '题目控制或隐藏精确数值，要求比较整体数量或连续位置；不能靠已学公式直接求解。',
  '理解变化': '答案由相邻变化或两个量的共同变化决定；只看单个数值无法完成。',
  '处理符号': '符号含义完全在题内定义，必须保持并执行新规则；熟悉的运算符经验不能直接替代。',
  '识别结构': '候选共享大量局部特征，只有追踪连接、转折与端点关系才能找到目标结构。',
  '空间想象': '目标结果不可直接从文字读出，必须在头脑中完成旋转或拼合，再与可视化候选核对。',
  '空间转换': '必须把平面图转换成立体关系，或对图示位置执行方向变换；答案取决于变换后的相对位置。',
  '发现关系': '新符号之间的对应只由示例给出，必须抽取关系并迁移到新对象，不能调用生活常识。',
  '归纳规律': '下一项未直接给出，必须从连续实例中归纳稳定变换；干扰项对应只跟踪局部特征的错误。',
  '推出结论': '所有前提均为题内虚构关系，只有沿条件方向进行有效传递才能得到必然结论。',
}

const measurementRationale = (task: TaskSeed) => task.code === 'N01'
  ? '点阵加载后呈现8秒，收起后作答，观察数量比较表现。8秒内仍可能计数，不作为纯粹近似数感指标；记忆保持间隔按实际时间记录，不参与计分。'
  : rationaleByMechanism[task.mechanism]
  ?? `正确作答必须处理题内的“${task.mechanism}”关系，不能只凭学科知识或表面线索完成。`

const tasks: TaskSeed[] = [
  {
    code: 'M01',
    primaryAbility: '记忆',
    mechanism: '快速记住',
    secondaryAbilities: ['空间'],
    dependencyRisk: risks(low('只需识别刚呈现的抽象图形。'), low('题干短，无长文本。'), low('使用常见的出现／未出现判断。')),
    difficulty: 'easy',
    expectedSeconds: 20,
    paradigm: 'visual-recognition',
    prompt: '图形识别记忆：选出刚才看过的图形。',
    helper: '选择出现过的图形，不需要回想位置。',
    memoryPresentationId: 'visual-board',
    memoryTargetSubset: 'visual-immediate-A',
    items: [
      item('下面哪一个图形出现在位置板上？', ['月牙形 VA1', '月牙加一点', '朝向相反的月牙', '五角星形'], 0, '位置板左上呈现的是月牙形VA1，另外三项分别改变了局部特征、朝向或整体形状。', ['', '把局部增添的相似干扰当成原图。', '把镜像干扰当成原图。', '五角星没有出现。'], {visualOptions: ["VA1","VA1-dot","VA1-mirror","VA1-star"]}),
      item('下面哪一个图形出现在位置板上？', ['单独圆环', '钥匙孔形 VA2', '双圆带长柄', '实心圆带短柄'], 1, '位置板中上呈现的是空心圆与短柄组成的钥匙孔形VA2。', ['遗漏了短柄。', '', '多记了一个圆和更长的柄。', '混淆了空心与实心特征。'], {visualOptions: ["VA2-ring","VA2","VA2-double","VA2-filled"]}),
      item('下面哪一个图形出现在位置板上？', ['单个拱形', '三段波浪', '双拱形 VA3', '双拱形加竖线'], 2, '位置板右上呈现的是两个相连拱形VA3，数量和附加线均与C一致。', ['少记了一个拱。', '多记了一个拱。', '', '加入了原图没有的竖线。'], {visualOptions: ["VA3-single","VA3-triple","VA3","VA3-line"]}),
    ],
  },
  {
    code: 'M02',
    primaryAbility: '记忆',
    mechanism: '快速记住',
    secondaryAbilities: ['语言'],
    dependencyRisk: risks(low('对象名称和属性均为题内虚构。'), medium('需要读懂简短属性词。'), low('采用直接配对选择。')),
    difficulty: 'easy',
    expectedSeconds: 21,
    paradigm: 'semantic-pair-immediate',
    prompt: '名字和特点记忆：选出刚才看过的配对。',
    helper: '回想每个名字对应什么特点，不用记它们的先后顺序。',
    memoryPresentationId: 'semantic-pairs',
    memoryTargetSubset: 'semantic-immediate-C',
    items: [
      item('“洛米”有什么特点？', ['发蓝光', '怕雨', '会折叠', '会变色'], 0, '语义材料中“洛米—发蓝光”，所以选择A。', ['', '“怕雨”属于塔格。', '“会折叠”属于奈朴。', '“会变色”没有出现在材料中。']),
      item('“塔格”有什么特点？', ['会折叠', '发蓝光', '怕雨', '喜欢噪声'], 2, '语义材料中“塔格—怕雨”，所以选择C。', ['“会折叠”属于奈朴。', '“发蓝光”属于洛米。', '', '“喜欢噪声”没有出现在材料中。']),
      item('“奈朴”有什么特点？', ['怕雨', '会折叠', '会发香味', '发蓝光'], 1, '语义材料中“奈朴—会折叠”，所以选择B。', ['“怕雨”属于塔格。', '', '“会发香味”没有出现在材料中。', '“发蓝光”属于洛米。']),
    ],
  },
  {
    code: 'M03',
    primaryAbility: '记忆',
    mechanism: '保持信息',
    secondaryAbilities: ['语言'],
    dependencyRisk: risks(low('只需记住题内符号。'), low('几乎没有阅读负担。'), medium('需要理解序列整体选择方式，题前说明会介绍。')),
    difficulty: 'medium',
    expectedSeconds: 28,
    paradigm: 'sequence-recall-4-5',
    prompt: '两组符号记忆：回想原来的顺序。',
    helper: '回想刚才依次闪现的两组符号：第一组4个，第二组5个。',
    items: [
      item('四项序列的原顺序是？', ['◆ ○ ▲ ■', '◆ ▲ ○ ■', '○ ◆ ▲ ■', '◆ ○ ■ ▲'], 0, '材料按“◆、○、▲、■”依次出现，A完整保持了位置顺序。', ['', '交换了第2、3项。', '交换了第1、2项。', '交换了第3、4项。']),
      item('五项序列的原顺序是？', ['☂ ◇ ☀ ♧ ★', '◇ ☂ ☀ ♧ ★', '☂ ◇ ♧ ☀ ★', '☂ ◇ ☀ ★ ♧'], 0, '材料按“☂、◇、☀、♧、★”依次出现，A与原序列一致。', ['', '交换了第1、2项。', '交换了第3、4项。', '交换了第4、5项。']),
    ],
  },
  {
    code: 'M04',
    primaryAbility: '记忆',
    mechanism: '保持信息',
    secondaryAbilities: ['语言'],
    dependencyRisk: risks(low('全部信息在测评内提供。'), medium('需要理解简短属性。'), low('采用直接配对选择。')),
    difficulty: 'medium',
    expectedSeconds: 24,
    paradigm: 'semantic-pair-delayed',
    prompt: '名字和特点记忆：找回原来的配对。',
    helper: '回想之前看过的名字，以及每个名字对应的特点。',
    memoryTargetSubset: 'semantic-delayed-D',
    items: [
      item('“西岚”有什么特点？', ['晚上发热', '靠近水会变轻', '会折叠', '怕雨'], 1, '开场语义材料中“西岚—靠近水会变轻”，所以选择B。', ['“晚上发热”属于伏可。', '', '“会折叠”属于即时子集奈朴。', '“怕雨”属于即时子集塔格。']),
      item('“伏可”有什么特点？', ['碰金属会响', '发蓝光', '晚上发热', '靠近水会变轻'], 2, '开场语义材料中“伏可—晚上发热”，所以选择C。', ['“碰金属会响”属于墨迩。', '“发蓝光”属于即时子集洛米。', '', '“靠近水会变轻”属于西岚。']),
      item('“墨迩”有什么特点？', ['碰金属会响', '怕雨', '晚上发热', '发蓝光'], 0, '开场语义材料中“墨迩—碰金属会响”，所以选择A。', ['', '“怕雨”属于即时子集塔格。', '“晚上发热”属于伏可。', '“发蓝光”属于即时子集洛米。']),
    ],
  },
  {
    code: 'M05',
    primaryAbility: '记忆',
    mechanism: '准确提取',
    secondaryAbilities: ['空间'],
    dependencyRisk: risks(low('只需回忆测评内图形。'), low('题干短。'), medium('需要将图形身份与二维位置对应。')),
    difficulty: 'challenge',
    expectedSeconds: 30,
    paradigm: 'visual-position-delayed',
    prompt: '图形位置记忆：找回原来的位置。',
    helper: '回想最开始的六格图形。在六格位置板上选择它原来的位置。',
    memoryTargetSubset: 'visual-delayed-B',
    items: [
      item('风筝形 VB1 原来在哪个位置？', ['左下', '中下', '右下', '左上', '中上', '右上'], 0, '开场位置板中风筝形 VB1 位于左下，所以选择A。', ['', '中下是双环形。', '右下是叶片形。', '左上是即时子集的月牙形。', '中上是即时子集的钥匙孔形。', '右上是即时子集的波浪形。'], {targetVisualId: 'VB1'}),
      item('双环形 VB2 原来在哪个位置？', ['右下', '左下', '中下', '中上', '左上', '右上'], 2, '开场位置板中双环形 VB2 位于中下，所以选择C。', ['右下是叶片形。', '左下是风筝形。', '', '中上是即时子集的钥匙孔形。', '左上是即时子集的月牙形。', '右上是即时子集的波浪形。'], {targetVisualId: 'VB2'}),
      item('叶片形 VB3 原来在哪个位置？', ['中下', '右下', '左下', '右上', '左上', '中上'], 1, '开场位置板中叶片形 VB3 位于右下，所以选择B。', ['中下是双环形。', '', '左下是风筝形。', '右上是即时子集的波浪形。', '左上是即时子集的月牙形。', '中上是即时子集的钥匙孔形。'], {targetVisualId: 'VB3'}),
    ],
  },
  {
    code: 'M06',
    primaryAbility: '记忆',
    mechanism: '准确提取',
    secondaryAbilities: ['语言'],
    dependencyRisk: risks(low('只使用新符号。'), low('题干短。'), medium('六项序列对位置提取有一定负荷。')),
    difficulty: 'medium',
    expectedSeconds: 24,
    paradigm: 'similar-distractor-position-retrieval',
    prompt: '六个符号记忆：找出指定位置的图形。',
    helper: '回想刚才依次出现的六个符号，选择题目指定位置的图形。',
    items: [
      item('第2个出现的符号是？', ['◐', '☾', '◑', '◒'], 1, '六项材料的第2位是开口朝右的月牙“☾”，其余选项只改变填充或开口方向。', ['把月牙误记成半实心圆。', '', '把月牙误记成右半填充圆。', '把弧形误记成下半填充。']),
      item('第4个出现的符号是？', ['◆', '◈', '◇', '⬟'], 1, '第4位是带中心小菱形的轮廓菱形“◈”；A全实心，C缺少中心，D边数不同。', ['只记住了菱形类别，错记填充。', '', '遗漏中心特征。', '混淆了相邻的多边形。']),
      item('第5个出现的符号是？', ['◇', '◈', '◆', '◊'], 0, '第5位是单一空心菱形“◇”，没有中心点或实心填充。', ['', '把第4位的中心特征带入第5位。', '把空心误记成实心。', '把宽菱形误记成窄菱形。']),
    ],
  },
  {
    code: 'L01',
    primaryAbility: '语言',
    mechanism: '理解意思',
    secondaryAbilities: ['记忆'],
    dependencyRisk: risks(low('只涉及日常通知语义。'), low('每段不超过两句。'), low('常规单选。')),
    difficulty: 'easy',
    expectedSeconds: 22,
    paradigm: 'notice-scope',
    prompt: '阅读通知，选择与原意一致的一项。',
    helper: '根据题目中的文字选择一项。',
    items: [
      item("“本周阅览区照常开放，借还服务移到一楼；周五下午仅暂停还书，借书不受影响。”", ["周五下午一楼仍可借书，但不能还书","周五下午暂停借书，还书仍在一楼办理","周五下午阅览区关闭，一楼仅办理借书","本周阅览区移到一楼，周五下午暂停还书"], 0, "借还地点是一楼；周五下午暂停的仅为还书，借书照常。A同时保留两项信息。", ["","对调了暂停和保留的服务。","将服务暂停扩大为阅览区关闭。","把借还服务迁移误读为阅览区迁移。"]),
      item("“申请表周三18点截止提交。已经提交的表格，周四中午前可更正联系方式，其他内容不再修改。”", ["周四中午前仍可提交申请，并修改联系方式","周三截止提交，之后至周四中午前仅可改联系方式","周三截止提交，周四中午前可修改表中所有内容","周三截止后表格不能再改，包括联系方式"], 1, "提交与更正有不同期限；更正仅限联系方式。B同时保留时间和范围。", ["混淆提交与更正的截止时间。","","扩大允许更正的内容。","遗漏联系方式的更正窗口。"]),
    ],
  },
  {
    code: 'L02',
    primaryAbility: '语言',
    mechanism: '理解意思',
    secondaryAbilities: ['记忆'],
    dependencyRisk: risks(low('不要求外部知识。'), medium('需要辨认代词、转折和否定范围。'), low('常规单选。')),
    difficulty: 'medium',
    expectedSeconds: 29,
    paradigm: 'reference-negation',
    prompt: '读这句话，选出理解正确的一项。',
    helper: '只看句子写了什么，不要自己加条件。',
    items: [
      item("“这篇评论保留了原来的判断，却换掉了支撑它的例子。作者说，这一调整是为了让说明更贴切，并不意味着撤回判断。”哪项理解准确？", ["原判断被撤回，但原例子仍然保留","原判断暂不表态，先补充更多例子","原判断不变，支撑它的例子被替换","原例子不变，只修改了说明的措辞"], 2, "“它”指原判断；“这一调整”指替换例子。改变的是支撑材料而非判断，C准确。", ["对调了保留与替换的对象。","把未撤回误读为暂不表态。","","将换例子缩小为改措辞。"]),
      item("“两份说明都写清了报名步骤。前者把注意事项夹在步骤中，后者将其另列一栏。老师建议采用后者的编排，但沿用前者的措辞。”最终应怎样处理？", ["将注意事项夹在步骤中，采用第二份的措辞","将注意事项另列一栏，采用第一份的措辞","将注意事项另列一栏，采用第二份的措辞","将注意事项夹在步骤中，采用第一份的措辞"], 1, "后者的编排是另列注意事项；前者的措辞是第一份的用语。B正确整合两处指代，不需要条件推导。", ["把编排与措辞来源同时颠倒。","","只保留了编排要求，措辞来源错误。","只保留了措辞要求，编排来源错误。"]),
    ],
  },
  {
    code: 'L03',
    primaryAbility: '语言',
    mechanism: '组织信息',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('内容为一般说明。'), low('短句结构明确。'), low('顺序选择前有清楚编号。')),
    difficulty: 'easy',
    expectedSeconds: 24,
    paradigm: 'information-order',
    prompt: '把几句话排成通顺的一段。',
    helper: '选择最合适的信息顺序。',
    items: [
      item("①这张清单随后交给管理员。②核对后，管理员把两处遗漏补进清单。③小岑先按登记表列出缺书清单。④管理员收到后，逐项核对登记表。", ["③①④②","③④①②","①③④②","③①②④"], 0, "③先生成清单，①随后交出；④收到后核对，②“核对后”承接核对并补漏。", ["","管理员核对先于收到，违反④的时间限定。","“这张清单”在生成前出现。","“核对后”的补漏被排在核对之前。"]),
      item("①她把这三条信息合并成一句提示。②压缩后的提示随后贴在门口。③小夏先记下开放时间、入口和预约要求。④贴出后，她又在末尾补上联系电话。", ["③②①④","①③②④","③①②④","③①④②"], 2, "③提供三条信息，①的“这三条”回指它们；②“压缩后的”承接合并，④“贴出后”承接张贴。", ["张贴发生在合并之前。","“这三条”缺少前文对象。","","补电话发生在“贴出”之前，违反④。"]),
    ],
  },
  {
    code: 'L04',
    primaryAbility: '语言',
    mechanism: '组织信息',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('不需要学科知识。'), medium('需要同时追踪指代与因果。'), medium('四句排序需要一定题型熟悉度。')),
    difficulty: 'challenge',
    expectedSeconds: 34,
    paradigm: 'paragraph-coherence',
    prompt: '把四句话排成一段，前后要接得上。',
    helper: '选择衔接通顺、意思连贯的排列。',
    items: [
      item('①因此，管理员增加了晚间归还点。②调查发现晚间还书者最多。③这项调整试行一周后，排队时间缩短。④图书馆记录了不同时段的还书人数。', ['④②①③', '②④③①', '④①②③', '①③④②'], 0, '先记录④，再得到发现②，因此调整①，最后“这项调整”承接并给出结果③。', ['', '调查结论出现在记录之前，且结果早于调整。', '未先说明发现就调整。', '以“因此”开头却没有前因。']),
      item('①这说明原来的解释还不完整。②研究者先提出温度会影响结果。③但在温度不变时，结果仍然波动。④他们随后加入了湿度记录。', ['②③①④', '③②④①', '②①③④', '④②③①'], 0, '先提出解释②，再用转折证据③挑战它，由此得出①，随后采取④。', ['', '转折事实出现在被反驳的解释之前。', '“这”没有可指代的前文证据。', '先记录湿度再提出原解释，时间关系不自然。']),
    ],
  },
  {
    code: 'L05',
    primaryAbility: '语言',
    mechanism: '准确表达',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('只需比较句意范围。'), medium('需要识别“多数、可能、仅”等限定。'), low('常规单选。')),
    difficulty: 'medium',
    expectedSeconds: 28,
    paradigm: 'scope-preservation',
    prompt: '哪种改写不漏条件，也不多加意思？',
    helper: '选择与原句意思一致的改写。',
    items: [
      item("原句：“目前仅能确认部分样本改善，尚不能确定改善能否持续。”", ["部分样本已改善，而且改善能够持续","仅有部分样本改善，其余样本均未改善","全部样本可能改善，但改善不能持续","已确认部分样本改善，能否持续仍待确认"], 3, "原句只确认部分样本改善，对其他样本和持续性都没有下定论。", ["加入肯定的持续性结论。","把仅能确认的范围误成全部样本的结论。","改变样本范围，并断言不能持续。",""]),
      item("原句：“本批只接收周四前提交的完整材料；已提交的不完整材料，可在周三补齐后纳入本批。”", ["周四前提交均进本批，缺件可以以后补齐","周四前交齐可进本批，已交缺件可周三补齐","周四前交齐可进本批，已交缺件只能转下批","周四当天交齐进本批，已交缺件可周三补齐"], 1, "B保留“周四前且完整”的接收范围，以及已提交缺件材料在周三补齐的补救安排。", ["删除完整要求并延长补齐时间。","","删除允许补齐后纳入的安排。","将周四前改成周四当天。"]),
    ],
  },
  {
    code: 'L06',
    primaryAbility: '语言',
    mechanism: '准确表达',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('不需外部知识。'), medium('需要定位指代和信息缺口。'), low('常规单选。')),
    difficulty: 'medium',
    expectedSeconds: 30,
    paradigm: 'ambiguity-detection',
    prompt: '哪种说法清楚、完整，不容易让人误解？',
    helper: '选出让人能读懂、知道该怎么做的一项。',
    items: [
      item("要明确表达：缺页的是小周的材料，负责补交的是小林。哪句话无歧义地表达了这两点？", ["小林告诉小周，他的材料缺页，由小林补交","小林告诉小周，小周的材料缺页，由他补交","小林告诉小周，小周的材料缺页，由小林补交","小林告诉小周，小林的材料缺页，由小周补交"], 2, "C明确材料所属者为小周、补交者为小林，不依赖含混代词。", ["“他的材料”有两个可能指向。","“他补交”有两个可能指向。","","交换了材料所属者和补交者。"]),
      item("需通知：活动改为周六9点，地点仍是东门；仅不能参加者须在周五前回复。哪条准确？", ["活动改为周六9点，仍在东门；不能参加者请周五前回复","活动改为周六9点，仍在东门；所有参加者请周五前回复","活动改为周六9点，仍在东门；不能参加者请周六前回复","活动仍为周六9点，改在东门；不能参加者请周五前回复"], 0, "A准确保留时间变更、地点不变、回复对象与截止时间。", ["","将不能参加者换成所有参加者。","推迟了回复截止时间。","将时间变更、地点不变误成时间不变、地点变更。"]),
    ],
  },
  {
    code: 'N01',
    primaryAbility: '数理',
    mechanism: '感知数量',
    secondaryAbilities: ['空间'],
    dependencyRisk: risks(low('不使用数字、公式或学科概念。'), low('题干极短。'), medium('图片呈现8秒，仍可能使用计数策略；点阵边界与总着色面积已控制，点大小略有变化。本题观察数量比较，不单独解释为近似数感。')),
    difficulty: 'easy',
    expectedSeconds: 20,
    paradigm: 'eight-second-dot-array-comparison',
    prompt: '观察两侧点阵，选择点更多的一侧。',
    helper: '这组有2题。每题看图8秒，图片收起后，再选哪边的点更多。',
    items: [
      item('哪一侧的点更多？', ['左侧', '右侧'], 1, '左右区域和分布边界相同，点半径按数量调整使总着色面积相同；内部计数为左37、右40，因此右侧更多。', ['左侧点更分散，若把覆盖范围当数量会误选。', ''], { asset: 'n01-dot-a', uniqueAnswerCheck: '右侧比左侧多3个点；在总着色面积和边界控制后，只有右侧满足“点更多”。' }),
      item('哪一侧的点更多？', ['左侧', '右侧'], 0, '左右区域和分布边界相同，点半径按数量调整使总着色面积相同；内部计数为左42、右39，因此左侧更多。', ['', '右侧局部更密，若只看局部疏密会误选。'], { asset: 'n01-dot-b', uniqueAnswerCheck: '左侧比右侧多3个点；两侧不存在相同数量，答案唯一为左侧。' }),
    ],
  },
  {
    code: 'N02',
    primaryAbility: '数理',
    mechanism: '感知数量',
    secondaryAbilities: ['空间'],
    dependencyRisk: risks(low('只涉及端点、基准刻度与目标数。'), low('题干短。'), medium('需要把数值映射到连续位置，不能依赖选点精确数值。')),
    difficulty: 'easy',
    expectedSeconds: 24,
    paradigm: 'number-line-estimation',
    prompt: '数轴上，哪个点最接近题目给出的数？',
    helper: '看清数轴两端的数和中间的刻度。',
    items: [
      item("图中哪个点最接近57？", ["A","B","C","D"], 1, "数轴范围20至100，四点内部位置为45、55、62、70，与57的距离为12、2、5、13，只有B最近。", ["低估目标位置。","","高估目标位置。","高估目标，忽略左端不是0。"], {"asset":"n02-line-a","uniqueAnswerCheck":"数轴范围20至100，四点内部位置为45、55、62、70，与57的距离为12、2、5、13，只有B最近。"}),
      item("图中哪个点最接近109？", ["A","B","C","D"], 2, "数轴范围40至160，四点内部位置为94、102、112、123，与109的距离为15、7、3、14，只有C最近。", ["低估目标位置。","低估目标与左端的距离。","","高估目标位置。"], {"asset":"n02-line-b","uniqueAnswerCheck":"数轴范围40至160，四点内部位置为94、102、112、123，与109的距离为15、7、3、14，只有C最近。"}),
    ],
  },
  {
    code: 'N03',
    primaryAbility: '数理',
    mechanism: '理解变化',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('只用小整数加减。'), low('题干简短。'), medium('需识别折线、等间隔记录和相邻增量，图表经验可能影响表现。')),
    difficulty: 'medium',
    expectedSeconds: 30,
    paradigm: 'observed-change-comparison',
    prompt: '看图，比较甲、乙两组怎样变化。',
    helper: '实线表示甲，虚线表示乙；不需要预测下一次记录。',
    items: [
      item("图中各次记录的间隔相同。关于甲、乙相邻两次的增加量，哪项正确？", ["甲逐次增大，乙逐次减小","甲保持不变，乙逐次增大","甲逐次减小，乙逐次增大","甲逐次减小，乙保持不变"], 2, "甲为4、8、11、13，增加量为4、3、2，逐次减小；乙为1、3、6、10，增加量为2、3、4，逐次增大。", ["颠倒了两组增加量的变化方向。","甲的增加量并不恒定。","","乙的增加量并不恒定。"], {"asset":"n03-trend-a","uniqueAnswerCheck":"逐段计算两组增加量，仅C同时描述正确；只比较最终数值无法得到答案。"}),
      item("哪项同时准确描述了两组的增加量和两组之间的差距？", ["甲每段增加更多，差距逐次缩小","两组每段增加相同，差距保持不变","乙每段增加更多，差距逐次扩大","两组每段增加相同，差距逐次缩小"], 1, "甲2、5、9、14，乙6、9、13、18；两组各段增加量都为3、4、5，每次记录乙都比甲多4，因此增量相同而差距不变。", ["两组增量相同，并非甲更多。","","乙数值始终更高不代表乙的增量更大。","相同增量不会缩小两组差距。"], {"asset":"n03-trend-b","uniqueAnswerCheck":"比较三段增量与四个时点差距，仅B同时满足。"}),
    ],
  },
  {
    code: 'N04',
    primaryAbility: '数理',
    mechanism: '理解变化',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('不依赖公式。'), medium('需要读懂两列量的变化。'), low('表格关系直接呈现。')),
    difficulty: 'medium',
    expectedSeconds: 28,
    paradigm: 'covariation',
    prompt: '比较两个量怎样一起变化。',
    helper: '根据题目给出的数量关系作答。',
    items: [
      item("甲每增加2，乙就减少3，始终如此。甲从4变到8时，乙从11变到多少？", ["5","8","6","17"], 0, "甲增加4，相当于两次增加2，乙应减少两次3，即6；11−6＝5。", ["","只减少了一次3。","算出变化量6，却未求最终值。","把减少方向误作增加。"]),
      item("每轮甲增加2、乙减少1，始终如此。开始甲为3、乙为8；两轮后甲比乙多多少？", ["1","3","5","7"], 0, "两轮后甲为3+4＝7，乙为8−2＝6，甲比乙多1。", ["","将每轮差距变化3当成最终差距。","沿用开始的差距5。","只算出甲的最终数值。"]),
    ],
  },
  {
    code: 'N05',
    primaryAbility: '数理',
    mechanism: '处理符号',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('规则在题内给出，只用小整数。'), low('符号定义一句话。'), medium('新符号题型需要先理解定义。')),
    difficulty: 'medium',
    expectedSeconds: 30,
    paradigm: 'novel-symbol-rule',
    prompt: '按下面的规则，选出数量对得上的一项。',
    helper: '左格每个●表示3，右格每个●表示1。两格合起来表示总量；两题使用同一规则。',
    items: [
      item("按规则，哪种编码表示11？", ["左2个●，右3个●","左3个●，右2个●","左4个●，右1个●","左1个●，右4个●"], 1, "左格每点表示3、右格每点表示1。各项依次为9、11、13、7，B表示11。四项均有5点，不能只比较总点数。", ["低估左格所需点数。","","高估左格所需点数。","把数量分配到权重较低的右格。"]),
      item("“左2个●、右3个●”与哪种编码表示相同的数量？", ["左1个●，右4个●","左2个●，右2个●","左3个●，右0个●","左3个●，右1个●"], 2, "原编码表示2×3＋3＝9；四项表示7、8、9、10。把右侧3点换为左侧1点得到C。", ["误把左右各一点视为等值。","漏算右侧一个点。","","换成左侧一点后仍多保留右侧一点。"]),
    ],
  },
  {
    code: 'N06',
    primaryAbility: '数理',
    mechanism: '处理符号',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('只需小整数等值换算，无需列方程。'), low('条件短且逐行给出。'), medium('需要整合两条兑换规则，会同时调用推演。')),
    difficulty: 'challenge',
    expectedSeconds: 38,
    paradigm: 'symbol-substitution',
    prompt: '按兑换规则，比较或选择相同的总量。',
    helper: '1张■可兑换2张▲，1张▲可兑换3张○。兑换前后总量不变；两题使用同一规则。',
    items: [
      item("甲有1张■和2张▲，乙有3张▲和2张○。全部换成○后，哪项正确？", ["甲比乙多1张○","乙比甲多1张○","甲比乙多3张○","乙比甲多3张○"], 0, "1■等于6○，1▲等于3○。甲共有6＋6＝12○，乙共有9＋2＝11○，甲多1○。", ["","比较方向颠倒。","算出甲有12张○，但漏算乙的2张○，误得差3张。","只看到乙比甲多1张▲，忽略其他卡片。"]),
      item("2张■和1张▲，可以换成下面哪一组？", ["2张■和2张○","1张■和3张▲","3张▲和4张○","2张■和4张○"], 1, "原组表示2×6＋3＝15○。四项依次为14、15、13、16○，只有B等值；也可将其中1张■换为2张▲，得到1■和3▲。", ["将1▲误换为2○。","","将1■误换为4○，导致总量减少。","将1▲误换为4○。"]),
    ],
  },
  {
    code: 'S01',
    primaryAbility: '空间',
    mechanism: '识别结构',
    secondaryAbilities: ['记忆'],
    dependencyRisk: risks(low('不需要几何术语。'), low('主要信息由图形符号呈现。'), low('目标方向固定，规则简单。')),
    difficulty: 'easy',
    expectedSeconds: 28,
    paradigm: 'embedded-structure',
    prompt: '哪张图里，藏着和目标图形完全一样的部分？',
    helper: '方向、拐弯的位置、线段长短和两端的标记都要一样。多出来的支线不用管。',
    items: [
      item("哪一项包含目标结构？", ["A","B","C","D"], 0, "忽略支线后，从实心端到空心端，A保留目标的六段折线及各段长度关系。B改变上方高度，C改变中间横向位置，D改变右侧横向位置。", ["","上方两转折的高度改变。","中间两转折的横向位置改变。","右侧两转折的横向位置改变。"], {"asset":"s01-embedded-a","uniqueAnswerCheck":"忽略支线后，从实心端到空心端，A保留目标的六段折线及各段长度关系。B改变上方高度，C改变中间横向位置，D改变右侧横向位置。"}),
      item("哪一项包含目标结构？", ["A","B","C","D"], 3, "D保留目标的五段折线路径和两种端点；其余候选各改变一组转折的位置，不能仅靠平移与目标重合。", ["第一组竖段向右偏移。","中间横段向上偏移。","第二组竖段向右偏移。",""], {"asset":"s01-embedded-b","uniqueAnswerCheck":"D保留目标的五段折线路径和两种端点；其余候选各改变一组转折的位置，不能仅靠平移与目标重合。"}),
    ],
  },
  {
    code: 'S02',
    primaryAbility: '空间',
    mechanism: '识别结构',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('不需电路知识，只按接通规则。'), low('规则说明一句话。'), medium('补线符号首次出现，提供规则说明。')),
    difficulty: 'medium',
    expectedSeconds: 32,
    paradigm: 'structure-completion',
    prompt: '空格里放哪一块，能把粗线接通？',
    helper: '把三对相同的标记各自接通，不同标记不能连在一起。每块按图上的方向放，不能转动。',
    practiceId: 'practice-structure-gap',
    items: [
      item("哪一块能同时接通三对相同标记？", ["A","B","C","D"], 0, "从上方左接口顺时针将六接口编号0至5（仅审计用），目标配对为0—5、1—2、3—4。只有A同时满足三对，且三路相互独立。", ["","将上方两个不同标记接在一起。","将上方两个不同标记接在一起。","将接口0接到3，圆标记与另一类标记混接。"], {"asset":"s02-gap-a","uniqueAnswerCheck":"从上方左接口顺时针将六接口编号0至5（仅审计用），目标配对为0—5、1—2、3—4。只有A同时满足三对，且三路相互独立。"}),
      item("哪一块能同时接通三对相同标记？", ["A","B","C","D"], 1, "按同一顺时针内部编号，目标配对为0—1、2—5、3—4。只有B保持全部三对标记分别接通。", ["将接口0接到5，混接不同标记。","","将接口2接到3，混接不同标记。","将接口0接到3，混接不同标记。"], {"asset":"s02-gap-b","uniqueAnswerCheck":"按同一顺时针内部编号，目标配对为0—1、2—5、3—4。只有B保持全部三对标记分别接通。"}),
    ],
  },
  {
    code: 'S03',
    primaryAbility: '空间',
    mechanism: '空间想象',
    secondaryAbilities: ['记忆'],
    dependencyRisk: risks(low('不需学科知识。'), low('说明短。'), medium('需要区分旋转与镜像，提供规则说明。')),
    difficulty: 'easy',
    expectedSeconds: 30,
    paradigm: 'rotation-not-mirror',
    prompt: '哪一项转动后，和目标图形完全一样？',
    helper: '只能转动，不能翻面，也不能改变图形。',
    practiceId: 'practice-rotation',
    memoryPresentationId: 'sequence-4-5',
    items: [
      item("哪一项能由目标只旋转得到？", ["A","B","C","D"], 0, "A是目标顺时针旋转90°后的结果，凹口、长短边与实心／空心标记的相对位置均保持不变。", ["","包含镜像翻面，无法只旋转得到。","空心标记相对外轮廓的位置改变。","凹口对应的两顶点位置改变。"], {"asset":"s03-rotation-a","uniqueAnswerCheck":"A是目标顺时针旋转90°后的结果，凹口、长短边与实心／空心标记的相对位置均保持不变。"}),
      item("哪一项能由目标只旋转得到？", ["A","B","C","D"], 3, "D是目标顺时针旋转270°后的结果，全部折线、分支与实心／空心端点同时对应。", ["包含镜像翻面。","分支朝向被改变。","一组转折位置改变，不是刚体旋转。",""], {"asset":"s03-rotation-b","uniqueAnswerCheck":"D是目标顺时针旋转270°后的结果，全部折线、分支与实心／空心端点同时对应。"}),
    ],
  },
  {
    code: 'S04',
    primaryAbility: '空间',
    mechanism: '空间想象',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('只涉及方格拼合。'), low('文字少，以方块图示为主。'), medium('拼合规则首次出现，提供规则说明。')),
    difficulty: 'medium',
    expectedSeconds: 35,
    paradigm: 'shape-composition',
    prompt: '两块图形沿金边拼好后，外轮廓是什么样？',
    helper: '左块不动，右块可以移动、转动，但不能翻面。两条金边要完全贴在一起：实心点对实心点，空心点对空心点。两块不能叠在一起。',
    practiceId: 'practice-composition',
    items: [
      item("保持左块方向，拼好后的外轮廓是哪一项？", ["A","B","C","D"], 0, "把右块转回金边与左块同向、同类端点重合的位置，再沿金边贴合。两块各占5个等大方格，合成10格无重叠轮廓，只有A匹配全部外边界。", ["","右下末端高了一格。","左侧底端的伸出位置改变。","左上方格的位置改变。"], {"asset":"s04-compose-a","uniqueAnswerCheck":"把右块转回金边与左块同向、同类端点重合的位置，再沿金边贴合。两块各占5个等大方格，合成10格无重叠轮廓，只有A匹配全部外边界。"}),
      item("保持左块方向，拼好后的外轮廓是哪一项？", ["A","B","C","D"], 1, "先旋转右块使金边端点与左块逐一对应，再平移贴合。所得10格轮廓上方保留左块缺口、下方保留右块弯折，只有B完整保留。", ["底端向左偏移了一格。","","把左块的缺口位置改变。","把左块右上方格移入缺口。"], {"asset":"s04-compose-b","uniqueAnswerCheck":"先旋转右块使金边端点与左块逐一对应，再平移贴合。所得10格轮廓上方保留左块缺口、下方保留右块弯折，只有B完整保留。"}),
    ],
  },
  {
    code: 'S05',
    primaryAbility: '空间',
    mechanism: '空间转换',
    secondaryAbilities: ['推演'],
    dependencyRisk: risks(low('只需按题内展开图判断。'), low('图示和问题都简短。'), medium('展开图题型经验可能影响表现，提供规则说明。')),
    difficulty: 'challenge',
    expectedSeconds: 34,
    paradigm: 'net-folding',
    prompt: '把图折成正方体后，哪两个面正好相对？',
    helper: '每题的图要单独看。相对的两个面面对面，不共用一条边。',
    practiceId: 'practice-net-folding',
    items: [
      item('折成立方体后，与C相对的是？', ['A', 'B', 'E', 'F'], 2, '以C为正面，A、D、B、F折成四个侧面；接在D外侧的E折到C背面，所以C与E相对。', ['A与C相邻。', 'B与C相邻。', '', 'F与C相邻。'], { asset: 's05-net', uniqueAnswerCheck: '按共享边折叠后，E的法向与C相反；A、B、F均与C共享棱，唯一答案为E。' }),
      item('这张展开图折起后，哪两面相对？', ['P与R', 'R与T', 'S与U', 'Q与S'], 3, '以R为正面折起，Q与S分别位于左、右两面，法向相反；P与T相对，R与U相对。', ['P与R共边。', 'R与T共边。', 'S与U折起后相邻。', ''], { asset: 's05-net-independent', uniqueAnswerCheck: '六面折叠法向产生三对相对面Q/S、P/T、R/U，四个候选中仅D属于其中一对。' }),
    ],
  },
  {
    code: 'S06',
    practiceId: 'practice-sequence',
    memoryPresentationId: 'sequence-6',
    primaryAbility: '空间',
    mechanism: '空间转换',
    secondaryAbilities: ['记忆'],
    dependencyRisk: risks(low('只使用图示的位置、方向与镜像关系。'), low('文字仅说明操作顺序。'), low('不需读取坐标符号，候选位置直接标在图中。')),
    difficulty: 'medium',
    expectedSeconds: 24,
    paradigm: 'visual-position-transformation',
    prompt: '看图，按题目要求选出结果。',
    helper: '按每题图示和文字要求选择一项。',
    items: [
      item('橙点按金色路径移动，终点对应哪个字母？', ['A', 'B', 'C', 'D'], 1, '从橙点沿路径先上移两格，再右移两格，箭头终点落在B。', ['向右少走一格。', '', '向上少走一格。', '向上、向右均少走一格。'], { asset: 's06-transform-a', uniqueAnswerCheck: '路径的唯一箭头终点与B标记重合，其他位置分别对应少走或漏走一步。' }),
      item('把左侧箭头整体翻到虚线另一侧，哪一项正确？', ['A', 'B', 'C', 'D'], 0, '关于竖直虚线翻面后，橙点移到右下，路径先向左再向上，箭头仍指向上方，对应A。', ['', '把上下方向也错误翻转。', '保持了原图左右方向，只做了平移。', '把橙点放到了箭头端。'], { asset: 's06-transform-b', uniqueAnswerCheck: '竖直镜像保持上下关系、反转左右关系；只有A同时满足起点、折角和箭头方向。' }),
    ],
  },
  {
    code: 'R01',
    primaryAbility: '推演',
    mechanism: '发现关系',
    secondaryAbilities: ['空间'],
    dependencyRisk: risks(low('只使用简单图形属性。'), low('题干短。'), low('类比关系直接。')),
    difficulty: 'easy',
    expectedSeconds: 23,
    paradigm: 'graphic-analogy',
    prompt: '照着例子的变法，选出结果。',
    helper: '每题只看这一题的例子。',
    items: [
      item('A“○△”变为B“●△”；C“□◇”应变为？', ['■◇', '□◆', '◇□', '■■'], 0, 'A到B只把第一个空心图形填实；对C同样处理得到“■◇”。', ['', '填实了第二个图形。', '交换了位置。', '把两个图形都改变了。']),
      item("同一种变换把“▲○▲”变为“○▲○”，把“■◇■”变为“◇■◇”。“★□★”应变为？", ["★□□","□★□","□□★","★□★"], 1, "两组示例都把两种符号的身份互换：原来外侧的符号变为内侧符号，原来内侧的符号变为外侧符号。★□★因此成为□★□。", ["只替换末项，没有保持两外项一致。","","只替换首项，没有保持两外项一致。","保持了原编码，未应用变换。"]),
    ],
  },
  {
    code: 'R02',
    primaryAbility: '推演',
    mechanism: '发现关系',
    secondaryAbilities: ['数理'],
    dependencyRisk: risks(low('符号关系在题内定义。'), low('文字负担很低。'), medium('需要保持映射方向。')),
    difficulty: 'medium',
    expectedSeconds: 28,
    paradigm: 'minimal-symbol-relation',
    prompt: '看例子里的符号怎么变，再照样变一变。',
    helper: '两个例子用的是同一种变法。',
    items: [
      item("同一种变换把“△○□”变为“□△○”，把“◇★■”变为“■◇★”。“＋●▽”连续经过两次该变换，得到？", ["▽＋●","▽●＋","●▽＋","＋●▽"], 2, "每次把末项移到首位，保留另外两项的次序。＋●▽第一次成为▽＋●，第二次成为●▽＋。", ["只执行了一次变换。","把原顺序倒置。","","执行了三次而非两次。"]),
      item("同一种变换把“◇★■●”变为“★◇●■”，把“▲○□＋”变为“○▲＋□”。“▽◆◎△”经过该变换，得到？", ["△▽◆◎","◆▽△◎","◎△▽◆","△◎◆▽"], 1, "关系是第1、2项互换，同时第3、4项互换；▽◆◎△因此成为◆▽△◎。", ["把末项移到开头。","","交换两对的整体位置而非对内位置。","将整个序列倒置。"]),
    ],
  },
  {
    code: 'R03',
    primaryAbility: '推演',
    mechanism: '归纳规律',
    secondaryAbilities: ['数理'],
    dependencyRisk: risks(low('规则只作用于题内符号。'), low('题干极短。'), medium('需要从多个表面变化中识别同一个稳定变换。')),
    difficulty: 'easy',
    expectedSeconds: 26,
    paradigm: 'graphic-sequence',
    prompt: '选择最符合已有变化规律的下一项。',
    helper: '你找到的规律，要能解释前面每一组图。',
    items: [
      item("○△□◇，△□◇○，□◇○△，下一项是？", ["◇△□○","○△□◇","◇○△□","△○◇□"], 2, "每次将首项移到末尾，其余顺序不变。第三组继续左移一项，得到◇○△□。", ["虽以菱形开头，但其余顺序不符。","提前回到第一组。","","将位置作了不同的成对交换。"]),
      item("●○○●○，○●○○●，●○●○○，下一项是？", ["○●○●○","○○●○●","●○○●○","○●●○○"], 0, "每一步所有符号向右循环移动一位，末项移到首位。第三组移动后得到○●○●○。", ["","移动两位而不是一位。","移动三位而不是一位。","只移动了其中一个实心圆。"]),
    ],
  },
  {
    code: 'R04',
    primaryAbility: '推演',
    mechanism: '归纳规律',
    secondaryAbilities: ['数理'],
    dependencyRisk: risks(low('只用题内形状与小整数。'), low('规则说明短。'), medium('需要把形状循环与数值变化拆开追踪，不能靠单一表面相似。')),
    difficulty: 'challenge',
    expectedSeconds: 38,
    paradigm: 'dual-rule-symbol-pattern',
    prompt: '每组包含形状和数字。选择符合整组规律的下一项。',
    helper: '选择符合整组变化规律的一项。',
    items: [
      item("○2，△5，□4，○7，△6，□9，○8，下一项是？", ["△9","□11","□9","△11"], 3, "规则一：形状以○△□为周期重复，下一项为△。规则二：数字的变化为+3、−1交替，三轮均符合，8之后为11；两条规则合并得到△11。", ["形状符合，但数字误按+1。","数字符合，但形状跳过△。","两条规则都不符合。",""], {"uniqueAnswerCheck":"检查最短重复形状周期与交替增量，两条规则同时适合全部已给项；在四个选项中仅D满足。此检查不宣称任意有限序列只有一种数学延拓。"}),
      item("◇3，○6，△4，◇8，○6，△11，◇9，下一项是？", ["△15","○14","○15","△14"], 2, "规则一：形状以◇○△为周期重复，下一项为○。规则二：增量为+3、−2、+4、−2、+5、−2，正增量每次多1，负增量固定−2；下一次+6，9变为15，因此是○15。", ["数字符合，但形状跳过○。","形状符合，但沿用了前一次正增量+5。","","形状错位且未更新正增量。"], {"uniqueAnswerCheck":"形状最短周期3；交替增量中正增量等差递增、负增量固定。全部已给项共同支持这组规则，四个候选中仅C满足；不是任意规则空间中的绝对唯一证明。"}),
    ],
  },
  {
    code: 'R05',
    primaryAbility: '推演',
    mechanism: '推出结论',
    secondaryAbilities: ['语言'],
    dependencyRisk: risks(low('对象均为虚构，不依赖常识。'), medium('需要准确处理“所有、没有、只有”等词。'), low('标准必要结论单选。')),
    difficulty: 'medium',
    expectedSeconds: 32,
    paradigm: 'necessary-conclusion',
    prompt: '把给出的条件都当作真的，选择一定成立的结论。',
    helper: '只用题目给出的条件，不自己加条件。',
    items: [
      item("所有“尼法”都带银印；带银印且带方框的对象都不漂浮。对象K是带方框的尼法。一定成立的是？", ["所有带银印的对象都不漂浮","所有不漂浮的对象都是尼法","K不漂浮","所有尼法都带方框"], 2, "K是尼法，所以带银印；K又带方框，满足第二条的两个条件，因此K不漂浮。", ["遗漏方框条件。","将结果反推成对象类别。","","将K的属性扩大到所有尼法。"]),
      item("只有带塔印的对象才能过蓝门；过蓝门的对象都收到圆签。K已过蓝门，J只有收到圆签这一条已知信息。一定成立的是？", ["K与J都带塔印","K带塔印且收到圆签","J过了蓝门且带塔印","K收到圆签但不带塔印"], 1, "由过门的必要条件推出K带塔印，由过门的结果推出K收到圆签。J收到圆签不能反推过门。", ["对J倒推过门和塔印。","","圆签未被规定只能由过蓝门获得。","K不带塔印违反必要条件。"]),
    ],
  },
  {
    code: 'R06',
    primaryAbility: '推演',
    mechanism: '推出结论',
    secondaryAbilities: ['语言'],
    dependencyRisk: risks(low('关系均在题内给出。'), medium('需要保持短关系链方向。'), low('链长不超过三步。')),
    difficulty: 'medium',
    expectedSeconds: 34,
    paradigm: 'symbol-text-chain',
    prompt: '根据题目给出的关系，哪一项一定对？',
    helper: '只根据题内条件，选择一定成立的一项。',
    items: [
      item("图中箭头表示“早于”：箭头起点的事件早于终点。四个事件时间均不同。哪一项中的两句话都一定成立？", ["甲早于丙；丙早于丁","丙早于甲；甲早于丁","甲早于丁；丙早于丁","甲早于丁；丁早于丙"], 2, "甲→乙→丁和丙→乙→丁分别推出甲、丙早于丁；甲与丙之间的先后未被限定。", ["第一句没有被条件限定。","第一句没有被条件限定。","","第二句与丙→乙→丁矛盾。"], {"asset":"r06-order-graph","uniqueAnswerCheck":"枚举全部满足图中三条有向边的事件排列，仅C的两句话在每一种排列中都成立。节点屏幕位置不额外表示时间先后。"}),
      item("若P发生，则Q发生；若Q和S都发生，则T发生。已知P发生而T未发生。一定成立的是？", ["Q未发生，S发生","Q发生，S也发生","Q未发生，S未发生","Q发生，S未发生"], 3, "P发生推出Q发生。若S也发生，则Q与S共同推出T，与T未发生矛盾；所以S未发生。", ["Q未发生与P→Q及已知P冲突。","Q、S都发生将推出T，违反已知。","Q未发生与已知推出的Q冲突。",""]),
    ],
  },
]

const sequence = [
  'M01', 'L01', 'N01', 'S01', 'R01', 'M02', 'L02', 'N02', 'S02', 'R02',
  'L03', 'N03', 'S03', 'R03', 'M03', 'L04', 'N04', 'S04', 'R04', 'M04',
  'L05', 'N05', 'S05', 'R05', 'M05', 'L06', 'N06', 'S06', 'R06', 'M06',
]

export const orderedV16Tasks: V16Task[] = sequence.map((code, index) => {
  const source = tasks.find((task) => task.code === code)
  if (!source) throw new Error('缺少V1.6任务：' + code)
  return { ...source, measurementRationale: measurementRationale(source), id: code + '-v16', position: index + 1 }
})

export const META_BANK_V16 = {
  version: '1.6',
  edition: '预测试版·任务等权',
  audience: '浙江省高三学生',
  memoryFlow: {
    visual: {
      immediateTargets: ['VA1', 'VA2', 'VA3'],
      delayedTargets: ['VB1', 'VB2', 'VB3'],
    },
    semantic: {
      immediateTargets: ['SC1', 'SC2', 'SC3'],
      delayedTargets: ['SD1', 'SD2', 'SD3'],
    },
    sequenceLengths: [4, 5, 6],
  },
  memoryPresentations: [
    {
      id: 'visual-board',
      visualIds: ['VA1', 'VA2', 'VA3', 'VB1', 'VB2', 'VB3'],
      beforeTask: 'M01',
      title: '图形位置记忆',
      instruction: '记住六个图形的形状，也要记住它们各自的位置。',
      durationSeconds: 24,
      content: ['☾\nVA1', '◉│\nVA2', '⌒⌒\nVA3', '◇╱\nVB1', '∞\nVB2', '◒\nVB3'],
    },
    {
      id: 'semantic-pairs',
      internalIds: ['SC1', 'SC2', 'SC3', 'SD1', 'SD2', 'SD3'],
      beforeTask: 'M02',
      title: '名字和特点记忆',
      instruction: '这些名字都是编出来的，不需要认识。记住每个名字对应什么特点。',
      durationSeconds: 24,
      content: ['洛米—发蓝光', '塔格—怕雨', '奈朴—会折叠', '西岚—靠近水会变轻', '伏可—晚上发热', '墨迩—碰金属会响'],
    },
    {
      id: 'sequence-4-5',
      practiceId: 'practice-sequence',
      beforeTask: 'S03',
      title: '两组符号记忆',
      instruction: '符号会一个个出现：第一组4个，第二组5个。记住每组的顺序。每组只放一次，做完后面两组题再问你。',
      durationSeconds: 18,
      content: ['四项：◆　○　▲　■', '五项：☂　◇　☀　♧　★'],
    },
    {
      id: 'sequence-6',
      beforeTask: 'S06',
      title: '六个符号记忆',
      instruction: '六个符号会一个个出现。记住第几个是什么，做完后面两组题再问你。',
      durationSeconds: 12,
      content: ['⬟　☾　✚　◈　◇　☁'],
    },
  ] satisfies MemoryPresentation[],
  timeBudget: {
    formalTasksSeconds: orderedV16Tasks.reduce((sum, task) => sum + task.expectedSeconds, 0),
    memoryPresentationSeconds: 78,
    practiceSeconds: 66,
    transitionSeconds: 72,
    totalExpectedSeconds: orderedV16Tasks.reduce((sum, task) => sum + task.expectedSeconds, 0) + 78 + 66 + 72,
  },
  tasks: orderedV16Tasks,
}
