declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): { [key: string]: string };
  }
  export const env: Env;

  export interface ServeOptions {
    port?: number;
    hostname?: number;
    handler?: (request: Request) => Response | Promise<Response>;
  }

  export function serve(handler: (request: Request) => Response | Promise<Response>): void;
  export function serve(options: ServeOptions, handler: (request: Request) => Response | Promise<Response>): void;
}

declare module "supabase" {
  export * from "https://esm.sh/@supabase/supabase-js@2.39.7";
}

declare module "zod" {
  import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
  export { z };
  export * from "https://deno.land/x/zod@v3.22.4/mod.ts";
}
