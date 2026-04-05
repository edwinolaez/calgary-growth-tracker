WITH business_counts AS (
    SELECT
        UPPER(community_name) AS community_name,
        license_year,
        COUNT(*) AS new_business_licenses,
        COUNT(DISTINCT business_license_id) AS unique_businesses
    FROM {{ ref('calgary_business_licenses') }}
    GROUP BY
        UPPER(community_name),
        license_year
),
employment AS (
    SELECT
        UPPER(community_name) AS community_name,
        unemployment_rate_per,
        employed,
        unemployed,
        in_labour_force,
        baseline_year
    FROM {{ ref('calgary_employment_by_community') }}
),
housing_by_quadrant AS (
    SELECT
        CASE
            WHEN sector IN ('NORTH', 'NORTHWEST') THEN 'NW'
            WHEN sector IN ('NORTHEAST', 'EAST') THEN 'NE'
            WHEN sector = 'WEST' THEN 'SW'
            WHEN sector IN ('SOUTH', 'SOUTHEAST') THEN 'SE'
            ELSE 'MAPPING_REQUIRED'
        END AS quadrant,
        year,
        SUM(ttl_units) AS forecast_housing_units,
        SUM(ttl_pop) AS forecast_population_growth
    FROM {{ ref('calgary_residential_growth_forecast') }}
    GROUP BY
        CASE
            WHEN sector IN ('NORTH', 'NORTHWEST') THEN 'NW'
            WHEN sector IN ('NORTHEAST', 'EAST') THEN 'NE'
            WHEN sector = 'WEST' THEN 'SW'
            WHEN sector IN ('SOUTH', 'SOUTHEAST') THEN 'SE'
            ELSE 'MAPPING_REQUIRED'
        END,
        year
),
community_quadrants AS (
    SELECT
        community_name,
        quadrant,
        mapping_status
    FROM {{ ref('calgary_community_golden_mapping') }}
),
scored AS (
    SELECT
        business_counts.community_name,
        COALESCE(community_quadrants.quadrant, 'MAPPING_REQUIRED') AS quadrant,
        CASE
            WHEN community_quadrants.quadrant IS NULL THEN 'MAPPING_REQUIRED'
            ELSE COALESCE(community_quadrants.mapping_status, 'APPROVED')
        END AS quadrant_mapping_status,
        business_counts.license_year AS year,
        business_counts.new_business_licenses,
        business_counts.unique_businesses,
        employment.unemployment_rate_per,
        employment.employed,
        employment.unemployed,
        employment.in_labour_force,
        employment.baseline_year,
        housing_by_quadrant.forecast_housing_units,
        housing_by_quadrant.forecast_population_growth,
        CAST(business_counts.new_business_licenses AS FLOAT)
            / NULLIF(housing_by_quadrant.forecast_housing_units, 0) AS business_to_housing_ratio,
        CASE
            WHEN business_counts.new_business_licenses >= 25
                AND COALESCE(housing_by_quadrant.forecast_housing_units, 0) < 1500 THEN 1
            ELSE 0
        END AS high_business_low_housing_flag
    FROM business_counts
    LEFT JOIN employment
        ON business_counts.community_name = employment.community_name
    LEFT JOIN community_quadrants
        ON business_counts.community_name = community_quadrants.community_name
    LEFT JOIN housing_by_quadrant
        ON business_counts.license_year = housing_by_quadrant.year
        AND COALESCE(community_quadrants.quadrant, 'MAPPING_REQUIRED') = housing_by_quadrant.quadrant
)
SELECT
    community_name,
    quadrant,
    quadrant_mapping_status,
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
FROM scored

{{ with_test("count_greater_than", count=0) }}
{{ with_test("not_null", column="community_name") }}
{{ with_test("not_null", column="year") }}
