WITH growth_signals AS (
    SELECT
        community_name,
        year,
        new_business_licenses,
        unique_businesses,
        unemployment_rate_per,
        employed,
        unemployed,
        in_labour_force,
        baseline_year,
        forecast_housing_units,
        forecast_population_growth,
        business_to_housing_ratio,
        high_business_low_housing_flag
    FROM {{ ref('calgary_growth_signals') }}
),
golden_mapping AS (
    SELECT
        community_name,
        quadrant,
        mapping_status,
        official_sector,
        community_code,
        community_class,
        mapping_source
    FROM {{ ref('calgary_community_golden_mapping') }}
),
scored AS (
    SELECT
        growth_signals.community_name,
        COALESCE(golden_mapping.quadrant, 'MAPPING_REQUIRED') AS quadrant,
        CASE
            WHEN golden_mapping.quadrant IS NULL THEN 'MAPPING_REQUIRED'
            ELSE COALESCE(golden_mapping.mapping_status, 'APPROVED')
        END AS quadrant_mapping_status,
        CASE
            WHEN COALESCE(golden_mapping.quadrant, 'MAPPING_REQUIRED') = 'NW' THEN '#3b82f6'
            WHEN COALESCE(golden_mapping.quadrant, 'MAPPING_REQUIRED') = 'NE' THEN '#14b8a6'
            WHEN COALESCE(golden_mapping.quadrant, 'MAPPING_REQUIRED') = 'SE' THEN '#ef4444'
            WHEN COALESCE(golden_mapping.quadrant, 'MAPPING_REQUIRED') = 'SW' THEN '#8b5cf6'
            ELSE '#6b7280'
        END AS quadrant_color_hex,
        golden_mapping.official_sector,
        golden_mapping.community_code,
        golden_mapping.community_class,
        golden_mapping.mapping_source,
        growth_signals.year,
        growth_signals.new_business_licenses,
        growth_signals.unique_businesses,
        growth_signals.unemployment_rate_per,
        growth_signals.employed,
        growth_signals.unemployed,
        growth_signals.in_labour_force,
        growth_signals.baseline_year,
        growth_signals.forecast_housing_units,
        growth_signals.forecast_population_growth,
        growth_signals.business_to_housing_ratio,
        growth_signals.high_business_low_housing_flag,
        (
            CAST(growth_signals.new_business_licenses AS FLOAT) * 1.8
            + COALESCE(CAST(growth_signals.forecast_housing_units AS FLOAT), 0) / 40.0
            - COALESCE(CAST(growth_signals.unemployment_rate_per AS FLOAT), 12) * 4.0
            - COALESCE(CAST(growth_signals.business_to_housing_ratio AS FLOAT), 0) * 25.0
        ) AS resilience_score,
        CASE
            WHEN growth_signals.year = 2026
                AND growth_signals.high_business_low_housing_flag = 1 THEN 'Growth node'
            ELSE 'Monitor'
        END AS growth_node_label
    FROM growth_signals
    LEFT JOIN golden_mapping
        ON growth_signals.community_name = golden_mapping.community_name
)
SELECT
    community_name,
    quadrant,
    quadrant_mapping_status,
    quadrant_color_hex,
    official_sector,
    community_code,
    community_class,
    mapping_source,
    year,
    ROUND(CAST(new_business_licenses AS FLOAT), 2) AS new_business_licenses,
    ROUND(CAST(unique_businesses AS FLOAT), 2) AS unique_businesses,
    ROUND(CAST(unemployment_rate_per AS FLOAT), 2) AS unemployment_rate_per,
    ROUND(CAST(employed AS FLOAT), 2) AS employed,
    ROUND(CAST(unemployed AS FLOAT), 2) AS unemployed,
    ROUND(CAST(in_labour_force AS FLOAT), 2) AS in_labour_force,
    baseline_year,
    ROUND(CAST(forecast_housing_units AS FLOAT), 2) AS forecast_housing_units,
    ROUND(CAST(forecast_population_growth AS FLOAT), 2) AS forecast_population_growth,
    ROUND(CAST(business_to_housing_ratio AS FLOAT), 2) AS business_to_housing_ratio,
    high_business_low_housing_flag,
    ROUND(CAST(resilience_score AS FLOAT), 2) AS resilience_score,
    growth_node_label
FROM scored
ORDER BY resilience_score DESC, community_name ASC

{{ with_test("count_greater_than", count=0) }}
{{ with_test("not_null", column="community_name") }}
{{ with_test("not_null", column="quadrant") }}
{{ with_test("not_null", column="quadrant_mapping_status") }}
