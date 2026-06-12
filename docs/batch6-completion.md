# Batch 6 completion — AI-coder prompt system

Batch 6 makes Matrix Builder useful with the AI coders developers already use.

## Product message

```text
AI coders are workers, not architects.
```

## Added capabilities

- Claude Code prompt
- Codex / ChatGPT prompt
- GitPilot prompt
- IBM Bob prompt
- Cursor prompt
- Generic AI coder prompt
- Copy prompt UI support
- Prompt preview support
- Send/fetch bundle URL pattern
- Coder-specific handoff instructions
- Allowed files policy display
- Prompt pack JSON included in every generated bundle ZIP
- Backend PromptResponse fields for contract files, allowed files, validation commands, hard constraints, and handoff mode

## Main files

```text
services/api/app/services/ai_coder_prompt_service.py
services/api/app/services/prompt_service.py
services/api/app/schemas/prompt.py
services/api/app/api/prompts.py
services/api/app/services/bundle_service.py
apps/web/src/lib/coder-prompts.ts
apps/web/src/lib/constants.ts
apps/web/src/types/coder.ts
apps/web/src/components/builder/AiCoderSegment.tsx
apps/web/src/components/builder/PromptCopyPanel.tsx
apps/web/src/components/builder/SendToCoderPanel.tsx
apps/web/src/components/builder/BundleResult.tsx
apps/web/src/components/builder/BundleFileTree.tsx
packages/contracts/schemas/prompt-pack.schema.json
packages/contracts/examples/prompt-pack.json
services/api/tests/test_ai_coder_prompts_batch6.py
```

## Validation

```text
make openapi  passed
make lint     passed
make test     39 tests passed
```

## Exit criteria

```text
User can copy a controlled prompt for each AI coder. passed
The AI coder receives a contract, not a vague prompt. passed
```
