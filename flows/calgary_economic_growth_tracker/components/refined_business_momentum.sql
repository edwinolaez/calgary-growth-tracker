WITH license_history AS (
    SELECT
        UPPER(community_name) AS community_name,
        CAST(first_issue_at AS DATE) AS issue_date,
        YEAR(first_issue_at) AS issue_year,
        business_license_id
    FROM {{ ref('calgary_business_licenses') }}
    WHERE community_name IS NOT NULL
        AND first_issue_at IS NOT NULL
),
recent_licenses AS (
    SELECT
        community_name,
        COUNT(DISTINCT business_license_id) AS license_count
    FROM license_history
    WHERE issue_date >= DATEADD(day, -60, CAST(GETDATE() AS DATE))
    GROUP BY
        community_name
),
historical_yearly_counts AS (
    SELECT
        community_name,
        issue_year,
        COUNT(DISTINCT business_license_id) AS yearly_license_count
    FROM license_history
    WHERE issue_date >= DATEADD(year, -5, CAST(GETDATE() AS DATE))
        AND issue_date < DATEADD(day, -60, CAST(GETDATE() AS DATE))
    GROUP BY
        community_name,
        issue_year
),
historical_average AS (
    SELECT
        community_name,
        AVG(CAST(yearly_license_count AS FLOAT)) AS five_year_average_license_count
    FROM historical_yearly_counts
    GROUP BY
        community_name
),
building_permit_communities AS (
    SELECT DISTINCT
        UPPER(community_name) AS community_name
    FROM {{ ref('building_permits') }}
    WHERE community_name IS NOT NULL
)
SELECT
    building_permit_communities.community_name,
    COALESCE(recent_licenses.license_count, 0) AS license_count,
    CASE
        WHEN COALESCE(historical_average.five_year_average_license_count, 0) = 0 THEN CAST(COALESCE(recent_licenses.license_count, 0) AS FLOAT)
        ELSE CAST(COALESCE(recent_licenses.license_count, 0) AS FLOAT)
            / historical_average.five_year_average_license_count
    END AS momentum_score
FROM building_permit_communities
LEFT JOIN recent_licenses
    ON building_permit_communities.community_name = recent_licenses.community_name
LEFT JOIN historical_average
    ON building_permit_communities.community_name = historical_average.community_name

{{ with_test("count_greater_than", count=0) }}
{{ with_test("not_null", column="community_name") }}
{{ with_test("not_null", column="license_count") }}
{{ with_test("not_null", column="momentum_score") }}
