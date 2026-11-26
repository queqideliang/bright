"""Read-only access to archived summaries from the original model worker."""

import json
import os
from pathlib import Path
import re
from secrets import compare_digest

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import httpx


load_dotenv()
DATA_DIR = Path(__file__).resolve().parent / "bim_data"
app = FastAPI(title="BIM archive")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "https://brightsunliang.top").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-VPS-Token", "Authorization"],
)


def verify_archive_token(x_vps_token: str = Header(default="")):
    token = os.environ.get("VPS_SECRET_TOKEN")
    if not token:
        raise HTTPException(status_code=503, detail="Archive access unavailable")
    if not compare_digest(x_vps_token.encode(), token.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health():
    return {"status": "ok", "msg": "归档服务运行中"}


def read_archive(project_id: str) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,180}", project_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
    try:
        with (DATA_DIR / f"{project_id}_full.json").open(encoding="utf-8") as archive:
            return json.load(archive)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Summary not found")
    except (OSError, ValueError):
        raise HTTPException(status_code=500, detail="读取数据失败")


@app.get("/project/{project_id}/summary", dependencies=[Depends(verify_archive_token)])
async def get_project_summary(project_id: str):
    data = read_archive(project_id)
    return JSONResponse({
        "file": data.get("file", "unknown"),
        "total_elements": data.get("summary", {}).get("total_objects", 0),
        "element_statistics": data.get("categories", {}),
        "notice": "Extracted from full data JSON",
    }, headers={"Cache-Control": "private, no-store"})


def retired_pipeline():
    return JSONResponse({
        "error": "旧版模型处理接口已停用，请从网站模型库上传，在模型工作台查看与审核。",
        "libraryUrl": "/models",
        "workbenchUrl": "/workbench",
    }, status_code=410)


for path in ("/process-url", "/extract", "/upload-to-speckle"):
    app.add_api_route(path, retired_pipeline, methods=["POST"], include_in_schema=False)
for path in ("/test-speckle", "/import-status/{import_job_id}"):
    app.add_api_route(path, retired_pipeline, methods=["GET"], include_in_schema=False)


class ComplianceCheckRequest(BaseModel):
    model_id: str
    project_id: str = "default"
    file_name: str = ""

# 七段命名规范字段定义
_NAMING_FIELDS = [
    (1, "Project",        r"^[A-Z0-9]{2,6}$",  "XYZ"),
    (2, "Originator",     r"^[A-Z]{3,6}$",      "WSP"),
    (3, "Volume/System",  r"^[A-Z0-9]{2,4}$",   "ZZ"),
    (4, "Level/Location", r"^[A-Z0-9]{2,4}$",   "01"),
    (5, "Type",           r"^[A-Z]{2}$",         "M3"),
    (6, "Role",           r"^[A-Z]{1}$",         "A"),
    (7, "Number",         r"^[0-9]{4,5}$",       "0001"),
]
_VALID_TYPES = {"AF","CM","CR","DR","FN","HS","IE","M2","M3","MR","PM","RI","RP","SA","SH","SN","SP","SU","VS"}
_VALID_ROLES = {"A","B","C","D","E","F","G","H","I","K","L","M","P","Q","S","T","W","X","Y","Z"}

# EIR 必填属性映射 — 每个历史模型类别需要的参数（在 IMPORTANT_PARAMS 中追踪的）
_EIR_REQUIRED: dict = {
    "Wall":        ["FireRating", "防火等级", "LoadBearing"],
    "Door":        ["FireRating", "防火等级"],
    "Window":      ["FireRating", "防火等级"],
    "Floor":       ["FireRating", "防火等级", "LoadBearing"],
    "Column":      ["FireRating", "防火等级", "LoadBearing"],
    "Beam":        ["FireRating", "防火等级", "LoadBearing"],
    "Roof":        ["FireRating", "防火等级"],
    "Stair":       ["FireRating", "防火等级"],
}

# Uniclass 检查：在 sample_elements 的 params 里找分类码相关 key
_UNICLASS_KEYS = {
    "classification", "classificationcode", "uniclass", "uniclass2015",
    "omniclass", "uniformat", "分类", "分类码",
}

def _check_naming(file_name: str) -> list:
    issues = []
    name = file_name.rsplit(".", 1)[0] if "." in file_name else file_name
    if not name:
        return []
    segments = name.split("-")

    if len(segments) < 7:
        issues.append({
            "id": f"naming-segments-{name}",
            "category": "NAMING",
            "severity": "ERROR",
            "elementId": name,
            "elementType": "File",
            "message": (
                f"File name must contain 7 hyphen-separated fields (UK NA). "
                f"Found {len(segments)} segment(s)."
            ),
            "field": "segment_count",
            "currentValue": str(len(segments)),
            "expectedFormat": "Project-Originator-Volume-Level-Type-Role-Number",
        })
        return issues

    for pos, fname, pattern, example in _NAMING_FIELDS:
        val = segments[pos - 1] if pos - 1 < len(segments) else ""
        if not val:
            issues.append({
                "id": f"naming-missing-{fname}-{name}",
                "category": "NAMING", "severity": "ERROR",
                "elementId": name, "elementType": "File",
                "message": f'Segment {pos} "{fname}" is missing.',
                "field": fname,
                "expectedFormat": f"{pattern} (e.g. {example})",
            })
        elif not re.match(pattern, val):
            issues.append({
                "id": f"naming-format-{fname}-{name}",
                "category": "NAMING", "severity": "ERROR",
                "elementId": name, "elementType": "File",
                "message": f'Segment {pos} "{fname}" has invalid format: "{val}".',
                "field": fname,
                "currentValue": val,
                "expectedFormat": f"{pattern} (e.g. {example})",
            })

    # 白名单检查 — Type 段
    if len(segments) >= 5 and re.match(r"^[A-Z]{2}$", segments[4]):
        if segments[4] not in _VALID_TYPES:
            issues.append({
                "id": f"naming-type-value-{name}",
                "category": "NAMING", "severity": "WARNING",
                "elementId": name, "elementType": "File",
                "message": f'Type code "{segments[4]}" is not in the standard type code list.',
                "field": "Type",
                "currentValue": segments[4],
                "expectedFormat": f"Standard codes: {', '.join(sorted(_VALID_TYPES))}",
            })

    # 白名单检查 — Role 段
    if len(segments) >= 6 and re.match(r"^[A-Z]{1}$", segments[5]):
        if segments[5] not in _VALID_ROLES:
            issues.append({
                "id": f"naming-role-value-{name}",
                "category": "NAMING", "severity": "WARNING",
                "elementId": name, "elementType": "File",
                "message": f'Role code "{segments[5]}" is not in the standard role code list.',
                "field": "Role",
                "currentValue": segments[5],
                "expectedFormat": f"Standard codes: {', '.join(sorted(_VALID_ROLES))}",
            })

    return issues


def _check_eir(full_data: dict) -> list:
    """从 missing_params 数据生成 EIR 合规问题列表"""
    issues = []
    missing_params: dict = full_data.get("missing_params", {})
    categories: dict = full_data.get("categories", {})

    for cat, required_props in _EIR_REQUIRED.items():
        cat_missing = missing_params.get(cat, {})
        cat_count = categories.get(cat, 0)
        if cat_count == 0:
            continue

        for prop in required_props:
            missing_count = cat_missing.get(prop, 0)
            if missing_count <= 0:
                continue

            severity = "ERROR" if missing_count == cat_count else "WARNING"
            issues.append({
                "id": f"eir-{cat}-{prop}",
                "category": "EIR",
                "severity": severity,
                "elementId": f"{cat} (×{missing_count})",
                "elementType": f"Ifc{cat}",
                "message": (
                    f"{missing_count}/{cat_count} {cat} elements missing "
                    f'required EIR property "{prop}".'
                ),
                "field": prop,
                "currentValue": f"{cat_count - missing_count} elements have it",
                "expectedFormat": f"All {cat_count} {cat} elements must have {prop}",
            })

    return issues


def _check_uniclass(full_data: dict) -> list:
    """从 sample_elements 推断全模型 Uniclass 覆盖率"""
    issues = []
    sample_elements: list = full_data.get("sample_elements", [])
    total_elements: int = full_data.get("summary", {}).get("total_elements", 0)
    categories: dict = full_data.get("categories", {})

    if not sample_elements:
        return issues

    has_classification = 0
    for el in sample_elements:
        params = el.get("params", {})
        for key in params:
            if key.lower().replace(" ", "").replace("_", "") in _UNICLASS_KEYS:
                if params[key] and str(params[key]).strip():
                    has_classification += 1
                    break

    coverage_pct = has_classification / len(sample_elements)

    if coverage_pct < 0.5:
        # 超过一半的样本没有分类码
        estimated_missing = round(total_elements * (1 - coverage_pct))
        issues.append({
            "id": "uniclass-missing-bulk",
            "category": "UNICLASS",
            "severity": "ERROR",
            "elementId": f"~{estimated_missing} elements",
            "elementType": "All",
            "message": (
                f"Estimated {estimated_missing}/{total_elements} elements "
                f"({round((1-coverage_pct)*100)}%) lack a Uniclass 2015 classification code. "
                f"Based on {len(sample_elements)}-element sample."
            ),
            "field": "Classification",
            "expectedFormat": "Every element must have a Uniclass 2015 code (e.g. Pr_25_57_17_12)",
        })
    elif coverage_pct < 0.9:
        estimated_missing = round(total_elements * (1 - coverage_pct))
        issues.append({
            "id": "uniclass-partial-coverage",
            "category": "UNICLASS",
            "severity": "WARNING",
            "elementId": f"~{estimated_missing} elements",
            "elementType": "All",
            "message": (
                f"Estimated {estimated_missing}/{total_elements} elements "
                f"({round((1-coverage_pct)*100)}%) may be missing Uniclass 2015 codes."
            ),
            "field": "Classification",
            "expectedFormat": "Every element must have a Uniclass 2015 code",
        })

    return issues


@app.post("/compliance-check")
async def compliance_check(req: ComplianceCheckRequest, _=Depends(verify_archive_token)):
    """ISO 19650 UK NA 合规检查 — 命名 + EIR + Uniclass"""
    import datetime as dt
    model_id = req.model_id
    file_name = re.sub(r'[^a-zA-Z0-9._\-]', '_', req.file_name)[:256]
    full_data = read_archive(model_id)

    issues: list = []
    issues.extend(_check_naming(file_name))
    issues.extend(_check_eir(full_data))
    issues.extend(_check_uniclass(full_data))

    total_elements = max(full_data.get("summary", {}).get("total_elements", 0), 1)

    def _stats(cat: str) -> dict:
        cat_issues = [i for i in issues if i["category"] == cat]
        errors = sum(1 for i in cat_issues if i["severity"] == "ERROR")
        warnings = sum(1 for i in cat_issues if i["severity"] == "WARNING")
        return {
            "total": len(cat_issues),
            "errors": errors,
            "warnings": warnings,
            "passed": max(0, total_elements - errors - warnings),
        }

    total_errors = sum(1 for i in issues if i["severity"] == "ERROR")
    score = max(0, round(((total_elements - total_errors) / total_elements) * 100))

    return {
        "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "modelName": file_name or model_id,
        "totalElements": total_elements,
        "complianceScore": score,
        "summary": {
            "naming":   _stats("NAMING"),
            "uniclass": _stats("UNICLASS"),
            "eir":      _stats("EIR"),
        },
        "issues": issues[:200],
    }


class AuditRequest(BaseModel):
    project_id: str
    model_id: str | None = None
    question: str
    context_json: dict | None = None


@app.post("/audit", dependencies=[Depends(verify_archive_token)])
async def audit_bim(req: AuditRequest):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    try:
        archive = read_archive(req.model_id or req.project_id)
    except HTTPException as error:
        if error.status_code != 404:
            raise
        archive = {}
    context = json.dumps({"archive": archive, "modelData": req.context_json}, ensure_ascii=False)[:15000]
    payload = {
        "system_instruction": {"parts": [{"text": "你是 BIM 审核助手。以提供的模型数据为依据，简明回答问题。"}]},
        "contents": [{"role": "user", "parts": [{"text": context}, {"text": req.question}]}],
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                headers={"x-goog-api-key": key}, json=payload,
            )
            response.raise_for_status()
            answer = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail="AI call failed")
    return {"answer": answer}
