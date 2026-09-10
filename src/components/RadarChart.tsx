import { dimensionLabels, type Dimension } from '../lib/assessment'

const axes: Dimension[] = ['memory', 'language', 'quantitative', 'space', 'reasoning']
const center = 145
const radius = 94

function point(index: number, value: number) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length
  const length = radius * value
  return `${center + Math.cos(angle) * length},${center + Math.sin(angle) * length}`
}

export default function RadarChart({ scores }: { scores: Record<Dimension, number> }) {
  const dataPoints = axes.map((axis, index) => point(index, scores[axis] / 100)).join(' ')

  return (
    <svg className="radar" viewBox="0 0 290 290" role="img" aria-label="五维元能力雷达图">
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <polygon key={level} points={axes.map((_, index) => point(index, level)).join(' ')} className="radar-grid" />
      ))}
      {axes.map((axis, index) => {
        const axisEnd = point(index, 1)
        const [x, y] = axisEnd.split(',')
        const labelPoint = point(index, 1.22).split(',')
        return (
          <g key={axis}>
            <line x1={center} y1={center} x2={x} y2={y} className="radar-axis" />
            <text x={labelPoint[0]} y={labelPoint[1]} textAnchor="middle" dominantBaseline="middle" className="radar-label">
              {dimensionLabels[axis]}
            </text>
          </g>
        )
      })}
      <polygon points={dataPoints} className="radar-data" />
      {axes.map((axis, index) => {
        const [x, y] = point(index, scores[axis] / 100).split(',')
        return <circle key={axis} cx={x} cy={y} r="4" className="radar-dot" />
      })}
    </svg>
  )
}
