import { createCn } from "cn/config";

/**
 * The app's one class merger. It is told that Vantage's size names are font
 * sizes: the stock merger files `text-meta` with the text colours, so a size
 * and a colour on one element silently drop each other (the design system's
 * RULES.md, section 6).
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["nano", "micro", "meta", "small", "body", "display"] },
      ],
    },
  },
});
