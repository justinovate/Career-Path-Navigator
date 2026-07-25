import json
import os
import re
from job_recommender import recommend_jobs, load_jobs

UNIVERSITY_GUIDANCE = {
  "tech_eng": "For **Technology & Engineering**, top accredited Philippine institutions include **Mapúa University** (ABET Accredited & CHED COE), **UP Diliman (UPD)**, **De La Salle University (DLSU)**, **MSU-IIT** (CHED COE), and **UST**.",
  "medicine": "For **Medicine & Healthcare**, top institutions include **UP Manila (UPM)** (#1 THE/QS Ranked), **UST Faculty of Medicine & Surgery**, **Ateneo School of Medicine & Public Health (ASMPH)**, **Mapúa School of Health Sciences**, and **SLU Baguio**.",
  "law": "For **Law & Legal Studies**, top law schools in the Philippines based on Bar examination performance include **UP Law (UPD)**, **Ateneo Law School (ALS)**, **San Beda University College of Law**, and **DLSU College of Law**.",
  "archi": "For **Architecture & Built Environment**, top CHED Centers of Excellence include **UST College of Architecture**, **Mapúa University School of Architecture**, **UP Diliman College of Architecture**, and **USC Cebu**.",
  "business": "For **Business, Accountancy & Finance**, leading accredited schools include **UP Diliman Virata School of Business**, **Ateneo de Manila (ADMU)**, **DLSU**, **UST**, **Mapúa ETYSB**, and **USC Cebu**."
}

def ask_cardi(user_message, user_skills="", user_interests="", user_stage="student"):
  msg = user_message.lower().strip()
  
  if any(w in msg for w in ["law", "attorney", "lawyer", "bar exam"]):
    return {
      "sender": "AI Advisor",
      "reply": f"⚖️ **Top Philippine Law Schools & Pathways:**\n\n{UNIVERSITY_GUIDANCE['law']}\n\nKey hiring employers in corporate law include **ACCRA Law**, **SyCipLaw**, **Romulo Mabanta Law**, and corporate legal departments at **San Miguel Corporation** and **Ayala Corporation**."
    }

  if any(w in msg for w in ["medicine", "doctor", "physician", "med", "hospital", "nmat"]):
    return {
      "sender": "AI Advisor",
      "reply": f"⚕️ **Top Philippine Medical Schools & Hospitals:**\n\n{UNIVERSITY_GUIDANCE['medicine']}\n\nLeading healthcare employers include **St. Luke's Medical Center**, **The Medical City**, **Makati Medical Center**, and **Philippine General Hospital (PGH)**."
    }

  if any(w in msg for w in ["architect", "archi", "building", "revit"]):
    return {
      "sender": "AI Advisor",
      "reply": f"🏛️ **Top Philippine Architecture Schools & Firms:**\n\n{UNIVERSITY_GUIDANCE['archi']}\n\nLeading real estate & architectural employers include **Ayala Land Inc. (ALI)**, **Megaworld**, **DMCI Homes**, **Palafox Associates**, and **SM Prime Holdings**."
    }

  if any(w in msg for w in ["engineering", "mechanical", "civil", "tech", "computer science", "ai", "data"]):
    return {
      "sender": "AI Advisor",
      "reply": f"🏗️ **Top Philippine Engineering & Technology Institutions:**\n\n{UNIVERSITY_GUIDANCE['tech_eng']}\n\nTop hiring tech & engineering employers include **GCash (Mynt)**, **Globe Telecom**, **Canva PH**, **Macquarie Group**, **Meralco**, **First Gen**, and **Accenture PH**."
    }

  # Fetch RAG Job Recommendations for Context
  recs = recommend_jobs(user_skills or "Python, Data Analysis", user_interests or "AI/ML, Business", "advisor_query")
  top_job = recs[0] if recs else None
  
  if top_job:
    top_employers = ", ".join(top_job.get("top_philippine_employers", [])[:3])
    top_unis = ", ".join(top_job.get("top_recommended_universities", [])[:2])
    return {
      "sender": "AI Advisor",
      "reply": f"🤖 **AI Career Advisor Analysis:**\n\nBased on your skillset and interests, your top match is **{top_job['title']}** ({top_job['overall_score']}% match)!\n\n- **Top Philippine Employers:** {top_employers}\n- **Recommended Universities:** {top_unis}\n- **RAG Insight:** {top_job['rag_reason']}\n\nAsk me any question about top Philippine universities, hiring companies, or career transitions!"
    }

  return {
    "sender": "AI Advisor",
    "reply": "🤖 **Hi! I am your AI Career Advisor.** Ask me any question about top accredited Philippine universities (based on CHED COE, ABET, THE, and QS rankings), hiring employers, degree specialization tracks, or career transitions!"
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
      
  # Step 2: Final refinement
  return {
    "step": 2,
    "total_steps": 3,
    "is_complete": True,
    "message": "Dynamic Adaptive Quiz Complete! Your profile has been updated based on your tailored responses."
  }
