import json
import os
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

script_dir = os.path.dirname(os.path.abspath(__file__))
json_path = os.path.join(script_dir, 'jobs.json')
QTABLE_PATH = os.path.join(script_dir, 'q_table.json')

SYNONYM_MAP = {
    "ai": ["ai", "artificial intelligence", "machine learning", "deep learning", "data & ai", "nlp"],
    "ml": ["ml", "machine learning", "deep learning", "artificial intelligence", "pytorch", "tensorflow"],
    "ai/ml": ["ai", "ml", "machine learning", "artificial intelligence", "deep learning", "data & ai", "pytorch", "tensorflow"],
    "tensorflow": ["tensorflow", "machine learning", "deep learning", "python", "pytorch", "ai"],
    "pytorch": ["pytorch", "machine learning", "deep learning", "python", "tensorflow", "ai"],
    "medicine": ["medical doctor", "physician", "clinical diagnosis", "patient care", "surgery", "pharmacology", "healthcare"],
    "med": ["medical doctor", "physician", "clinical diagnosis", "patient care", "healthcare"],
    "healthcare": ["medical doctor", "physician", "clinical diagnosis", "patient care", "healthcare"],
    "law": ["corporate lawyer", "legal counsel", "legal research", "corporate law", "litigation", "contract drafting"],
    "legal": ["corporate lawyer", "legal counsel", "legal research", "corporate law", "litigation"],
    "architecture": ["architectural design", "autocad", "revit", "3d modeling", "registered architect", "building codes"],
    "archi": ["architectural design", "autocad", "revit", "3d modeling", "registered architect"],
    "cpa": ["certified public accountant", "financial auditing", "taxation law", "ifrs", "accounting software"],
    "accounting": ["certified public accountant", "financial auditing", "taxation law", "ifrs", "excel", "accounting"],
    "finance": ["financial analysis", "excel", "financial modeling", "risk assessment", "investment banking"],
    "civil": ["civil engineering", "project management", "construction", "autocad", "structural analysis"],
    "mechanical": ["mechanical engineering", "cad software", "solidworks", "thermodynamics", "materials science"]
}

def load_jobs():
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

tfidf_vectorizer = None
job_tfidf_matrix = None

def prepare_vector_index(jobs):
    global tfidf_vectorizer, job_tfidf_matrix
    texts = []
    for job in jobs:
        skills_str = " ".join(job.get("skills_required", []))
        degrees_str = " ".join(job.get("recommended_degrees", []))
        unis_str = " ".join(job.get("top_recommended_universities", []))
        text = f"Title: {job['title']} {job['title']}. Category: {job.get('category', '')}. Skills: {skills_str}. Degrees: {degrees_str}. Unis: {unis_str}. Description: {job['description']}"
        texts.append(text)
        
    tfidf_vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
    job_tfidf_matrix = tfidf_vectorizer.fit_transform(texts)

def load_qtable():
    if os.path.exists(QTABLE_PATH):
        try:
            with open(QTABLE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def save_qtable(q_table):
    with open(QTABLE_PATH, "w", encoding="utf-8") as f:
        json.dump(q_table, f, indent=2)

def normalize_state(skills, interests):
    s_list = sorted([s.strip().lower() for s in skills.split(",") if s.strip()]) if isinstance(skills, str) else []
    i_list = sorted([i.strip().lower() for i in interests.split(",") if i.strip()]) if isinstance(interests, str) else []
    
    skills_part = "_".join(s_list) if s_list else "noskills"
    interests_part = "_".join(i_list) if i_list else "nointerests"
    return f"{skills_part}|{interests_part}"

def parse_input_tokens(text_input):
    if not text_input:
        return []
    if isinstance(text_input, list):
        items = text_input
    else:
        items = re.split(r'[,/;\n]', str(text_input))
    return [i.strip() for i in items if i.strip()]

def expand_user_terms(user_skills, user_interests):
    all_raw = [s.lower() for s in user_skills] + [i.lower() for i in user_interests]
    expanded = set(all_raw)
    
    for term in all_raw:
        if term in SYNONYM_MAP:
            expanded.update(SYNONYM_MAP[term])
        for key, syns in SYNONYM_MAP.items():
            if key in term or term in key:
                expanded.update(syns)
                
    return expanded

def calculate_skill_match(user_skills, expanded_terms, job_skills, job_category, job_title):
    if not job_skills:
        return 0.0, [], []
    
    user_skills_lower = {s.lower(): s for s in user_skills}
    matched = []
    missing = []
    
    for j_skill in job_skills:
        j_lower = j_skill.lower()
        found = False
        for u_lower, u_orig in user_skills_lower.items():
            if u_lower == j_lower or u_lower in j_lower or j_lower in u_lower:
                matched.append(j_skill)
                found = True
                break
        if not found:
            for exp_term in expanded_terms:
                if exp_term == j_lower or exp_term in j_lower or j_lower in exp_term:
                    matched.append(j_skill)
                    found = True
                    break
        if not found:
            missing.append(j_skill)
            
    matched_count = len(matched)
    total_required = len(job_skills)
    
    base_match_score = (matched_count / max(1, min(3, total_required)))
    base_match_score = min(1.0, base_match_score)
        
    category_boost = 0.0
    for term in expanded_terms:
        if term in job_category.lower() or term in job_title.lower():
            category_boost = 0.45
            break
            
    final_skill_score = min(1.0, (0.65 * base_match_score) + category_boost)
    return final_skill_score, matched, missing

def generate_rag_reason(title, matched_skills, missing_skills, user_interests, category, composite_score):
    reasons = []
    if matched_skills:
        reasons.append(f"Strongly leverages your skills in {', '.join(matched_skills[:3])}.")
    else:
        reasons.append(f"Presents an excellent career path in {category}.")
        
    matching_interests = [i for i in user_interests if i.lower() in category.lower() or i.lower() in title.lower()]
    if matching_interests:
        reasons.append(f"Directly aligns with your interest in {', '.join(matching_interests)}.")
        
    if composite_score >= 80:
        reasons.append("Top match based on your skills and target domain.")
    elif composite_score >= 60:
        reasons.append("High contextual vector alignment.")

    if missing_skills:
        reasons.append(f"Next recommended skills to acquire: {', '.join(missing_skills[:2])}.")
        
    return " ".join(reasons)

def recommend_jobs(skills, interests, student_id, category_filter=None, experience_filter=None):
    job_data = load_jobs()
    prepare_vector_index(job_data)
        
    user_skills = parse_input_tokens(skills)
    user_interests = parse_input_tokens(interests)
    expanded_terms = expand_user_terms(user_skills, user_interests)
    
    query_text = f"Title: {', '.join(user_interests)} {', '.join(user_skills)}. Category: {', '.join(user_interests)}. Skills: {', '.join(expanded_terms)}."
    
    query_vec = tfidf_vectorizer.transform([query_text])
    semantic_sims = cosine_similarity(query_vec, job_tfidf_matrix)[0]
    
    q_table = load_qtable()
    canonical_state = normalize_state(skills if isinstance(skills, str) else ", ".join(skills), 
                                      interests if isinstance(interests, str) else ", ".join(interests))
    
    student_data = q_table.get(student_id, {})
    state_data = student_data.get("states", {}).get(canonical_state, {})
    
    results = []
    
    for idx, job in enumerate(job_data):
        title = job["title"]
        job_category = job.get("category", "General")
        exp_level = job.get("experience_level", "Entry-Level")
        
        if category_filter and category_filter.lower() != "all" and category_filter.lower() not in job_category.lower():
            continue
        if experience_filter and experience_filter.lower() != "all" and experience_filter.lower() not in exp_level.lower():
            continue
            
        semantic_score = float(semantic_sims[idx])
        
        skill_score, matched_skills, missing_skills = calculate_skill_match(
            user_skills, expanded_terms, job.get("skills_required", []), job_category, title
        )
        
        rl_adjustment = float(state_data.get(title, 0.0))
        
        rl_boost_norm = max(-0.25, min(0.25, rl_adjustment))
        composite_raw = (0.50 * skill_score) + (0.40 * min(1.0, semantic_score * 1.8)) + (0.10 * (0.5 + rl_boost_norm))
        
        if any(t in title.lower() or t in job_category.lower() for t in expanded_terms):
            composite_raw += 0.20

        overall_percentage = round(min(98, max(25, composite_raw * 100)))
        
        rag_reason = generate_rag_reason(
            title, matched_skills, missing_skills, user_interests, job_category, overall_percentage
        )
        
        results.append({
            "id": job.get("id", title.replace(" ", "_").lower()),
            "title": title,
            "category": job_category,
            "experience_level": exp_level,
            "salary_range": job.get("salary_range", "N/A"),
            "salary_min": job.get("salary_min", 30000),
            "salary_max": job.get("salary_max", 60000),
            "market_growth_rate": job.get("market_growth_rate", 15),
            "location": job.get("location", "N/A"),
            "job_type": job.get("job_type", "Full-time"),
            "description": job["description"],
            "skills_required": job.get("skills_required", []),
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "top_philippine_employers": job.get("top_philippine_employers", []),
            "recommended_degrees": job.get("recommended_degrees", []),
            "top_recommended_universities": job.get("top_recommended_universities", []),
            "overall_score": overall_percentage,
            "semantic_score": round(semantic_score * 100, 1),
            "skill_score": round(skill_score * 100, 1),
            "rl_score": round(rl_adjustment, 3),
            "rag_reason": rag_reason,
            "key_responsibilities": job.get("key_responsibilities", []),
            "career_roadmap": job.get("career_roadmap", []),
            "recommended_courses": job.get("recommended_courses", []),
            "side_project_blueprints": job.get("side_project_blueprints", []),
            "stage_advice": job.get("stage_advice", {}),
            "state_key": canonical_state
        })
        
    results.sort(key=lambda x: x["overall_score"], reverse=True)
    return results

def update_rl(student_id, skills, interests, action_job_title, feedback_type):
    reward_map = {
        'like': 0.05,
        'dislike': -0.05,
        'bookmark': 0.08,
        'target': 0.12
    }
    
    reward = reward_map.get(str(feedback_type).lower(), 0.02)
    q_table = load_qtable()
    canonical_state = normalize_state(skills, interests)
    
    if student_id not in q_table:
        q_table[student_id] = {
            "last_state": canonical_state,
            "skills_input": skills,
            "interests_input": interests,
            "saved_bookmarks": [],
            "target_careers": [],
            "states": {}
        }

    student_data = q_table[student_id]
    student_data["last_state"] = canonical_state
    
    if feedback_type == 'bookmark' and action_job_title not in student_data.get("saved_bookmarks", []):
        student_data.setdefault("saved_bookmarks", []).append(action_job_title)
    elif feedback_type == 'target' and action_job_title not in student_data.get("target_careers", []):
        student_data.setdefault("target_careers", []).append(action_job_title)

    if canonical_state not in student_data["states"]:
        student_data["states"][canonical_state] = {}

    current_val = student_data["states"][canonical_state].get(action_job_title, 0.0)
    alpha = 0.15
    new_val = current_val + alpha * (reward - current_val)
    new_val = max(min(new_val, 0.25), -0.25)
    
    student_data["states"][canonical_state][action_job_title] = new_val
    save_qtable(q_table)
    
    return {
        "student_id": student_id,
        "state": canonical_state,
        "action": action_job_title,
        "new_rl_score": round(new_val, 3),
        "reward": reward
    }
