import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownMessageProps = {
  content: string;
};

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        code: ({ node: _node, className, children, ...props }) => {
          const value = String(children);
          const isBlock = (className?.includes("language-") ?? false) || value.includes("\n");
          if (!isBlock) {
            return (
              <code className={`inline-code ${className ?? ""}`.trim()} {...props}>
                {children}
              </code>
            );
          }
          return (
            <pre className="code-block">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
