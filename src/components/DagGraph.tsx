import type { DagEvent } from '../types'

interface DagGraphProps {
  events: DagEvent[]
  onSelect: (event: DagEvent) => void
}

const positions = [
  { x: 84, y: 50 },
  { x: 208, y: 112 },
  { x: 332, y: 42 },
  { x: 454, y: 118 },
  { x: 572, y: 58 },
]

export function DagGraph({ events, onSelect }: DagGraphProps) {
  return (
    <div className="dag-canvas" aria-label="Recent DAG events visualization">
      <svg viewBox="0 0 660 170" role="img">
        <defs>
          <linearGradient id="edge-gradient" x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(79, 223, 255, .18)" />
            <stop offset="100%" stopColor="rgba(146, 97, 255, .7)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {positions.slice(0, -1).map((position, index) => {
          const next = positions[index + 1]
          return (
            <g key={`edge-${index}`}>
              <line x1={position.x} y1={position.y} x2={next.x} y2={next.y} className="dag-edge" />
              {index < positions.length - 2 && (
                <line x1={position.x} y1={position.y} x2={positions[index + 2].x} y2={positions[index + 2].y} className="dag-edge dag-edge-muted" />
              )}
            </g>
          )
        })}
        {events.slice(0, positions.length).map((event, index) => {
          const position = positions[index]
          return (
            <g
              key={event.id}
              className={`dag-node dag-node-${event.status}`}
              onClick={() => onSelect(event)}
              role="button"
              tabIndex={0}
              onKeyDown={(keyboardEvent) => keyboardEvent.key === 'Enter' && onSelect(event)}
            >
              <circle cx={position.x} cy={position.y} r="18" filter="url(#glow)" />
              <circle cx={position.x} cy={position.y} r="5" className="dag-node-core" />
              <text x={position.x} y={position.y + 34} textAnchor="middle">{event.shortId.slice(0, 6)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
