from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from job_recommender import recommend_jobs, update_rl, load_qtable, load_jobs
from auth import register_user, authenticate_user, get_user_profile, update_user_profile
from ai_assistant import ask_cardi, generate_adaptive_quiz_question

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
CORS(app)

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "Career Path Navigator API is running."})

# --- Dynamic Adaptive AI Quiz Endpoint ---
@app.route('/api/quiz/next_question', methods=['POST'])
def quiz_next_question():
    data = request.get_json() or {}
    previous_answers = data.get("previous_answers", [])
    step = data.get("step", 0)
    
    question_data = generate_adaptive_quiz_question(step, previous_answers)
    return jsonify(question_data)

# --- AI Assistant Endpoint ---
@app.route('/api/ai_chat', methods=['POST'])
def ai_chat():
    data = request.get_json() or {}
    message = data.get("message", "")
    skills = data.get("skills", "")
    interests = data.get("interests", "")
    user_stage = data.get("user_stage", "student")

    if not message:
        return jsonify({"error": "Message is required"}), 400

    response = ask_cardi(message, skills, interests, user_stage)
    return jsonify(response)

# --- User Auth Endpoints ---
@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json() or {}
    username = data.get("username", "")
    email = data.get("email", "")
    password = data.get("password", "")
    full_name = data.get("full_name", "")

    result, status_code = register_user(username, email, password, full_name)
    return jsonify(result), status_code

@app.route('/login_user', methods=['POST'])
def login_user_route():
    data = request.get_json() or {}
    identifier = data.get("identifier", "") or data.get("username", "") or data.get("email", "")
    password = data.get("password", "")

    if not identifier or not password:
        return jsonify({"error": "Username/email and password are required."}), 400

    result, status_code = authenticate_user(identifier, password)
    if status_code == 200:
        user_data = result.get("user", {})
        skills = user_data.get("skills", "")
        interests = user_data.get("interests", "")
        if skills or interests:
            user_data["previous_recommendations"] = recommend_jobs(skills, interests, user_data.get("user_id"))
        result["user"] = user_data

    return jsonify(result), status_code

@app.route('/user/profile', methods=['GET'])
def user_profile():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    
    user = get_user_profile(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    return jsonify(user)

@app.route('/user/save_profile', methods=['POST'])
def save_profile():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
        
    updated = update_user_profile(
        user_id=user_id,
        skills=data.get("skills"),
        interests=data.get("interests"),
        bookmarks=data.get("saved_bookmarks"),
        target_careers=data.get("target_careers"),
        quiz_completed=data.get("quiz_completed")
    )
    if not updated:
        return jsonify({"error": "Failed to update profile"}), 400
        
    return jsonify({"message": "Profile updated successfully", "user": updated})

# --- Recommendation & Feedback Endpoints ---
@app.route('/recommend_jobs', methods=['POST'])
def recommend():
    data = request.get_json() or {}
    student_id = data.get('student_id') or data.get('user_id') or 'Guest'
    skills = data.get('skills', '')
    interests = data.get('interests', '')
    category_filter = data.get('category_filter', None)
    experience_filter = data.get('experience_filter', None)

    recommendations = recommend_jobs(
        skills=skills,
        interests=interests,
        student_id=student_id,
        category_filter=category_filter,
        experience_filter=experience_filter
    )

    return jsonify(recommendations)

@app.route('/feedback', methods=['POST'])
def feedback():
    data = request.get_json() or {}
    student_id = data.get('student_id') or data.get('user_id')
    skills = data.get('skills', '')
    interests = data.get('interests', '')
    action = data.get('action') or data.get('job_title')
    feedback_type = data.get('feedback_type') or data.get('reward_type') or 'like'

    if not student_id or not action:
        return jsonify({"error": "user_id and action (job title) are required."}), 400

    result = update_rl(student_id, skills, interests, action, feedback_type)
    return jsonify({'message': 'RL model updated successfully', 'result': result})

@app.route('/student/<student_id>', methods=['GET'])
def student_info(student_id):
    q_table = load_qtable()
    student_data = q_table.get(student_id, {})
    
    summary_states = []
    states = student_data.get("states", {})
    
    for state_key, actions in states.items():
        for job_title, q_val in actions.items():
            summary_states.append({
                "state_key": state_key,
                "job_title": job_title,
                "q_value": round(q_val, 3)
            })

    return jsonify({
        "student_id": student_id,
        "skills_input": student_data.get("skills_input", ""),
        "interests_input": student_data.get("interests_input", ""),
        "saved_bookmarks": student_data.get("saved_bookmarks", []),
        "target_careers": student_data.get("target_careers", []),
        "learned_preferences": summary_states
    })

@app.route('/jobs', methods=['GET'])
def get_jobs():
    jobs = load_jobs()
    return jsonify(jobs)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting Career Path Navigator Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
