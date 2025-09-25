import type { RouterTypes } from "bun";
import { blobRoutes } from "./blob.ts";
import { listRoutes } from "./list.ts";
import { uploadRoutes } from "./upload.ts";

const routes: Record<
  string,
  RouterTypes.RouteHandler<any> | RouterTypes.RouteHandlerObject<any>
> = {
  ...uploadRoutes,
  ...listRoutes,
  ...blobRoutes,
};

export default routes;
