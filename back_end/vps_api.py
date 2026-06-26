"""
亮阳 BIM·AI 平台 — VPS FastAPI 后端 (Speckle V2 调试增强版)
"""

import asyncio
import json
import os

# NOTE: 从 .env 文件加载环境变量，必须在 _require_env() 调用之前执行
from dotenv import load_dotenv
load_dotenv()

import requests
import urllib.parse
import time
import sys
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import httpx

# ============================================================
# ★ 配置区 ★  — 全部从环境变量读取，禁止硬编码密钥
# ============================================================
def _require_env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise RuntimeError(f"[STARTUP] 缺少必要环境变量: {key}，请在 .env 文件或系统环境中配置后重启")
    return val

SPECKLE_TOKEN      = _require_env("SPECKLE_TOKEN")
SPECKLE_PROJECT_ID = _require_env("SPECKLE_PROJECT_ID")
SPECKLE_SERVER_URL = os.environ.get("SPECKLE_SERVER_URL", "https://app.speckle.systems")
GEMINI_API_KEY     = _require_env("GEMINI_API_KEY")
SUPABASE_URL       = _require_env("SUPABASE_URL")
SUPABASE_SERVICE_KEY = _require_env("SUPABASE_SERVICE_KEY")
VPS_SECRET_TOKEN   = _require_env("VPS_SECRET_TOKEN")   # VPS 内部鉴权令牌

# Speckle 支持的 22 种 3D/BIM 格式白名单
SPECKLE_ALLOWED_EXTS = {
    'ifc','rvt','3dm','skp','dwg','dxf','dgn','3ds','sldprt',
    'stp','step','e57','3mf','amf','fbx','igs','iges',
    'obj','ply','x','nwc','nwd',
}
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bim_data")
# ============================================================

import re
from urllib.parse import urlparse
from fastapi import Header

app = FastAPI(title="BIM·AI VPS Worker V3 (Debug)")

_ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS", "https://brightsunliang.top"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-VPS-Token", "Authorization"],
)

def _verify_token(x_vps_token: str = Header(default="")):
    """VPS 内部接口 Token 验证 — 防止未授权调用"""
    if x_vps_token != VPS_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

def _safe_id(raw: str) -> str:
    """净化 ID，只允许 UUID 字母数字和连字符，防止路径穿越"""
    clean = re.sub(r'[^a-zA-Z0-9\-_]', '', raw)
    if not clean:
        raise HTTPException(status_code=400, detail="Invalid ID format")
    return clean

def _validate_storage_url(url: str) -> str:
    """只允许从 Supabase Storage 域名下载文件，防止 SSRF"""
    parsed = urlparse(url)
    if not parsed.netloc.endswith(".supabase.co"):
        raise HTTPException(status_code=400, detail="Invalid file URL domain")
    return url

class ProcessUrlRequest(BaseModel):
    model_id: str
    project_id: str
    file_url: str
    file_name: str
    file_format: str = "IFC"

class ExtractRequest(BaseModel):
    project_id: str
    speckle_project_id: str
    speckle_model_id: str

    model_id: str
    project_id: str
    file_url: str
    file_name: str
    file_format: str = "IFC"

class AuditRequest(BaseModel):
    project_id: str
    model_id: Optional[str] = None
    question: str
    context_json: Optional[Dict] = None

@app.get("/health")
async def health():
    return {"status": "ok", "msg": "VPS 运行中"}

@app.get("/project/{project_id}/summary")
async def get_project_summary(project_id: str, _=Depends(_verify_token)):
    # 净化 project_id，防止路径穿越（CWE-22）
    safe_pid = _safe_id(project_id)
    summary_path = os.path.join(DATA_DIR, f"{safe_pid}_full.json")

    if not os.path.exists(summary_path):
        raise HTTPException(status_code=404, detail="Summary not found")

    try:
        with open(summary_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        return {
            "file": data.get("file", "unknown"),
            "total_elements": data.get("summary", {}).get("total_objects", 0),
            "element_statistics": data.get("categories", {}),
            "notice": "Extracted from full data JSON"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="读取数据失败")

@app.get("/test-speckle")
async def test_speckle_connection():
    """通过 GraphQL 测试 Speckle 连接"""
    gql_url = "https://app.speckle.systems/graphql"
    headers = {
        "Authorization": f"Bearer {SPECKLE_TOKEN}",
        "Content-Type": "application/json",
    }
    try:
        query = '{"query":"{ activeUser { id name } }"}'
        res = requests.post(gql_url, headers=headers, data=query, timeout=10)
        if res.status_code == 200:
            data = res.json().get("data", {}).get("activeUser", {})
            return {"status": "success", "user": data.get("name")}
        return {"status": "error", "code": res.status_code, "msg": res.text}
    except Exception as e:
        return {"status": "exception", "msg": str(e)}

@app.post("/process-url")
async def process_from_url(req: ProcessUrlRequest, background_tasks: BackgroundTasks, _=Depends(_verify_token)):
    # 入口校验：净化 ID + SSRF 防护
    safe_model_id = _safe_id(req.model_id)
    safe_file_url = _validate_storage_url(req.file_url)
    # 文件名只保留安全字符，防止路径穿越
    safe_file_name = re.sub(r'[^a-zA-Z0-9._\-]', '_', req.file_name)[:128]
    print(f"[RECV] 收到解析任务: {safe_file_name} (ModelID: {safe_model_id})")
    background_tasks.add_task(_do_process_url, safe_model_id, safe_file_url, safe_file_name, req.file_format)
    return {"status": "processing"}

async def _do_process_url(model_id, file_url, file_name, file_format):
    tmp_path = os.path.join(DATA_DIR, f"{model_id}_{file_name}")
    print(f"[START] 开始处理任务 [{model_id}]...")

    try:
        # Step 1: 标记开始
        await _update_supabase_model(model_id, {"status": "PARSING", "progress": 10})
        print(f"[STEP 1] 正在从云端下载文件... (10%)")

        # Step 2: 下载文件
        os.makedirs(DATA_DIR, exist_ok=True)
        start_time = time.time()
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.get(file_url)
            resp.raise_for_status()
            with open(tmp_path, "wb") as f:
                f.write(resp.content)
        print(f"[SUCCESS] 下载完成，耗时: {time.time() - start_time:.2f}s (30%)")
        await _update_supabase_model(model_id, {"progress": 30})

        # Step 3: 原理不再使用本地解析，全部交由 Speckle 云端处理
        print(f"[STEP 2] 将完全依靠 Speckle 云端解析引擎... (45%)")
        elements, levels = [], []
        # (删除了 ifcopenshell 支持，完全剥离本地重量级运算)

        await _update_supabase_model(model_id, {"progress": 60})
        print(f"[STEP 3] 正在同步至 Speckle 渲染引擎... (75%)")

        # ============================================================
        # Step 4: 上传到 Speckle（S3 直传并触发解析）
        # ============================================================
        model_name = file_name.rsplit(".", 1)[0]
        model_name_clean = "".join(c for c in model_name if c.isalnum() or c in ("-", "_", " ")).strip()

        GRAPHQL_URL = "https://app.speckle.systems/graphql"
        HEADERS_SPECKLE = {
            "Authorization": f"Bearer {SPECKLE_TOKEN}",
            "Content-Type": "application/json"
        }

        print(f"[4-1] 正在创建新模型...")
        query_create = """
        mutation CreateModel($input: CreateModelInput!) {
          modelMutations {
            create(input: $input) { id name }
          }
        }
        """
        import datetime
        res_create = requests.post(GRAPHQL_URL, json={
            "query": query_create,
            "variables": {"input": {"projectId": SPECKLE_PROJECT_ID, "name": model_name_clean}}
        }, headers=HEADERS_SPECKLE)
        
        res_json = res_create.json()
        def _get_model_id(data):
            try: return data['data']['modelMutations']['create']['id']
            except (KeyError, TypeError): return None

        if res_create.status_code != 200 or 'errors' in res_json or not _get_model_id(res_json):
            print(f"[WARN] 第一次创建 Speckle 模型失败(可能重名或错误)，尝试附加时间戳重试...")
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            model_name_clean = f"{model_name_clean}_{timestamp}"
            
            res_create = requests.post(GRAPHQL_URL, json={
                "query": query_create,
                "variables": {"input": {"projectId": SPECKLE_PROJECT_ID, "name": model_name_clean}}
            }, headers=HEADERS_SPECKLE)
            res_json = res_create.json()
            
            if res_create.status_code != 200 or 'errors' in res_json or not _get_model_id(res_json):
                err_msg = res_json.get('errors') or res_create.text
                raise Exception(f"创建 Speckle 模型彻底失败: {err_msg}")
            
        speckle_model_id = _get_model_id(res_json)
        if not speckle_model_id:
            raise Exception("无法从 Speckle 返回体提取出有效的 model id，请终止！")
            
        print(f"[SUCCESS] 新模型创建成功！modelId: {speckle_model_id}")

        print(f"[4-2] 正在请求请求上传 URL...")
        query_upload = """
        mutation GenerateIngestionUploadUrl($projectId: String!, $fileName: String!) {
          fileUploadMutations {
            generateUploadUrl(input: {projectId: $projectId, fileName: $fileName}) { fileId url }
          }
        }
        """
        res_upload = requests.post(GRAPHQL_URL, json={
            "query": query_upload,
            "variables": {"projectId": SPECKLE_PROJECT_ID, "fileName": file_name}
        }, headers=HEADERS_SPECKLE)

        if res_upload.status_code != 200 or 'errors' in res_upload.json():
            raise Exception(f"获取 S3 上传 URL 失败: {res_upload.text}")
            
        upload_data = res_upload.json()['data']['fileUploadMutations']['generateUploadUrl']
        upload_url = upload_data['url']
        speckle_file_id = upload_data['fileId']
        print(f"[SUCCESS] 拿到上传 URL！fileId: {speckle_file_id}")

        print(f"[4-3] PUT 文件到 S3...")
        with open(tmp_path, "rb") as f:
            res_put = requests.put(upload_url, data=f)

        if res_put.status_code != 200:
            raise Exception(f"PUT 方式直传 S3 失败: {res_put.status_code} {res_put.text}")
            
        raw_etag = res_put.headers.get('ETag', '')
        print(f"[SUCCESS] 上传成功！ETag: {raw_etag}")

        print(f"[4-4] 通知 Speckle 开始解析...")
        query_ingest = """
        mutation StartFileIngestion($projectId: String!, $modelId: String!, $fileId: String!, $etag: String!) {
          fileUploadMutations {
            startFileIngestion(input: {projectId: $projectId, modelId: $modelId, fileId: $fileId, etag: $etag}) { id }
          }
        }
        """
        res_ingest = requests.post(GRAPHQL_URL, json={
            "query": query_ingest,
            "variables": {
                "projectId": SPECKLE_PROJECT_ID,
                "modelId": speckle_model_id,
                "fileId": speckle_file_id,
                "etag": raw_etag
            }
        }, headers=HEADERS_SPECKLE)

        if res_ingest.status_code != 200 or 'errors' in res_ingest.json():
            raise Exception(f"触发解析失败: {res_ingest.text}")

        print(f"[SUCCESS] S3 直传并通知 Speckle 成功！")
        
        # ============================================================
        # 新增 D 步：等待 Speckle 解析完毕，获取 GraphQL 及完整构件树存 full JSON
        # ============================================================
        print(f"[WAIT] 正在等待 Speckle 分布式后端解析 IFC 模型...")

        query_model_versions = """
        query GetModelVersions($projectId: String!, $modelId: String!) {
          project(id: $projectId) {
            model(id: $modelId) {
              versions(limit: 1) {
                items { id referencedObject }
              }
            }
          }
        }
        """

        converted_version_id = None
        for attempt in range(60): # 轮询 10 分钟 (60*10 = 600s)
            await asyncio.sleep(10)

            current_prog = 70 + int((attempt / 60) * 15)
            await _update_supabase_model(model_id, {"progress": current_prog})

            print(f"[POLL] 轮询 Speckle 模型版本 (尝试 {attempt+1}/60)...")
            res_st = requests.post(GRAPHQL_URL, json={
                "query": query_model_versions,
                "variables": {"projectId": SPECKLE_PROJECT_ID, "modelId": speckle_model_id}
            }, headers=HEADERS_SPECKLE)

            if res_st.status_code == 200:
                items = res_st.json().get("data", {}).get("project", {}).get("model", {}).get("versions", {}).get("items", [])
                if items and items[0].get("referencedObject"):
                    converted_version_id = items[0]["id"]
                    print(f"[SUCCESS] Speckle 模型版本已生成！versionId: {converted_version_id}")
                    await _update_supabase_model(model_id, {"progress": 85})
                    break

        if not converted_version_id:
            raise Exception("等待 10 分钟后，Speckle 云端解析仍未完成或超时！")

        print(f"[FETCH] 正在获取模型结构引用的根节点 (versionId: {converted_version_id})...")
        query_version = """
        query GetVersionObject($projectId: String!, $modelId: String!, $versionId: String!) {
          project(id: $projectId) {
            model(id: $modelId) {
              version(id: $versionId) {
                referencedObject
              }
            }
          }
        }
        """
        res_ver = requests.post(GRAPHQL_URL, json={
            "query": query_version,
            "variables": {"projectId": SPECKLE_PROJECT_ID, "modelId": speckle_model_id, "versionId": converted_version_id}
        }, headers=HEADERS_SPECKLE)
        
        referenced_object = None
        if res_ver.status_code == 200:
            ver_data = res_ver.json().get("data", {}).get("project", {}).get("model", {}).get("version", {})
            if ver_data and ver_data.get("referencedObject"):
                referenced_object = ver_data["referencedObject"]
        
        if not referenced_object:
            raise Exception(f"成功拿到 Version，但未找到 referencedObject: {res_ver.text}")
        print(f"[SUCCESS] 拿到根对象 Hash: {referenced_object}")


        print(f"[PULL] 流式提取 Speckle 构件数据（低内存模式）...")

        objects_endpoint = f"https://app.speckle.systems/objects/{SPECKLE_PROJECT_ID}/{referenced_object}"
        res_objects = requests.get(objects_endpoint, headers={**HEADERS_SPECKLE, "Accept": "text/plain"}, stream=True)

        total_count = 0
        category_counts = {}
        levels = {}
        systems = {}
        param_stats = {}
        missing_params = {}
        sample_elements = []

        IMPORTANT_PARAMS = [
            "材质", "材料", "Material", "防火等级", "FireRating",
            "厚度", "Thickness", "高度", "Height", "面积", "Area",
            "管径", "Diameter", "系统", "System", "长度", "Length",
            "宽度", "Width", "体积", "Volume", "重量", "Weight",
        ]

        if res_objects.status_code == 200:
            for line in res_objects.iter_lines(decode_unicode=True):
                if not line:
                    continue
                try:
                    # Speckle 返回格式: {id}\t{json}
                    if '\t' in line:
                        line = line.split('\t', 1)[1]
                    obj = json.loads(line)
                except Exception:
                    continue
                if not isinstance(obj, dict):
                    continue

                total_count += 1
                stype = obj.get("speckle_type", "")

                # 1. 构件类型统计
                if stype and "Objects." in stype:
                    cat = stype.split(":")[-1] if ":" in stype else stype.split(".")[-1]
                    category_counts[cat] = category_counts.get(cat, 0) + 1

                    # 2. 参数统计 + 缺失参数
                    params = obj.get("parameters", obj.get("properties", {}))
                    if isinstance(params, dict):
                        if cat not in param_stats:
                            param_stats[cat] = {}
                            missing_params[cat] = {}
                        for p_name in IMPORTANT_PARAMS:
                            found = False
                            for key in params:
                                if p_name.lower() in key.lower():
                                    param_stats[cat][p_name] = param_stats[cat].get(p_name, 0) + 1
                                    found = True
                                    break
                            if not found:
                                missing_params[cat][p_name] = missing_params[cat].get(p_name, 0) + 1

                    # 3. 采样前 30 个构件完整参数
                    if len(sample_elements) < 30:
                        sample_el = {"type": cat, "name": obj.get("name", "")}
                        if isinstance(params, dict):
                            sample_el["params"] = {k: str(v)[:100] for k, v in list(params.items())[:20]}
                        sample_elements.append(sample_el)

                # 4. 楼层信息
                if "BuildingStorey" in stype or "IfcBuildingStorey" in stype:
                    lname = str(obj.get("name", obj.get("Name", "Unknown")))
                    elev = obj.get("elevation", obj.get("Elevation", 0))
                    levels[lname] = {"elevation": elev}

                # 5. 系统分类
                sys_name = ""
                p = obj.get("parameters", {})
                if isinstance(p, dict):
                    for k, v in p.items():
                        if "system" in str(k).lower() or "系统" in str(k):
                            sys_name = str(v) if v else ""
                            break
                if not sys_name:
                    sys_name = obj.get("systemName", obj.get("system", ""))
                if sys_name:
                    systems[str(sys_name)] = systems.get(str(sys_name), 0) + 1

            print(f"[SUCCESS] 流式提取完成：{total_count} 个对象，{len(category_counts)} 种构件类型")
            await _update_supabase_model(model_id, {"progress": 95})
        else:
            print(f"[WARN] 拉取构件树数据失败: {res_objects.status_code}")

        # 清理空的缺失参数
        missing_params = {
            cat: {p: c for p, c in pdict.items() if c > 0}
            for cat, pdict in missing_params.items()
            if any(c > 0 for c in pdict.values())
        }

        os.makedirs(DATA_DIR, exist_ok=True)
        full_data = {
            "file": file_name,
            "rootObject": referenced_object,
            "summary": {
                "total_objects": total_count,
                "total_elements": sum(category_counts.values()),
            },
            "categories": category_counts,
            "levels": levels,
            "systems": systems,
            "param_coverage": param_stats,
            "missing_params": missing_params,
            "sample_elements": sample_elements,
        }

        with open(os.path.join(DATA_DIR, f"{model_id}_full.json"), "w", encoding="utf-8") as f:
            json.dump(full_data, f, ensure_ascii=False, indent=2)

        file_size = os.path.getsize(os.path.join(DATA_DIR, f"{model_id}_full.json"))
        print(f"[SAVE] 结构化数据已保存：{file_size / 1024:.1f} KB")

        await _update_supabase_model(model_id, {
            "speckle_stream_id": SPECKLE_PROJECT_ID,
            "speckle_model_id": speckle_model_id,
            "status": "COMPLETED",
            "progress": 100,
            "element_count": sum(category_counts.values()) or total_count,
        })
                
    except Exception as e:
        print(f"[ERROR] 进程重大故障: {e}")
        import traceback
        traceback.print_exc()
        await _update_supabase_model(model_id, {"status": "FAILED"})
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            print(f"[CLEAN] 临时文件已清理")


@app.post("/extract")
async def extract_data(req: ExtractRequest, background_tasks: BackgroundTasks, _=Depends(_verify_token)):
    safe_pid = _safe_id(req.project_id)
    safe_spid = _safe_id(req.speckle_project_id)
    safe_smid = _safe_id(req.speckle_model_id)
    print(f"[EXTRACT] 收到提取任务: {safe_pid} (Speckle Project: {safe_spid})")
    background_tasks.add_task(_do_extract, safe_pid, safe_spid, safe_smid)
    return {"status": "extracting"}

async def _do_extract(model_id: str, speckle_project_id: str, speckle_model_id: str):
    print(f"[PULL] 开始流式提取 Speckle 构件数据 (ModelID: {model_id})...")
    try:
        await _update_supabase_model(model_id, {"status": "AUDITING", "progress": 85})
        
        GRAPHQL_URL = f"{SPECKLE_SERVER_URL}/graphql"
        HEADERS_SPECKLE = {
            "Authorization": f"Bearer {SPECKLE_TOKEN}",
            "Content-Type": "application/json"
        }
        
        # 1. 拿 referencedObject（带 10分钟轮询等待机制）
        referenced_object = None
        query_version = """
        query GetModelVersion($projectId: String!, $modelId: String!) {
          project(id: $projectId) {
            model(id: $modelId) {
              versions(limit: 1) {
                items { id referencedObject }
              }
            }
          }
        }
        """
        import requests
        
        for attempt in range(60):
            res_ver = requests.post(GRAPHQL_URL, json={
                "query": query_version,
                "variables": {"projectId": speckle_project_id, "modelId": speckle_model_id}
            }, headers=HEADERS_SPECKLE)
            
            if res_ver.status_code == 200:
                ver_items = res_ver.json().get("data", {}).get("project", {}).get("model", {}).get("versions", {}).get("items", [])
                if ver_items and len(ver_items) > 0 and ver_items[0].get("referencedObject"):
                    referenced_object = ver_items[0]["referencedObject"]
                    print(f"[SUCCESS] 找到 Speckle 根对象 Hash: {referenced_object}")
                    break
                    
            print(f"[POLL] 等待 Speckle 生成数据树树节点中... (尝试 {attempt+1}/60)")
            import asyncio
            await asyncio.sleep(10)
                
        if not referenced_object:
            raise Exception("等待 10 分钟后，仍未能从 Speckle 中找到相关的模型版本和 referencedObject！")

        # 2. 流式获取数据
        objects_endpoint = f"{SPECKLE_SERVER_URL}/objects/{speckle_project_id}/{referenced_object}"
        res_objects = requests.get(objects_endpoint, headers={**HEADERS_SPECKLE, "Accept": "text/plain"}, stream=True)

        if res_objects.status_code != 200:
            raise Exception(f"拉取构件数据失败: {res_objects.status_code} {res_objects.text[:100]}")

        total_count = 0
        category_counts = {}
        levels = {}
        systems = {}
        param_stats = {}
        missing_params = {}
        sample_elements = []

        IMPORTANT_PARAMS = [
            "材质", "材料", "Material", "防火等级", "FireRating",
            "厚度", "Thickness", "高度", "Height", "面积", "Area",
            "管径", "Diameter", "系统", "System", "长度", "Length",
            "宽度", "Width", "体积", "Volume", "重量", "Weight",
        ]
        
        import json
        for line in res_objects.iter_lines(decode_unicode=True):
            if not line:
                continue
            try:
                if '\t' in line:
                    line = line.split('\t', 1)[1]
                obj = json.loads(line)
            except Exception:
                continue
            if not isinstance(obj, dict):
                continue

            total_count += 1
            stype = obj.get("speckle_type", "")

            if stype and "Objects." in stype:
                cat = stype.split(":")[-1] if ":" in stype else stype.split(".")[-1]
                category_counts[cat] = category_counts.get(cat, 0) + 1

                params = obj.get("parameters", obj.get("properties", {}))
                if isinstance(params, dict):
                    if cat not in param_stats:
                        param_stats[cat] = {}
                        missing_params[cat] = {}
                    for p_name in IMPORTANT_PARAMS:
                        found = False
                        for key in params:
                            if p_name.lower() in key.lower():
                                param_stats[cat][p_name] = param_stats[cat].get(p_name, 0) + 1
                                found = True
                                break
                        if not found:
                            missing_params[cat][p_name] = missing_params[cat].get(p_name, 0) + 1

                if len(sample_elements) < 30:
                    sample_el = {"type": cat, "name": obj.get("name", "")}
                    if isinstance(params, dict):
                        sample_el["params"] = {k: str(v)[:100] for k, v in list(params.items())[:20]}
                    sample_elements.append(sample_el)

            if "BuildingStorey" in stype or "IfcBuildingStorey" in stype:
                lname = str(obj.get("name", obj.get("Name", "Unknown")))
                elev = obj.get("elevation", obj.get("Elevation", 0))
                levels[lname] = {"elevation": elev}

            sys_name = ""
            p = obj.get("parameters", {})
            if isinstance(p, dict):
                for k, v in p.items():
                    if "system" in str(k).lower() or "系统" in str(k):
                        sys_name = str(v) if v else ""
                        break
            if not sys_name:
                sys_name = obj.get("systemName", obj.get("system", ""))
            if sys_name:
                systems[str(sys_name)] = systems.get(str(sys_name), 0) + 1

        print(f"[SUCCESS] 提取完成：{total_count} 个对象，{len(category_counts)} 种构件类型")
        await _update_supabase_model(model_id, {"progress": 95})

        missing_params = {
            cat: {p: c for p, c in pdict.items() if c > 0}
            for cat, pdict in missing_params.items()
            if any(c > 0 for c in pdict.values())
        }

        import os
        os.makedirs(DATA_DIR, exist_ok=True)
        full_data = {
            "file": "Extracted via VPS",
            "rootObject": referenced_object,
            "summary": {
                "total_objects": total_count,
                "total_elements": sum(category_counts.values()),
            },
            "categories": category_counts,
            "levels": levels,
            "systems": systems,
            "param_coverage": param_stats,
            "missing_params": missing_params,
            "sample_elements": sample_elements,
        }

        with open(os.path.join(DATA_DIR, f"{model_id}_full.json"), "w", encoding="utf-8") as f:
            json.dump(full_data, f, ensure_ascii=False, indent=2)

        file_size = os.path.getsize(os.path.join(DATA_DIR, f"{model_id}_full.json"))
        print(f"[SAVE] VPS数据已保存：{file_size / 1024:.1f} KB")

        await _update_supabase_model(model_id, {
            "status": "COMPLETED",
            "progress": 100,
            "element_count": sum(category_counts.values()) or total_count,
        })
                
    except Exception as e:
        print(f"[ERROR] 提取进程重大故障: {e}")
        import traceback
        traceback.print_exc()
        await _update_supabase_model(model_id, {"status": "FAILED"})


# ============================================================
# ★ ISO 19650 合规检查端点 ★
# ============================================================

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

# EIR 必填属性映射 — 每个 Speckle 类别需要的参数（在 IMPORTANT_PARAMS 中追踪的）
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
async def compliance_check(req: ComplianceCheckRequest, _=Depends(_verify_token)):
    """ISO 19650 UK NA 合规检查 — 命名 + EIR + Uniclass"""
    import datetime as dt
    model_id = _safe_id(req.model_id)
    file_name = re.sub(r'[^a-zA-Z0-9._\-]', '_', req.file_name)[:256]

    full_path = os.path.join(DATA_DIR, f"{model_id}_full.json")
    if not os.path.exists(full_path):
        raise HTTPException(
            status_code=404,
            detail="Model data not extracted yet. Please wait for extraction to complete.",
        )

    with open(full_path, "r", encoding="utf-8") as f:
        full_data = json.load(f)

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
        "checkedAt": dt.datetime.utcnow().isoformat() + "Z",
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


@app.post("/audit")
async def audit_bim(req: AuditRequest, _=Depends(_verify_token)):
    """BIM AI 智能审计接口"""
    try:
        raw_id = req.model_id if req.model_id else req.project_id
        model_id = _safe_id(raw_id)  # 净化，防止路径穿越
        print(f"[Audit] /audit called. model_id: {model_id}")

        # 策略：以 _full.json 作为权威的构件参数来源喂给模型
        summary_path = os.path.join(DATA_DIR, f"{model_id}_full.json")

        context_text = ""
        if os.path.exists(summary_path):
            with open(summary_path, "r", encoding="utf-8") as f:
                context_text = f.read()
                
        if req.context_json:
            context_text += f"\n前端补充信息: {json.dumps(req.context_json, ensure_ascii=False)}"

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        
        prompt = f"""你是一个专业的 BIM 审计助手（亮阳 BIM·AI 平台）。
请根据以下 BIM 模型的解析数据，专业且简洁地回答用户的问题。
可以用 emoji 标注重要信息。

【BIM 模型数据上下文】
{context_text[:15000] if context_text else "暂无该模型详细数据。"}

【用户问题】
{req.question}
"""
        payload = {"contents": [{"parts": [{"text": prompt}]}]}
        
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                resp.raise_for_status()
                data = resp.json()
                answer = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "AI 暂时无法分析此数据。")
                return {"answer": answer}
        except Exception as e:
            print(f"[ERROR] Gemini API 网络调用异常: {e}")
            raise HTTPException(status_code=500, detail="AI 生成网络调用失败")
            
    except Exception as general_err:
        print(f"[CRITICAL] /audit 处理过程发生严重异常: {general_err}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"服务器内部异常处理失败: {general_err}")

async def _update_supabase_model(model_id, updates):
    url = f"{SUPABASE_URL}/rest/v1/models?id=eq.{model_id}"
    headers = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        await client.patch(url, headers=headers, json=updates)

# ============================================================
# ★ 流式转发上传到 Speckle ★
# NOTE: 文件不落盘、不在内存中缓存完整文件，适合 2G VPS
# ============================================================

@app.post("/upload-to-speckle")
async def upload_to_speckle(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    model_name: str = Form(...),
    user_id: str = Form(...),
    _=Depends(_verify_token),
):
    """
    流式转发用户上传的 BIM 文件到 Speckle 服务器
    不在 VPS 内存中缓存完整文件，峰值内存 < 200MB
    """
    # ① 校验文件扩展名
    original_name = file.filename or "unknown.ifc"
    ext = original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    if ext not in SPECKLE_ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式 .{ext}")

    safe_project_id = _safe_id(project_id)
    safe_user_id = _safe_id(user_id)
    # 模型名只保留安全字符
    model_name_clean = re.sub(r'[^a-zA-Z0-9._\-\s\u4e00-\u9fff]', '_', model_name)[:128].strip()
    if not model_name_clean:
        model_name_clean = original_name.rsplit(".", 1)[0]

    print(f"[UPLOAD-SPECKLE] 收到上传请求: {original_name} -> 项目 {safe_project_id}")

    # ② 从 Supabase 查项目对应的 speckle_project_id
    speckle_pid = SPECKLE_PROJECT_ID  # 默认使用全局配置
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/projects?id=eq.{safe_project_id}&select=speckle_project_id",
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                },
            )
            if resp.status_code == 200:
                rows = resp.json()
                if rows and rows[0].get("speckle_project_id"):
                    speckle_pid = rows[0]["speckle_project_id"]
    except Exception as e:
        print(f"[WARN] 查询 speckle_project_id 失败，使用全局默认: {e}")

    GRAPHQL_URL = f"{SPECKLE_SERVER_URL}/graphql"
    HEADERS_SPECKLE = {
        "Authorization": f"Bearer {SPECKLE_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        # ③ 在 Speckle 创建 Model
        import datetime
        query_create = """
        mutation CreateModel($input: CreateModelInput!) {
          modelMutations {
            create(input: $input) { id name }
          }
        }
        """
        async with httpx.AsyncClient(timeout=30) as client:
            res_create = await client.post(GRAPHQL_URL, json={
                "query": query_create,
                "variables": {"input": {"projectId": speckle_pid, "name": model_name_clean}}
            }, headers=HEADERS_SPECKLE)

        res_json = res_create.json()
        speckle_model_id = None
        try:
            speckle_model_id = res_json['data']['modelMutations']['create']['id']
        except (KeyError, TypeError):
            pass

        # 如果重名，附加时间戳重试
        if not speckle_model_id:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            model_name_retry = f"{model_name_clean}_{timestamp}"
            async with httpx.AsyncClient(timeout=30) as client:
                res_create = await client.post(GRAPHQL_URL, json={
                    "query": query_create,
                    "variables": {"input": {"projectId": speckle_pid, "name": model_name_retry}}
                }, headers=HEADERS_SPECKLE)
            res_json = res_create.json()
            try:
                speckle_model_id = res_json['data']['modelMutations']['create']['id']
            except (KeyError, TypeError):
                raise HTTPException(status_code=502, detail=f"Speckle 创建模型失败: {res_json}")

        print(f"[UPLOAD-SPECKLE] Speckle 模型创建成功: {speckle_model_id}")

        # ④ 获取 S3 上传 URL
        query_upload = """
        mutation GenerateIngestionUploadUrl($projectId: String!, $fileName: String!) {
          fileUploadMutations {
            generateUploadUrl(input: {projectId: $projectId, fileName: $fileName}) { fileId url }
          }
        }
        """
        async with httpx.AsyncClient(timeout=30) as client:
            res_upload = await client.post(GRAPHQL_URL, json={
                "query": query_upload,
                "variables": {"projectId": speckle_pid, "fileName": original_name}
            }, headers=HEADERS_SPECKLE)

        if res_upload.status_code != 200 or 'errors' in res_upload.json():
            raise HTTPException(status_code=502, detail=f"获取上传 URL 失败: {res_upload.text}")

        upload_data = res_upload.json()['data']['fileUploadMutations']['generateUploadUrl']
        upload_url = upload_data['url']
        speckle_file_id = upload_data['fileId']
        print(f"[UPLOAD-SPECKLE] 获取上传 URL 成功, fileId: {speckle_file_id}")

        # ⑤ 读取文件流并 PUT 到 S3
        print(f"[UPLOAD-SPECKLE] 开始流式 PUT 到 S3 (使用线程池并发)...")
        
        # 将游标复位，以防前面被消费
        await file.seek(0)

        import asyncio
        import requests

        def _do_s3_upload():
            return requests.put(
                upload_url,
                data=file.file,  # SpooledTemporaryFile 可以直接传给 requests 并自动加上 Content-Length
                headers={"Content-Type": "application/octet-stream"}
            )
            
        res_put = await asyncio.to_thread(_do_s3_upload)

        if res_put.status_code != 200:
            raise HTTPException(status_code=502, detail=f"S3 上传失败: {res_put.status_code}")

        raw_etag = res_put.headers.get('ETag', '')
        print(f"[UPLOAD-SPECKLE] S3 上传完成, ETag: {raw_etag}")

        # ⑥ 通知 Speckle 开始解析
        query_ingest = """
        mutation StartFileIngestion($projectId: String!, $modelId: String!, $fileId: String!, $etag: String!) {
          fileUploadMutations {
            startFileIngestion(input: {projectId: $projectId, modelId: $modelId, fileId: $fileId, etag: $etag}) { id }
          }
        }
        """
        async with httpx.AsyncClient(timeout=30) as client:
            res_ingest = await client.post(GRAPHQL_URL, json={
                "query": query_ingest,
                "variables": {
                    "projectId": speckle_pid,
                    "modelId": speckle_model_id,
                    "fileId": speckle_file_id,
                    "etag": raw_etag,
                }
            }, headers=HEADERS_SPECKLE)

        if res_ingest.status_code != 200 or 'errors' in res_ingest.json():
            raise HTTPException(status_code=502, detail=f"触发解析失败: {res_ingest.text}")

        # 提取 import_job_id
        import_job_id = ""
        try:
            import_job_id = res_ingest.json()['data']['fileUploadMutations']['startFileIngestion']['id']
        except (KeyError, TypeError):
            import_job_id = speckle_file_id  # 回退使用 fileId

        print(f"[UPLOAD-SPECKLE] Speckle 解析已触发, importJobId: {import_job_id}")

        # ⑦ 在 Supabase models 表 INSERT 记录
        model_record = {
            "project_id": safe_project_id,
            "name": original_name,
            "file_type": ext.upper() if ext not in ('step', 'stp', 'iges', 'igs') else ({'step': 'STEP', 'stp': 'STEP', 'iges': 'IGES', 'igs': 'IGES'}[ext]),
            "status": "PARSING",
            "progress": 10,
            "element_count": 0,
            "speckle_model_id": speckle_model_id,
            "speckle_stream_id": speckle_pid,
            "import_job_id": import_job_id,
            "import_status": "processing",
        }
        async with httpx.AsyncClient() as client:
            res_db = await client.post(
                f"{SUPABASE_URL}/rest/v1/models",
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
                json=model_record,
            )
        if res_db.status_code not in (200, 201):
            print(f"[ERROR] Supabase INSERT 失败: {res_db.status_code} {res_db.text}")
            raise HTTPException(status_code=500, detail="数据库记录创建失败")

        db_model = res_db.json()
        model_id = db_model[0]["id"] if isinstance(db_model, list) else db_model["id"]
        print(f"[UPLOAD-SPECKLE] 数据库记录创建成功, modelId: {model_id}")

        return {
            "model_id": model_id,
            "import_job_id": import_job_id,
            "speckle_model_id": speckle_model_id,
            "status": "processing",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] upload-to-speckle 异常: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ★ 查询 Speckle 文件导入状态 ★
# ============================================================

@app.get("/import-status/{import_job_id}")
async def get_import_status(
    import_job_id: str,
    _=Depends(_verify_token),
):
    """
    查询 Speckle 文件导入状态，完成后自动更新 Supabase 记录
    """
    safe_job_id = _safe_id(import_job_id)

    # ① 从 Supabase 查出对应的 model 记录
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/models?import_job_id=eq.{safe_job_id}&select=id,project_id,import_status,speckle_stream_id,speckle_model_id",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            },
        )
    if resp.status_code != 200 or not resp.json():
        raise HTTPException(status_code=404, detail="未找到对应的导入任务")

    model_row = resp.json()[0]
    model_id = model_row["id"]
    speckle_pid = model_row.get("speckle_stream_id") or SPECKLE_PROJECT_ID
    speckle_mid = model_row.get("speckle_model_id", "")
    current_status = model_row.get("import_status", "processing")

    # 如果已经是终态，直接返回
    if current_status in ("ready", "failed"):
        return {"status": current_status, "model_id": model_id}

    # ② 查询 Speckle 版本信息（检查解析是否完成）
    GRAPHQL_URL = f"{SPECKLE_SERVER_URL}/graphql"
    HEADERS_SPECKLE = {
        "Authorization": f"Bearer {SPECKLE_TOKEN}",
        "Content-Type": "application/json",
    }

    query_status = """
    query GetFileUploadStatus($projectId: String!, $fileId: String!) {
      project(id: $projectId) {
        fileUpload(id: $fileId) {
          convertedStatus
          convertedMessage
          convertedVersionId
        }
      }
    }
    """

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res_st = await client.post(GRAPHQL_URL, json={
                "query": query_status,
                "variables": {"projectId": speckle_pid, "fileId": safe_job_id}
            }, headers=HEADERS_SPECKLE)

        if res_st.status_code == 200:
            fup = res_st.json().get("data", {}).get("project", {}).get("fileUpload", {})
            st = fup.get("convertedStatus")
            
            if st == 2:
                # 解析完成
                version_id = fup.get("convertedVersionId")
                print(f"[IMPORT-STATUS] 模型解析完成! versionId: {version_id}")

                await _update_supabase_model(model_id, {
                    "import_status": "ready",
                    "speckle_version_id": version_id,
                })

                return {
                    "status": "ready",
                    "model_id": model_id,
                    "speckle_version_id": version_id,
                }
            elif st == 3:
                # 解析失败
                err_msg = fup.get("convertedMessage")
                print(f"[IMPORT-STATUS] 模型解析彻底失败: {err_msg}")
                await _update_supabase_model(model_id, {
                    "import_status": "failed",
                    "import_error": err_msg,
                    "status": "FAILED",
                })
                return {"status": "failed", "model_id": model_id, "error": err_msg}

        # 仍在处理中
        return {"status": "processing", "model_id": model_id}

    except Exception as e:
        print(f"[ERROR] import-status 查询异常: {e}")
        # 检查是否 Speckle 报错
        await _update_supabase_model(model_id, {
            "import_status": "failed",
            "import_error": str(e)[:500],
            "status": "FAILED",
        })
        return {"status": "failed", "model_id": model_id, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)