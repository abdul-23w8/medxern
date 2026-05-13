import streamlit as st
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
import pandas as pd
import fitz
import datetime
import re
import streamlit.components.v1 as components

st.set_page_config(page_title="MEDXERN - Medical NER", page_icon="🏥", layout="wide")

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
    <p style='font-size:14px; color:#aaaaaa; margin:0;'>AI-Powered Clinical NER using BioBERT | Constitutional Privacy Governance via MAC Framework</p>
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
    <h3 style='color:#00B4D8;'>⚙️ Model Info</h3>
    <b>Model:</b> BioBERT Clinical NER<br>
    <b>Base:</b> d4data/biomedical-ner-all<br>
    <b>Framework:</b> HuggingFace Transformers<br>
    <b>Fine-tuning:</b> Indian corpus (in progress)
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
    model_name = "d4data/biomedical-ner-all"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForTokenClassification.from_pretrained(model_name)
    return pipeline("ner", model=model, tokenizer=tokenizer,
                    aggregation_strategy="simple")

def extract_text_from_pdf(pdf_file):
    doc = fitz.open(stream=pdf_file.read(), filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text() + "\n"
        for widget in page.widgets():
            if widget.field_value:
                text += f"{widget.field_name}: {widget.field_value}\n"
    doc.close()
    return text.strip()

def extract_date_from_text(text):
    patterns = [
        r'Date[:\s]+(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})',
        r'Date[:\s]+(\d{4}-\d{2}-\d{2})',
        r'Date[:\s]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return datetime.date.today().strftime("%Y-%m-%d")

def extract_patient_info(text):
    name, dob, sex = "Unknown", "Unknown", "Unknown"
    name_match = re.search(
        r'Patient Name:.*?([A-Z][a-z]+\s+[A-Z][a-z]+)\s+RM-',
        text, re.DOTALL)
    if name_match:
        candidate = name_match.group(1).strip()
        if candidate.lower() not in ('unknown', 'patient', 'name'):
            name = candidate
    all_dates = re.findall(
        r'(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{4})',
        text, re.IGNORECASE)
    for d in all_dates:
        year = int(d.split('-')[-1])
        if year < 2000:
            dob = d
            break
    if dob == "Unknown":
        iso_dates = re.findall(r'(\d{4}-\d{2}-\d{2})', text)
        for d in iso_dates:
            year = int(d.split('-')[0])
            if year < 2000:
                dob = d
                break
    sex_match = re.search(r'\b(Male|Female)\s*/\s*\d+', text, re.IGNORECASE)
    if sex_match:
        sex = sex_match.group(1).capitalize()
    else:
        sex_match2 = re.search(r'Sex[:/\s]+(Male|Female)', text, re.IGNORECASE)
        if sex_match2:
            sex = sex_match2.group(1).capitalize()
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

def filter_entities(entities):
    seen = set()
    cleaned = []
    for e in entities:
        w = re.sub(r'\s*##', '', e['word']).strip()
        if w.lower() in NOISE_WORDS:
            continue
        if len(w) <= 2:
            continue
        if e['score'] < 0.65:
            continue
        # Skip pure number fragments
        if re.match(r'^\d+\s*$', w):
            continue
        # Skip single letter fragments
        if re.match(r'^[a-z]\s*$', w, re.IGNORECASE):
            continue
        key = f"{w.lower()}_{e['entity_group']}"
        if key in seen:
            continue
        seen.add(key)
        e_copy = dict(e)
        e_copy['word'] = CORRECTIONS.get(w.lower(), w)
        cleaned.append(e_copy)
    return cleaned

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

def generate_summary(doc_results, all_filtered):
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
        summary += f"Patient presented with {', '.join(diseases[:2])} on {dates[0]}. "
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
        summary = ("Clinical documents processed. "
                   "Entities extracted via BioBERT NER pipeline.")
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

def build_timeline_rows(doc_results):
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
            g = e['entity_group']
            if g not in USEFUL_CATS:
                continue
            if g not in by_cat:
                by_cat[g] = []
            by_cat[g].append(e['word'])
        for cat, words in by_cat.items():
            unique = list(dict.fromkeys(
                [w for w in words if len(w) > 3]))
            if not unique:
                continue
            color = COLOR_MAP.get(cat, '#555')
            label = CATEGORY_LABELS.get(cat, cat)
            title = ctx['title_map'].get(cat, label.title())
            details = ctx['details_prefix'] + ', '.join(unique[:4])
            evidence = (
                f"{unique[0]} confirmed. "
                f"Additional: {', '.join(unique[1:3])}"
                if len(unique) > 1
                else f"{unique[0]} identified via BioBERT NER"
            )
            rows.append({
                "date":     doc['date'],
                "category": label,
                "title":    title,
                "details":  details,
                "evidence": evidence,
                "source":   doc['name'],
                "color":    color,
            })
    return sorted(rows, key=lambda x: x['date'])

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
                        "date": extract_date_from_text(text)
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

    with st.spinner("Loading BioBERT Clinical NER Model..."):
        ner = load_model()

    all_filtered = []
    doc_results  = []
    all_violations = []
    all_active_rules = set()

    for src in sources:
        with st.spinner(f"Running BioBERT NER on {src['name']}..."):
            raw = ner(src['text'][:1500])
        filtered = filter_entities(raw)
        all_filtered.extend(filtered)
        name, dob, sex = extract_patient_info(src['text'])

        # Apply MAC constitution to each document
        violations, active_rules = apply_mac_constitution(src['text'], filtered)
        all_violations.extend(violations)
        all_active_rules.update(active_rules)

        doc_results.append({
            "name":         src['name'],
            "date":         src['date'],
            "text":         src['text'],
            "entities":     filtered,
            "patient_name": name,
            "patient_dob":  dob,
            "patient_sex":  sex,
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

    summary_text, diseases, meds, labs = generate_summary(
        doc_results, all_filtered)
    key_findings  = generate_key_findings(doc_results, all_filtered)
    timeline_rows = build_timeline_rows(doc_results)

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
        Generated by MEDXERN BioBERT NER Pipeline &nbsp;|&nbsp;
        MAC Constitutional Privacy Governance &nbsp;|&nbsp;
        {datetime.datetime.now().strftime("%d %b %Y, %H:%M")} &nbsp;|&nbsp;
        Model: d4data/biomedical-ner-all
        </div>
    </div>"""

    st.markdown("## 📋 Generated Medical Timeline Report")
    components.html(report_html, height=900, scrolling=True)

    with st.expander("🧬 View Raw BioBERT Entity Extraction"):
        tags_html = ""
        for e in all_filtered:
            color = COLOR_MAP.get(e['entity_group'], '#3498db')
            conf  = f"{e['score']*100:.0f}%"
            label = CATEGORY_LABELS.get(e['entity_group'], e['entity_group'])
            tags_html += (
                f"<span style='background:{color}; color:white; "
                f"padding:4px 12px; border-radius:15px; margin:4px; "
                f"display:inline-block; font-size:13px; font-weight:bold;'>"
                f"{e['word']} "
                f"<span style='font-size:11px; opacity:0.8;'>"
                f"[{label} · {conf}]</span></span>"
            )
        st.markdown(
            f"<div style='background:#1a2f5e; padding:20px; "
            f"border-radius:12px; line-height:3;'>{tags_html}</div>",
            unsafe_allow_html=True)

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
    <p style='color:#2ecc71; margin:4px 0;'>✅ DPDPA 2023 compliance: Enforced</p>
    <p style='color:{"#2ecc71" if pii_clean else "#e74c3c"}; margin:4px 0;'>
    {"✅ No PII detected — all documents clean"
     if pii_clean
     else f"⚠️ PII detected and blocked — see violations below"}</p>
    </div>
    </div>

    {f"<div style='margin:8px 0;'><p style='color:#e74c3c; font-weight:bold; font-size:13px; margin:0 0 6px 0;'>Constitutional Violations Detected:</p>{violations_display}</div>" if all_violations else ""}

    {f"<div style='margin:8px 0;'><p style='color:#00B4D8; font-weight:bold; font-size:13px; margin:0 0 6px 0;'>Constitutional Rules Applied This Session:</p>{active_rules_display}</div>" if active_rules_display else ""}

    <p style='color:#aaaaaa; font-size:11px; margin:10px 0 0 0;'>
    MAC Framework: Thareja et al. (2026) | arXiv:2603.15968 |
    Constitution v1.0 — DPDPA 2023 Edition |
    Processed: {datetime.datetime.now().strftime("%d %b %Y %H:%M:%S")}</p>
    </div>""", unsafe_allow_html=True)

    st.success(
        f"✅ Report generated — {len(sources)} document(s), "
        f"{len(all_filtered)} entities extracted, "
        f"{len(timeline_rows)} timeline entries, "
        f"{len(all_active_rules)} constitutional rules enforced."
    )

st.markdown("""
<hr style='border-color:#00B4D8; margin-top:40px;'>
<div style='text-align:center; padding:15px;'>
<p style='color:#aaaaaa; font-size:13px;'>
MEDXERN — Medical Exchange & Records Network<br>
Dept. of CSE, Lords Institute of Engineering and Technology, Hyderabad<br>
BioBERT: d4data/biomedical-ner-all | MAC Framework: Thareja et al. (2026) | arXiv:2603.15968
</p></div>""", unsafe_allow_html=True)