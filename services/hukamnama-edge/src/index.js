// Cloudflare Worker entry: all logic is in core.js so it runs under plain Node in the tests.
import { handle } from "./core.js";

export default {
  fetch(request, env) {
    return handle(request, env, new Date());
  },
};
