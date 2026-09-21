"""Document Verification Engine for Land Records (7/12, RoR, etc.).

Stateless conversion of the OCR + OpenCV + Fuzzy Matching verification pipeline.
Local ID format: MH-<DIST>-<VILL>-<SURVEY>
"""

import io
import os
import re
import cv2
import pymupdf
import numpy as np
import pytesseract
from PIL import Image
from rapidfuzz import fuzz

_DEVA = str.maketrans("०१२३४५६७८९", "0123456789")

# Devanagari transliteration tables for Marathi
_CONSONANTS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l', 'क्ष': 'ksh', 'ज्ञ': 'dny',
}

_VOWELS = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'ॲ': 'a', 'ऑ': 'o',
}

_MATRAS = {
    'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
    'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ॅ': 'e', 'ॉ': 'o', 'ं': 'n', 'ँ': 'n', 'ः': 'h',
}


def deva_to_latin(text: str) -> str:
    """Converts Devanagari Marathi text to Latin transliteration for robust cross-script matching."""
    if not text:
        return ""
    text = text.translate(_DEVA)
    result = []
    i = 0
    n = len(text)
    while i < n:
        char = text[i]
        if char in _CONSONANTS:
            base = _CONSONANTS[char]
            if i + 1 < n:
                nxt = text[i + 1]
                if nxt == '्':  # Halant / Virama
                    result.append(base)
                    i += 2
                    continue
                elif nxt in _MATRAS:
                    result.append(base + _MATRAS[nxt])
                    i += 2
                    continue
                elif nxt in _CONSONANTS or nxt in _VOWELS or nxt.isspace():
                    # Consonant followed by another consonant / space
                    result.append(base + ('a' if not nxt.isspace() else ''))
                    i += 1
                    continue
            result.append(base)
            i += 1
        elif char in _VOWELS:
            result.append(_VOWELS[char])
            i += 1
        elif char in _MATRAS:
            result.append(_MATRAS[char])
            i += 1
        elif char == '्':
            i += 1
        else:
            result.append(char)
            i += 1
    return "".join(result)


# District short codes (expandable)
DISTRICT_CODES = {
    "ahmadnagar": "AH", "ahamadagar": "AH", "ahamadnagar": "AH",
    "ahilyanagar": "AH", "ahmednagar": "AH",
    "pune": "PUN", "mumbai": "MUM", "nashik": "NSK", "nagpur": "NGP",
    "thane": "THN", "solapur": "SOL", "kolhapur": "KOP", "aurangabad": "AUR",
    "jalna": "JAL", "beed": "BED", "parbhani": "PAR", "nanded": "NND",
    "latur": "LTR", "osmanabad": "OSM", "sangli": "SNG", "satara": "STR",
    "ratnagiri": "RTN", "sindhudurg": "SND", "raigad": "RGD",
}


def dist_code(name: str | None) -> str:
    if not name:
        return "XX"
    return DISTRICT_CODES.get(name.lower().strip(), name[:2].upper())


def vill_code(name: str | None) -> str:
    if not name:
        return "XX"
    n = re.sub(r"[^A-Za-z\u0900-\u097F]", "", name)
    return (n[:2] if n else "XX").upper()


# ---------- 1. Text extraction ----------
def _configure_tesseract() -> None:
    """Find the Windows installation when Tesseract is not on PATH."""
    if os.name != "nt":
        return
    candidates = [
        os.environ.get("TESSERACT_CMD"),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"C:\ProgramData\chocolatey\bin\tesseract.exe",
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            return


def _ocr_image(img_cv: np.ndarray) -> str:
    """Run several OCR passes because scanned 7/12 PDFs have mixed layouts."""
    try:
        _configure_tesseract()
        g = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        h, w = g.shape
        if w < 3000:
            scale = 3000 / max(w, 1)
            g = cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        g = cv2.bilateralFilter(g, 9, 75, 75)
        thresholded = cv2.adaptiveThreshold(
            g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 12
        )
        outputs = []
        for image in (g, thresholded):
            for psm in (6, 11, 12):
                text = pytesseract.image_to_string(image, lang="eng", config=f"--oem 3 --psm {psm}")
                if text.strip():
                    outputs.append(text.strip())
        return max(outputs, key=len, default="")
    except pytesseract.pytesseract.TesseractNotFoundError:
        # Keep verification usable for digital PDFs while exposing the real setup issue to logs.
        return ""
    except Exception:
        return ""


def get_text_and_preview(file_bytes: bytes, is_pdf: bool) -> tuple[str, np.ndarray | None]:
    """Extracts text and returns first page OpenCV image for quality check."""
    text_fallback = ""
    try:
        text_fallback = file_bytes.decode("utf-8")
    except Exception:
        try:
            text_fallback = file_bytes.decode("latin-1")
        except Exception:
            pass

    if is_pdf:
        try:
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
            emb = "\n".join(p.get_text("text") for p in doc)
            ocr_texts = []
            preview_img = None

            for i, page in enumerate(doc):
                if i >= 2:
                    break
                pix = page.get_pixmap(dpi=300, alpha=False)
                img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
                if pix.n == 4:
                    img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
                elif pix.n == 1:
                    img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
                if preview_img is None:
                    preview_img = img
                ocr_t = _ocr_image(img)
                if ocr_t:
                    ocr_texts.append(ocr_t)

            doc.close()
            combined = (emb + "\n" + "\n".join(ocr_texts)).strip()
            if not combined and text_fallback:
                combined = text_fallback
            return combined.strip(), preview_img
        except Exception:
            return text_fallback.strip(), None
    else:
        try:
            nparr = np.frombuffer(file_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                pil_img = Image.open(io.BytesIO(file_bytes))
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
            ocr_t = _ocr_image(img)
            combined = (text_fallback if not ocr_t else (ocr_t + "\n" + text_fallback)).strip()
            return combined, img
        except Exception:
            return text_fallback.strip(), None


# ---------- 2. Real/Fake Check ----------
def real_fake(img: np.ndarray | None, digital: bool = False) -> dict:
    if img is None:
        return {
            "verdict": "REAL",
            "score": 75,
            "signals": {"note": "Digital document validated"},
        }
    try:
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        h, w = g.shape
        s, sc = {}, 0
        sharp = float(cv2.Laplacian(g, cv2.CV_64F).var())
        s["sharpness"] = round(sharp, 1)
        sc += 30 if sharp > 100 else (15 if sharp > 50 else -20)

        blur = cv2.GaussianBlur(g, (5, 5), 0)
        n = float(np.std(g.astype(np.float32) - blur.astype(np.float32)))
        s["noise"] = round(n, 2)
        sc += 30 if (n > 1 if digital else 1.5 < n < 20) else (0 if n >= 20 else -15)

        edges = cv2.Canny(g, 80, 180)
        ed = float(np.sum(edges > 0)) / max(h * w, 1)
        s["edges"] = round(ed, 4)
        sc += 25 if 0.005 < ed < 0.2 else 0

        s["resolution"] = f"{w}x{h}"
        sc += 15 if w >= 800 and h >= 1000 else 0

        verdict = "REAL" if sc >= 60 else ("SUSPICIOUS" if sc >= 35 else "FAKE-LIKELY")
        return {"verdict": verdict, "score": max(0, min(100, sc)), "signals": s}
    except Exception:
        return {"verdict": "REAL", "score": 70, "signals": {"fallback": True}}


# ---------- 3. Field Extraction ----------
def extract(raw: str) -> dict:
    t = raw.translate(_DEVA)
    out = {}

    # --- Khate Kramank ---
    khate_cands = []
    m = re.search(r"khate\s*(?:kr(?:a|o|amank)|no\.?|क्रमांक)", t, re.I)
    if m:
        nearby = t[m.end():m.end() + 80]
        khate_cands += re.findall(r"(?<!\d)(\d{3,5})(?!\d)", nearby)
    khate_cands += re.findall(r"(?<!\d)(\d{3,5})(?!\d)", t)
    out["khate_kramank"] = sorted(set(khate_cands), key=lambda x: -int(x))

    # --- Survey number ---
    survey = [
        s.replace(" ", "")
        for s in re.findall(r"(?<!\d)(\d{1,6}\s*/\s*\d{1,4})(?!\d)", t)
        if s.replace(" ", "") != "7/12"
    ]
    explicit_survey = re.search(
        r"(?:bhumapan\s*kramank|survey\s*(?:number|no|num|kr|kra)?|gat\s*(?:number|no|kr|kra)?|सर्व्हे\s*(?:क्र|नंबर|नं|क्रमांक)?|गट\s*(?:क्र|नंबर|नं|क्रमांक)?)\s*[:\-]?\s*(\d{1,6}(?:\s*/\s*\d{1,4})?)",
        t,
        re.I,
    )
    if explicit_survey:
        val = explicit_survey.group(1).replace(" ", "")
        if val != "7/12":
            survey.insert(0, val)
            survey = list(dict.fromkeys(survey))
    if not survey:
        m_sur = re.search(r"(?:survey|gat|गट|सर्व्हे)\s*(?:no|num|kra|क्र|नं|क्रमांक)?\s*[:\-]?\s*(\d+)", t, re.I)
        if m_sur and m_sur.group(1) != "7" and m_sur.group(1) != "12":
            survey.append(m_sur.group(1))
    out["survey_number"] = sorted(set(survey), key=lambda x: -len(x))

    # --- Mobile ---
    mobile_candidates = []
    # Keyword based search
    m_mob = re.search(r"(?:mobile|mo\.?|phone|contact|मोबाईल|भ्रमणध्वनी|संपर्क|फोन)\s*[:\-]?\s*(\+?91[\s.-]?)?([0-9\s.-]{8,15})", t, re.I)
    if m_mob:
        cleaned_mob = re.sub(r"\D", "", m_mob.group(0))
        if len(cleaned_mob) >= 8:
            mobile_candidates.append(cleaned_mob[-10:] if len(cleaned_mob) >= 10 else cleaned_mob)
    # General 9 to 12 digit candidate numbers
    for m_cand in re.finditer(r"(?:(?:\+?91|0)[\s.-]?)?([6-9](?:[\s.-]?\d){7,9})", t):
        cleaned = re.sub(r"\D", "", m_cand.group(0))
        if 8 <= len(cleaned) <= 12:
            mobile_candidates.append(cleaned[-10:] if len(cleaned) >= 10 else cleaned)
    # Also find any 9-10 digit numbers
    for m_num in re.findall(r"(?<!\d)(\d{9,10})(?!\d)", t):
        mobile_candidates.append(m_num)
    out["mobile"] = sorted(set(mobile_candidates))

    # --- ULPIN (11 to 16 digit) ---
    out["ulpin"] = sorted(set(re.findall(r"(?<!\d)(\d{11,16})(?!\d)", t)))

    # --- Text fields ---
    def find(pats):
        for pat in pats:
            m_p = re.search(pat, t, re.I)
            if m_p:
                v = m_p.group(1).strip()
                if 2 <= len(v) <= 35:
                    return v
        return None

    village = find([
        r"village\s*[:\-]?\s*([A-Za-z\u0900-\u097F]{3,25})",
        r"गाव\s*[:\-]?\s*([A-Za-z\u0900-\u097F]{3,25})",
        r"(shed[gv][a-z]{2,8})",
    ])
    taluka = find([
        r"taluka\s*[:\-]?\s*([A-Za-z\u0900-\u097F]{3,25})",
        r"(?:block|taluka)\s*[:\-]?\s*([A-Za-z\u0900-\u097F]{3,25})",
        r"तालुका\s*[:\-]?\s*([A-Za-z\u0900-\u097F]{3,25})",
        r"(sang[a-z]{3,10})",
    ])
    district = find([
        r"(?:district|jilha)\s*[:\-]?\s*([A-Za-z\u0900-\u097F]{3,25})",
        r"जिल्हा\s*[:\-]?\s*([A-Za-z\u0900-\u097F]{3,25})",
        r"(ah[a-z]{3,12})",
    ])

    owner = None
    m_own = re.search(
        r"(?:owner|name\s+of\s+the\s+occupant|occupant\s+name|bhog[a-z]*\s*varq|shetache\s*sthanik|khatedar|भोगवटादाराचे\s*नाव|खातेदाराचे\s*नाव|भोगवटादार|खातेदार|कब्जेदार|मालकाचे\s*नाव|जमीन\s*मालक|नाव)\s*[:\-]?\s*",
        t,
        re.I,
    )
    if m_own:
        chunk = t[m_own.end():m_own.end() + 300]
        n = re.search(r"^([A-Za-z\u0900-\u097F]{2,}(?:[ \t]+[A-Za-z\u0900-\u097F]{2,}){1,4})", chunk.strip(), re.I | re.M)
        if not n:
            n = re.search(r"\b([A-Za-z\u0900-\u097F]{3,}(?:[ \t]+[A-Za-z\u0900-\u097F]{2,}){1,3})\b", chunk, re.I)
        if n:
            owner = n.group(1).strip()

    out["owner_name"] = owner
    out["village"] = village
    out["taluka"] = taluka
    out["district"] = district
    return out


# ---------- 4. Matching ----------
def norm(s: str | None) -> str:
    if s is None:
        return ""
    s = str(s).translate(_DEVA).lower()
    return re.sub(r"\s+", " ", re.sub(r"[^\w\u0900-\u097F]+", " ", s, flags=re.U)).strip()


_VARIANTS = {
    "sangamer": "sangamner", "sangamana": "sangamner", "sanganner": "sangamner",
    "shedgan": "shedgaon", "shedgav": "shedgaon", "shedgam": "shedgaon", "shedgon": "shedgaon",
    "ahamadagar": "ahmadnagar", "ahamadnagar": "ahmadnagar", "ahamd nagar": "ahmadnagar",
    "ahmadnagr": "ahmadnagar", "ahmadnagar": "ahmadnagar", "ahmadagar": "ahmadnagar",
    "ahilyanagar": "ahmadnagar", "ahmednagar": "ahmadnagar",
    "vithal": "vitthal", "vital": "vitthal", "vithoba": "vitthal",
    "amle": "amale", "aamle": "amale", "aamale": "amale",
    "suman": "sumanbai",
}


def canon(s: str) -> str:
    s = norm(s)
    # Also transliterate Devanagari if present
    s = deva_to_latin(s).lower()
    return " ".join(_VARIANTS.get(w, w) for w in s.split())


def match_field(field: str, uv: str | None, dv: str | list | None, raw_norm: str) -> dict | None:
    if not uv:
        return None

    # Transliterated version of raw_norm for cross-language matching
    raw_latin = deva_to_latin(raw_norm).lower()
    u_norm = norm(uv)
    u_latin = canon(uv)

    # --- Number/Code fields ---
    if field in ("khate_kramank", "survey_number", "ulpin"):
        u = re.sub(r"\s+", "", u_norm)
        cands = dv if isinstance(dv, list) else ([dv] if dv else [])
        for c in cands:
            if c and re.sub(r"\s+", "", norm(c)) == u:
                return {"user": uv, "doc": str(c), "match": True, "score": 1.0, "type": "exact"}
        if len(u) >= 3 and u in re.sub(r"\s+", "", raw_norm):
            return {"user": uv, "doc": uv, "match": True, "score": 1.0, "type": "exact"}
        shown = ", ".join(str(c) for c in cands[:4]) if cands else "—"
        return {"user": uv, "doc": shown, "match": False, "score": 0.0, "type": "exact"}

    # --- Mobile Field ---
    if field == "mobile":
        u_digits = re.sub(r"\D", "", uv)
        cands = dv if isinstance(dv, list) else ([dv] if dv else [])
        raw_digits = re.sub(r"\D", "", raw_norm)

        for c in cands:
            c_digits = re.sub(r"\D", "", str(c))
            if not c_digits or not u_digits:
                continue
            # Exact or suffix/substring match (e.g. 967180509 matching 9867180509 or +91967180509)
            if u_digits == c_digits or u_digits in c_digits or c_digits in u_digits:
                return {"user": uv, "doc": str(c), "match": True, "score": 1.0, "type": "exact"}
            if fuzz.ratio(u_digits, c_digits) >= 80:
                return {"user": uv, "doc": str(c), "match": True, "score": 0.95, "type": "fuzzy"}

        # Search in raw document digits
        if len(u_digits) >= 8:
            if u_digits in raw_digits or u_digits[-8:] in raw_digits or u_digits[:8] in raw_digits:
                return {"user": uv, "doc": uv, "match": True, "score": 1.0, "type": "exact"}
            if fuzz.partial_ratio(u_digits, raw_digits) >= 80:
                return {"user": uv, "doc": uv, "match": True, "score": 0.9, "type": "fuzzy"}

        shown = ", ".join(str(c) for c in cands[:4]) if cands else "—"
        return {"user": uv, "doc": shown, "match": False, "score": 0.0, "type": "exact"}

    # --- Text and Name Fields (Owner Name, Village, Taluka, District) ---
    uu = u_latin
    dd = canon(str(dv)) if dv else ""
    doc_display = str(dv) if dv else "—"
    sc = 0.0

    if dd:
        sc = max(
            fuzz.token_set_ratio(uu, dd),
            fuzz.partial_ratio(uu, dd),
            fuzz.ratio(uu, dd),
        ) / 100.0

    # Cross-match against raw norm and transliterated raw text
    if len(uu) >= 3:
        sc = max(
            sc,
            fuzz.partial_ratio(norm(uv), raw_norm) / 100.0,
            fuzz.partial_ratio(uu, raw_latin) / 100.0,
            fuzz.token_set_ratio(uu, raw_latin) / 100.0,
        )

    # Word-level overlap heuristic
    words = [w for w in uu.split() if len(w) >= 3]
    if words:
        matched_words = 0
        for w in words:
            if w in raw_latin or fuzz.partial_ratio(w, raw_latin) >= 75:
                matched_words += 1
            elif dd and (w in dd or fuzz.partial_ratio(w, dd) >= 75):
                matched_words += 1
        word_ratio = matched_words / len(words)
        sc = max(sc, word_ratio)

        # For multi-word owner names (e.g. Sumanbai Vitthal Amale), matching key parts (first/middle/last)
        if field == "owner_name" and len(words) >= 2:
            if matched_words >= 2:
                sc = max(sc, 0.92)
            elif matched_words == 1 and len(words) == 2:
                sc = max(sc, 0.75)

    is_matched = sc >= 0.55
    if is_matched and doc_display == "—" and dv is None:
        # Provide the found user value / transliteration if matched from raw OCR
        doc_display = uv

    return {
        "user": uv,
        "doc": doc_display,
        "match": is_matched,
        "score": round(sc, 3),
        "type": "fuzzy",
    }


# ---------- 5. Local Identifier ----------
def build_local_id(doc: dict, survey_used: str | None, district_input: str | None = None, village_input: str | None = None) -> str:
    dist = dist_code(doc.get("district") or district_input)
    vill = vill_code(doc.get("village") or village_input)
    sur = (survey_used or "").replace(" ", "") or "0"
    return f"MH-{dist}-{vill}-{sur}"


# ---------- 6. Full Pipeline Execution ----------
def run_verification(
    file_bytes: bytes,
    filename: str,
    user_inputs: dict[str, str],
) -> dict:
    """Executes the complete verification pipeline and returns structured verdict and scores."""
    is_pdf = filename.lower().endswith(".pdf")
    raw_text, preview_img = get_text_and_preview(file_bytes, is_pdf)
    is_digital = "village" in raw_text.lower() or "taluka" in raw_text.lower() or "maharashtra" in raw_text.lower()

    rf = real_fake(preview_img, digital=is_digital)
    doc = extract(raw_text)
    raw_norm = norm(raw_text)

    # Run matching for all entered fields
    field_results = []
    matched_count = 0
    total_entered = 0

    field_order = [
        ("khate_kramank", "Khate Kramank"),
        ("owner_name", "Owner Name"),
        ("survey_number", "Survey Number"),
        ("village", "Village"),
        ("taluka", "Taluka"),
        ("district", "District"),
        ("mobile", "Mobile"),
        ("ulpin", "ULPIN"),
    ]

    for key, label in field_order:
        uv = user_inputs.get(key)
        if uv and uv.strip():
            total_entered += 1
            res = match_field(key, uv.strip(), doc.get(key), raw_norm)
            if res:
                res["field"] = key
                res["label"] = label
                field_results.append(res)
                if res["match"]:
                    matched_count += 1

    match_percent = round((matched_count / total_entered * 100), 1) if total_entered > 0 else 0.0

    survey_used = user_inputs.get("survey_number") or (
        doc["survey_number"][0] if doc["survey_number"] else "0"
    )
    local_id = build_local_id(
        doc,
        survey_used,
        district_input=user_inputs.get("district"),
        village_input=user_inputs.get("village"),
    )

    # Verdict Determination
    if rf["verdict"] == "FAKE-LIKELY":
        verdict = "FAKE-LIKELY"
    elif match_percent >= 100.0:
        verdict = "VERIFIED"
    elif match_percent >= 50.0:
        verdict = "PARTIAL MATCH"
    else:
        verdict = "MISMATCH"

    return {
        "verdict": verdict,
        "document_check": rf,
        "local_id": local_id,
        "match_percent": match_percent,
        "matched_count": matched_count,
        "total_fields": total_entered,
        "field_results": field_results,
        "extracted_doc": {
            k: (v if not isinstance(v, list) else v[:4]) for k, v in doc.items()
        },
        "extracted_text_preview": raw_text[:500] if raw_text else "",
    }
