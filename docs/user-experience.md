# User Experience

The public flow must stay simple:

```text
One idea → three blueprint options → one Matrix Bundle → copy prompt / download ZIP → validate → publish
```

The user should not need to understand standards packs, internal engine boundaries, or validation internals. Those are hidden behind clear product actions.

## Optional Internal AI assist

The flow above is fully deterministic and needs no AI. Users who want a smarter-feeling experience
can optionally connect OllaBridge under **Account Settings → System Configuration** (provider
defaults to `None`). When enabled, Internal AI only improves candidate wording and explains
validation results in plain language — it never changes the blueprint, bundle, allowed files, or
validation outcome. Source code is never sent to it. See
[`ollabridge-internal-ai.md`](./ollabridge-internal-ai.md).

> Internal AI can improve the words users see, but it cannot change the contract users build from.
