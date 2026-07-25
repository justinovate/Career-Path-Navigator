import json
import os
import hashlib
import uuid

script_dir = os.path.dirname(os.path.abspath(__file__))
USERS_DB_PATH = os.path.join(script_dir, 'users.json')

def load_users():
    users = {}
    if os.path.exists(USERS_DB_PATH):
        try:
            with open(USERS_DB_PATH, 'r', encoding='utf-8') as f:
                users = json.load(f)
        except Exception:
            users = {}
            
    # Auto-seed demo accounts if missing
    seeded = seed_demo_accounts(users)
    if seeded:
        save_users(users)
    return users

def save_users(users):
    with open(USERS_DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=2)

def hash_password(password, salt=None):
    if not salt:
        salt = os.urandom(16).hex()
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return f"{salt}:{hashed}"

def verify_password(stored_password_hash, provided_password):
    try:
        salt, hashed = stored_password_hash.split(':')
        new_hash = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
        return new_hash == hashed
    except Exception:
        return False

def seed_demo_accounts(users):
    demo_accounts = [
        {"username": "alex_ai", "email": "alex@example.com", "full_name": "Alex Rivera", "skills": "Python, TensorFlow, Machine Learning", "interests": "AI/ML, Data Science"},
        {"username": "maria_eng", "email": "maria@example.com", "full_name": "Maria Santos", "skills": "CAD Software, SolidWorks, AutoCAD", "interests": "Mechanical Systems, Engineering"},
        {"username": "dr_cruz", "email": "cruz@example.com", "full_name": "Dr. Christian Cruz", "skills": "Clinical Medicine, Diagnostics, Patient Care", "interests": "Medicine, Healthcare"},
        {"username": "atty_santos", "email": "atty@example.com", "full_name": "Atty. Sophia Santos", "skills": "Legal Research, Corporate Law, Litigation", "interests": "Law, Legal Services"},
        {"username": "arch_reyes", "email": "reyes@example.com", "full_name": "Arch. Marco Reyes", "skills": "Architectural Design, AutoCAD, Revit, 3D Modeling", "interests": "Architecture, Urban Planning"}
    ]
    
    modified = False
    for demo in demo_accounts:
        uname_clean = demo["username"].lower()
        exists = any(u.get("username_clean") == uname_clean for u in users.values())
        if not exists:
            uid = f"user_{demo['username']}"
            pwd_hash = hash_password("password123")
            users[uid] = {
                "user_id": uid,
                "username": demo["username"],
                "username_clean": uname_clean,
                "email": demo["email"],
                "email_clean": demo["email"].lower(),
                "full_name": demo["full_name"],
                "password_hash": pwd_hash,
                "skills": demo["skills"],
                "interests": demo["interests"],
                "saved_bookmarks": [],
                "target_careers": [],
                "quiz_completed": True
            }
            modified = True
    return modified

def register_user(username, email, password, full_name=""):
    users = load_users()
    username_clean = username.strip().lower()
    email_clean = email.strip().lower()

    if not username_clean or not email_clean or not password:
        return {"error": "Username, email, and password are required."}, 400

    for uid, user in users.items():
        if user.get("username_clean") == username_clean:
            return {"error": "Username is already taken."}, 400
        if user.get("email_clean") == email_clean:
            return {"error": "An account with this email already exists."}, 400

    user_id = f"user_{uuid.uuid4().hex[:8]}"
    pwd_hash = hash_password(password)

    user_data = {
        "user_id": user_id,
        "username": username.strip(),
        "username_clean": username_clean,
        "email": email.strip(),
        "email_clean": email_clean,
        "full_name": full_name.strip() or username.strip(),
        "password_hash": pwd_hash,
        "skills": "Python, Data Analysis",
        "interests": "AI/ML",
        "saved_bookmarks": [],
        "target_careers": [],
        "quiz_completed": False
    }

    users[user_id] = user_data
    save_users(users)

    safe_data = dict(user_data)
    del safe_data["password_hash"]
    return {"message": "Registration successful", "user": safe_data}, 201

def authenticate_user(identifier, password):
    users = load_users()
    clean_id = identifier.strip().lower()

    target_user = None
    for uid, user in users.items():
        if user.get("username_clean") == clean_id or user.get("email_clean") == clean_id:
            target_user = user
            break

    if not target_user:
        return {"error": "Invalid username/email or password."}, 401

    if not verify_password(target_user.get("password_hash", ""), password):
        return {"error": "Invalid username/email or password."}, 401

    safe_data = dict(target_user)
    if "password_hash" in safe_data:
        del safe_data["password_hash"]
    return {"message": "Login successful", "user": safe_data}, 200

def get_user_profile(user_id):
    users = load_users()
    user = users.get(user_id)
    if not user:
        return None
    safe_data = dict(user)
    if "password_hash" in safe_data:
        del safe_data["password_hash"]
    return safe_data

def update_user_profile(user_id, skills=None, interests=None, bookmarks=None, target_careers=None, quiz_completed=None):
    users = load_users()
    if user_id not in users:
        return None

    user = users[user_id]
    if skills is not None:
        user["skills"] = skills
    if interests is not None:
        user["interests"] = interests
    if bookmarks is not None:
        user["saved_bookmarks"] = bookmarks
    if target_careers is not None:
        user["target_careers"] = target_careers
    if quiz_completed is not None:
        user["quiz_completed"] = quiz_completed

    users[user_id] = user
    save_users(users)

    safe_data = dict(user)
    if "password_hash" in safe_data:
        del safe_data["password_hash"]
    return safe_data
