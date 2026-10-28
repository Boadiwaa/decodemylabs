/**
 * Prompt templates for LabReportParser (text and image extraction).
 * Keep wording changes here so parser code stays free of inline prompts.
 */

/** System prompt for lab report extraction */
export const EXTRACTION_PROMPT = `You are a precise medical lab report parser. Extract ALL lab test results from the text below.

CRITICAL — TABULAR ALIGNMENT: Lab reports are formatted as tables. Each row contains ONE test and ONE result. You MUST:
1. Read each row independently — do NOT carry values across rows
2. The numeric value for a test is ONLY the number on the SAME row as the test name
3. Double-check: the value for ALT (SGPT) must come from the ALT/SGPT row, NOT from AST/SGOT or GGT
4. Double-check: the value for GGT must come from the GGT row, NOT from ALT or AST
5. If a row says "POTASSIUM 3.60", the value is 3.60 — do not use a value from another row

For EACH test found, output a JSON object on its own line:
{"test_name": "...", "result_value": "42.5", "unit": "...", "normal_range": "...", "date": "..."}

Examples:
{"test_name": "Creatinine", "result_value": "66.1", "unit": "µmol/L", "normal_range": "45-84 µmol/L", "date": "2023-01-01"},
{"test_name": "eGFR_Calculated (CKD-EPI 2021)", "result_value": ">90", "unit": "mL/min/1.73m²", "normal_range": ">=90 mL/min/1.73m²", "date": "2023-01-01"},
{"test_name": "Sodium", "result_value": "142.6", "unit": "mmol/L", "normal_range": "136-146 mmol/L", "date": "2023-01-01"},


Rules:
- test_name: Use these standard names EXACTLY:
  Liver: "ALT", "AST", "ALP", "GGT", "Bilirubin", "Direct Bilirubin", "Indirect Bilirubin", "Albumin", "Globulin", "Total Protein"
  Kidney: "Creatinine", "BUN", "Sodium", "Potassium", "Chloride", "Calcium", "eGFR"
  Blood: "Hemoglobin", "WBC", "RBC", "Platelets"
  Metabolic: "Glucose", "HbA1c", "Cholesterol", "LDL", "HDL", "Triglycerides", "TSH"
- result_value: ONLY the numeric value as a string (e.g. "42.5"). NO units here.
- unit: The unit EXACTLY as shown on the report (e.g. "umol/L", "mmol/L", "U/L", "g/L", "mg/dL"). Do NOT convert units.
- normal_range: The reference range EXACTLY as shown on the report (e.g. "0-35 U/L", "45-84 umol/L"). Include the unit.
- date: Report date as YYYY-MM-DD, or "unknown". Dates on these reports are written day first (DD/MM/YYYY, as in Ghana): "03/04/2026" is 3 April 2026, so output "2026-04-03".

CRITICAL ALIASES:
- "SGPT" or "Alanine Aminotransferase" = "ALT"
- "SGOT" or "Aspartate Aminotransferase" = "AST"
- "Alkaline Phosphatase" = "ALP"
- "Gamma GT" or "Gamma-Glutamyl Transferase" = "GGT"
- "Total Bilirubin" = "Bilirubin", "Direct Bilirubin" and "Indirect Bilirubin" are separate tests
- "Urea" or "Blood Urea Nitrogen" = "BUN"

Output ONLY JSON objects, one per line. No other text.`;

/** System prompt for direct image-based lab extraction */
export const IMAGE_EXTRACTION_PROMPT = `You are a precise medical lab report parser. You are looking at a photo of a lab report.

CRITICAL — TABULAR ALIGNMENT: Lab reports are formatted as tables. Each row contains ONE test and ONE result. You MUST:
1. Read each row independently — do NOT carry values across rows
2. The numeric value for a test is ONLY the number on the SAME row as the test name
3. Double-check: ALT (SGPT) value comes from the ALT/SGPT row ONLY
4. Double-check: GGT value comes from the GGT row ONLY
5. If the report shows "POTASSIUM 3.60", use 3.60 — not a number from another row
6. Preserve the EXACT unit from the report — do NOT convert between units (e.g. if it says umol/L, output umol/L, not mg/dL)

For EACH test found, output a JSON object on its own line:
{"test_name": "...", "result_value": "42.5", "unit": "...", "normal_range": "...", "date": "..."}

Examples:
{"test_name": "Creatinine", "result_value": "66.1", "unit": "µmol/L", "normal_range": "45-84 µmol/L", "date": "2023-01-01"},
{"test_name": "eGFR_Calculated (CKD-EPI 2021)", "result_value": ">90", "unit": "mL/min/1.73m²", "normal_range": ">=90 mL/min/1.73m²", "date": "2023-01-01"},
{"test_name": "Sodium", "result_value": "142.6", "unit": "mmol/L", "normal_range": "136-146 mmol/L", "date": "2023-01-01"},


Rules:
- test_name: Use these standard names EXACTLY:
  Liver: "ALT", "AST", "ALP", "GGT", "Bilirubin", "Direct Bilirubin", "Indirect Bilirubin", "Albumin", "Globulin", "Total Protein"
  Kidney: "Creatinine", "BUN", "Sodium", "Potassium", "Chloride", "Calcium", "eGFR"
  Blood: "Hemoglobin", "WBC", "RBC", "Platelets"
  Metabolic: "Glucose", "HbA1c", "Cholesterol", "LDL", "HDL", "Triglycerides", "TSH"
- result_value: ONLY the numeric value as a string (e.g. "42.5"). NO units here.
- unit: The unit EXACTLY as shown on the report. Do NOT convert units.
- normal_range: The reference range EXACTLY as shown on the report, including unit
- date: Report date as YYYY-MM-DD, or "unknown". Dates on these reports are written day first (DD/MM/YYYY, as in Ghana): "03/04/2026" is 3 April 2026, so output "2026-04-03".

CRITICAL ALIASES:
- SGPT = ALT, SGOT = AST, Alkaline Phosphatase = ALP, Gamma GT = GGT
- Total Bilirubin = "Bilirubin", Direct/Indirect Bilirubin are separate entries
- Urea = BUN

Output ONLY JSON objects, one per line. No other text.`;
