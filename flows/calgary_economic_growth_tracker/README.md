# Calgary Economic Growth Tracker

This flow combines Calgary open data sources to identify areas with strong business activity but weaker housing support.

## Sources

- `calgary_business_licenses` - Open Calgary business licenses feed filtered to tech and service-oriented licence types
- `building_permits` - Open Calgary building permits feed with issued-date and community-level permit activity
- `calgary_community_golden_mapping` - governed community mapping derived from the official City of Calgary Community Boundaries dataset
- `calgary_employment_by_community` - 2021 Federal Census Employment by Community for unemployment baseline
- `calgary_residential_growth_forecast` - Suburban Residential Growth forecast by planning sector and year

## Modeling approach

- Business momentum is measured from new licenses issued per year.
- `refined_business_momentum` measures current 60-day license issuance against a trailing 5-year community average and limits output to communities present in `building_permits`.
- `calgary_growth_priority_zones` compares job momentum against residential building permit supply and flags communities where demand is high but housing delivery lags.
- Quadrant governance is handled in-pipeline through `calgary_community_golden_mapping`, sourced from the official City of Calgary Community Boundaries dataset rather than frontend logic.
- Any community still missing an official quadrant is surfaced as `MAPPING_REQUIRED` for remediation.
- Labour resilience uses community unemployment rate.
- Housing support uses sector-level residential unit forecast as a proxy for housing pipeline.
- Communities are mapped into Calgary quadrants via the governed golden mapping table.

## Outputs

- `refined_business_momentum` - community-level momentum feed with `community_name`, `license_count`, and `momentum_score`
- `calgary_growth_priority_zones` - strategic gap alert summary with `residential_units_count`, demand-to-supply ratio, `alert_level`, and `growth_alert_flag`
- `calgary_growth_signals` - joined SQL model with flags for business-heavy and housing-light areas
- `calgary_quadrant_resilience` - SQL model with a resilience score per community, governed quadrant mapping, quadrant color hex code, rounded numeric fields for frontend delivery, and descending score sort order
