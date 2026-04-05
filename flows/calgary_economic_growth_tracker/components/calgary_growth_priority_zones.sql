WITH housing_supply AS (
    SELECT
        UPPER(community_name) AS community_name,
        SUM(COALESCE(housingunits, 0)) AS residential_units_count
    FROM {{ ref('building_permits') }}
    WHERE community_name IS NOT NULL
        AND permit_class_mapped = 'Residential'
    GROUP BY
        UPPER(community_name)
),
community_gap AS (
    SELECT
        momentum.community_name,
        momentum.license_count,
        momentum.momentum_score,
        COALESCE(housing_supply.residential_units_count, 0) AS residential_units_count,
        PERCENT_RANK() OVER (ORDER BY momentum.momentum_score) AS momentum_percent_rank,
        PERCENT_RANK() OVER (ORDER BY COALESCE(housing_supply.residential_units_count, 0)) AS housing_supply_percent_rank,
        CAST(momentum.momentum_score AS FLOAT) / NULLIF(CAST(COALESCE(housing_supply.residential_units_count, 0) AS FLOAT), 0) AS demand_supply_ratio
    FROM {{ ref('refined_business_momentum') }} momentum
    LEFT JOIN housing_supply
        ON momentum.community_name = housing_supply.community_name
),
scored AS (
    SELECT
        community_name,
        license_count,
        momentum_score,
        residential_units_count,
        momentum_percent_rank,
        housing_supply_percent_rank,
        COALESCE(demand_supply_ratio, CAST(momentum_score AS FLOAT)) AS demand_supply_ratio,
        CASE
            WHEN momentum_percent_rank >= 0.8
                AND housing_supply_percent_rank <= 0.4
                AND COALESCE(demand_supply_ratio, CAST(momentum_score AS FLOAT)) >= 1.5 THEN 'High'
            WHEN momentum_percent_rank >= 0.8
                AND housing_supply_percent_rank <= 0.4 THEN 'Medium'
            ELSE 'Low'
        END AS alert_level,
        CASE
            WHEN momentum_percent_rank >= 0.8
                AND housing_supply_percent_rank <= 0.4 THEN 1
            ELSE 0
        END AS growth_alert_flag
    FROM community_gap
)
SELECT
    community_name,
    license_count,
    momentum_score,
    residential_units_count,
    demand_supply_ratio,
    alert_level,
    growth_alert_flag
FROM scored

{{ with_test("count_greater_than", count=0) }}
{{ with_test("not_null", column="community_name") }}
{{ with_test("not_null", column="residential_units_count") }}
{{ with_test("not_null", column="alert_level") }}
