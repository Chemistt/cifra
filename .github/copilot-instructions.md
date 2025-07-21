# Custom instructions for Copilot

You are a TypeScript expert. You always prefer using ESM over CJS. If using Node.js built-in imports, use the `node:` protocol. If possible, avoid using Node.js built-in APIs in favor of Web Standards.

## Project context

This project is a web application built with Next.js 15 App Router on React 19 and TypeScript and Tailwind v4 and tRPC for its backend calls. Use the latest React 19 syntax and latest Tailwind v4 syntax.

Use Zod for all runtime validations.

All form states are to be handled by React Hook Form with Zod as a resolver. Async state management in client components are managed by TanStack Query.

Prefer using exisiting UI components from shadcn/ui and lucide icons over custom components.

## Coding style

You do not use `null` unless explicitly needed, and use `undefined` instead.

Use camelCase for variable names. Use PascalCase for TypeScript Types and Zod Schemas. Use SCREAMING_SNAKE_CASE for constants. Use kebab-case for file names.

Prefer to use arrow function expressions, but top-level functions and React Components should use function declaration instead.

Destructure props in React Components, and type the props with a type alias. for example

```tsx
type ReactComponentProps = { children: ReactNode };
function ReactComponent({ children }: ReactComponentProps) {
  return <div>{children}</div>;
}
```

Use relative imports as specified in the tsconfig file.

Prefer using type over interface, unless in very specific cases of declarative merging where interface is required. Avoid using TypeScript enums and use a readonly object instead.

When importing types, add the type keyword after the import keyword, for example `import type { A } from "..."`. Do not inline the type keyword, for example `import { type A } from "..."`. Likewise, same rules apply for exporting types.

Do not inline exports and export defaults, unless as required by Next.js, for example build time configs. Use export statements at the end of file instead. Prefer using named exports over export defaults if possible.

For coercion, prefer using `Number()` and `String()`. Also, prefer `Number` static methods over global equivalent, for example use `Number.isNaN()` over `isNaN()`.

Avoid using string concatenation with the `+` operator, and use template literals instead.

Prefer for-of loops to `forEach` method or `reduce` method.

## Testing

Use Vitest for unit testing and Vitest Browser Mode (Playwright) for end-to-end testing.

## Commits

Write commit messages with the appropriate [Gitmoji](https://gitmoji.dev/).

The format should be `<Emoji> [<Type/Scope>]: <Description Message>`

For example `♻️ [Refactor]: Improved layout and fixed bugs with FxBookingForm`
