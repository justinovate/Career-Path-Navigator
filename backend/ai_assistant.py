import json
import os
import re
from job_recommender import recommend_jobs, load_jobs

UNIVERSITY_GUIDANCE = {
  "tech_eng": "For **Technology & Engineering**, top accredited Philippine institutions include **Mapúa University** (ABET Accredited & CHED COE), **UP Diliman (UPD)**, **De La Salle University (DLSU)**, **MSU-IIT** (CHED COE), and **UST**.",
  "medicine": "For **Medicine & Healthcare**, top institutions include **UP Manila (UPM)** (#1 THE/QS Ranked), **UST Faculty of Medicine & Surgery**, **Ateneo School of Medicine & Public Health (ASMPH)**, and **Mapúa School of Health Sciences**.",
  "law": "For **Law & Legal Studies**, top law schools in the Philippines based on Bar examination performance include **UP Law (UPD)**, **Ateneo Law School (ALS)**, **San Beda University College of Law**, and **DLSU College of Law**.",
  "archi": "For **Architecture & Built Environment**, top CHED Centers of Excellence include **UST College of Architecture**, **Mapúa University School of Architecture**, and **UP Diliman College of Architecture**.",
  "business": "For **Business, Accountancy & Finance**, leading accredited schools include **UP Diliman Virata School of Business**, **Ateneo de Manila (ADMU)**, **DLSU**, **UST**, and **Mapúa ETYSB**."
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
