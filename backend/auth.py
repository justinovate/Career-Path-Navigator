import json
import os
import hashlib
import uuid

script_dir = os.path.dirname(os.path.abspath(__file__))
USERS_DB_PATH = os.path.join(script_dir, 'users.json')

def load_users():
    if os.path.exists(USERS_DB_PATH):
        try:
            with open(USERS_DB_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

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

def register_user(username, email, password, full_name=""):
    users = load_users()
    username_clean = username.strip().lower()
    email_clean = email.strip().lower()

    if not username_clean or not email_clean or not password:
        return {"error": "Username, email, and password are required."}, 400

    # Check for existing user
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
        "skills": "Python, Machine Learning",
        "interests": "AI & Machine Learning",
        "saved_bookmarks": [],
        "target_careers": [],
        "quiz_completed": False
    }

    users[user_id] = user_data
    save_users(users)

    # Sanitize password out before returning
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
