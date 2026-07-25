import json
import os
import re
from job_recommender import recommend_jobs, load_jobs

MAPUA_FAQS = {
  "campuses": "Mapúa University operates two main campuses: **Manila Campus** (Intramuros - Engineering, Architecture, IT, Media Studies) and **Makati Campus** (Gil Puyat & Pablo Ocampo - IT/CS, Data Science, Business/ETYSB, Health Sciences).",
  "grading": "Mapúa operates on a **Quaterm (Quarterly)** academic calendar with 4 terms per academic year, enabling accelerated degree completion.",
  "programs": "Mapúa offers top-tier ABET-accredited programs in Computer Science, IT, Computer Engineering, Civil, Mechanical, EE, ECE, Chemical, Data Science, Business Intelligence, Multimedia Arts, Nursing, and Graduate Studies.",
  "graduate": "Mapúa School of Graduate Studies offers MS Computer Science (MS CS), MS Artificial Intelligence (MS AI), MS Cybersecurity, Master of Engineering (M.Eng), and Master of Business Administration (MBA)."
}

def ask_cardi(user_message, user_skills="", user_interests="", user_stage="student"):
  msg = user_message.lower().strip()
  
  # Check direct FAQ triggers
  if any(w in msg for w in ["campus", "location", "intramuros", "makati", "manila"]):
    return {
      "sender": "Cardi",
      "reply": f"🔴💛 **Hi! Cardi here!** {MAPUA_FAQS['campuses']}\n\nDo you want to know which campus offers your specific degree program?"
    }
    
  if any(w in msg for w in ["quaterm", "quarter", "term", "grading"]):
    return {
      "sender": "Cardi",
      "reply": f"🔴💛 **Cardi's Mapúa Tip:** {MAPUA_FAQS['grading']} It's fast-paced, so building strong study habits early is key!"
    }
    
  if any(w in msg for w in ["master", "graduate", "ms", "mba", "postgraduate"]):
    return {
      "sender": "Cardi",
      "reply": f"🔴💛 **Mapúa Graduate Studies:** {MAPUA_FAQS['graduate']}\n\nThese programs are perfect if you're a career shifter or looking to specialize in AI, Cybersecurity, or Tech Leadership!"
    }

  # Fetch RAG Job Recommendations for Context
  query_skills = user_skills or "Python, Machine Learning"
  query_interests = user_interests or "AI/ML, Software Development"
  
  recs = recommend_jobs(query_skills, query_interests, "cardi_query")
  top_job = recs[0] if recs else None
  
  # Contextual Cardi advice based on query intent
  if any(w in msg for w in ["elective", "track", "specialization", "major"]):
    if top_job:
      degrees = ", ".join(top_job.get("mapua_degrees", []))
      tracks = ", ".join(top_job.get("mapua_tracks", []))
      return {
        "sender": "Cardi",
        "reply": f"🔴💛 **Cardi's Track Recommendation for {top_job['title']}:**\n\n- **Recommended Degree:** {degrees}\n- **Specialization Tracks:** {tracks}\n- **Top Electives to Pick:** Data Structures, Machine Learning, Systems Architecture.\n\nWould you like side project ideas for your portfolio?"
      }

  if any(w in msg for w in ["freshman", "applicant", "entrance", "apply", "enroll"]):
    return {
      "sender": "Cardi",
      "reply": "🔴💛 **Welcome to Mapúa! Cardi's Freshman Guide:**\n\n1. Prepare in Mathematics (Calculus/Algebra) and basic Programming.\n2. Apply for your desired campus: Manila (Engineering & IT) or Makati (CS/AI, Data Science, Business, Health).\n3. Join Mapúa student chapters (ACM, IEEE, ICpEP, PICE) during orientation week!"
    }

  if any(w in msg for w in ["project", "portfolio", "side project", "capstone"]):
    if top_job:
      projects = "\n• ".join(top_job.get("side_project_blueprints", []))
      return {
        "sender": "Cardi",
        "reply": f"🔴💛 **Cardi's Top Side Project Blueprints for {top_job['title']}:**\n\n• {projects}\n\nBuilding these will make your GitHub profile pop for recruiters!"
      }

  # Default friendly Cardi response with RAG recommendation synthesis
  if top_job:
    degrees = ", ".join(top_job.get("mapua_degrees", [])[:2])
    return {
      "sender": "Cardi",
      "reply": f"🔴💛 **Hi! Cardi here, your Mapúa AI Career Advisor!**\n\nBased on your profile, your top career match is **{top_job['title']}** ({top_job['overall_score']}% match)!\n\n- **Recommended Mapúa Program:** {degrees}\n- **RAG Insight:** {top_job['rag_reason']}\n\nAsk me anything about Mapúa tracks, electives, side projects, or career shifts!"
    }

  return {
    "sender": "Cardi",
    "reply": "🔴💛 **Hi! Cardi here!** Ask me any question about Mapúa University programs, specialization tracks, side projects, or career advice!"
  }
