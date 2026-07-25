from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from job_recommender import recommend_jobs, update_rl, load_qtable, load_jobs

frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))

app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
CORS(app)

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "message": "Career Path Navigator API is running."})

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    student_id = data.get("student_id", "").strip()

    if not student_id:
        return jsonify({"error": "Student ID is required."}), 400

    q_table = load_qtable()
    student_data = q_table.get(student_id, {})
    
    last_state = student_data.get("last_state", "")
    skills_input = student_data.get("skills_input", "")
    interests_input = student_data.get("interests_input", "")
    saved_bookmarks = student_data.get("saved_bookmarks", [])
    target_careers = student_data.get("target_careers", [])

    previous_recommendations = []
    if skills_input or interests_input:
        previous_recommendations = recommend_jobs(skills_input, interests_input, student_id)

    return jsonify({
        "student_id": student_id,
        "skills": skills_input,
        "interests": interests_input,
        "last_state": last_state,
        "saved_bookmarks": saved_bookmarks,
        "target_careers": target_careers,
        "recommendations": previous_recommendations
    })

@app.route('/recommend_jobs', methods=['POST'])
def recommend():
    data = request.get_json() or {}
    student_id = data.get('student_id', 'Guest')
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
    student_id = data.get('student_id')
    skills = data.get('skills', '')
    interests = data.get('interests', '')
    action = data.get('action') or data.get('job_title')
    feedback_type = data.get('feedback_type') or data.get('reward_type') or 'like'
    
    if 'reward' in data and not feedback_type:
        reward_val = data.get('reward')
        feedback_type = 'like' if reward_val > 0 else 'dislike'

    if not student_id or not action:
        return jsonify({"error": "student_id and action (job title) are required."}), 400

    print(f"FEEDBACK RECEIVED | ID: {student_id} | Action: {action} | Type: {feedback_type}")
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
