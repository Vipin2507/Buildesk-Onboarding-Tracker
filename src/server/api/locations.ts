import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireUser } from "@/server/auth/session";
import {
  fetchCscCities,
  fetchCscCountries,
  fetchCscStates,
} from "@/server/lib/csc-api";

export const listCscCountries = createServerFn({ method: "GET" }).handler(async () => {
  requireUser();
  return fetchCscCountries();
});

export const listCscStates = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ countryCode: z.string().min(2).max(3) }).parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    return fetchCscStates(data.countryCode);
  });

export const listCscCities = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        countryCode: z.string().min(2).max(3),
        stateCode: z.string().min(1).max(8),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    requireUser();
    return fetchCscCities(data.countryCode, data.stateCode);
  });
