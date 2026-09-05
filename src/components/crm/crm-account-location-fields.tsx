import type { ReactElement, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import type { CrmAccountFormValues } from "@/components/crm/crm-account-form";
import {
  DesignTicketSearchableSelect,
  DesignTicketSelect,
} from "@/components/design-ticket/design-ticket-fields";
import {
  ACCOUNT_COUNTRIES,
  citiesForState,
  INDIA_STATES,
  regionForState,
} from "@/data/india-locations";
import { listCscCities, listCscCountries, listCscStates } from "@/lib/api";
import type { CompanyRegion } from "@/types/company";

type CscCountry = { iso2: string; name: string };
type CscState = { iso2: string; name: string };

type Props = {
  form: UseFormReturn<CrmAccountFormValues>;
  fieldClass: (hasError?: boolean, readOnly?: boolean) => string;
  Label: (props: { children: ReactNode; required?: boolean }) => ReactElement;
  FieldError: (props: { message?: string }) => ReactElement | null;
};

function matchByName<T extends { name: string }>(rows: T[], value: string | undefined) {
  const needle = value?.trim().toLowerCase();
  if (!needle) return undefined;
  return rows.find((row) => row.name.toLowerCase() === needle);
}

export function CrmAccountLocationFields({ form, fieldClass, Label, FieldError }: Props) {
  const errors = form.formState.errors;
  const country = form.watch("country");
  const state = form.watch("state");
  const city = form.watch("city");

  const [useFallback, setUseFallback] = useState(false);
  const [countries, setCountries] = useState<CscCountry[]>([]);
  const [states, setStates] = useState<CscState[]>([]);
  const [cities, setCities] = useState<{ name: string }[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const initRef = useRef(false);

  const setOpts = { shouldValidate: true, shouldDirty: true } as const;

  useEffect(() => {
    let cancelled = false;
    setLoadingCountries(true);
    void listCscCountries()
      .then((rows) => {
        if (cancelled) return;
        setCountries(rows);
        setUseFallback(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setUseFallback(true);
        toast.error(
          err instanceof Error ? err.message : "Could not load countries. Using India defaults.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingCountries(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (useFallback || !countries.length || initRef.current) return;

    const matchedCountry = matchByName(countries, country);
    if (matchedCountry) {
      setCountryCode(matchedCountry.iso2);
      initRef.current = true;
      return;
    }

    const india = countries.find((row) => row.iso2 === "IN");
    if (india && !country?.trim()) {
      form.setValue("country", india.name, setOpts);
      setCountryCode(india.iso2);
    }
    initRef.current = true;
  }, [countries, country, form, useFallback]);

  useEffect(() => {
    if (useFallback || !countryCode) {
      setStates([]);
      setStateCode("");
      return;
    }

    let cancelled = false;
    setLoadingStates(true);
    void listCscStates({ data: { countryCode } })
      .then((rows) => {
        if (cancelled) return;
        setStates(rows);
        const matched = matchByName(rows, state);
        setStateCode(matched?.iso2 ?? "");
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Could not load states");
        setStates([]);
        setStateCode("");
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false);
      });

    return () => {
      cancelled = true;
    };
  }, [countryCode, state, useFallback]);

  useEffect(() => {
    if (useFallback || !countryCode || !stateCode) {
      setCities([]);
      return;
    }

    let cancelled = false;
    setLoadingCities(true);
    void listCscCities({ data: { countryCode, stateCode } })
      .then((rows) => {
        if (cancelled) return;
        setCities(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : "Could not load cities");
        setCities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [countryCode, stateCode, useFallback]);

  useEffect(() => {
    const nextRegion: CompanyRegion =
      country?.trim().toLowerCase() === "india" && state?.trim()
        ? regionForState(state)
        : "Rest of India";
    if (form.getValues("region") !== nextRegion) {
      form.setValue("region", nextRegion, setOpts);
    }
  }, [country, state, form]);

  const countryOptions = useMemo(() => {
    if (useFallback) {
      return ACCOUNT_COUNTRIES.map((name) => ({ value: name, label: name }));
    }
    return countries.map((row) => ({ value: row.iso2, label: row.name }));
  }, [countries, useFallback]);

  const stateOptions = useMemo(() => {
    if (useFallback) {
      const list = state && !INDIA_STATES.includes(state) ? [state, ...INDIA_STATES] : INDIA_STATES;
      return list.map((name) => ({ value: name, label: name }));
    }
    return states.map((row) => ({ value: row.iso2, label: row.name }));
  }, [state, states, useFallback]);

  const cityOptions = useMemo(() => {
    const names = useFallback ? citiesForState(state) : cities.map((row) => row.name);
    const unique = [...new Set(names)];
    if (city?.trim() && !unique.some((name) => name.toLowerCase() === city.trim().toLowerCase())) {
      unique.unshift(city.trim());
    }
    return unique.map((name) => ({ value: name, label: name }));
  }, [cities, city, state, useFallback]);

  function onCountryChange(value: string) {
    if (useFallback) {
      form.setValue("country", value, setOpts);
      form.setValue("state", "", setOpts);
      form.setValue("city", "", setOpts);
      setCountryCode("");
      setStateCode("");
      return;
    }

    const matched = countries.find((row) => row.iso2 === value);
    if (!matched) return;
    setCountryCode(matched.iso2);
    setStateCode("");
    form.setValue("country", matched.name, setOpts);
    form.setValue("state", "", setOpts);
    form.setValue("city", "", setOpts);
  }

  function onStateChange(value: string) {
    if (useFallback) {
      form.setValue("state", value, setOpts);
      form.setValue("city", "", setOpts);
      setStateCode("");
      return;
    }

    const matched = states.find((row) => row.iso2 === value);
    if (!matched) return;
    setStateCode(matched.iso2);
    form.setValue("state", matched.name, setOpts);
    form.setValue("city", "", setOpts);
  }

  function onCityChange(value: string) {
    form.setValue("city", value, setOpts);
  }

  const countryValue = useFallback
    ? country
    : countries.find((row) => row.name === country)?.iso2 ?? countryCode;
  const stateValue = useFallback
    ? state
    : states.find((row) => row.name === state)?.iso2 ?? stateCode;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <Label required>Country</Label>
        <DesignTicketSelect
          value={countryValue}
          onChange={onCountryChange}
          options={countryOptions}
          placeholder={loadingCountries ? "Loading countries…" : "Select country"}
          disabled={loadingCountries}
          className={fieldClass(!!errors.country)}
        />
        <FieldError message={errors.country?.message} />
      </div>
      <div>
        <Label required>State</Label>
        <DesignTicketSelect
          value={stateValue}
          onChange={onStateChange}
          options={stateOptions}
          placeholder={
            loadingStates ? "Loading states…" : countryValue ? "Select state" : "Select country first"
          }
          disabled={!countryValue || loadingStates}
          className={fieldClass(!!errors.state)}
        />
        <FieldError message={errors.state?.message} />
      </div>
      <div>
        <Label required>City</Label>
        <DesignTicketSearchableSelect
          value={city}
          onChange={onCityChange}
          options={cityOptions}
          placeholder={
            loadingCities ? "Loading cities…" : stateValue ? "Search city…" : "Select state first"
          }
          emptyLabel={loadingCities ? "Loading…" : "No cities found"}
          disabled={!stateValue || loadingCities}
        />
        <FieldError message={errors.city?.message} />
      </div>
      <div>
        <Label required>Region</Label>
        <input
          readOnly
          {...form.register("region")}
          className={fieldClass(!!errors.region, true)}
          tabIndex={-1}
        />
        <FieldError message={errors.region?.message} />
      </div>
    </div>
  );
}
