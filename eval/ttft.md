# Time to first token

Run 2026-11-13 by `pnpm perf:ttft` against https://citeseek.app.
Asked as a guest in the demo: "What is the expenses policy?"
A warm-up request was discarded first.
12 of 12 samples completed, with a 16 s pause between requests.

**529 ms** to the first byte of the stream, which is the citation payload.

**1.09 s** to the first token of the answer.

Both are medians of the completed samples. Each sample, from request start:

- 1: first byte 519 ms, first token 915 ms
- 2: first byte 628 ms, first token 1028 ms
- 3: first byte 533 ms, first token 1080 ms
- 4: first byte 519 ms, first token 1001 ms
- 5: first byte 529 ms, first token 995 ms
- 6: first byte 541 ms, first token 1096 ms
- 7: first byte 507 ms, first token 1149 ms
- 8: first byte 531 ms, first token 1341 ms
- 9: first byte 513 ms, first token 1115 ms
- 10: first byte 530 ms, first token 1033 ms
- 11: first byte 498 ms, first token 1211 ms
- 12: first byte 602 ms, first token 1504 ms
