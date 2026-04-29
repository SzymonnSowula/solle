

interface SummaryCardProps {
  summary: string;
}

function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <div className="summary-card">
      <h3>Session Summary</h3>
      <p>{summary}</p>
    </div>
  );
}

export default SummaryCard;
