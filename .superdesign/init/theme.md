# Theme Summary

## Tokens
- Framework: Tailwind CSS 3.3 with local utility classes
- Font: system sans stack (`-apple-system`, BlinkMacSystemFont, `Segoe UI`, Roboto, Oxygen, Ubuntu, Cantarell, `Fira Sans`, `Droid Sans`, `Helvetica Neue`, sans-serif)
- Primary: emerald 600 `#059669`; hover emerald 700 `#047857`; Tailwind custom `primary` `#185fa5`
- Background: `#f7faf8`; surfaces: white; borders: slate 200; text: slate 800/600/500/400
- Semantic: rose alerts, amber warnings, emerald success
- Radius: mostly `rounded-lg`, `rounded-xl`, `rounded-2xl`; inputs `0.5rem`
- Shadows: no custom shadows in global CSS
- Breakpoints: Tailwind defaults, with `md` used for desktop shell and `sm`/`lg`/`xl` grids
- Spacing: Tailwind default scale

## Raw source: frontend/src/index.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
button { cursor: pointer; }
input, select, textarea { font-family: inherit; }
.input { display: block; width: 100%; margin-top: 0.25rem; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.5rem; }
.primary { background: #059669; color: white; border-radius: 0.5rem; padding: 0.625rem 1rem; font-size: 0.875rem; }
.primary:hover { background: #047857; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #f1f5f9; }
::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
```

## Tailwind config
```js
/** @type {import('tailwindcss').Config} */
export default { content: ['./index.html', './src/**/*.{js,jsx}'], theme: { extend: { colors: { primary: '#185fa5', secondary: '#6b7280' } } }, plugins: [] };
```
