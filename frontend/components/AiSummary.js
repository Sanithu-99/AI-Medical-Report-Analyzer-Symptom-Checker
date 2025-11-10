import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

const NORMAL_LABEL_PATTERN =
  "(?:Normal(?:\\s+(?:Range|Ranges|Limit|Limits|Value|Values))?|Reference(?:\\s+Range)?|Ref(?:erence)?\\s+(?:Range|Values?)|Ref\\.?\\s*Range|Ref\\.?\\s*Values?)";

const MEASUREMENT_REGEX = new RegExp(
  [
    "(?:^|[\\s\\n\\r•*\\-–—])(?:\\d+\\.\\s*)?",
    "([A-Z][A-Za-z0-9()/%+#]*(?:\\s+[A-Za-z0-9()/%+#]+)*)",
    "(?:\\s*[:\\-]\\s*|\\s+)",
    "([<>]?[0-9.,]+)",
    "(?:\\s*(x10\\^\\d+\\/\\w+|10\\^\\d+\\/\\w+|[A-Za-z/%()]+))?",
    "(?:\\s+(?:is\\s+)?)?",
    "(?:[A-Za-z]+\\s+)?",
    NORMAL_LABEL_PATTERN,
    "(?:\\s*(?:[:;\\-–—(]\\s*)|\\s+)",
    "([<>]?[0-9.,]+(?:\\s*(?:[–-]\\s*|to\\s+)[0-9.,]+)?(?:\\s*(?:x10\\^\\d+\\/\\w+|10\\^\\d+\\/\\w+|[A-Za-z/%()]+))?)"
  ].join(""),
  "gi"
);

const CLEAN_TOKENS = new Set(["Result", "Trends", "Component", "Table", "of", "(Table", "Date", "Birth", "Normal", "Range"]);

const STATUS_TOKENS = new Set(["High", "Low", "Critical", "Elevated", "Reduced", "Above", "Below"]);

const UNIT_PATTERN =
  /^(?:K\/CMM|M\/CMM|KICMM|MCMM|G\/DL|MG\/DL|g\/dL|mg\/dL|FL|PG|K\/UL|M\/UL|10\^\d+\/\w+|\/100WBCS|cells\/uL)$/i;

const MONTH_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i;

const STATUS_STYLES = {
  high: "border-rose-200 bg-rose-50 text-rose-600",
  low: "border-amber-200 bg-amber-50 text-amber-600",
  critical: "border-rose-400 bg-rose-100 text-rose-700",
  elevated: "border-amber-200 bg-amber-50 text-amber-600",
  reduced: "border-amber-200 bg-amber-50 text-amber-600",
  above: "border-rose-200 bg-rose-50 text-rose-600",
  below: "border-amber-200 bg-amber-50 text-amber-600",
};

const normalizeToken = (token) => token.replace(/[(),]/g, "");

const cleanLabelAndStatus = (rawLabel, rawRange) => {
  const labelTokens = rawLabel.trim().split(/\s+/);
  let status = "";

  while (labelTokens.length) {
    const normalized = normalizeToken(labelTokens[0]);
    if (
      CLEAN_TOKENS.has(normalized) ||
      MONTH_PATTERN.test(normalized) ||
      /^\d{1,2}$/.test(normalized) ||
      /^\d{4}$/.test(normalized) ||
      UNIT_PATTERN.test(normalized) ||
      (/^[A-Z]{3,5}S$/.test(normalized) && labelTokens.length > 1)
    ) {
      labelTokens.shift();
      continue;
    }
    break;
  }

  while (labelTokens.length) {
    const normalized = normalizeToken(labelTokens[0]);
    if (STATUS_TOKENS.has(normalized)) {
      status = normalized;
      labelTokens.shift();
    } else {
      break;
    }
  }

  while (labelTokens.length) {
    const normalized = normalizeToken(labelTokens[labelTokens.length - 1]);
    if (STATUS_TOKENS.has(normalized)) {
      status = status || normalized;
      labelTokens.pop();
      continue;
    }
    if (!normalized) {
      labelTokens.pop();
      continue;
    }
    break;
  }

  const cleanRangeString = (rawRange || "").replace(/[()]/g, " ").trim();
  const rangeTokens = cleanRangeString.split(/\s+/);
  if (!status && rangeTokens.length) {
    const endToken = normalizeToken(rangeTokens[rangeTokens.length - 1]);
    if (STATUS_TOKENS.has(endToken)) {
      status = endToken;
      rangeTokens.pop();
    }
  }

  const cleanRange = rangeTokens.join(" ").trim();
  return {
    label: labelTokens.join(" ").trim(),
    status,
    cleanRange,
  };
};

const parseAiSummary = (summary) => {
  const trimmed = summary?.trim();
  if (!trimmed) {
    return { paragraphs: [], metrics: [] };
  }

  const metrics = [];
  const narrativeSegments = [];
  let lastIndex = 0;
  const normalized = trimmed.replace(/\r/g, "\n");
  const sanitizedForMetrics = normalized.replace(/[•●◦▪▫·]/g, " ");
  const regex = new RegExp(MEASUREMENT_REGEX);

  for (const match of sanitizedForMetrics.matchAll(regex)) {
    const [fullMatch, rawLabel, value, unit1, rawRange] = match;
    const start = match.index ?? 0;

    if (start > lastIndex) {
      const chunk = normalized.slice(lastIndex, start).trim();
      if (chunk) {
        narrativeSegments.push(chunk);
      }
    }

    lastIndex = start + fullMatch.length;

    const { label, status, cleanRange } = cleanLabelAndStatus(rawLabel, rawRange);
    if (!label) continue;

    metrics.push({
      label,
      value: `${value}${unit1 ? ` ${unit1}` : ""}`,
      range: cleanRange,
      status,
    });
  }

  const tail = normalized.slice(lastIndex).trim();
  if (tail) {
    narrativeSegments.push(tail);
  }

  let paragraphs = [];

  narrativeSegments.forEach((segment) => {
    const blocks = segment.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    if (blocks.length === 0) return;
    if (blocks.length === 1) {
      const sentences = blocks[0].match(/[^.!?]+[.!?]?/g);
      if (sentences && sentences.length > 1) {
        sentences.forEach((sentence) => {
          const trimmedSentence = sentence.trim();
          if (trimmedSentence) {
            paragraphs.push(trimmedSentence);
          }
        });
        return;
      }
    }
    paragraphs.push(...blocks);
  });

  if (metrics.length === 0 && paragraphs.length === 0) {
    const fallbackBlocks = trimmed.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    if (fallbackBlocks.length > 0) {
      paragraphs = fallbackBlocks;
    } else {
      const sentences = trimmed.match(/[^.!?]+[.!?]?/g);
      if (sentences) {
        paragraphs = sentences.map((sentence) => sentence.trim()).filter(Boolean);
      } else {
        paragraphs = [trimmed];
      }
    }
  }

  return { paragraphs, metrics };
};

const statusClasses = (status) => {
  if (!status) return "border-white/60 bg-white text-ocean/70";
  const key = status.toLowerCase();
  return STATUS_STYLES[key] ?? "border-teal/30 bg-teal/10 text-teal";
};

const formatStatusLabel = (status) => {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

export default function AiSummary({
  summary,
  expanded,
  onExpansionChange,
  previewLimit = 5,
}) {
  const { paragraphs, metrics } = useMemo(() => parseAiSummary(summary), [summary]);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isControlled = typeof expanded === "boolean";
  const isExpanded = isControlled ? expanded : internalExpanded;
  const hasOverflow = paragraphs.length > previewLimit;
  const displayedParagraphs =
    !hasOverflow || isExpanded ? paragraphs : paragraphs.slice(0, previewLimit);

  useEffect(() => {
    if (!isControlled) {
      setInternalExpanded(false);
    }
  }, [summary, isControlled]);

  if (!summary) {
    return <p className="text-sm text-ocean/60">The AI narrative will appear once analysis is complete.</p>;
  }

  const handleToggle = () => {
    const next = !isExpanded;
    if (!isControlled) {
      setInternalExpanded(next);
    }
    onExpansionChange?.(next);
  };

  return (
    <div className="space-y-8 text-sm leading-relaxed text-ocean/80">
      {metrics.length > 0 && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={`${metric.label}-${metric.value}`}
                className="group relative overflow-hidden rounded-[26px] border border-white/70 bg-white/95 p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full bg-gradient-to-r from-teal/30 via-white/70 to-transparent" />
                <div className="relative flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-ocean/80">{metric.label}</p>
                    {metric.status && (
                      <span
                        className={clsx(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
                          statusClasses(metric.status)
                        )}
                      >
                        {formatStatusLabel(metric.status)}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-semibold tracking-tight text-ocean">{metric.value}</p>
                  <p className="text-xs text-ocean/60">
                    <span className="font-medium text-ocean/75">Normal:&nbsp;</span>
                    {metric.range || "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {paragraphs.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ocean/50">AI Narrative</p>
            {hasOverflow && (
              <button
                type="button"
                onClick={handleToggle}
                className="hidden items-center gap-2 rounded-full border border-teal/40 bg-teal/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-teal transition hover:bg-teal/10 sm:inline-flex"
              >
                {isExpanded ? "Show less" : "Show full summary"}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {displayedParagraphs.map((paragraph, index) => (
              <div
                key={`${paragraph.slice(0, 32)}-${index}`}
                className="rounded-[26px] border border-white/70 bg-white/95 p-5 text-base text-ocean/80 shadow-soft"
              >
                {paragraph}
              </div>
            ))}
          </div>

          {hasOverflow && (
            <button
              type="button"
              onClick={handleToggle}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-teal/40 bg-teal/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-teal transition hover:bg-teal/10 sm:hidden"
            >
              {isExpanded ? "Show less" : "Show full summary"}
            </button>
          )}
        </section>
      )}

      {paragraphs.length === 0 && metrics.length === 0 && (
        <p className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 text-ocean/70">
          The AI narrative could not be formatted. Original output:
          <span className="block pt-2 text-ocean">{summary}</span>
        </p>
      )}
    </div>
  );
}
