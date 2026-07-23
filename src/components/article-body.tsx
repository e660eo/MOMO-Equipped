import { parseArticle } from "@/lib/article";

/*
  Текст статьи на странице новости.

  Каждый блок рисуется обычным React-элементом, а текст подставляется
  значением — `{block.text}`, не разметкой. Поэтому `<script>` из панели
  останется набором букв на экране: dangerouslySetInnerHTML здесь нет и
  быть не должно (см. src/lib/sanitize.ts).
*/
export function ArticleBody({ body }: { body: string }) {
  const blocks = parseArticle(body);

  return (
    <div className="mt-8">
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h2
              key={i}
              className="mt-10 font-display text-[1.15rem] font-semibold leading-snug first:mt-0"
            >
              {block.text}
            </h2>
          );
        }

        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={i}
              className={`mt-4 space-y-2 pl-5 leading-relaxed text-muted-foreground ${
                block.ordered ? "list-decimal" : "list-disc"
              }`}
            >
              {block.items.map((item, j) => (
                <li key={j} className="pl-1">
                  {item}
                </li>
              ))}
            </List>
          );
        }

        return (
          <p key={i} className="mt-4 leading-relaxed text-muted-foreground">
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
