import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { cn } from "@/lib/utils";
import { Copy } from "lucide-react";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

function CodeBlock({ inline, className, children, ...props }: any) {
  const codeString = String(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const copyCode = () => {
    navigator.clipboard.writeText(codeString);
  };

  if (!inline && match) {
    return (
      <div className="relative">
        <button 
          onClick={copyCode} 
          className="absolute top-2 right-2 text-xs bg-inherit p-2 rounded text-white"
        >
          <Copy className="w-4 h-4 text-white" />
        </button>
        <SyntaxHighlighter
          // @ts-ignore
          style={coldarkDark as Record<string, React.CSSProperties>}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }
  return inline ? (
    <code className={className} {...props}>
      {children}
    </code>
  ) : (
    <pre className={className} {...props}>
      <code>{codeString}</code>
    </pre>
  );
}

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        className
      )}
      remarkPlugins={[remarkGfm, remarkMath]} 
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        p({ children }) {
          return (
            <p
              style={{
                margin: 0, 
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}
            >
              {children}
            </p>
          );
        },
        // @ts-ignore
        inlineCode({ children, className, ...props }) {
          return (
            <code
              className={className}
              style={{ background: "none", padding: 0, fontSize: "inherit" }}
              {...props}
            >
              {children}
            </code>
          );
        },
        code: CodeBlock,
        // Override table to add horizontal scroll for mobile
        table({ children }) {
          return (
            <div className="overflow-auto w-full">
              <table className="border-collapse border border-border">{children}</table>
            </div>
          );
        },
        // Style links properly
        a({ children, href }) {
          return (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline"
            >
              {children}
            </a>
          );
        },
        // New overrides for headings
        h1({ children, ...props }) {
          return <h1 {...props}>{children}</h1>;
        },
        h2({ children, ...props }) {
          return <h2 {...props}>{children}</h2>;
        },
        h3({ children, ...props }) {
          return <h3 {...props}>{children}</h3>;
        },
        h4({ children, ...props }) {
          return <h4 {...props}>{children}</h4>;
        },
        h5({ children, ...props }) {
          return <h5 {...props}>{children}</h5>;
        },
        h6({ children, ...props }) {
          return <h6 {...props}>{children}</h6>;
        },
        blockquote({ children, ...props }) {
          return <blockquote {...props}>{children}</blockquote>;
        },
        ol({ children, ...props }) {
          return <ol {...props}>{children}</ol>;
        },
        ul({ children, ...props }) {
          return <ul {...props}>{children}</ul>;
        },
        li({ children, ...props }) {
          return <li {...props}>{children}</li>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
