# Contributing

Thanks for improving ChromaCraft. Small, focused pull requests are easiest to review.

## Development

1. Fork and clone the repository.
2. Create a branch from `main`.
3. Run `npm test` and `npm run check` before submitting.
4. Describe the user-visible behavior and include screenshots for interface changes.

The project intentionally has no runtime dependencies or build step. Discuss changes that add either one before implementation. Keep color calculations in `src/color-utils.js` so they remain testable outside the browser.

## Pull requests

- Add tests for color math and clustering changes.
- Verify keyboard navigation and narrow screens for interface changes.
- Do not add analytics, remote image processing, or background network calls.
- Keep commits scoped and use clear imperative messages.

By contributing, you agree that your work is licensed under the MIT License.
