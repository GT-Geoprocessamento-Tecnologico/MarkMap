## 2026-10-24 - AppIcon Memoization
**Learning:** Pure presentational components, especially SVGs used frequently like AppIcon, benefit greatly from `React.memo()` to prevent wasteful render cycles when their primitive props haven't changed.
**Action:** Identify heavily reused presentational components and wrap them in `React.memo()` if they only accept primitive props.
