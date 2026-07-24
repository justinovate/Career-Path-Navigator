import json
import os
import re

# Dual vector search support: Try SentenceTransformer, fallback gracefully to scikit-learn TfidfVectorizer
USE_SENTENCE_TRANSFORMERS = False
model = None
tfidf_vectorizer = None
job_tfidf_matrix = None

try:
    import torch
    from sentence_transformers import SentenceTransformer, util
    model = SentenceTransformer('all-MiniLM-L6-v2')
    USE_SENTENCE_TRANSFORMERS = True
    print("Using SentenceTransformer for RAG vector embeddings.")
except Exception as e:
    print(f"SentenceTransformer unavailable ({e}). Falling back to TF-IDF Vector Space search.")
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    USE_SENTENCE_TRANSFORMERS = False

script_dir = os.path.dirname(os.path.abspath(__file__))
json_path = os.path.join(script_dir, 'jobs.json')
QTABLE_PATH = os.path.join(script_dir, 'q_table.json')

def load_jobs():
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

job_data = load_jobs()

def prepare_vector_index(jobs):
    global USE_SENTENCE_TRANSFORMERS, model, tfidf_vectorizer, job_tfidf_matrix
    texts = []
    for job in jobs:
        skills_str = ", ".join(job.get("skills_required", []))
        text = f"Title: {job['title']}. Category: {job.get('category', '')}. Skills: {skills_str}. Description: {job['description']}"
        texts.append(text)
        
    if USE_SENTENCE_TRANSFORMERS and model is not None:
        try:
            embeddings = model.encode(texts, convert_to_tensor=True)
            return ("st", embeddings)
        except Exception as e:
            print(f"Error encoding with SentenceTransformer: {e}. Switching to TF-IDF.")
            USE_SENTENCE_TRANSFORMERS = False

    # TF-IDF Fallback Vector Indexing
    from sklearn.feature_extraction.text import TfidfVectorizer
    tfidf_vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
    job_tfidf_matrix = tfidf_vectorizer.fit_transform(texts)
    return ("tfidf", job_tfidf_matrix)

vector_index_type, job_vector_index = prepare_vector_index(job_data)

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
    """
    Creates a canonical, deterministic state key regardless of order or casing.
    """
    s_list = sorted([s.strip().lower() for s in skills.split(",") if s.strip()]) if isinstance(skills, str) else []
    i_list = sorted([i.strip().lower() for i in interests.split(",") if i.strip()]) if isinstance(interests, str) else []
    
    skills_part = "_".join(s_list) if s_list else "noskills"
    interests_part = "_".join(i_list) if i_list else "nointerests"
    return f"{skills_part}|{interests_part}"

def parse_user_skills(skills_input):
    if not skills_input:
        return []
    if isinstance(skills_input, list):
        return [s.strip() for s in skills_input if s.strip()]
    return [s.strip() for s in skills_input.split(",") if s.strip()]

def parse_user_interests(interests_input):
    if not interests_input:
        return []
    if isinstance(interests_input, list):
        return [i.strip() for i in interests_input if i.strip()]
    return [i.strip() for i in interests_input.split(",") if i.strip()]

def calculate_skill_match(user_skills, job_skills):
    if not job_skills:
        return 0.0, [], []
    
    user_skills_lower = {s.lower(): s for s in user_skills}
    matched = []
    missing = []
    
    for j_skill in job_skills:
        j_lower = j_skill.lower()
        found = False
        for u_lower in user_skills_lower.keys():
            if u_lower == j_lower or u_lower in j_lower or j_lower in u_lower:
                matched.append(j_skill)
                found = True
                break
        if not found:
            missing.append(j_skill)
            
    match_ratio = len(matched) / len(job_skills) if job_skills else 0.0
    return match_ratio, matched, missing

def generate_rag_reason(title, matched_skills, missing_skills, user_interests, category, semantic_score):
    reasons = []
    if matched_skills:
        reasons.append(f"Directly leverages your expertise in {', '.join(matched_skills[:3])}.")
    else:
        reasons.append(f"Presents an exciting career opportunity in the {category} domain.")
        
    matching_interests = [i for i in user_interests if i.lower() in category.lower() or i.lower() in title.lower()]
    if matching_interests:
        reasons.append(f"Strongly aligns with your interest in {', '.join(matching_interests)}.")
        
    if semantic_score > 0.65:
        reasons.append("High semantic vector alignment with your skills and background.")
    elif semantic_score > 0.35:
        reasons.append("Moderate contextual alignment with your requested path.")

    if missing_skills:
        reasons.append(f"Recommended next skills to acquire: {', '.join(missing_skills[:2])}.")
        
    return " ".join(reasons)

def calculate_semantic_scores(query_text, jobs):
    global USE_SENTENCE_TRANSFORMERS, model, tfidf_vectorizer, job_tfidf_matrix
    scores = [0.0] * len(jobs)
    
    if USE_SENTENCE_TRANSFORMERS and model is not None:
        try:
            from sentence_transformers import util
            query_emb = model.encode(query_text, convert_to_tensor=True)
            hits = util.semantic_search(query_emb, job_vector_index[1], top_k=len(jobs))[0]
            for hit in hits:
                scores[hit["corpus_id"]] = float(hit["score"])
            return scores
        except Exception as e:
            print(f"Semantic search error: {e}. Falling back to TF-IDF.")
            
    # TF-IDF fallback
    from sklearn.metrics.pairwise import cosine_similarity
    if tfidf_vectorizer is None or job_tfidf_matrix is None:
        prepare_vector_index(jobs)
    
    query_vec = tfidf_vectorizer.transform([query_text])
    sim = cosine_similarity(query_vec, job_tfidf_matrix)[0]
    for idx, s in enumerate(sim):
        scores[idx] = float(s)
    return scores

def recommend_jobs(skills, interests, student_id, category_filter=None, experience_filter=None):
    global job_data
    if not job_data:
        job_data = load_jobs()
        prepare_vector_index(job_data)
        
    user_skills = parse_user_skills(skills)
    user_interests = parse_user_interests(interests)
    
    query_text = f"Student looking for career path. Skills: {', '.join(user_skills)}. Interests: {', '.join(user_interests)}."
    semantic_scores = calculate_semantic_scores(query_text, job_data)
    
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
        
        # Apply filters if provided
        if category_filter and category_filter.lower() != "all" and category_filter.lower() not in job_category.lower():
            continue
        if experience_filter and experience_filter.lower() != "all" and experience_filter.lower() not in exp_level.lower():
            continue
            
        semantic_score = semantic_scores[idx]
        
        # Calculate Skill Match Score
        skill_match_ratio, matched_skills, missing_skills = calculate_skill_match(user_skills, job.get("skills_required", []))
        
        # RL Adjustment from Q-table
        rl_adjustment = float(state_data.get(title, 0.0))
        
        # Weighted Overall Score (Scaled to 0 - 100%)
        # 45% semantic relevance + 40% skill match + 15% RL user preference boost
        rl_boost_normalized = max(-0.25, min(0.25, rl_adjustment))
        composite_score = (0.45 * semantic_score) + (0.40 * skill_match_ratio) + (0.15 * (0.5 + rl_boost_normalized))
        overall_percentage = round(min(99, max(20, composite_score * 100)))
        
        # RAG Generated personalized explanation
        rag_reason = generate_rag_reason(
            title, matched_skills, missing_skills, user_interests, job_category, semantic_score
        )
        
        results.append({
            "id": job.get("id", title.replace(" ", "_").lower()),
            "title": title,
            "category": job_category,
            "experience_level": exp_level,
            "salary_range": job.get("salary_range", "N/A"),
            "location": job.get("location", "N/A"),
            "job_type": job.get("job_type", "Full-time"),
            "description": job["description"],
            "skills_required": job.get("skills_required", []),
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "overall_score": overall_percentage,
            "semantic_score": round(semantic_score * 100, 1),
            "skill_score": round(skill_match_ratio * 100, 1),
            "rl_score": round(rl_adjustment, 3),
            "rag_reason": rag_reason,
            "key_responsibilities": job.get("key_responsibilities", []),
            "career_roadmap": job.get("career_roadmap", []),
            "recommended_courses": job.get("recommended_courses", []),
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
    student_data["skills_input"] = skills
    student_data["interests_input"] = interests
    
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
