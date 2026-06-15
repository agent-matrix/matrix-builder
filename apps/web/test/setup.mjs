// Register the `@/` alias resolver for `node --test`. Used via `node --import ./test/setup.mjs`.
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
