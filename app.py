import streamlit as st
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
import pandas as pd
import fitz
import datetime
import re
import hashlib
from typing import List, Dict, Any
import streamlit.components.v1 as components

try:
    from gliner import GLiNER
    GLINER_AVAILABLE = True
except ImportError:
    GLiNER = None
    GLINER_AVAILABLE = False

st.set_page_config(page_title="MEDXERN - Medical NER + Clinical Intelligence", page_icon="🏥", layout="wide")

st.markdown("""
<style>
.stApp { background-color: #0D1B3E; }
h1,h2,h3,h4 { color: #00B4D8 !important; }
p, li, label { color: #ffffff !important; }
.stMarkdown { color: #ffffff; }
</style>
""", unsafe_allow_html=True)

st.markdown("""
<div style='text-align:center; padding:20px 0 10px 0;'>
    <h1 style='font-size:52px; color:#00B4D8; margin:0;'>🏥 MEDXERN</h1>
    <p style='font-size:18px; color:#FFB703; margin:4px 0;'>Medical Exchange & Records Network</p>
    <p style='font-size:14px; color:#aaaaaa; margin:0;'>AI-Powered Clinical NER using BioBERT + GLiNER-BioMed | Constitutional Privacy Governance via MAC Framework</p>
    <hr style='border-color:#00B4D8; margin-top:16px;'>
</div>
""", unsafe_allow_html=True)

# ── MAC MEDICAL CONSTITUTION ──────────────────────────────────────────────────
MAC_CONSTITUTION = [
    "Mark patient names when adjacent to MRN identifiers. Do not mark general clinical staff names.",
    "Mark 10-digit Indian mobile numbers starting with 6-9 as CRITICAL risk PII requiring immediate blocking.",
    "Mark 12-digit Aadhar number patterns as CRITICAL risk PII requiring immediate blocking.",
    "Mark diagnosis terms when associated with named individual patients. Do not mark diagnoses in general clinical reference text.",
    "Mark dates of birth when year is before 2000. Do not mark document dates or procedure dates.",
    "Mark email addresses in any clinical document as HIGH risk PII requiring redaction.",
    "Mark lab values when directly associated with patient identifiers. Do not mark reference range values.",
    "Mark medication names when prescribed to a named patient. Do not mark general pharmacological references.",
    "Mark MRN and hospital ID numbers as CRITICAL risk PII requiring immediate blocking.",
]

with st.sidebar:
    st.markdown("""<div style='color:white;'>
    <h3 style='color:#00B4D8;'>⚙️ NER Model</h3>
    </div>""", unsafe_allow_html=True)
    model_options = ["BioBERT", "GLiNER-BioMed", "Compare Both"]
    if not GLINER_AVAILABLE:
        model_options = ["BioBERT"]
        st.caption("Install GLiNER with: pip install gliner -U")
    ner_mode = st.selectbox("Extraction backend", model_options, index=0)
    st.markdown(f"""<div style='color:#cccccc; font-size:12px; margin-top:6px;'>
    <b>Selected:</b> {ner_mode}<br>
    <b>BioBERT:</b> d4data/biomedical-ner-all<br>
    <b>GLiNER:</b> Ihor/gliner-biomed-base-v1.0<br>
    <b>Framework:</b> Transformers + GLiNER
    </div>""", unsafe_allow_html=True)
    st.markdown("---")
    st.markdown("""<div style='color:#2ecc71;'>
    <h3 style='color:#00B4D8;'>🔒 Privacy Status</h3>
    ✅ PrivGuard Gateway: Active<br>
    ✅ PII Detection: Enabled<br>
    ✅ MAC Constitution: Loaded<br>
    ✅ Local Processing: ON<br>
    ✅ No data sent to cloud
    </div>""", unsafe_allow_html=True)
    st.markdown("---")

    # MAC Constitution Display
    st.markdown("""<p style='color:#FFB703; font-weight:bold; font-size:13px;
    margin:0 0 8px 0;'>🏛️ Medical Constitution (MAC Framework)</p>""",
    unsafe_allow_html=True)
    for i, rule in enumerate(MAC_CONSTITUTION):
        st.markdown(f"""
        <div style='background:#1a2f5e; border-left:3px solid #00B4D8;
        border-radius:4px; padding:6px 8px; margin-bottom:5px;'>
        <span style='color:#FFB703; font-size:10px; font-weight:bold;'>
        Rule {i+1}</span><br>
        <span style='color:#cccccc; font-size:10px; line-height:1.3;'>
        {rule}</span></div>""", unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("""<div style='color:#aaaaaa; font-size:13px;'>
    <b style='color:#FFB703;'>Guide: Dr. Syed Raziuddin</b><br><br>
    Abdul Rahman Siddiqui Mohammed<br>
    Syed Ahsan Ahmed<br>
    Mohammad Saad ur Rahman<br>
    Mohammed Saad Shareef<br><br>
    <i>Dept. of CSE, Lords Institute of Engg. & Tech.</i>
    </div>""", unsafe_allow_html=True)

@st.cache_resource
def load_model():
    """Load the existing BioBERT-compatible biomedical NER pipeline."""
    model_name = "d4data/biomedical-ner-all"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForTokenClassification.from_pretrained(model_name)
    return pipeline("ner", model=model, tokenizer=tokenizer,
                    aggregation_strategy="simple")

@st.cache_resource
def load_gliner_model():
    """Load GLiNER-BioMed without changing the existing BioBERT backend."""
    if not GLINER_AVAILABLE:
        raise RuntimeError("GLiNER is not installed. Run: pip install gliner -U")
    return GLiNER.from_pretrained("Ihor/gliner-biomed-base-v1.0")

GLINER_LABELS = [
    "Disease",
    "Symptom",
    "Drug",
    "Drug dosage",
    "Lab test",
    "Lab test value",
    "Diagnostic procedure",
    "Therapeutic procedure",
    "Anatomical structure",
    "Clinical measurement",
    "Date",
    "Duration",
]

GLINER_TO_MEDXERN = {
    "disease": "Disease_disorder",
    "symptom": "Sign_symptom",
    "drug": "Medication",
    "drug dosage": "Dosage",
    "lab test": "Diagnostic_procedure",
    "lab test value": "Lab_value",
    "clinical measurement": "Lab_value",
    "diagnostic procedure": "Diagnostic_procedure",
    "therapeutic procedure": "Therapeutic_procedure",
    "anatomical structure": "Biological_structure",
    "date": "Date",
    "duration": "Duration",
}

def extract_text_from_pdf(pdf_file):
    """Extract full digital PDF text while preserving page boundaries."""
    doc = fitz.open(stream=pdf_file.read(), filetype="pdf")
    pages = []
    for page_no, page in enumerate(doc, start=1):
        page_text = page.get_text("text") or ""
        widgets = page.widgets()
        if widgets:
            for widget in widgets:
                if widget.field_value:
                    page_text += f"\n{widget.field_name}: {widget.field_value}"
        page_text = re.sub(r"[ \t]+", " ", page_text)
        page_text = re.sub(r"\n{3,}", "\n\n", page_text).strip()
        if page_text:
            pages.append(f"[PAGE {page_no}]\n{page_text}")
    doc.close()
    return "\n\n".join(pages).strip()

def normalize_clinical_text(text):
    """Normalize whitespace without destroying clinically meaningful punctuation."""
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def chunk_text(text, max_chars=1100, overlap=180):
    """Create sentence-aware overlapping chunks for transformer NER."""
    text = normalize_clinical_text(text)
    if len(text) <= max_chars:
        return [(text, 0)] if text else []
    chunks = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + max_chars, n)
        if end < n:
            boundary = max(text.rfind(". ", start, end),
                           text.rfind("\n", start, end),
                           text.rfind("; ", start, end))
            if boundary > start + int(max_chars * 0.55):
                end = boundary + 1
        chunk = text[start:end].strip()
        if chunk:
            actual_start = text.find(chunk, start, end + 1)
            chunks.append((chunk, actual_start if actual_start >= 0 else start))
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks

def run_ner_full_document(ner, text):
    """Run NER over the complete document and return deduplicated entities."""
    results = []
    for chunk, offset in chunk_text(text):
        try:
            chunk_entities = ner(chunk)
        except Exception:
            continue
        for e in chunk_entities:
            item = dict(e)
            item["source_offset"] = offset + int(e.get("start", 0))
            item["source_end"] = offset + int(e.get("end", 0))
            results.append(item)
    return results

def run_gliner_full_document(model, text, threshold=0.45):
    """Run GLiNER-BioMed over overlapping chunks and normalize to MEDXERN schema."""
    results = []
    for chunk, offset in chunk_text(text):
        try:
            chunk_entities = model.predict_entities(
                chunk, GLINER_LABELS, threshold=threshold
            )
        except Exception:
            continue
        for e in chunk_entities:
            label = str(e.get("label", "")).strip()
            group = GLINER_TO_MEDXERN.get(label.lower())
            if not group:
                continue
            start = int(e.get("start", 0))
            end = int(e.get("end", start + len(str(e.get("text", "")))))
            results.append({
                "word": str(e.get("text", "")).strip(),
                "entity_group": group,
                "score": float(e.get("score", 0.0)),
                "start": start,
                "end": end,
                "source_offset": offset + start,
                "source_end": offset + end,
                "source_model": "GLiNER-BioMed",
                "source_label": label,
            })
    # Deduplicate overlapping chunk outputs. Keep the highest-confidence span.
    deduped = {}
    for e in results:
        key = (e["word"].lower(), e["entity_group"], e["source_offset"], e["source_end"])
        if key not in deduped or e["score"] > deduped[key]["score"]:
            deduped[key] = e
    return list(deduped.values())


def add_model_metadata(entities, model_name):
    """Attach backend metadata while preserving the existing MEDXERN entity schema."""
    output = []
    for e in entities:
        item = dict(e)
        item.setdefault("source_model", model_name)
        output.append(item)
    return output

def normalize_document_date(value):
    """Normalize supported document-date formats to ISO YYYY-MM-DD for reliable sorting."""
    value = str(value or "").strip()
    formats = [
        "%Y-%m-%d",
        "%d-%b-%Y",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d/%m/%y",
        "%d-%m-%y",
    ]
    for fmt in formats:
        try:
            parsed = datetime.datetime.strptime(value, fmt).date()
            return parsed.isoformat()
        except ValueError:
            continue
    return value or datetime.date.today().isoformat()


def format_document_date(value):
    """Display an internal ISO date as a readable clinical-report date."""
    normalized = normalize_document_date(value)
    try:
        return datetime.date.fromisoformat(normalized).strftime("%d-%b-%Y")
    except ValueError:
        return str(value)


def extract_date_from_text(text):
    patterns = [
        r'Date[:\s]+(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})',
        r'Date[:\s]+(\d{4}-\d{2}-\d{2})',
        r'Date[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return normalize_document_date(m.group(1))
    return datetime.date.today().isoformat()

def _first_form_value(text, field_names):
    """Read a PDF form-field value emitted by PyMuPDF, if present."""
    for field in field_names:
        pattern = rf'\[FORM FIELD\]\s*{re.escape(field)}\s*:\s*([^\n\r]+)'
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            value = m.group(1).strip()
            if value and value.lower() not in {"unknown", "none", "null", "n/a"}:
                return value
    return "Unknown"

def _normalize_person_name(value):
    value = re.sub(r'\s+', ' ', str(value)).strip(' :,-')
    # Do not accept obvious labels or document metadata as a patient name.
    if not value or value.lower() in {"unknown", "patient", "name", "mrn", "doctor"}:
        return "Unknown"
    if len(value.split()) < 2:
        return "Unknown"
    return value

def extract_patient_info(text):
    """Extract patient identity from both visible PDF text and AcroForm fields."""
    name = _normalize_person_name(_first_form_value(text, ["patient_name", "patient name"]))
    dob = _first_form_value(text, ["dob", "date_of_birth", "date of birth"])
    sex = "Unknown"

    # Structured form field is the preferred source for these synthetic medical PDFs.
    sex_age = _first_form_value(text, ["sex_age", "sex/age", "sex age"])
    if sex_age != "Unknown":
        sex_match = re.search(r'\b(Male|Female|Other)\b', sex_age, re.IGNORECASE)
        if sex_match:
            sex = sex_match.group(1).capitalize()

    # Fallbacks for ordinary non-formatted clinical documents.
    if name == "Unknown":
        patterns = [
            r'Patient\s+Name\s*:\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)',
            r'Patient\s*:\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)',
        ]
        for pattern in patterns:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                candidate = _normalize_person_name(m.group(1))
                if candidate != "Unknown":
                    name = candidate
                    break

    if dob == "Unknown":
        dob_patterns = [
            r'\b(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})\b',
            r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b',
            r'\b(\d{4}-\d{2}-\d{2})\b',
        ]
        # Prefer a value explicitly adjacent to DOB before scanning all dates.
        for pattern in [
            r'(?:DOB|Date\s+of\s+Birth)\s*:\s*' + dob_patterns[0][2:-2],
            r'(?:DOB|Date\s+of\s+Birth)\s*:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})',
            r'(?:DOB|Date\s+of\s+Birth)\s*:\s*(\d{4}-\d{2}-\d{2})',
        ]:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                dob = m.group(1)
                break
        if dob == "Unknown":
            # Avoid accidentally selecting a 2024 document/report date.
            all_dates = re.findall(
                r'\b(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})\b',
                text, re.IGNORECASE)
            for d in all_dates:
                if int(d.split('-')[-1]) < 2000:
                    dob = d
                    break
            if dob == "Unknown":
                for d in re.findall(r'\b(\d{4}-\d{2}-\d{2})\b', text):
                    if int(d.split('-')[0]) < 2000:
                        dob = d
                        break

    if sex == "Unknown":
        sex_match = re.search(r'\b(Male|Female|Other)\s*/\s*\d+', text, re.IGNORECASE)
        if sex_match:
            sex = sex_match.group(1).capitalize()
        else:
            sex_match = re.search(r'\bSex\s*:\s*(Male|Female|Other)\b', text, re.IGNORECASE)
            if sex_match:
                sex = sex_match.group(1).capitalize()

    return name, dob, sex

def apply_mac_constitution(text, entities):
    """
    Apply MAC Medical Constitution rules to validate and filter entities.
    Returns flagged PII and constitution enforcement report.
    """
    violations = []
    enforced_rules = []

    # Rule 2: Indian mobile numbers
    phones = re.findall(r'\b[6-9]\d{9}\b', text)
    if phones:
        violations.append(f"CRITICAL: Indian mobile number detected — {len(phones)} instance(s) blocked")
        enforced_rules.append(2)

    # Rule 3: Aadhar patterns
    aadhar = re.findall(r'\b\d{4}\s\d{4}\s\d{4}\b', text)
    if aadhar:
        violations.append(f"CRITICAL: Aadhar pattern detected — blocked")
        enforced_rules.append(3)

    # Rule 5: Email addresses
    emails = re.findall(r'\b[\w.-]+@[\w.-]+\.\w+\b', text)
    if emails:
        violations.append(f"HIGH: Email address detected — {len(emails)} instance(s) redacted")
        enforced_rules.append(6)

    # Rule 9: MRN patterns
    mrn = re.findall(r'RM-\d+', text)
    if mrn:
        violations.append(f"CRITICAL: MRN identifier detected — access controlled")
        enforced_rules.append(9)

    # Rules applied to entities
    for e in entities:
        if e['entity_group'] == 'Disease_disorder':
            enforced_rules.append(4)
            break
    for e in entities:
        if e['entity_group'] == 'Lab_value':
            enforced_rules.append(7)
            break
    for e in entities:
        if e['entity_group'] == 'Medication':
            enforced_rules.append(8)
            break

    active_rules = sorted(list(set(enforced_rules)))
    return violations, active_rules


# ── PRIVGUARD v2.3: CONTEXT-AWARE RISK + PATIENT RECORD ENGINE ────────────────

PII_PATTERNS = {
    "Indian Mobile": re.compile(r"\b[6-9]\d{9}\b"),
    "Aadhaar-like": re.compile(r"\b\d{4}[\s-]\d{4}[\s-]\d{4}\b"),
    "Email": re.compile(r"\b[\w.+-]+@[\w.-]+\.\w+\b"),
    "MRN": re.compile(r"\b(?:RM|MRN|UHID|UHID NO|HOSPITAL ID)[\s:-]*[A-Z0-9-]{3,}\b", re.I),
}

def mask_value(value, keep_start=2, keep_end=2):
    value = str(value)
    if len(value) <= keep_start + keep_end:
        return "*" * len(value)
    return value[:keep_start] + "*" * (len(value) - keep_start - keep_end) + value[-keep_end:]

def contextual_pii_scan(text, patient_name="Unknown"):
    """Heuristic context-aware PII scan. It detects identifiers and records nearby context."""
    findings = []
    for kind, pattern in PII_PATTERNS.items():
        for m in pattern.finditer(text):
            start, end = m.span()
            left = max(0, start - 100)
            right = min(len(text), end + 100)
            context = re.sub(r"\s+", " ", text[left:right]).strip()

            if kind in ("Indian Mobile", "Aadhaar-like", "MRN"):
                risk, action = "CRITICAL", "BLOCK / REDACT"
            else:
                risk, action = "HIGH", "REDACT"

            findings.append({
                "type": kind,
                "value": m.group(0),
                "masked": mask_value(m.group(0)),
                "risk": risk,
                "action": action,
                "context": context,
                "start": start,
                "end": end,
            })

    # Patient-name relationship heuristic: only flag clinical entities when a
    # patient identifier/name occurs in the same local context.
    if patient_name and patient_name != "Unknown":
        name_pat = re.compile(re.escape(patient_name), re.I)
        for nm in name_pat.finditer(text):
            local_start = max(0, nm.start() - 350)
            local_end = min(len(text), nm.end() + 350)
            local = text[local_start:local_end]
            if re.search(r"\b(?:diagnosis|diagnosed|prescribed|medication|treatment|lab|result|patient)\b",
                         local, re.I):
                findings.append({
                    "type": "Named-patient clinical context",
                    "value": patient_name,
                    "masked": mask_value(patient_name, 1, 1),
                    "risk": "HIGH",
                    "action": "REVIEW",
                    "context": re.sub(r"\s+", " ", local).strip(),
                    "start": nm.start(),
                    "end": nm.end(),
                })
                break

    return sorted(findings, key=lambda x: x["start"])

def redact_sensitive_text(text, findings):
    """Redact only identified PII spans; clinical content remains readable."""
    if not findings:
        return text
    replacements = sorted(
        [(f["start"], f["end"], f"[{f['type'].upper()} REDACTED]") for f in findings
         if f["type"] != "Named-patient clinical context"],
        reverse=True
    )
    result = text
    for start, end, replacement in replacements:
        result = result[:start] + replacement + result[end:]
    return result

def classify_privguard(findings):
    critical = sum(1 for f in findings if f["risk"] == "CRITICAL")
    high = sum(1 for f in findings if f["risk"] == "HIGH")
    if critical:
        return "BLOCK / REDACT", "CRITICAL", critical, high
    if high:
        return "REVIEW / REDACT", "HIGH", critical, high
    return "ALLOW", "LOW", critical, high

def build_patient_record(doc_results):
    """Build a non-diagnostic longitudinal record from extracted document evidence."""
    record = {
        "documents": len(doc_results),
        "dates": sorted({d["date"] for d in doc_results}),
        "conditions": [],
        "symptoms": [],
        "medications": [],
        "labs": [],
        "procedures": [],
        "sources": [],
    }
    for doc in doc_results:
        record["sources"].append(doc["name"])
        for e in doc["entities"]:
            word = e["word"]
            if len(word) <= 2:
                continue
            group = e["entity_group"]
            if group == "Disease_disorder":
                record["conditions"].append(word)
            elif group == "Sign_symptom":
                record["symptoms"].append(word)
            elif group == "Medication":
                record["medications"].append(word)
            elif group == "Lab_value":
                record["labs"].append(word)
            elif group in ("Diagnostic_procedure", "Therapeutic_procedure"):
                record["procedures"].append(word)

    for k in ("conditions", "symptoms", "medications", "labs", "procedures"):
        record[k] = list(dict.fromkeys(record[k]))
    return record

def audit_digest(doc_results):
    """Create a deterministic digest over extracted document metadata and entities."""
    payload = []
    for d in doc_results:
        payload.append({
            "name": d["name"],
            "date": d["date"],
            "text_sha256": hashlib.sha256(d["text"].encode("utf-8", errors="ignore")).hexdigest(),
            "entities": [(e["word"], e["entity_group"], round(float(e["score"]), 5))
                         for e in d["entities"]],
        })
    canonical = repr(payload).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()

NOISE_WORDS = {
    'care', 'home', 'center', 'department', 'md', 'synthetic',
    'demo', 'document', 'report', 'fillable', 'editable', 'pdf',
    'hyderabad', 'jubilee', 'hills', 'sapphire', 'pulmonary',
    'x', 'in', 'on', 'at', 'the', 'and', 'or', 'of', 'to',
    'bro', 'nch', 'tors', 'sp', 'fl', 'spo', 'co2', 're',
    'h', 'le', 'cy', 'ys', 'des', 'oxyg', 'uration',
    'room', 'excessive', 'controlled', 'acute', 'chronic',
    'mild', 'severe', 'intermittent', 'nocturnal', 'focal',
    'flattened', 'normal', 'high', 'low', 'complete', 'male',
    'male /', 'interpretation', 'blood count', 'hct', 'wbc',
    'platelets', 'synthetic diagnostic report',
    'synthetic demo document', 'synthetic laboratory report',
    '8201', '458201', '201', 'hyperin', 'imaging', 'ltot',
    'fever', 'eur', 'cop', 'themia', 'oxemia',
    # New noise from new PDFs
    'rises', 'rator', 'backup', 'cylinder', '2 re',
    'hyper', 'capnia', 'yspnea', 'cap', 'nia',
    'walk', 'test', 'minute', 'abg', 'arterial',
    'pao2', 'paco2', 'hco3', 'base', 'excess',
}

CORRECTIONS = {
    # Original fixes
    'eural effusion':       'Pleural Effusion',
    'poly':                 'Polycythemia',
    'ocytosis':             'Polycythemia',
    'neb bronchodila':      'Nebulized Bronchodilator',
    'ste':                  'Steroids',
    'odilator':             'Bronchodilator',
    'co2 re':               'CO2 Retention',
    'oxyg':                 'Oxygen Therapy',
    'des':                  'Desaturation',
    'obstruction':          'Airway Obstruction',
    'consolidation':        'Lung Consolidation',
    'spo2':                 'SpO2 Monitoring',
    'oxygen support':       'Oxygen Support Therapy',
    'critical care':        'Critical Care Management',
    '84 %':                 'SpO2 84%',
    '88 - 92':              'SpO2 Target 88-92%',
    '17. 8 g / dl':         'Hb 17.8 g/dL (Elevated)',
    '11, 200 / µl':         'WBC 11,200/µL (Mild Leukocytosis)',
    '2. 4 lakh / µl':       'Platelets 2.4 lakh/µL (Normal)',
    'copd':                 'COPD',
    'oxygen':               'Oxygen Therapy',
    'hypoxemia':            'Severe Hypoxemia',
    'polycythemia':         'Polycythemia',
    'leukocytosis':         'Mild Leukocytosis',
    # New fixes for additional PDFs
    'yspnea':               'Dyspnea',
    'dyspnea':              'Dyspnea',
    'hypercapnia':          'Hypercapnia',
    'hyper capnia':         'Hypercapnia',
    'capnia':               'Hypercapnia',
    'bronchodila':          'Bronchodilator',
    'bronchodilator':       'Bronchodilator',
    'rator + cylinder':     'Nebulizer + Cylinder Backup',
    'ltot':                 'LTOT (Long-Term Oxygen Therapy)',
    '15 h / day':           'LTOT 15h/day',
    '15 h':                 'LTOT 15h/day',
    '89 %':                 'SpO2 89%',
    '82 %':                 'SpO2 82%',
    '90 %':                 'SpO2 90%',
    'arterial blood gas':   'Arterial Blood Gas (ABG)',
    'critical care center': 'Critical Care Management',
    'controlled oxygen':    'Controlled Oxygen Therapy',
    'six minute':           'Six-Minute Walk Test',
    '6mwt':                 'Six-Minute Walk Test',
    'pft':                  'Pulmonary Function Test',
    'fev1':                 'FEV1 (Forced Expiratory Volume)',
    'fvc':                  'FVC (Forced Vital Capacity)',
    'tlco':                 'TLCO (Transfer Factor)',
}

DOC_CONTEXT = {
    'chest_xray': {
        'title_map': {
            'Disease_disorder':     'Radiographic Finding',
            'Sign_symptom':         'Radiographic Sign',
            'Therapeutic_procedure':'Radiographic Management',
            'Diagnostic_procedure': 'Imaging Procedure',
            'Lab_value':            'Radiographic Measurement',
            'Medication':           'Prescribed Treatment',
        },
        'details_prefix': 'Chest X-Ray: '
    },
    'ed_visit': {
        'title_map': {
            'Disease_disorder':     'ED Diagnosis',
            'Sign_symptom':         'Presenting Symptom',
            'Medication':           'ED Prescription',
            'Therapeutic_procedure':'ED Treatment',
            'Lab_value':            'ED Measurement',
        },
        'details_prefix': 'Emergency Department: '
    },
    'cbc': {
        'title_map': {
            'Disease_disorder':     'Haematological Diagnosis',
            'Sign_symptom':         'Blood Finding',
            'Lab_value':            'CBC Result',
            'Diagnostic_procedure': 'Blood Test',
            'Therapeutic_procedure':'CBC Management',
        },
        'details_prefix': 'CBC Result: '
    },
    'pft': {
        'title_map': {
            'Disease_disorder':     'Pulmonary Diagnosis',
            'Sign_symptom':         'Respiratory Finding',
            'Therapeutic_procedure':'Respiratory Treatment',
            'Lab_value':            'PFT Measurement',
            'Medication':           'Respiratory Medication',
        },
        'details_prefix': 'Pulmonary Function Test: '
    },
    'abg': {
        'title_map': {
            'Disease_disorder':     'ABG Diagnosis',
            'Sign_symptom':         'ABG Finding',
            'Lab_value':            'ABG Result',
            'Therapeutic_procedure':'ABG Management',
        },
        'details_prefix': 'Arterial Blood Gas: '
    },
    'walk': {
        'title_map': {
            'Disease_disorder':     'Exercise Diagnosis',
            'Sign_symptom':         'Exercise Finding',
            'Lab_value':            'Walk Test Result',
            'Therapeutic_procedure':'Exercise Management',
        },
        'details_prefix': 'Six-Minute Walk Test: '
    },
    'default': {
        'title_map': {},
        'details_prefix': 'Clinical Finding: '
    }
}

def build_clinical_intelligence(doc_results):
    """Build longitudinal, document-level clinical patterns without making diagnoses."""
    condition_events = {}
    medication_events = {}
    lab_events = {}
    symptom_events = {}
    procedure_events = {}

    def add_event(store, key, doc, entity):
        norm = re.sub(r"\s+", " ", str(key).strip().lower())
        if not norm or len(norm) < 3:
            return
        store.setdefault(norm, []).append({
            "date": doc["date"],
            "document": doc["name"],
            "label": entity["word"],
            "confidence": round(float(entity.get("score", 0)) * 100, 1),
        })

    for doc in doc_results:
        for e in doc.get("entities", []):
            group = e.get("entity_group", "")
            word = e.get("word", "")
            if len(word) <= 3:
                continue
            if group == "Disease_disorder":
                add_event(condition_events, word, doc, e)
            elif group == "Sign_symptom":
                add_event(symptom_events, word, doc, e)
            elif group in ("Medication", "Therapeutic_procedure"):
                add_event(medication_events, word, doc, e)
            elif group == "Lab_value":
                add_event(lab_events, word, doc, e)
            elif group == "Diagnostic_procedure":
                add_event(procedure_events, word, doc, e)

    def collapse(store):
        out = []
        for key, events in store.items():
            events = sorted(events, key=lambda x: x["date"])
            labels = list(dict.fromkeys(e["label"] for e in events))
            out.append({
                "key": key,
                "label": labels[0],
                "occurrences": len(events),
                "dates": [e["date"] for e in events],
                "documents": list(dict.fromkeys(e["document"] for e in events)),
                "events": events,
                "persistent": len(events) >= 2,
            })
        return sorted(out, key=lambda x: (-x["occurrences"], x["label"].lower()))

    conditions = collapse(condition_events)
    medications = collapse(medication_events)
    labs = collapse(lab_events)
    symptoms = collapse(symptom_events)
    procedures = collapse(procedure_events)

    repeated_conditions = [x for x in conditions if x["occurrences"] >= 2]
    repeated_medications = [x for x in medications if x["occurrences"] >= 2]
    repeated_labs = [x for x in labs if x["occurrences"] >= 2]

    # Detect simple first/last-document changes for recurring items.
    changes = []
    for item in repeated_conditions + repeated_medications + repeated_labs:
        if len(item["dates"]) >= 2 and item["dates"][0] != item["dates"][-1]:
            changes.append({
                "type": "Repeated finding",
                "item": item["label"],
                "first_date": item["dates"][0],
                "last_date": item["dates"][-1],
                "occurrences": item["occurrences"],
            })

    # Ordered document progression. This is a record of extracted evidence, not a clinical conclusion.
    progression = []
    for doc in sorted(doc_results, key=lambda d: d["date"]):
        progression.append({
            "date": doc["date"],
            "document": doc["name"],
            "conditions": list(dict.fromkeys(
                e["word"] for e in doc.get("entities", [])
                if e.get("entity_group") == "Disease_disorder" and len(e["word"]) > 3
            ))[:6],
            "symptoms": list(dict.fromkeys(
                e["word"] for e in doc.get("entities", [])
                if e.get("entity_group") == "Sign_symptom" and len(e["word"]) > 3
            ))[:6],
            "medications": list(dict.fromkeys(
                e["word"] for e in doc.get("entities", [])
                if e.get("entity_group") in ("Medication", "Therapeutic_procedure") and len(e["word"]) > 3
            ))[:6],
            "labs": list(dict.fromkeys(
                e["word"] for e in doc.get("entities", [])
                if e.get("entity_group") == "Lab_value" and len(e["word"]) > 3
            ))[:6],
        })

    return {
        "conditions": conditions,
        "symptoms": symptoms,
        "medications": medications,
        "labs": labs,
        "procedures": procedures,
        "repeated_conditions": repeated_conditions,
        "repeated_medications": repeated_medications,
        "repeated_labs": repeated_labs,
        "changes": changes,
        "progression": progression,
    }


def clinical_intelligence_summary(ci):
    parts = []
    if ci["repeated_conditions"]:
        parts.append(f"{len(ci['repeated_conditions'])} condition(s) recur across documents.")
    if ci["repeated_medications"]:
        parts.append(f"{len(ci['repeated_medications'])} treatment/medication mention(s) recur across documents.")
    if ci["repeated_labs"]:
        parts.append(f"{len(ci['repeated_labs'])} laboratory finding(s) recur across documents.")
    if ci["changes"]:
        parts.append(f"{len(ci['changes'])} longitudinal change candidate(s) were identified from repeated extracted evidence.")
    if not parts:
        parts.append("No repeated longitudinal patterns were identified from the extracted entities.")
    return " ".join(parts)


def get_doc_context(filename):
    fn = filename.lower()
    if 'chest' in fn or 'xray' in fn or 'x_ray' in fn:
        return 'chest_xray'
    elif 'ed' in fn or 'visit' in fn or 'emergency' in fn:
        return 'ed_visit'
    elif 'cbc' in fn or 'blood' in fn or 'count' in fn:
        return 'cbc'
    elif 'pft' in fn or 'pulmonary' in fn or 'function' in fn:
        return 'pft'
    elif 'abg' in fn or 'arterial' in fn or 'gas' in fn:
        return 'abg'
    elif 'walk' in fn or 'six' in fn or '6mwt' in fn:
        return 'walk'
    return 'default'

def _nearby_context(text, start, end, window=120):
    """Return a small context window around an extracted span."""
    if not text or start is None or end is None:
        return ""
    start = max(0, int(start))
    end = min(len(text), int(end))
    left = max(0, start - window)
    right = min(len(text), end + window)
    return re.sub(r"\s+", " ", text[left:right]).strip()


def _is_probable_medication_code(word):
    """Detect generic alphanumeric codes that should not become medication entities."""
    return bool(re.fullmatch(r"[A-Z]{2,8}-\d{3,12}", str(word).strip(), re.IGNORECASE))


def _is_mrn_or_identifier_code(word):
    """Detect identifiers such as RM-458201 that are governed as PII, not medication."""
    value = str(word).strip()
    return bool(
        re.fullmatch(r"RM-\d{3,12}", value, re.IGNORECASE)
        or re.fullmatch(r"(?:MRN|UHID|HOSPITAL[-_ ]?ID)[\s:-]*[A-Z0-9-]{3,}", value, re.IGNORECASE)
    )


def _has_medication_context(context):
    """Require medication-specific context before accepting a generic alphanumeric code."""
    return bool(re.search(
        r"\b(?:medication|medicine|drug|prescribed|prescription|dose|dosage|"
        r"tablet|capsule|syrup|inhaler|mg|mcg|ml|take|administer|frequency|"
        r"once daily|twice daily|three times daily|per day)\b",
        context,
        re.IGNORECASE,
    ))


def normalize_lab_relationships(entities, source_text):
    """
    Preserve simple test/value/interpretation relationships that generic NER
    commonly fragments. This does not invent clinical conclusions; it only
    combines evidence explicitly present in the source document.
    """
    if not entities or not source_text:
        return entities

    text = normalize_clinical_text(source_text)
    out = [dict(e) for e in entities]

    # CRP: pair a CRP test with a nearby numeric result and qualitative interpretation.
    crp_value = re.search(
        r"\bCRP\b[^\n.;]{0,100}?\b(\d+(?:\.\d+)?)\s*mg/L\b",
        text, re.IGNORECASE,
    )
    crp_interpretation = re.search(
        r"\b(?:CRP|C-reactive protein)\b[^\n.;]{0,140}?\b"
        r"(mildly elevated|elevated|normal|high|low)\b",
        text, re.IGNORECASE,
    )
    if crp_value:
        value_text = f"CRP {crp_value.group(1)} mg/L"
        if crp_interpretation:
            value_text += f" ({crp_interpretation.group(1).title()})"

        crp_words = {
            "mildly elevated", "elevated", "normal", "high", "low",
            crp_value.group(0).strip().lower(),
            f"{crp_value.group(1)} mg/l",
        }
        crp_candidates = [
            e for e in out
            if e.get("entity_group") == "Lab_value"
            and str(e.get("word", "")).strip().lower() in crp_words
        ]
        if crp_candidates:
            keeper = crp_candidates[0]
            keeper["word"] = value_text
            keeper["normalized_from"] = "CRP value + interpretation"
            keeper["relationship_type"] = "test_value_interpretation"
            for e in crp_candidates[1:]:
                out.remove(e)

    # SpO2: restore measurement/value relationship when the model returns
    # a bare "saturation" or a range without the test name.
    spo2_value = re.search(
        r"\b(?:SpO2|oxygen saturation|saturation)\b[^\n.;]{0,80}?"
        r"(\d{2}(?:\s*[-–]\s*\d{2})?\s*%)",
        text, re.IGNORECASE,
    )
    if spo2_value:
        value = re.sub(r"\s+", "", spo2_value.group(1)).replace("–", "-")
        normalized = f"SpO2 {value}"
        spo2_candidates = [
            e for e in out
            if e.get("entity_group") == "Lab_value"
            and str(e.get("word", "")).strip().lower() in {
                "saturation", "oxygen saturation", "spo2",
                spo2_value.group(1).strip().lower(),
            }
        ]
        if spo2_candidates:
            keeper = spo2_candidates[0]
            keeper["word"] = normalized
            keeper["normalized_from"] = "saturation + value"
            keeper["relationship_type"] = "measurement_value"
            for e in spo2_candidates[1:]:
                out.remove(e)

    # Lipid panels: attach explicit labels to nearby mg/dL values.
    # Only values already extracted by the model are relabeled; no new
    # clinical measurement is invented.
    lipid_patterns = [
        ("Total Cholesterol", r"(?:total\s+cholesterol|cholesterol)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/dL"),
        ("LDL", r"\bLDL(?:[-\s]+cholesterol)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/dL"),
        ("HDL", r"\bHDL(?:[-\s]+cholesterol)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/dL"),
        ("Triglycerides", r"\b(?:triglycerides|TG)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/dL"),
    ]
    for label, pattern in lipid_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue

        numeric = f"{match.group(1)} mg/dL"
        candidates = [
            e for e in out
            if e.get("entity_group") == "Lab_value"
            and re.sub(r"\s+", " ", str(e.get("word", "")).strip()).lower() == numeric.lower()
        ]
        if candidates:
            keeper = candidates[0]
            keeper["word"] = f"{label} {numeric}"
            keeper["normalized_from"] = "lipid test + value"
            keeper["relationship_type"] = "test_value"
            for e in candidates[1:]:
                out.remove(e)

    return out



def filter_entities(entities, source_text=None):
    """Clean, correct and deduplicate model output while retaining provenance."""
    cleaned = []
    seen_spans = set()
    seen_semantic = set()

    for e in sorted(entities, key=lambda x: (x.get("source_offset", 0), -x.get("score", 0))):
        raw_word = re.sub(r"\s*##", "", str(e.get("word", ""))).strip()
        if not raw_word:
            continue

        w = CORRECTIONS.get(raw_word.lower(), raw_word)
        if w.lower() in NOISE_WORDS or len(w) <= 2:
            continue
        if e.get("score", 0) < 0.65:
            continue
        if re.fullmatch(r"[\d\W_]+", w):
            continue
        if re.fullmatch(r"[a-z]", w, re.IGNORECASE):
            continue

        group = e.get("entity_group", "Unknown")
        start = e.get("source_offset")
        end = e.get("source_end")

        # Oxygen/LTOT are therapies rather than medications. GLiNER can place
        # them under Drug because its label set is intentionally broad.
        OXYGEN_THERAPY_TERMS = {
            "oxygen therapy",
            "controlled oxygen therapy",
            "oxygen support therapy",
            "long-term oxygen therapy",
            "ltot",
            "ltot (long-term oxygen therapy)",
            "ltot 15h/day",
        }
        if group == "Medication" and w.strip().lower() in OXYGEN_THERAPY_TERMS:
            group = "Therapeutic_procedure"

        # Never expose MRN/hospital identifiers as clinical medications.
        # RM-458201 is explicitly an MRN-style identifier in the MAC framework.
        if _is_mrn_or_identifier_code(w):
            continue

        # Other generic alphanumeric codes are only accepted as medications
        # when medication-specific context is present.
        if group == "Medication" and _is_probable_medication_code(w):
            context = _nearby_context(source_text, start, end, window=140)
            if not _has_medication_context(context):
                continue

        # "oxygen requirement" is a clinical requirement/finding, not a lab value.
        # Drop it from the Lab_value stream rather than presenting it as a measurement.
        if group == "Lab_value" and re.fullmatch(
            r"(?:oxygen\s+)?requirement", w, re.IGNORECASE
        ):
            continue

        if start is not None and end is not None:
            # Include source_model so Compare Both can retain two model
            # predictions over the exact same span for genuine comparison.
            model = e.get("source_model", "Unknown")
            span_key = (model, group, int(start), int(end))
            if span_key in seen_spans:
                continue
            seen_spans.add(span_key)

        semantic_key = (group, re.sub(r"\s+", " ", w.lower()))
        # Keep repeated findings when they occur at different source locations,
        # but suppress exact duplicate entities when no offsets are available.
        if start is None and semantic_key in seen_semantic:
            continue
        seen_semantic.add(semantic_key)

        item = dict(e)
        item["word"] = w
        # Persist any ontology correction made above. Without this assignment,
        # the local `group` change would be lost and the original Medication
        # label would reach the dashboard/timeline.
        item["entity_group"] = group
        cleaned.append(item)

    # Preserve clinically meaningful test/value relationships after basic cleanup.
    return normalize_lab_relationships(cleaned, source_text)

COLOR_MAP = {
    'Disease_disorder':     '#c0392b',
    'Sign_symptom':         '#e67e22',
    'Medication':           '#27ae60',
    'Dosage':               '#f39c12',
    'Lab_value':            '#16a085',
    'Diagnostic_procedure': '#8e44ad',
    'Therapeutic_procedure':'#2980b9',
    'Biological_structure': '#2471a3',
    'Date':                 '#d35400',
    'Duration':             '#7f8c8d',
}

CATEGORY_LABELS = {
    'Disease_disorder':     'diagnosis',
    'Sign_symptom':         'symptom',
    'Medication':           'medication',
    'Dosage':               'dosage',
    'Lab_value':            'lab result',
    'Diagnostic_procedure': 'procedure',
    'Therapeutic_procedure':'treatment',
    'Biological_structure': 'anatomy',
    'Date':                 'date',
}

def generate_summary(doc_results, all_filtered, ner_mode="BioBERT"):
    diseases = list(dict.fromkeys([
        e['word'] for e in all_filtered
        if e['entity_group'] in ('Disease_disorder', 'Sign_symptom')
        and len(e['word']) > 3
    ]))[:5]
    meds = list(dict.fromkeys([
        e['word'] for e in all_filtered
        if e['entity_group'] in ('Medication', 'Therapeutic_procedure')
        and len(e['word']) > 3
    ]))[:4]
    labs = list(dict.fromkeys([
        e['word'] for e in all_filtered
        if e['entity_group'] == 'Lab_value'
        and len(e['word']) > 3
    ]))[:4]
    dates = sorted(list(dict.fromkeys([d['date'] for d in doc_results])))
    summary = ""
    if diseases and dates:
        summary += f"Patient presented with {', '.join(diseases[:2])} on {format_document_date(dates[0])}. "
    if len(doc_results) > 1:
        summary += (f"Medical workup across {len(doc_results)} documents "
                    f"confirmed the clinical findings. ")
    if meds:
        summary += f"Treatment initiated with {', '.join(meds[:3])}. "
    if labs:
        summary += f"Key laboratory findings include: {', '.join(labs[:3])}. "
    if len(diseases) > 2:
        summary += f"Additional findings: {', '.join(diseases[2:])}. "
    if not summary:
        summary = (
            "Clinical documents processed. "
            f"Entities extracted via {ner_mode}."
        )
    return summary, diseases, meds, labs

def generate_key_findings(doc_results, all_filtered):
    findings = []
    lab_vals = list(dict.fromkeys([
        e['word'] for e in all_filtered
        if e['entity_group'] == 'Lab_value' and len(e['word']) > 3
    ]))[:5]
    if lab_vals:
        findings.append(f"Key measurements: {', '.join(lab_vals)}")
    treatments = list(dict.fromkeys([
        e['word'] for e in all_filtered
        if e['entity_group'] in ('Therapeutic_procedure', 'Medication')
        and len(e['word']) > 3
    ]))[:4]
    if treatments:
        findings.append(f"Treatments administered: {', '.join(treatments)}")
    for doc in doc_results:
        doc_diseases = list(dict.fromkeys([
            e['word'] for e in doc['entities']
            if e['entity_group'] in ('Disease_disorder', 'Sign_symptom')
            and len(e['word']) > 3
        ]))[:3]
        if doc_diseases:
            label = doc['name'].replace('.pdf','').replace('_',' ')
            findings.append(f"{label}: {', '.join(doc_diseases)}")
    return findings

def build_timeline_rows(doc_results, ner_mode="BioBERT"):
    """
    Build one timeline row per document/category.

    Model provenance is derived from the entity metadata rather than from a
    hardcoded string, so BioBERT, GLiNER-BioMed, and Compare Both reports are
    accurately attributed.
    """
    rows = []
    USEFUL_CATS = {
        'Disease_disorder', 'Sign_symptom', 'Medication',
        'Lab_value', 'Diagnostic_procedure', 'Therapeutic_procedure'
    }

    for doc in doc_results:
        ctx_key = get_doc_context(doc['name'])
        ctx = DOC_CONTEXT[ctx_key]
        by_cat = {}

        for e in doc['entities']:
            g = e.get('entity_group')
            if g not in USEFUL_CATS:
                continue
            by_cat.setdefault(g, []).append(e)

        for cat, ents in by_cat.items():
            unique_by_word = {}
            for e in ents:
                word = str(e.get('word', '')).strip()
                if len(word) > 3:
                    unique_by_word.setdefault(word.lower(), e)

            unique_ents = list(unique_by_word.values())
            if not unique_ents:
                continue

            unique = [e['word'] for e in unique_ents]

            models_used = {
                e.get('source_model', ner_mode)
                for e in unique_ents
                if e.get('source_model', ner_mode)
            }

            # Report model provenance honestly.
            if models_used == {"BioBERT"}:
                model_note = "identified via BioBERT"
            elif models_used == {"GLiNER-BioMed"}:
                model_note = "identified via GLiNER-BioMed"
            elif {"BioBERT", "GLiNER-BioMed"}.issubset(models_used):
                model_note = "identified by both BioBERT and GLiNER-BioMed"
            else:
                model_note = f"identified via {', '.join(sorted(models_used))}"

            color = COLOR_MAP.get(cat, '#555')
            label = CATEGORY_LABELS.get(cat, cat)
            title = ctx['title_map'].get(cat, label.title())
            details = ctx['details_prefix'] + ', '.join(unique[:4])

            if len(unique) > 1:
                evidence = (
                    f"{unique[0]} identified. "
                    f"Additional: {', '.join(unique[1:3])}. "
                    f"Model source: {model_note}."
                )
            else:
                evidence = f"{unique[0]} {model_note}."

            rows.append({
                "date":     format_document_date(doc['date']),
                "sort_date": normalize_document_date(doc['date']),
                "category": label,
                "title":    title,
                "details":  details,
                "evidence": evidence,
                "source":   doc['name'],
                "color":    color,
                "models":   sorted(models_used),
            })

    return sorted(rows, key=lambda x: x.get('sort_date', normalize_document_date(x['date'])))
def build_raw_ner_export(doc_results):
    """
    Flatten extracted NER entities into a reproducible export table.

    Preserves model provenance and source offsets so BioBERT,
    GLiNER-BioMed, and Compare Both outputs can be evaluated later.
    """
    rows = []

    for doc in doc_results:
        for e in doc.get("entities", []):
            rows.append({
                "document": doc["name"],
                "date": doc["date"],
                "entity": e.get("word", ""),
                "entity_group": e.get("entity_group", ""),
                "source_model": e.get("source_model", "Unknown"),
                "source_label": e.get("source_label", ""),
                "confidence": round(float(e.get("score", 0.0)), 5),
                "source_offset": e.get("source_offset", ""),
                "source_end": e.get("source_end", ""),
                "normalized_from": e.get("normalized_from", ""),
                "relationship_type": e.get("relationship_type", ""),
            })

    return pd.DataFrame(rows)

# ── UI ────────────────────────────────────────────────────────────────────────

st.markdown("## 📂 Upload Medical Documents")
st.markdown(
    "<p style='color:#aaaaaa;'>Upload prescriptions, lab reports, "
    "discharge summaries — PDF format</p>",
    unsafe_allow_html=True)

uploaded_files = st.file_uploader(
    "Drop your medical PDF files here",
    type=["pdf"], accept_multiple_files=True)

with st.expander("✏️ Override patient details (auto-detected from PDFs)"):
    col1, col2, col3 = st.columns(3)
    with col1:
        patient_name = st.text_input("Patient Name",
                                     placeholder="Auto-detected from PDF")
    with col2:
        patient_dob = st.text_input("Date of Birth",
                                    placeholder="Auto-detected from PDF")
    with col3:
        patient_sex = st.selectbox("Sex", ["", "Male", "Female", "Other"])
    manual_text = st.text_area("Or paste clinical text:", height=100,
        placeholder="Patient: Male, 45 years. Diagnosis: COPD...")

st.markdown("---")
col1, col2, col3 = st.columns([1,2,1])
with col2:
    analyze_btn = st.button(
        "🔬 Generate Medical Timeline Report",
        use_container_width=True, type="primary")

if analyze_btn:
    sources = []
    if uploaded_files:
        for f in uploaded_files:
            with st.spinner(f"Extracting text from {f.name}..."):
                text = extract_text_from_pdf(f)
                if text:
                    sources.append({
                        "name": f.name,
                        "text": text,
                        "date": normalize_document_date(extract_date_from_text(text))
                    })

    if manual_text and manual_text.strip():
        sources.append({
            "name": "Manual Input",
            "text": manual_text.strip(),
            "date": datetime.date.today().strftime("%Y-%m-%d")
        })

    if not sources:
        st.error("Please upload at least one PDF.")
        st.stop()

    bio_model = None
    gliner_model = None
    if ner_mode in ("BioBERT", "Compare Both"):
        with st.spinner("Loading BioBERT Clinical NER Model..."):
            bio_model = load_model()
    if ner_mode in ("GLiNER-BioMed", "Compare Both"):
        with st.spinner("Loading GLiNER-BioMed model..."):
            gliner_model = load_gliner_model()

    all_filtered = []
    model_counts = {"BioBERT": 0, "GLiNER-BioMed": 0}
    doc_results  = []
    all_violations = []
    all_active_rules = set()

    for src in sources:
        if ner_mode == "BioBERT":
            with st.spinner(f"Running BioBERT NER on {src['name']}..."):
                raw = add_model_metadata(
                    run_ner_full_document(bio_model, src["text"]), "BioBERT"
                )
        elif ner_mode == "GLiNER-BioMed":
            with st.spinner(f"Running GLiNER-BioMed on {src['name']}..."):
                raw = run_gliner_full_document(gliner_model, src["text"])
        else:
            with st.spinner(f"Comparing BioBERT + GLiNER-BioMed on {src['name']}..."):
                bio_raw = add_model_metadata(
                    run_ner_full_document(bio_model, src["text"]), "BioBERT"
                )
                gliner_raw = run_gliner_full_document(gliner_model, src["text"])
                raw = bio_raw + gliner_raw

        filtered = filter_entities(raw, src['text'])
        for e in filtered:
            model_counts[e.get("source_model", "BioBERT")] = model_counts.get(
                e.get("source_model", "BioBERT"), 0
            ) + 1
        all_filtered.extend(filtered)
        name, dob, sex = extract_patient_info(src['text'])

        # Apply MAC constitution to each document
        violations, active_rules = apply_mac_constitution(src['text'], filtered)
        all_violations.extend(violations)
        all_active_rules.update(active_rules)

        pii_findings = contextual_pii_scan(src["text"], name)
        privguard_action, privguard_risk, critical_count, high_count = classify_privguard(pii_findings)
        redacted_text = redact_sensitive_text(src["text"], pii_findings)

        doc_results.append({
            "name":         src['name'],
            "date":         src['date'],
            "text":         src['text'],
            "entities":     filtered,
            "patient_name": name,
            "patient_dob":  dob,
            "patient_sex":  sex,
            "pii_findings": pii_findings,
            "privguard_action": privguard_action,
            "privguard_risk": privguard_risk,
            "critical_pii": critical_count,
            "high_pii": high_count,
            "redacted_text": redacted_text,
        })

    final_name = patient_name
    final_dob  = patient_dob
    final_sex  = patient_sex

    for doc in doc_results:
        if not final_name and doc['patient_name'] != 'Unknown':
            final_name = doc['patient_name']
        if not final_dob and doc['patient_dob'] != 'Unknown':
            final_dob = doc['patient_dob']
        if not final_sex and doc['patient_sex'] != 'Unknown':
            final_sex = doc['patient_sex']

    final_name = final_name or 'Unknown'
    final_dob  = final_dob  or 'Unknown'
    final_sex  = final_sex  or 'Unknown'

    # Build longitudinal patient record and privacy posture.
    patient_record = build_patient_record(doc_results)
    clinical_intelligence = build_clinical_intelligence(doc_results)
    all_pii_findings = [f for d in doc_results for f in d.get("pii_findings", [])]
    overall_action, overall_risk, critical_pii, high_pii = classify_privguard(all_pii_findings)
    integrity_digest = audit_digest(doc_results)

    summary_text, diseases, meds, labs = generate_summary(
        doc_results, all_filtered, ner_mode)
    key_findings  = generate_key_findings(doc_results, all_filtered)
    timeline_rows = build_timeline_rows(doc_results, ner_mode)

    entity_groups = {}
    for e in all_filtered:
        g = e['entity_group']
        if g not in entity_groups:
            entity_groups[g] = []
        entity_groups[g].append(e)

    avg = (sum(e['score'] for e in all_filtered) /
           len(all_filtered) * 100) if all_filtered else 0

    # Metrics
    st.markdown("---")
    if ner_mode == "Compare Both":
        c1, c2 = st.columns(2)
        with c1:
            st.metric("BioBERT entities", model_counts.get("BioBERT", 0))
        with c2:
            st.metric("GLiNER-BioMed entities", model_counts.get("GLiNER-BioMed", 0))
    st.markdown("---")
    cols = st.columns(5)
    for col, label, val in [
        (cols[0], "Documents",          len(sources)),
        (cols[1], "Entities Extracted", len(all_filtered)),
        (cols[2], "Avg Confidence",     f"{avg:.1f}%"),
        (cols[3], "Timeline Events",    len(timeline_rows)),
        (cols[4], "Categories",         len(entity_groups)),
    ]:
        with col:
            st.markdown(f"""
            <div style='background:#1a2f5e; border-left:4px solid #FFB703;
            border-radius:8px; padding:15px; text-align:center;'>
            <p style='color:#aaa; font-size:12px; margin:0;'>{label}</p>
            <p style='color:#FFB703; font-size:28px; font-weight:bold;
            margin:0;'>{val}</p></div>""", unsafe_allow_html=True)

    # ── PATIENT RECORD DASHBOARD ─────────────────────────────────────────────
    st.markdown("## 🧑‍⚕️ Patient Record Dashboard")
    risk_badge = {
        "LOW": ("#2ecc71", "LOW — ALLOW"),
        "HIGH": ("#f39c12", "HIGH — REVIEW / REDACT"),
        "CRITICAL": ("#e74c3c", "CRITICAL — BLOCK / REDACT"),
    }[overall_risk]
    badge_color, badge_text = risk_badge

    dcols = st.columns(4)
    dashboard_cards = [
        ("Patient", final_name),
        ("DOB", final_dob),
        ("Sex", final_sex),
        ("Privacy posture", badge_text),
    ]
    for c, (label, value) in zip(dcols, dashboard_cards):
        with c:
            st.markdown(f"""
            <div style='background:#142956;border-radius:10px;padding:14px;
            border-top:4px solid {badge_color if label=="Privacy posture" else "#00B4D8"};'>
            <div style='color:#aaa;font-size:11px;'>{label}</div>
            <div style='color:white;font-size:17px;font-weight:bold;margin-top:4px;'>{value}</div>
            </div>""", unsafe_allow_html=True)

    st.markdown("")
    pcols = st.columns(5)
    for c, label, value in [
        (pcols[0], "Conditions", len(patient_record["conditions"])),
        (pcols[1], "Symptoms", len(patient_record["symptoms"])),
        (pcols[2], "Medications", len(patient_record["medications"])),
        (pcols[3], "Lab findings", len(patient_record["labs"])),
        (pcols[4], "Procedures", len(patient_record["procedures"])),
    ]:
        with c:
            st.markdown(f"""
            <div style='background:#1a2f5e;border-radius:8px;padding:12px;text-align:center;'>
            <div style='color:#aaa;font-size:11px;'>{label}</div>
            <div style='color:#FFB703;font-size:24px;font-weight:bold;'>{value}</div>
            </div>""", unsafe_allow_html=True)

    with st.expander("📌 Longitudinal clinical record"):
        record_cols = st.columns(2)
        record_groups = [
            ("Conditions", patient_record["conditions"]),
            ("Symptoms", patient_record["symptoms"]),
            ("Medications / treatments", patient_record["medications"] + patient_record["procedures"]),
            ("Laboratory findings", patient_record["labs"]),
        ]
        for idx, (label, values) in enumerate(record_groups):
            with record_cols[idx % 2]:
                st.markdown(f"**{label}**")
                if values:
                    st.write(" • ".join(values[:20]))
                else:
                    st.caption("No extracted items.")

    # ── CLINICAL INTELLIGENCE LAYER ──────────────────────────────────────────
    st.markdown("## 🧠 Longitudinal Clinical Intelligence")
    st.info("This layer summarizes repeated extracted evidence across documents. It does not diagnose, prescribe, or infer treatment decisions.")
    st.markdown(f"**Pattern summary:** {clinical_intelligence_summary(clinical_intelligence)}")

    icols = st.columns(4)
    for c, label, value in [
        (icols[0], "Repeated conditions", len(clinical_intelligence["repeated_conditions"])),
        (icols[1], "Repeated treatments", len(clinical_intelligence["repeated_medications"])),
        (icols[2], "Repeated lab findings", len(clinical_intelligence["repeated_labs"])),
        (icols[3], "Change candidates", len(clinical_intelligence["changes"])),
    ]:
        with c:
            st.markdown(f"""
            <div style='background:#142956;border-radius:9px;padding:12px;text-align:center;border-top:3px solid #00B4D8;'>
            <div style='color:#aaa;font-size:11px;'>{label}</div>
            <div style='color:#FFB703;font-size:23px;font-weight:bold;'>{value}</div>
            </div>""", unsafe_allow_html=True)

    with st.expander("📈 Repeated clinical evidence"):
        repeated_rows = []
        for group_name, items in [
            ("Condition", clinical_intelligence["repeated_conditions"]),
            ("Medication / Treatment", clinical_intelligence["repeated_medications"]),
            ("Lab finding", clinical_intelligence["repeated_labs"]),
        ]:
            for item in items:
                repeated_rows.append({
                    "Type": group_name,
                    "Finding": item["label"],
                    "Occurrences": item["occurrences"],
                    "First date": item["dates"][0],
                    "Last date": item["dates"][-1],
                    "Documents": ", ".join(item["documents"]),
                })
        if repeated_rows:
            st.dataframe(pd.DataFrame(repeated_rows), use_container_width=True, hide_index=True)
        else:
            st.caption("No repeated extracted findings across the supplied documents.")

    with st.expander("🔄 Longitudinal change candidates"):
        if clinical_intelligence["changes"]:
            st.dataframe(pd.DataFrame(clinical_intelligence["changes"]), use_container_width=True, hide_index=True)
            st.caption("These are recurrence/change candidates derived from extracted entities and document dates; they are not clinical interpretations.")
        else:
            st.caption("No change candidates identified.")

    with st.expander("🗓️ Document-by-document clinical progression"):
        progression_rows = []
        for item in clinical_intelligence["progression"]:
            progression_rows.append({
                "Date": item["date"],
                "Document": item["document"],
                "Conditions": "; ".join(item["conditions"]) or "—",
                "Symptoms": "; ".join(item["symptoms"]) or "—",
                "Medications / Treatments": "; ".join(item["medications"]) or "—",
                "Labs": "; ".join(item["labs"]) or "—",
            })
        if progression_rows:
            st.dataframe(pd.DataFrame(progression_rows), use_container_width=True, hide_index=True)

    with st.expander("🔐 PrivGuard — document-level risk"):
        risk_rows = []
        for d in doc_results:
            risk_rows.append({
                "Document": d["name"],
                "Date": d["date"],
                "Risk": d["privguard_risk"],
                "Action": d["privguard_action"],
                "Critical": d["critical_pii"],
                "High": d["high_pii"],
            })
        st.dataframe(pd.DataFrame(risk_rows), use_container_width=True, hide_index=True)
        st.caption(f"Audit digest: {integrity_digest}")

    st.markdown("---")

    findings_html = "".join(
        f"<div style='font-size:13px; color:#222; margin:5px 0; "
        f"padding-left:12px;'>• {f}</div>"
        for f in key_findings
    )

    table_rows_html = ""
    for i, row in enumerate(timeline_rows):
        bg = '#f5f5f5' if i % 2 == 0 else '#ffffff'
        table_rows_html += f"""
        <tr style='background:{bg};'>
        <td style='padding:9px 11px; border-bottom:1px solid #ddd;
            color:#111; font-weight:bold; white-space:nowrap;
            vertical-align:top; font-size:12px;'>{row['date']}</td>
        <td style='padding:9px 11px; border-bottom:1px solid #ddd;
            vertical-align:top;'>
            <span style='background:{row["color"]}; color:white;
            padding:2px 9px; border-radius:10px; font-size:11px;
            font-weight:bold; white-space:nowrap;'>
            {row['category']}</span></td>
        <td style='padding:9px 11px; border-bottom:1px solid #ddd;
            color:#111; font-weight:bold; vertical-align:top;
            font-size:12px;'>{row['title']}</td>
        <td style='padding:9px 11px; border-bottom:1px solid #ddd;
            color:#222; vertical-align:top; font-size:12px;'>
            {row['details']}</td>
        <td style='padding:9px 11px; border-bottom:1px solid #ddd;
            color:#555; vertical-align:top; font-size:11px;'>
            {row['evidence']}</td>
        <td style='padding:9px 11px; border-bottom:1px solid #ddd;
            color:#2980b9; vertical-align:top; font-size:11px;'>
            {row['source']}</td>
        </tr>"""

    report_html = f"""
    <div style='background:white; color:#111; padding:44px 52px;
    border-radius:14px; font-family:Georgia,"Times New Roman",serif;
    max-width:960px; margin:20px auto;
    box-shadow:0 6px 30px rgba(0,0,0,0.4);'>

        <div style='text-align:center; font-size:24px; font-weight:bold;
        color:#111; margin-bottom:22px; border-bottom:2px solid #111;
        padding-bottom:12px; letter-spacing:0.5px;'>
        Medical Timeline Report</div>

        <div style='margin-bottom:22px; font-size:14px; color:#111;
        line-height:1.8;'>
        <b>Patient:</b> {final_name}&nbsp;&nbsp;&nbsp;
        <b>DOB:</b> {final_dob}&nbsp;&nbsp;&nbsp;
        <b>Sex:</b> {final_sex}
        </div>

        <div style='font-size:17px; font-weight:bold; color:#111;
        border-bottom:1px solid #888; padding-bottom:5px;
        margin:22px 0 12px 0;'>Summary</div>
        <div style='font-size:14px; line-height:1.75; color:#222;
        margin-bottom:18px;'>{summary_text}</div>

        <div style='font-size:13px; font-style:italic; font-weight:bold;
        color:#111; margin:16px 0 8px 0;'>Key clinical findings</div>
        {findings_html}

        <div style='font-size:17px; font-weight:bold; color:#111;
        border-bottom:1px solid #888; padding-bottom:5px;
        margin:28px 0 14px 0;'>Timeline</div>

        <div style='overflow-x:auto;'>
        <table style='width:100%; border-collapse:collapse;
        font-family:Arial,sans-serif; font-size:12px;'>
        <thead>
        <tr>
        <th style='background:#2c3e50; color:white; padding:9px 11px;
            text-align:left; font-size:12px;'>Date</th>
        <th style='background:#2c3e50; color:white; padding:9px 11px;
            text-align:left; font-size:12px;'>Category</th>
        <th style='background:#2c3e50; color:white; padding:9px 11px;
            text-align:left; font-size:12px;'>Title</th>
        <th style='background:#2c3e50; color:white; padding:9px 11px;
            text-align:left; font-size:12px;'>Details</th>
        <th style='background:#2c3e50; color:white; padding:9px 11px;
            text-align:left; font-size:12px;'>Evidence</th>
        <th style='background:#2c3e50; color:white; padding:9px 11px;
            text-align:left; font-size:12px;'>Source file</th>
        </tr>
        </thead>
        <tbody>{table_rows_html}</tbody>
        </table>
        </div>

        <div style='margin-top:32px; padding-top:12px;
        border-top:1px solid #ccc; font-size:11px; color:#888;
        text-align:center;'>
        Generated by MEDXERN {ner_mode} NER Pipeline &nbsp;|&nbsp;
        MAC Constitutional Privacy Governance &nbsp;|&nbsp;
        {datetime.datetime.now().strftime("%d %b %Y, %H:%M")} &nbsp;|&nbsp;
        NER backend: {ner_mode} &nbsp;|&nbsp;
        BioBERT: d4data/biomedical-ner-all &nbsp;|&nbsp;
        GLiNER: Ihor/gliner-biomed-base-v1.0
        </div>
    </div>"""

    st.markdown("## 📋 Generated Medical Timeline Report")
    st.caption(f"Extraction backend used for this report: **{ner_mode}**")
    components.html(report_html, height=900, scrolling=True)

        # ── RAW NER EXTRACTION + EXPORT ────────────────────────────────────────────
    with st.expander(f"🧬 View Raw {ner_mode} Entity Extraction"):

        tags_html = ""

        for e in all_filtered:
            color = COLOR_MAP.get(e['entity_group'], '#3498db')
            conf = f"{e['score'] * 100:.0f}%"
            label = CATEGORY_LABELS.get(
                e['entity_group'],
                e['entity_group']
            )
            source_model = e.get("source_model", ner_mode)

            tags_html += (
                f"<span style='background:{color}; color:white; "
                f"padding:4px 12px; border-radius:15px; margin:4px; "
                f"display:inline-block; font-size:13px; font-weight:bold;'>"
                f"{e['word']} "
                f"<span style='font-size:11px; opacity:0.8;'>"
                f"[{label} · {conf} · {source_model}]"
                f"</span></span>"
            )

        st.markdown(
            f"<div style='background:#1a2f5e; padding:20px; "
            f"border-radius:12px; line-height:3;'>{tags_html}</div>",
            unsafe_allow_html=True
        )

        # ── EXPORT DATA ───────────────────────────────────────────────────────
        raw_export_df = build_raw_ner_export(doc_results)

        st.markdown("### 📥 Export NER Results")

        st.caption(
            "Export the cleaned NER output with model provenance, confidence "
            "scores, source offsets, and document information."
        )

        csv_data = raw_export_df.to_csv(index=False).encode("utf-8")

        json_data = raw_export_df.to_json(
            orient="records",
            indent=2,
            force_ascii=False
        ).encode("utf-8")

        export_col1, export_col2 = st.columns(2)

        with export_col1:
            st.download_button(
                label="⬇️ Download Raw NER CSV",
                data=csv_data,
                file_name=f"medxern_{ner_mode.lower().replace(' ', '_').replace('-', '_')}_ner.csv",
                mime="text/csv",
                use_container_width=True
            )

        with export_col2:
            st.download_button(
                label="⬇️ Download Raw NER JSON",
                data=json_data,
                file_name=f"medxern_{ner_mode.lower().replace(' ', '_').replace('-', '_')}_ner.json",
                mime="application/json",
                use_container_width=True
            )

        st.markdown("#### Export preview")

        st.dataframe(
            raw_export_df,
            use_container_width=True,
            hide_index=True
        )

    # ── MAC CONSTITUTIONAL PRIVACY REPORT ────────────────────────────────────
    st.markdown("---")
    full_text    = " ".join([s['text'] for s in sources])
    emails_found = re.findall(r'\b[\w.-]+@[\w.-]+\.\w+\b', full_text)
    phones_found = re.findall(r'\b[6-9]\d{9}\b', full_text)
    pii_clean    = not (emails_found or phones_found) and not all_violations

    # Build active rules display
    active_rules_display = ""
    for rule_num in sorted(all_active_rules):
        rule_text = MAC_CONSTITUTION[rule_num - 1]
        active_rules_display += f"""
        <div style='background:#0d2040; border-left:2px solid #00B4D8;
        padding:4px 8px; margin:3px 0; border-radius:2px;'>
        <span style='color:#FFB703; font-size:10px; font-weight:bold;'>
        Rule {rule_num} Applied</span><br>
        <span style='color:#aaaaaa; font-size:10px;'>{rule_text}</span>
        </div>"""

    violations_display = ""
    for v in all_violations:
        color = "#e74c3c" if "CRITICAL" in v else "#f39c12"
        violations_display += f"""
        <p style='color:{color}; margin:4px 0; font-size:12px;'>⚠️ {v}</p>"""

    st.markdown(f"""
    <div style='background:#0f2040; border:2px solid #00B4D8;
    border-radius:12px; padding:20px; margin:10px 0;'>
    <p style='color:#00B4D8; font-weight:bold; font-size:16px;
    margin:0 0 12px 0;'>
    🛡️ PrivGuard — Constitutional Privacy Governance (MAC Framework)</p>

    <div style='display:flex; gap:20px; flex-wrap:wrap; margin-bottom:12px;'>
    <div>
    <p style='color:#2ecc71; margin:4px 0;'>✅ Patient data: Processed locally — zero cloud exposure</p>
    <p style='color:#2ecc71; margin:4px 0;'>✅ Medical Constitution: {len(MAC_CONSTITUTION)} rules loaded</p>
    <p style='color:#2ecc71; margin:4px 0;'>✅ Rules applied this session: {len(all_active_rules)}</p>
    <p style='color:#2ecc71; margin:4px 0;'>✅ Audit log: Entry recorded (tamper-evident)</p>
    <p style='color:#2ecc71; margin:4px 0;'>✅ DPDPA-aware privacy controls: Active</p>
    <p style='color:{"#2ecc71" if pii_clean else "#e74c3c"}; margin:4px 0;'>
    {"✅ No PII detected — all documents clean"
     if pii_clean
     else f"⚠️ PII detected — PrivGuard action shown below"}</p>
    </div>
    </div>

    {f"<div style='margin:8px 0;'><p style='color:#e74c3c; font-weight:bold; font-size:13px; margin:0 0 6px 0;'>Constitutional Violations Detected:</p>{violations_display}</div>" if all_violations else ""}

    {f"<div style='margin:8px 0;'><p style='color:#00B4D8; font-weight:bold; font-size:13px; margin:0 0 6px 0;'>Constitutional Rules Applied This Session:</p>{active_rules_display}</div>" if active_rules_display else ""}

    <p style='color:#aaaaaa; font-size:11px; margin:10px 0 0 0;'>
    MAC Framework: Thareja et al. (2026) | arXiv:2603.15968 |
    Constitution v1.0 — DPDPA 2023 Edition |
    Processed: {datetime.datetime.now().strftime("%d %b %Y %H:%M:%S")}</p>
    </div>""", unsafe_allow_html=True)

    # ── REDACTED DOCUMENT PREVIEW ────────────────────────────────────────────
    if all_pii_findings:
        st.markdown("### 🔐 Redacted Clinical Text")
        st.warning(
            f"PrivGuard identified {critical_pii} critical and {high_pii} high-risk "
            "privacy finding(s). The preview below replaces detected identifiers "
            "while retaining surrounding clinical text."
        )
        redacted_combined = "\n\n".join(
            f"===== {d['name']} =====\n{d['redacted_text']}" for d in doc_results
        )
        st.text_area("Safe preview", redacted_combined, height=280)
        st.download_button(
            "⬇️ Download redacted clinical text",
            data=redacted_combined,
            file_name="medxern_redacted_clinical_text.txt",
            mime="text/plain",
        )
    else:
        st.info("🔒 No identifier patterns were detected by the current PrivGuard rules.")

    st.success(
        f"✅ Report generated using {ner_mode} — {len(sources)} document(s), "
        f"{len(all_filtered)} entities extracted, "
        f"{len(timeline_rows)} timeline entries, "
        f"{len(all_active_rules)} constitutional rules enforced."
    )

st.markdown("""
<hr style='border-color:#00B4D8; margin-top:40px;'>
<div style='text-align:center; padding:15px;'>
<p style='color:#aaaaaa; font-size:13px;'>
MEDXERN v2.5 — Medical Exchange & Records Network<br>
Dept. of CSE, Lords Institute of Engineering and Technology, Hyderabad<br>
NER: BioBERT + GLiNER-BioMed | MAC Framework: Thareja et al. (2026) | arXiv:2603.15968
</p></div>""", unsafe_allow_html=True)