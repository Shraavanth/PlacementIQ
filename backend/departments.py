import re

# Canonical department names
CANONICAL_DEPARTMENTS = [
    "Computer Science and Engineering",
    "Information Technology",
    "Electronics and Communication Engineering",
    "Electrical and Electronics Engineering",
    "Artificial Intelligence and Data Science",
    "Artificial Intelligence and Machine Learning",
    "Mechanical Engineering",
    "Civil Engineering",
    "Data Science",
]

# Normalization mapping for standard abbreviations, aliases, and variations
DEPARTMENT_MAPPINGS = {
    # Computer Science and Engineering
    "cse": "Computer Science and Engineering",
    "cs": "Computer Science and Engineering",
    "computer science": "Computer Science and Engineering",
    "computer science and engineering": "Computer Science and Engineering",
    "computer science & engineering": "Computer Science and Engineering",
    "computer science engineering": "Computer Science and Engineering",
    "comp sci": "Computer Science and Engineering",
    "b tech cse": "Computer Science and Engineering",
    "btech cse": "Computer Science and Engineering",
    "be cse": "Computer Science and Engineering",

    # Information Technology
    "it": "Information Technology",
    "information technology": "Information Technology",
    "info tech": "Information Technology",
    "infotech": "Information Technology",
    "b tech it": "Information Technology",
    "btech it": "Information Technology",
    "be it": "Information Technology",

    # Electronics and Communication Engineering
    "ece": "Electronics and Communication Engineering",
    "electronics and communication engineering": "Electronics and Communication Engineering",
    "electronics & communication engineering": "Electronics and Communication Engineering",
    "electronics and communication": "Electronics and Communication Engineering",
    "electronics & communication": "Electronics and Communication Engineering",
    "electronics communication": "Electronics and Communication Engineering",
    "b tech ece": "Electronics and Communication Engineering",
    "btech ece": "Electronics and Communication Engineering",
    "be ece": "Electronics and Communication Engineering",

    # Electrical and Electronics Engineering
    "eee": "Electrical and Electronics Engineering",
    "electrical and electronics engineering": "Electrical and Electronics Engineering",
    "electrical & electronics engineering": "Electrical and Electronics Engineering",
    "electrical and electronics": "Electrical and Electronics Engineering",
    "electrical & electronics": "Electrical and Electronics Engineering",
    "electrical electronics": "Electrical and Electronics Engineering",
    "b tech eee": "Electrical and Electronics Engineering",
    "btech eee": "Electrical and Electronics Engineering",
    "be eee": "Electrical and Electronics Engineering",

    # Artificial Intelligence and Data Science
    "ai & ds": "Artificial Intelligence and Data Science",
    "ai and ds": "Artificial Intelligence and Data Science",
    "ai ds": "Artificial Intelligence and Data Science",
    "aids": "Artificial Intelligence and Data Science",
    "artificial intelligence and data science": "Artificial Intelligence and Data Science",
    "artificial intelligence & data science": "Artificial Intelligence and Data Science",
    "b tech aids": "Artificial Intelligence and Data Science",
    "btech aids": "Artificial Intelligence and Data Science",

    # Artificial Intelligence and Machine Learning
    "ai & ml": "Artificial Intelligence and Machine Learning",
    "ai and ml": "Artificial Intelligence and Machine Learning",
    "ai ml": "Artificial Intelligence and Machine Learning",
    "aiml": "Artificial Intelligence and Machine Learning",
    "artificial intelligence and machine learning": "Artificial Intelligence and Machine Learning",
    "artificial intelligence & machine learning": "Artificial Intelligence and Machine Learning",
    "b tech aiml": "Artificial Intelligence and Machine Learning",
    "btech aiml": "Artificial Intelligence and Machine Learning",

    # Mechanical Engineering
    "me": "Mechanical Engineering",
    "mech": "Mechanical Engineering",
    "mechanical": "Mechanical Engineering",
    "mechanical engineering": "Mechanical Engineering",
    "b tech me": "Mechanical Engineering",
    "btech me": "Mechanical Engineering",
    "b tech mech": "Mechanical Engineering",
    "btech mech": "Mechanical Engineering",

    # Civil Engineering
    "ce": "Civil Engineering",
    "civil": "Civil Engineering",
    "civil engineering": "Civil Engineering",
    "b tech ce": "Civil Engineering",
    "btech ce": "Civil Engineering",
    "b tech civil": "Civil Engineering",
    "btech civil": "Civil Engineering",

    # Data Science
    "ds": "Data Science",
    "data science": "Data Science",
}

def clean_department_key(dept_name: str) -> str:
    """Normalize capitalization, punctuation, whitespace, and formatting."""
    if not dept_name:
        return ""
    text = str(dept_name).strip()
    # Replace '&' with ' and '
    text = text.replace('&', ' and ')
    # Remove degree / department prefixes token-aware
    # e.g., 'Bachelor of Technology in', 'B.Tech in', 'BTech in', 'Department of'
    text = re.sub(r'(?i)\b(bachelor of technology|bachelor of engineering|b\.?tech|b\.?e\.?|department of|dept\.? of)\b', '', text)
    text = re.sub(r'(?i)\bin\b', '', text)
    # Remove punctuation
    text = re.sub(r'[^a-zA-Z0-9\s]', ' ', text)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip().lower()
    return text

def normalize_department(dept_name: str) -> str:
    """
    Returns canonical department name if recognized.
    Preserves unknown department names for manual confirmation rather than guessing.
    """
    if not dept_name:
        return ""
    raw = str(dept_name).strip()
    cleaned = clean_department_key(raw)
    
    # Check exact cleaned key match
    if cleaned in DEPARTMENT_MAPPINGS:
        return DEPARTMENT_MAPPINGS[cleaned]
    
    # Check raw lower with & replaced
    raw_lower = raw.lower().replace('&', ' and ')
    raw_lower = re.sub(r'\s+', ' ', raw_lower).strip()
    if raw_lower in DEPARTMENT_MAPPINGS:
        return DEPARTMENT_MAPPINGS[raw_lower]

    # Token-aware matching for standalone abbreviations or canonical titles
    # Avoid false substring matches (e.g., 'it' inside 'security' or 'ce' in 'commerce')
    words = cleaned.split()
    if len(words) == 1:
        single_word = words[0]
        if single_word in DEPARTMENT_MAPPINGS:
            return DEPARTMENT_MAPPINGS[single_word]

    # Return original trimmed name if not recognized
    return raw

def departments_match(dept1: str, dept2: str) -> bool:
    """
    Compares two department names after normalization.
    Returns True if both normalize to the same canonical department, or if
    casefolded strings match.
    """
    if not dept1 or not dept2:
        return False
    norm1 = normalize_department(dept1)
    norm2 = normalize_department(dept2)
    return norm1.casefold() == norm2.casefold()

def student_matches_any_department(student_dept: str, accepted_departments: list) -> bool:
    """
    Checks if student's confirmed department matches any department accepted by the job.
    """
    if not accepted_departments:
        return True
    if not student_dept:
        return False
    for accepted in accepted_departments:
        if departments_match(student_dept, accepted):
            return True
    return False
