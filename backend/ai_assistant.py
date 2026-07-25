import json
import os
import re
from job_recommender import recommend_jobs, load_jobs

def ask_cardi(user_message, user_skills="", user_interests="", user_stage="student"):
    msg = user_message.strip()
    msg_lower = msg.lower()

    # 1. Computer Engineering for AI Question
    if ("computer engineering" in msg_lower or "cpe" in msg_lower) and ("ai" in msg_lower or "machine learning" in msg_lower):
        return {
            "sender": "AI Advisor",
            "reply": "Yes! **BS Computer Engineering (BS CpE)** is highly recommended for AI roles, especially for hardware-accelerated AI, robotics, embedded systems, and edge computing. Alongside BS CpE, **BS Computer Science (AI Track)** and **BS Data Science** are prime choices.\n\nTop accredited Philippine universities for CpE and AI include **Mapúa University** (ABET Accredited & CHED COE in CS/IT), **UP Diliman**, **De La Salle University (DLSU)**, and **MSU-IIT**."
        }

    # 2. Law & Pre-Law Question
    if any(w in msg_lower for w in ["law school", "lawyer", "attorney", "bar exam", "juris doctor", "pre-law"]):
        return {
            "sender": "AI Advisor",
            "reply": "For **Law & Legal Services**, top Philippine law schools based on Supreme Court Bar Examination passing rates and legal accreditation include **UP Law (UP Diliman)**, **Ateneo Law School (ALS - Rockwell)**, **San Beda University College of Law**, and **DLSU College of Law**.\n\nRecommended Pre-Law degree programs include **BS Legal Management**, **BA Political Science**, **BS Accountancy**, and **BS Business Administration**."
        }

    # 3. Medicine & Pre-Med Question
    if any(w in msg_lower for w in ["medicine", "doctor", "physician", "nmat", "hospital", "pre-med"]):
        return {
            "sender": "AI Advisor",
            "reply": "For **Medicine & Healthcare**, top medical schools in the Philippines include **UP Manila (UPM - #1 THE/QS Ranked)**, **UST Faculty of Medicine & Surgery**, **Ateneo School of Medicine & Public Health (ASMPH)**, **Mapúa School of Health Sciences**, **DLSMHSI**, and **SLU Baguio**.\n\nRecommended Pre-Med bachelor degrees include **Doctor of Medicine (MD)** after completing **BS Biology**, **BS Health Sciences**, **BS Nursing**, or **BS Medical Laboratory Science**."
        }

    # 4. Architecture Question
    if any(w in msg_lower for w in ["architect", "architecture", "building", "revit", "autocad", "ale board"]):
        return {
            "sender": "AI Advisor",
            "reply": "For **Architecture & Built Environment**, top accredited Philippine institutions include **UST College of Architecture** (CHED Center of Excellence), **Mapúa University School of Architecture**, **UP Diliman College of Architecture**, **CSB Design**, and **USC Cebu**.\n\nRecommended degree programs include **BS Architecture (BS Archi)** and **BS Environmental Planning & Design**."
        }

    # 5. RAG Vector Knowledge Base Search
    jobs = load_jobs()
    matched_job = None
    for job in jobs:
        title_lower = job['title'].lower()
        cat_lower = job['category'].lower()
        if any(t in msg_lower for t in title_lower.split() if len(t) > 2) or cat_lower in msg_lower:
            matched_job = job
            break

    if matched_job:
        degrees_str = ", ".join(matched_job.get("recommended_degrees", [])[:3])
        unis_str = ", ".join(matched_job.get("top_recommended_universities", [])[:3])
        employers_str = ", ".join(matched_job.get("top_philippine_employers", [])[:3])
        
        return {
            "sender": "AI Advisor",
            "reply": f"For **{matched_job['title']}**, here are the top recommendations:\n\n"
                     f"• **Recommended Degrees:** {degrees_str}\n"
                     f"• **Top Accredited Universities:** {unis_str}\n"
                     f"• **Top Hiring Employers:** {employers_str}\n\n"
                     f"*{matched_job['description']}*"
        }

    # 6. Fallback Context Answer
    recs = recommend_jobs(user_skills or "Python, Data Analysis", user_interests or "AI/ML, Business", "advisor_query")
    top_job = recs[0] if recs else None
    
    if top_job:
        degrees_str = ", ".join(top_job.get("recommended_degrees", [])[:3])
        unis_str = ", ".join(top_job.get("top_recommended_universities", [])[:3])
        return {
            "sender": "AI Advisor",
            "reply": f"Regarding your query: Based on your profile, your top career match is **{top_job['title']}** ({top_job['overall_score']}% match).\n\n"
                     f"• **Recommended Degrees:** {degrees_str}\n"
                     f"• **Top Accredited Universities:** {unis_str}\n\n"
                     f"Feel free to ask a specific question about recommended degrees, top accredited Philippine universities, or career shifts!"
        }

    return {
        "sender": "AI Advisor",
        "reply": "I am your AI Career Advisor. Ask me any question regarding recommended degree programs, top accredited Philippine universities (CHED COE, ABET, THE/QS), or career shifts!"
    }

# --- Dynamic Adaptive Quiz Generator ---
def generate_adaptive_quiz_question(step, previous_answers):
    if step == 0:
        return {
            "step": 0,
            "total_steps": 3,
            "question": "What is your primary career or study domain of interest?",
            "options": [
                { "label": "⚕️ Medicine & Healthcare Services", "domain": "Medicine & Healthcare", "add_skills": ["Clinical Diagnosis", "Patient Care"], "add_interests": ["Medicine & Healthcare"] },
                { "label": "⚖️ Law & Corporate Legal Services", "domain": "Law & Legal Services", "add_skills": ["Legal Research", "Corporate Law"], "add_interests": ["Law & Legal Services"] },
                { "label": "💻 Artificial Intelligence, Data & Tech", "domain": "Data & AI", "add_skills": ["Python", "TensorFlow"], "add_interests": ["Artificial Intelligence & Machine Learning (AI/ML)"] },
                { "label": "🏛️ Architecture & Urban Development", "domain": "Architecture & Design", "add_skills": ["Architectural Design", "AutoCAD"], "add_interests": ["Architecture & Built Environment"] },
                { "label": "🏗️ Civil, Mechanical & Systems Engineering", "domain": "Engineering", "add_skills": ["CAD Software", "Structural Analysis"], "add_interests": ["Civil & Structural Engineering"] }
            ]
        }
    
    first_domain = previous_answers[0].get("domain", "Data & AI") if len(previous_answers) > 0 else "Data & AI"
    
    if step == 1:
        if first_domain == "Medicine & Healthcare":
            return {
                "step": 1,
                "total_steps": 3,
                "question": "Which medical specialization path aligns best with your goals?",
                "options": [
                    { "label": "🩺 Internal Medicine & Patient Diagnostics", "add_skills": ["Internal Medicine", "Diagnostics"], "add_interests": ["Medicine & Healthcare"] },
                    { "label": "🧪 Clinical Laboratory & Medical Technology", "add_skills": ["Laboratory Science", "Pharmacology"], "add_interests": ["Medicine & Healthcare"] }
                ]
            }
        elif first_domain == "Law & Legal Services":
            return {
                "step": 1,
                "total_steps": 3,
                "question": "What legal practice environment do you target?",
                "options": [
                    { "label": "🏢 Corporate M&A & Enterprise Governance", "add_skills": ["Contract Drafting", "Regulatory Compliance"], "add_interests": ["Law & Legal Services"] },
                    { "label": "🏛️ Litigation, Advocacy & Dispute Resolution", "add_skills": ["Litigation", "Court Advocacy"], "add_interests": ["Law & Legal Services"] }
                ]
            }
        elif first_domain == "Architecture & Design":
            return {
                "step": 1,
                "total_steps": 3,
                "question": "What structural design focus appeals most to you?",
                "options": [
                    { "label": "🏙️ Sustainable Commercial & High-Rise BIM Design", "add_skills": ["Revit", "3D Modeling"], "add_interests": ["Architecture & Built Environment"] },
                    { "label": "🌳 Master Urban Planning & Smart Transit Infrastructure", "add_skills": ["Urban Planning", "Building Codes"], "add_interests": ["Architecture & Built Environment"] }
                ]
            }
        else:
            return {
                "step": 1,
                "total_steps": 3,
                "question": "What core technical capability would you like to master?",
                "options": [
                    { "label": "🤖 Neural Networks, Deep Learning & RAG Agents", "add_skills": ["PyTorch", "Deep Learning"], "add_interests": ["Artificial Intelligence & Machine Learning (AI/ML)"] },
                    { "label": "🛡️ Network Defense & Ethical Hacking", "add_skills": ["Network Security", "Linux"], "add_interests": ["Cybersecurity & IT Security"] }
                ]
            }
        
    return {
        "step": 2,
        "total_steps": 3,
        "is_complete": True,
        "message": "Adaptive Assessment Complete! Your career recommendations have been updated."
    }
