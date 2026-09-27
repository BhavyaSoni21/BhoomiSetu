"""One-shot: push the 600 code-used i18n keys (English seed built on the frontend)
into all 11 backend static/ui_strings_*.json, translating en->lang via Bhashini in
batches. Idempotent: only fills keys missing from each target file. Resumable.

Usage:
  python scripts/translate_ui_strings.py --langs ta --limit 5   # smoke test
  python scripts/translate_ui_strings.py                        # full run (10 langs)
"""
import argparse, asyncio, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import httpx
from app.config import get_settings
from app.services.bhashini import _get_config, _find_matching_service

SEED = Path("D:/Projects/SIH_2026_BhoomiSetu/frontend/scripts/_seed_complete_en.json")
STATIC = Path(__file__).parent.parent / "static"
TARGET_LANGS = ["hi", "bn", "gu", "kn", "ml", "mr", "or", "pa", "ta", "te"]
CHUNK = 25


async def translate_batch(sources: list[str], target: str, settings) -> list[str]:
    config = await _get_config("translation", "en", target)
    svc = _find_matching_service(config, "en", target)
    service_id = svc["serviceId"]
    api_key = config["pipelineInferenceAPIEndPoint"]["inferenceApiKey"]
    payload = {
        "pipelineTasks": [{
            "taskType": "translation",
            "config": {"language": {"sourceLanguage": "en", "targetLanguage": target}, "serviceId": service_id},
        }],
        "inputData": {"input": [{"source": s} for s in sources]},
    }
    headers = {"Content-Type": "application/json", api_key["name"]: api_key["value"]}
    async with httpx.AsyncClient(timeout=settings.bhashini_translation_timeout) as client:
        r = await client.post(settings.bhashini_inference_url, json=payload, headers=headers)
    r.raise_for_status()
    out = r.json()["pipelineResponse"][0]["output"]
    # Bhashini returns outputs in input order; fall back to source if short.
    return [(out[i].get("target") or sources[i]) if i < len(out) else sources[i] for i in range(len(sources))]


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", nargs="*", default=TARGET_LANGS)
    ap.add_argument("--limit", type=int, default=0, help="max keys per lang (0 = all)")
    args = ap.parse_args()
    settings = get_settings()

    seed = json.loads(SEED.read_text(encoding="utf-8"))
    print(f"seed: {len(seed)} English keys")

    # en base: merge verbatim (no translation)
    en_path = STATIC / "ui_strings_en.json"
    en_data = json.loads(en_path.read_text(encoding="utf-8"))
    added_en = 0
    for k, v in seed.items():
        if k not in en_data:
            en_data[k] = v; added_en += 1
    en_path.write_text(json.dumps(en_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"ui_strings_en.json: +{added_en} keys")

    for lang in args.langs:
        path = STATIC / f"ui_strings_{lang}.json"
        data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        missing = [k for k in seed if k not in data]
        if args.limit:
            missing = missing[: args.limit]
        if not missing:
            print(f"{lang}: nothing missing"); continue
        print(f"{lang}: translating {len(missing)} keys...", flush=True)
        for i in range(0, len(missing), CHUNK):
            chunk_keys = missing[i : i + CHUNK]
            srcs = [seed[k] for k in chunk_keys]
            try:
                outs = await translate_batch(srcs, lang, settings)
            except Exception as e:
                print(f"  chunk {i}-{i+len(chunk_keys)} FAILED: {e}"); continue
            for k, o in zip(chunk_keys, outs):
                data[k] = o
            print(f"  {min(i+CHUNK, len(missing))}/{len(missing)}", flush=True)
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")  # checkpoint
        print(f"{lang}: done ({len(data)} total keys)")


if __name__ == "__main__":
    asyncio.run(main())
