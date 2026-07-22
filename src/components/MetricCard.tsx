interface MetricCardProps {
  label: string
  value: string
  detail: string
  trend?: string
}

export function MetricCard({ label, value, detail, trend }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-card-topline">
        <span>{label}</span>
        {trend && <span className="trend">{trend}</span>}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}
