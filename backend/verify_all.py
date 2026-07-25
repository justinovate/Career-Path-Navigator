import json
from job_recommender import recommend_jobs
from ai_assistant import ask_cardi, generate_adaptive_quiz_question

def test_everything():
    print("--- 1. Testing Medical Recommendation Matching & Degrees/Schools ---")
    recs = recommend_jobs('Clinical Diagnosis, Patient Care', 'Medicine & Healthcare', 'dr_cruz')
    top_role = recs[0]
    print(f"Top Matched Role: {top_role['title']} | Score: {top_role['overall_score']}%")
    print("Recommended Degrees:", top_role.get("recommended_degrees"))
    print("Top Recommended Universities:", top_role.get("top_recommended_universities"))
    print("Top Employers:", top_role.get("top_philippine_employers"))

    assert top_role['title'] == "Medical Doctor / Physician", f"Expected Medical Doctor, got {top_role['title']}"
    assert top_role['overall_score'] >= 90, f"Expected match score >= 90%, got {top_role['overall_score']}%"
    assert len(top_role.get("recommended_degrees", [])) > 0, "Recommended degrees must not be empty"
    assert len(top_role.get("top_recommended_universities", [])) > 0, "Top universities must not be empty"
    print("PASSED Test 1!\n")

    print("--- 2. Testing AI Chatbot Context-Aware RAG Answer ---")
    q = "Is Computer Engineering recommended for AI roles?"
    res = ask_cardi(q)
    print("Question:", q)
    print("AI Reply:\n", res['reply'])
    
    assert "Computer Engineering" in res['reply'] or "CpE" in res['reply'], "Reply must mention Computer Engineering"
    assert "Cardi" not in res['reply'], "Reply must NOT contain legacy mascot name Cardi"
    print("PASSED Test 2!\n")

    print("--- 3. Testing Dynamic Adaptive AI Quiz ---")
    quiz_q = generate_adaptive_quiz_question(0, [])
    print("Quiz Step 0 Question:", quiz_q['question'])
    print("Options Count:", len(quiz_q['options']))
    assert len(quiz_q['options']) > 0, "Quiz options must not be empty"
    print("PASSED Test 3!\n")

    print("ALL SELF-TESTS PASSED 100% CLEANLY!")

if __name__ == '__main__':
    test_everything()
