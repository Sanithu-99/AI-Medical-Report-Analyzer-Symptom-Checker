export default function ResultCard({ title, content, footer }) {
  return (
    <section className="glass gradient-border relative flex flex-col gap-4 p-6">
      <header>
        <h3 className="text-lg font-semibold text-ocean">{title}</h3>
      </header>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-ocean/80">
        {content || "No data available yet."}
      </div>
      {footer && <footer className="text-xs text-ocean/50">{footer}</footer>}
    </section>
  );
}
