export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        // trailer-exists is case-sensitive, so it misses "Co-Authored-By".
        "no-co-authored-by": ({ raw }) => [
          !/^co-authored-by:/im.test(raw),
          "message must not have a Co-authored-by trailer",
        ],
      },
    },
  ],
  rules: {
    "header-max-length": [2, "always", 120],
    "body-max-line-length": [2, "always", 120],
    "footer-max-line-length": [2, "always", 120],
    "no-co-authored-by": [2, "always"],
  },
};
