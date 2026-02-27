type SourceAccordionProps = {
  sources: string[];
  expanded: boolean;
  onToggle: () => void;
};

export default function SourceAccordion({ sources, expanded, onToggle }: SourceAccordionProps) {
  return (
    <section className="source-accordion">
      <button
        type="button"
        className="source-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        Sources ({sources.length})
      </button>
      {expanded ? (
        <ul className="source-list">
          {sources.map((source, idx) => (
            <li key={`${source}-${idx}`}>{source}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
