from __future__ import annotations

import json
import urllib.parse
import urllib.request

import pandas as pd

from ascend.application.context import ComponentExecutionContext
from ascend.resources import read, test


URL = "https://data.calgary.ca/resource/c2es-76ed.json"


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
        test("not_null", column="issued_date"),
    ],
    on_schema_change="sync_all_columns",
)
def building_permits(context: ComponentExecutionContext) -> pd.DataFrame:
    offset = 0
    limit = 5000
    rows: list[dict[str, str]] = []

    while True:
        query = urllib.parse.urlencode(
            {
                "$select": "permitnum,statuscurrent,applieddate,issueddate,completeddate,permittype,permittypemapped,permitclass,permitclassgroup,permitclassmapped,workclass,workclassgroup,workclassmapped,description,applicantname,contractorname,housingunits,estprojectcost,totalsqft,originaladdress,communitycode,communityname",
                "$where": "communityname IS NOT NULL AND issueddate IS NOT NULL",
                "$limit": str(limit),
                "$offset": str(offset),
                "$order": "issueddate",
            }
        )
        payload = _fetch_json(f"{URL}?{query}")
        if not payload:
            break
        rows.extend(payload)
        if len(payload) < limit:
            break
        offset += limit

    data = pd.DataFrame(rows).rename(
        columns={
            "permitnum": "permit_number",
            "statuscurrent": "status_current",
            "applieddate": "applied_date",
            "issueddate": "issued_date",
            "completeddate": "completed_date",
            "permittype": "permit_type",
            "permittypemapped": "permit_type_mapped",
            "permitclass": "permit_class",
            "permitclassgroup": "permit_class_group",
            "permitclassmapped": "permit_class_mapped",
            "workclass": "work_class",
            "workclassgroup": "work_class_group",
            "workclassmapped": "work_class_mapped",
            "applicantname": "applicant_name",
            "contractorname": "contractor_name",
            "estprojectcost": "estimated_project_cost",
            "totalsqft": "total_sqft",
            "originaladdress": "original_address",
            "communitycode": "community_code",
            "communityname": "community_name",
        }
    )

    for column in ["applied_date", "issued_date", "completed_date"]:
        data[column] = pd.to_datetime(data[column], errors="coerce", utc=True)

    for column in ["housingunits", "estimated_project_cost", "total_sqft"]:
        data[column] = pd.to_numeric(data[column], errors="coerce")

    data["issued_year"] = data["issued_date"].dt.year.astype("Int64")
    return data
