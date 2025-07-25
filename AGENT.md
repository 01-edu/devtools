## Stack

- backend: Deno
- frontend: Preact, preact signals, Tailwind v4+, DaisyUI 5
- build using vite

## JS / TS

### Coding style rules

- Check for useless `try / catch` that simply re-throw the error without
  handeling anything
- Check for useless `async / await` that could be simply handled by returning
  `async () { return await asyncCall() }` should be `() => asyncCall()`
- Never use `.forEach` unless the function called in the loop already exists,
  use `for .. of` instead
- Check that `.map` is return value is used
- Check for useless wrapper function `onclick={() => handleClick()}` should be
  `onclick={handleClick}`
- `.reduce` is to be avoided aside from very simple accumulation that do not
  imply re-spreading / object creation. Valid cases are total, descending a
  tree, chaining promises .then, suggest `for .. of` instead, if the goal was to
  recreate an object, suggest to `.map` to entries and use `Object.fromEntries`
  like so: `Object.fromEntries(xx.map(x => [x.k, x.v]))` instead.
- Never use `for .. in`, use `for .. of` with `Object.keys` / `Object.entries`
  or `Object.values`
- Enum / switch type recommandation: In switch cases over enums, make sure we
  have an exhaustive check in the `default` case:
  ```
  switch (e /* enum value*/ ) {
   case (E.A): break;
   case (E.B): break;
   default: {
     const _: never = e; // Ensure all cases are handled
   }
  ```
  or require a comment justifying why all the case are not needed.
- Code Format:
  - indent: 2 spaces
  - line width: 80 chars
  - no semi-colons
  - favor single quote

### External Libraries

Most code is custom, library are avoided as much as possible. For the backend,
if needed, rely on https://jsr.io/@std for external libraries only.

### Logs

- Always prompt to remove `console.log` if the log need to stay, they must use
  our own log library `log.info`
- Our own log library first argument is always the name of the event, it is a
  simple string, without spaces if possible static.
- Errors are automatically handled and can be passed a simple props of the
  second argument, Example:
  `log.warn('unable-to-reach-instance', { error: err,  instanceId: 56 })`

### Preact

- We try to use url params as the main source of state through a custom signal
  `url.params`
- Avoid hooks and state in components
- Favor modern html standard and avoid redefining what's already available in
  the browser (example, <dialog> & <details>+<summary> tags)
- Signals in components
  - make sure we never create signals unless we use `useSignal` and still,
    suggest alternatives using computed signals outside of the component
    function.
  - Look for un-necessary `useEffects` that could simply be conditional values
    (ternary for examples) or achieved using signals outside of the component

## Persistance

This project does not use any database, instead due to the limited data it needs
to handle, a simple JSON file store was created.

- All the data lives in memory and is loaded on startup.
- Any creation or modification are persisted to the respective files
