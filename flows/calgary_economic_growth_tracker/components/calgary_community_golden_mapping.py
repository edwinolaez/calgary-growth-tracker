from __future__ import annotations

import json
import urllib.parse
import urllib.request

import pandas as pd

from ascend.application.context import ComponentExecutionContext
from ascend.resources import read, test


BOUNDARIES_URL = "https://data.calgary.ca/resource/surr-xmvs.json"


def _fetch_json(url: str) -> list[dict[str, str]]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "AscendCalgaryEconomicGrowthTracker/1.0",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


@read(
    tests=[
        test("count_greater_than", count=0),
        test("not_null", column="community_name"),
        test("not_null", column="quadrant"),
    ],
    on_schema_change="sync_all_columns",
)
def calgary_community_golden_mapping(context: ComponentExecutionContext) -> pd.DataFrame:
    query = urllib.parse.urlencode(
        {
            "$select": "name,sector,comm_code,class",
            "$limit": "5000",
        }
    )
    boundaries = pd.DataFrame(_fetch_json(f"{BOUNDARIES_URL}?{query}"))

    boundaries = boundaries.rename(
        columns={
            "name": "community_name",
            "sector": "official_sector",
            "comm_code": "community_code",
            "class": "community_class",
        }
    )
    boundaries["community_name"] = boundaries["community_name"].fillna("").str.upper().str.strip()
    boundaries["official_sector"] = boundaries["official_sector"].fillna("").str.upper().str.strip()

    residential_like_classes = {
        "RESIDENTIAL",
        "INDUSTRIAL",
        "MAJOR PARK",
        "RESIDUAL SUB AREA",
    }
    boundaries = boundaries[boundaries["community_class"].str.upper().isin(residential_like_classes)].copy()

    boundaries["quadrant"] = boundaries["official_sector"].map(
        {
            "NORTHEAST": "NE",
            "EAST": "NE",
            "NORTHWEST": "NW",
            "NORTH": "NW",
            "SOUTHEAST": "SE",
            "SOUTH": "SE",
            "WEST": "SW",
            "CENTRE": "SW",
        }
    )
    boundaries["mapping_status"] = boundaries["quadrant"].apply(
        lambda value: "APPROVED" if pd.notna(value) and value != "" else "MAPPING_REQUIRED"
    )
    boundaries["mapping_source"] = "City of Calgary Community Boundaries"

    return boundaries[
        [
            "community_name",
            "community_code",
            "official_sector",
            "community_class",
            "quadrant",
            "mapping_status",
            "mapping_source",
        ]
    ].drop_duplicates(subset=["community_name"])
