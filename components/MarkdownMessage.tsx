import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

type MarkdownMessageProps = {
  content: string | null | undefined;
  className?: string;
};

const ALLOWED_MARKDOWN_ELEMENTS = ["p", "strong", "em", "ul", "ol", "li", "br", "code", "blockquote"];

export default function MarkdownMessage({ content, className = "" }: MarkdownMessageProps) {
  const trimmedContent = content?.trim();

  if (!trimmedContent) {
    return null;
  }

  return (
    <div className={`markdown-message text-sm leading-6 ${className}`}>
      <ReactMarkdown
        allowedElements={ALLOWED_MARKDOWN_ELEMENTS}
        components={{
          blockquote({ children }) {
            return (
              <blockquote className="mb-2 border-l-2 border-[#E55125]/70 pl-3 text-white/75 last:mb-0">
                {children}
              </blockquote>
            );
          },
          code({ children }) {
            return <code className="rounded bg-white/10 px-1 py-0.5 text-[0.92em] text-white/90">{children}</code>;
          },
          em({ children }) {
            return <em className="italic text-inherit">{children}</em>;
          },
          li({ children }) {
            return <li className="pl-1">{children}</li>;
          },
          ol({ children }) {
            return <ol className="mb-2 list-decimal space-y-1 pl-5 marker:text-[#E55125] last:mb-0">{children}</ol>;
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-inherit">{children}</strong>;
          },
          ul({ children }) {
            return <ul className="mb-2 list-disc space-y-1 pl-5 marker:text-[#E55125] last:mb-0">{children}</ul>;
          },
        }}
        remarkPlugins={[remarkBreaks]}
        unwrapDisallowed
      >
        {trimmedContent}
      </ReactMarkdown>
    </div>
  );
}
