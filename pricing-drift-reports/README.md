# Pricing Drift Reports

Weekly output of the pricing-drift watch routine (`trig_0113xK23HSeSpB46ySDYJtBF`, Mon 9am ET). Each report at `YYYY-MM-DD.md` spot-checks 10 tiers from `PRICING_TIERS.md` against Depop/eBay/Poshmark sold comps (or Chairish/1stDibs/Etsy for furniture rows) and flags any tier whose comp median has drifted out of its current band in `services/gemini.ts`.

The routine does NOT modify `services/gemini.ts`. Apply band edits manually after reviewing the report.

## Report template

The routine fills this template verbatim each Monday.

```markdown
# Pricing Drift Report, YYYY-MM-DD

**Tiers checked:** 10 (6 HOT + 3 WARM + 1 COOL)
**ISO week:** N
**Registry SHA:** <PRICING_TIERS.md commit at run time>
**gemini.ts SHA:** <services/gemini.ts commit at run time>

## Summary

| Metric | Value |
| --- | --- |
| Checked | 10 |
| In-band | X |
| Drifted low | Y |
| Drifted high | Z |
| Mixed | W |

## Per-tier results

### [HOT] Tier name (id 001)

| Field | Value |
| --- | --- |
| Current band | $X-$Y |
| Depop sold (last 90d) | $A-$B, n=N |
| Poshmark sold (last 90d) | $A-$B, n=N |
| eBay sold (last 90d) | $A-$B, n=N |
| Weighted verdict (eBay 2x) | in-band / drifted low / drifted high / mixed |
| Suggested new band | $X'-$Y' or n/a |
| Notes | one line |

(repeat per tier, prefix with [HOT] / [WARM] / [COOL] in the section header)

## Code-clamp rows (if any in this week's slice)

Narrative sanity-check format (substitutes per-platform rows when category = code_clamp):

> **Current clamp:** $X cap (or routing rule text).
> **Recent comps:** Depop [clamp's target item] sold comps last 90d cluster $Y-$Z, n=N.
> **Verdict:** clamp still appropriate / too tight / too loose.
> **Suggested adjustment:** raise cap to $X' / lower cap to $X' / no change.

## Next week preview

ISO week N+1 will check:
- [HOT] tier name (id), tier name (id), tier name (id), tier name (id), tier name (id), tier name (id)
- [WARM] tier name (id), tier name (id), tier name (id)
- [COOL] tier name (id)

(Computed by re-running the rotation rule with WEEK_INDEX+1 against the current registry.)

## Footer

- Registry commit: <PRICING_TIERS.md SHA>
- gemini.ts commit: <services/gemini.ts SHA>
- Queries fired at: <ISO timestamp>
- Trigger id: trig_0113xK23HSeSpB46ySDYJtBF
```

## Verdict thresholds

The routine applies these rules to compute each tier's verdict:

- **in-band**, weighted median sits inside the current band AND no platform's median is outside the band by more than 15%.
- **drifted low**, weighted median is at least 15% below band low, OR at least 2 platforms have medians below the band.
- **drifted high**, weighted median is at least 15% above band high, OR at least 2 platforms have medians above the band.
- **mixed**, platforms disagree (one high, one low), OR sample size n is less than 5 on 2 or more platforms.

## Weighting

eBay sold counts are weighted 2x toward consensus. Depop 1x, Poshmark 1x. This matches the existing CLAUDE.md trust convention (eBay has the deepest sold-comp data and most-reliable filtering).

## Suggested-new-band calculation

Populated only when verdict is NOT `in-band`. Otherwise `n/a`.

- **Lower bound**, floor of cheapest 25th-percentile across the three platforms.
- **Upper bound**, ceiling of richest 75th-percentile across the three platforms with eBay 2x-weighted.
- **Rounding**, per `roundDisplayPrice` in `utils/currency.ts`:
  - Under $200 → nearest $5
  - $200-$499 → nearest $10
  - $500-$999 → nearest $25
  - $1000 and up → nearest $50

## Constraints on the routine

- Do NOT modify `services/gemini.ts`.
- Do NOT modify `PRICING_TIERS.md` or this `README.md`.
- Only file change is the new report at `pricing-drift-reports/YYYY-MM-DD.md`.
- No em dashes anywhere (en dashes in numeric ranges like `$30-$70` are fine).
- If WebFetch fails on the registry, abort and open an issue titled `Pricing drift routine, registry fetch failed YYYY-MM-DD` with the error text.

## Failure mode

The routine opens a tracking issue (not a malformed PR) when the registry fetch fails. Investigate only when multiple consecutive weeks fail, which would indicate the raw URL or repo permissions changed.
