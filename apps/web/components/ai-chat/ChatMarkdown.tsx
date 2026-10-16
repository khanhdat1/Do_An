import { Fragment, type ReactNode } from "react";
import { parseChatMarkdown, type InlineNode } from "@/lib/chat-markdown";
import { cn } from "@/lib/utils";

interface ChatMarkdownProps {
  text: string;
  /** Gắn vào cuối dòng chữ cuối cùng (con trỏ nhấp nháy khi đang stream) thay vì xuống một dòng riêng */
  trailing?: ReactNode;
}

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return <Fragment key={index}>{node.text}</Fragment>;
      case "strong":
        return (
          <strong key={index} className="font-semibold">
            {renderInline(node.children)}
          </strong>
        );
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>;
      case "code":
        return (
          <code key={index} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em]">
            {node.text}
          </code>
        );
    }
  });
}

/** Câu trả lời AI có định dạng đơn giản — dựng bằng phần tử React, không chèn HTML thô (xem lib/chat-markdown.ts) */
export default function ChatMarkdown({ text, trailing }: ChatMarkdownProps) {
  const blocks = parseChatMarkdown(text);
  if (blocks.length === 0) return <>{trailing}</>;

  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        const isLastBlock = blockIndex === blocks.length - 1;

        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={blockIndex}
              start={block.ordered && block.start !== 1 ? block.start : undefined}
              className={cn("space-y-1 pl-5", block.ordered ? "list-decimal" : "list-disc")}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  {renderInline(item)}
                  {isLastBlock && itemIndex === block.items.length - 1 ? trailing : null}
                </li>
              ))}
            </List>
          );
        }

        return (
          <p key={blockIndex}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(line)}
              </Fragment>
            ))}
            {isLastBlock ? trailing : null}
          </p>
        );
      })}
    </div>
  );
}
