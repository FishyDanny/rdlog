import { createApi } from "./app";
import { createD1RdlogStore } from "./d1-store";

interface Bindings {
  DB: D1Database;
  SESSION_SIGNING_SECRET: string;
  WEB_ORIGIN: string;
}

export default {
  async fetch(request: Request, environment: Bindings): Promise<Response> {
    return createApi({
      makeId: () => crypto.randomUUID(),
      now: () => new Date(),
      sessionSecret: environment.SESSION_SIGNING_SECRET,
      store: createD1RdlogStore(environment.DB),
      webOrigin: environment.WEB_ORIGIN,
    }).fetch(request, environment);
  },
};
