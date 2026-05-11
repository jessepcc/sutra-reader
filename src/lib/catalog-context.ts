// Statically-loaded, gated-filtered catalog. Bundled at build time.

import catalogJson from "../data/catalog.json";
import gaijiJson from "../data/gaiji.json";
import { filterGated } from "./catalog";
import type { Catalog } from "./types";

export const CATALOG: Catalog = filterGated(catalogJson as Catalog);

export const GAIJI: Record<string, string> = gaijiJson as Record<string, string>;
