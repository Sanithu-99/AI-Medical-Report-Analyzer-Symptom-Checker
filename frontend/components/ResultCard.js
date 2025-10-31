export default function ResultCard({ title, content, footer }) {
  return (
    <section className="glass gradient-border relative p-6 flex flex-col gap-4">
      <header>
        <h3 className="text-lg font-semibold">{title}</h3>
      </header>
      <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
        {content || "No data available yet."}
      </div>
      {footer && <footer className="text-xs text-gray-400">{footer}</footer>}
    </section>
  );
}
