import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  GraduationCap,
  MessageCircle,
  PlusCircle,
  Search,
} from "lucide-react";

import {
  DesignTicketPageHeader,
  PortalPageWrap,
  ticketPageVariants,
  ticketSectionVariants,
} from "@/components/design-ticket/design-ticket-shared";
import { AcademyTutorialCard } from "@/components/portal/academy/academy-tutorial-card";
import { AcademyTutorialCardSkeleton } from "@/components/portal/academy/academy-tutorial-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACADEMY_CATEGORY_ORDER } from "@/data/buildesk-academy-tutorials";
import { listPortalAcademyTutorials } from "@/lib/api";
import {
  filterAcademyTutorials,
  getAcademyFeatured,
  listAcademyCategories,
  listAcademyTutorials,
  loadAcademyProgress,
  resolveTutorialThumbnail,
} from "@/lib/buildesk-academy";
import { cn } from "@/lib/utils";
import type { AcademyTutorial } from "@/types/buildesk-academy";

export function AcademyLibraryPage({ slug }: { slug: string }) {
  const [tutorials, setTutorials] = useState<AcademyTutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const progressMap = useMemo(() => loadAcademyProgress(slug), [slug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void listPortalAcademyTutorials()
      .then((rows) => {
        if (!cancelled) setTutorials(listAcademyTutorials(rows));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tutorials");
          setTutorials([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const present = new Set(listAcademyCategories(tutorials));
    const ordered = ACADEMY_CATEGORY_ORDER.filter((c) => present.has(c));
    const extras = [...present].filter(
      (c) => !ordered.includes(c as (typeof ACADEMY_CATEGORY_ORDER)[number]),
    );
    return [...ordered, ...extras.sort()];
  }, [tutorials]);

  const filtered = useMemo(
    () => filterAcademyTutorials(tutorials, { query, category }),
    [tutorials, query, category],
  );

  const featured =
    category === "all" && !query.trim() ? getAcademyFeatured(filtered.length ? filtered : tutorials) : undefined;
  const gridTutorials = featured
    ? filtered.filter((t) => t.id !== featured.id)
    : filtered;
  const featuredThumb = featured ? resolveTutorialThumbnail(featured) : "";

  return (
    <PortalPageWrap>
      <motion.div
        variants={ticketPageVariants}
        initial="hidden"
        animate="show"
        className="space-y-5"
      >
        <motion.div variants={ticketSectionVariants}>
          <DesignTicketPageHeader title="Buildesk Academy" />
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Learn how to get the most out of Buildesk CRM. Explore step-by-step tutorials,
            product guides, and helpful walkthroughs.
          </p>
        </motion.div>

        <motion.div variants={ticketSectionVariants} className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tutorials…"
              aria-label="Search tutorials"
              className="h-10 rounded-xl border-border/80 bg-card pl-9 text-sm shadow-sm"
            />
          </div>

          <div
            className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Tutorial categories"
          >
            <CategoryChip
              label="All"
              active={category === "all"}
              onClick={() => setCategory("all")}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c}
                label={c}
                active={category === c}
                onClick={() => setCategory(c)}
              />
            ))}
          </div>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <AcademyTutorialCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-dashed px-4 py-8 text-center">
            <p className="text-sm font-medium">Unable to load tutorials</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            <Button
              type="button"
              size="sm"
              className="mt-3 h-8"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            {featured ? (
              <motion.section
                variants={ticketSectionVariants}
                className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
                aria-labelledby="academy-featured-heading"
              >
                <div className="grid gap-0 md:grid-cols-[1.15fr_1fr]">
                  <div className="relative aspect-video bg-muted md:aspect-auto md:min-h-[220px]">
                    {featuredThumb ? (
                      <img
                        src={featuredThumb}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/55 via-black/15 to-amber-500/10" />
                    <div className="absolute left-3 top-3 rounded-md bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                      Featured
                    </div>
                  </div>
                  <div className="flex flex-col justify-center gap-3 p-4 sm:p-5">
                    <div>
                      <p
                        id="academy-featured-heading"
                        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Featured tutorial
                      </p>
                      <h2 className="mt-1 text-lg font-semibold leading-snug text-foreground sm:text-xl">
                        {featured.title}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {featured.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                        {featured.category}
                      </span>
                      <span className="tabular-nums">{featured.duration}</span>
                    </div>
                    <Button asChild className="h-9 w-fit gap-1.5 rounded-lg">
                      <Link
                        to="/portal/$slug/academy/$tutorialId"
                        params={{ slug, tutorialId: featured.id }}
                      >
                        Watch tutorial
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.section>
            ) : null}

            <motion.section variants={ticketSectionVariants} className="space-y-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="text-sm font-semibold text-foreground">Explore tutorials</h2>
                <span className="text-xs text-muted-foreground">
                  {filtered.length} {filtered.length === 1 ? "result" : "results"}
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                  <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-3 text-sm font-medium text-foreground">No tutorials found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try searching for another topic or clear the category filter.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 h-8"
                    onClick={() => {
                      setQuery("");
                      setCategory("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(featured ? gridTutorials : filtered).map((t) => (
                    <AcademyTutorialCard
                      key={t.id}
                      tutorial={t}
                      slug={slug}
                      progressMap={progressMap}
                    />
                  ))}
                </div>
              )}
            </motion.section>
          </>
        )}

        <motion.section
          variants={ticketSectionVariants}
          className="rounded-xl border border-border/80 bg-muted/20 p-4"
        >
          <h2 className="text-sm font-semibold text-foreground">Need help?</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Can&apos;t find what you&apos;re looking for? Reach your Buildesk team from the portal.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <Link to="/portal/$slug/create-ticket" params={{ slug }}>
                <PlusCircle className="h-3.5 w-3.5" />
                Raise a ticket
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
              <Link to="/portal/$slug/book" params={{ slug }}>
                <Calendar className="h-3.5 w-3.5" />
                Book a call
              </Link>
            </Button>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              Or use live chat to ask an executive
            </p>
          </div>
        </motion.section>
      </motion.div>
    </PortalPageWrap>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border/80 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
