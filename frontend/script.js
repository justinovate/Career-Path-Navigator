// ==========================================================================
// Career Path Navigator - Minimalist Client Application Logic
// ==========================================================================

const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000'
  : window.location.origin;

let currentUser = null;
let skills = [];
let interests = [];
let currentStage = 'student';
let activeCategoryFilter = 'All';
let activeExperienceFilter = 'All';
let searchQuery = '';
let currentRecommendations = [];
let savedBookmarks = [];
let targetCareers = [];

// Adaptive Quiz Memory State
let quizStep = 0;
let quizPreviousAnswers = [];
let currentQuizData = null;

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const topBar = document.getElementById('top-bar');
const dashboardWorkspace = document.getElementById('dashboard-workspace');
const studentDisplay = document.getElementById('student-display');
const skillTagsDiv = document.getElementById('skill-tags');
const interestTagsDiv = document.getElementById('interest-tags');
const resultsDiv = document.getElementById('results');
const resultsHeader = document.getElementById('results-header');
const resultsCount = document.getElementById('results-count');
const toastContainer = document.getElementById('toast-container');
const quizModal = document.getElementById('quiz-modal');
const quizBody = document.getElementById('quiz-body');
const cardiDrawer = document.getElementById('cardi-chat-drawer');
const cardiMessages = document.getElementById('cardi-chat-messages');

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('cpn_theme') || 'dark';
  applyThemeMode(savedTheme);

  const savedUser = localStorage.getItem('cpn_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      initUserSession(currentUser);
    } catch (e) {
      localStorage.removeItem('cpn_user');
    }
  }
});

// --- Minimalist 2-Mode Theme Switcher (Dark / Light) ---
function toggleThemeMode() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyThemeMode(next);
}

function applyThemeMode(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('cpn_theme', theme);
  
  const label = document.getElementById('theme-toggle-label');
  if (label) {
    label.innerHTML = theme === 'dark'
      ? '<i class="fa-solid fa-sun"></i> Light Mode'
      : '<i class="fa-solid fa-moon"></i> Dark Mode';
  }
}

// --- Life Stage Selector ---
function setLifeStage(stage, btnElement) {
  currentStage = stage;
  document.querySelectorAll('.stage-pill').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  fetchRecommendations();
}

// --- Auth Tabs & Authentication ---
function switchAuthTab(tab) {
  document.getElementById('tab-signin').classList.toggle('active', tab === 'signin');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('signin-form').style.display = tab === 'signin' ? 'block' : 'none';
  document.getElementById('signup-form').style.display = tab === 'signup' ? 'block' : 'none';
}

async function handleSignIn() {
  const identifier = document.getElementById('signin-id').value.trim();
  const password = document.getElementById('signin-pwd').value.trim();

  if (!identifier || !password) {
    showToast('Please enter your username/email and password.', 'warning');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/login_user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const data = await response.json();
    if (!response.ok) {
      showToast(data.error || 'Login failed', 'warning');
      return;
    }

    currentUser = data.user;
    localStorage.setItem('cpn_user', JSON.stringify(currentUser));
    initUserSession(currentUser);
    showToast(`Welcome back, ${currentUser.full_name || currentUser.username}!`, 'success');

  } catch (err) {
    console.error('Sign in error:', err);
    showToast('Could not connect to authentication server.', 'warning');
  }
}

async function handleSignUp() {
  const full_name = document.getElementById('signup-name').value.trim();
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-pwd').value.trim();

  if (!username || !email || !password) {
    showToast('Please fill in all required fields.', 'warning');
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, full_name })
    });

    const data = await response.json();
    if (!response.ok) {
      showToast(data.error || 'Registration failed', 'warning');
      return;
    }

    currentUser = data.user;
    localStorage.setItem('cpn_user', JSON.stringify(currentUser));
    initUserSession(currentUser);
    showToast(`Account created successfully! Welcome, ${currentUser.username}.`, 'success');

  } catch (err) {
    console.error('Sign up error:', err);
    showToast('Could not connect to authentication server.', 'warning');
  }
}

function quickDemoLogin(username, password) {
  document.getElementById('signin-id').value = username;
  document.getElementById('signin-pwd').value = password;
  handleSignIn();
}

function initUserSession(user) {
  studentDisplay.textContent = `User: ${user.username}`;
  savedBookmarks = user.saved_bookmarks || [];
  targetCareers = user.target_careers || [];

  if (user.skills) {
    skills = user.skills.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    skills = ['Python', 'TensorFlow'];
  }

  if (user.interests) {
    interests = user.interests.split(',').map(i => i.trim()).filter(Boolean);
  } else {
    interests = ['Artificial Intelligence & Machine Learning (AI/ML)'];
  }

  renderTags(skillTagsDiv, skills, 'skills');
  renderTags(interestTagsDiv, interests, 'interests');

  loginScreen.style.display = 'none';
  topBar.style.display = 'flex';
  dashboardWorkspace.style.display = 'grid';

  fetchRecommendations();
}

function logout() {
  currentUser = null;
  localStorage.removeItem('cpn_user');
  skills = [];
  interests = [];
  currentRecommendations = [];
  savedBookmarks = [];
  targetCareers = [];

  topBar.style.display = 'none';
  dashboardWorkspace.style.display = 'none';
  loginScreen.style.display = 'block';

  skillTagsDiv.innerHTML = '';
  interestTagsDiv.innerHTML = '';
  resultsDiv.innerHTML = `
    <div class="empty-state glass-card">
      <i class="fa-solid fa-compass"></i>
      <h3>Ready to Explore Your Career Path?</h3>
      <p>Sign in or create an account to generate RAG & RL recommendations.</p>
    </div>
  `;
  resultsHeader.style.display = 'none';
  showToast('Logged out successfully.', 'info');
}

// --- Tag Management ---
function addSkill() {
  const input = document.getElementById('skill-input');
  const value = input.value.trim();
  if (value && !skills.some(s => s.toLowerCase() === value.toLowerCase())) {
    skills.push(value);
    renderTags(skillTagsDiv, skills, 'skills');
    saveUserProfileState();
  }
  input.value = '';
}

function quickAddSkill(skillName) {
  if (!skills.some(s => s.toLowerCase() === skillName.toLowerCase())) {
    skills.push(skillName);
    renderTags(skillTagsDiv, skills, 'skills');
    showToast(`Added ${skillName} to your skills!`, 'info');
    saveUserProfileState();
    fetchRecommendations();
  }
}

function addInterest() {
  const input = document.getElementById('interest-input');
  const value = input.value.trim();
  if (value && !interests.some(i => i.toLowerCase() === value.toLowerCase())) {
    interests.push(value);
    renderTags(interestTagsDiv, interests, 'interests');
    saveUserProfileState();
  }
  input.value = '';
}

function removeTag(type, index) {
  if (type === 'skills') {
    skills.splice(index, 1);
    renderTags(skillTagsDiv, skills, 'skills');
  } else {
    interests.splice(index, 1);
    renderTags(interestTagsDiv, interests, 'interests');
  }
  saveUserProfileState();
  fetchRecommendations();
}

function renderTags(container, list, type) {
  container.innerHTML = '';
  list.forEach((item, index) => {
    const chip = document.createElement('div');
    chip.className = `tag-chip ${type === 'interests' ? 'interest' : ''}`;
    chip.innerHTML = `
      <span>${item}</span>
      <button type="button" onclick="removeTag('${type}', ${index})">&times;</button>
    `;
    container.appendChild(chip);
  });
}

async function saveUserProfileState() {
  if (!currentUser) return;
  try {
    await fetch(`${API_BASE_URL}/user/save_profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.user_id,
        skills: skills.join(', '),
        interests: interests.join(', '),
        saved_bookmarks: savedBookmarks,
        target_careers: targetCareers
      })
    });
  } catch (e) {
    console.error('Failed to auto-save profile state', e);
  }
}

// --- Category & Search Filters ---
function setCategoryFilter(category, btnElement) {
  activeCategoryFilter = category;
  document.querySelectorAll('#category-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
  if (btnElement) btnElement.classList.add('active');
  fetchRecommendations();
}

function performSearch() {
  const input = document.getElementById('search-filter');
  const clearBtn = document.getElementById('clear-search-btn');
  searchQuery = input.value.toLowerCase().trim();

  if (searchQuery) {
    clearBtn.style.display = 'block';
  } else {
    clearBtn.style.display = 'none';
  }

  renderRecommendations(currentRecommendations);
}

function clearSearch() {
  const input = document.getElementById('search-filter');
  const clearBtn = document.getElementById('clear-search-btn');
  input.value = '';
  searchQuery = '';
  clearBtn.style.display = 'none';
  renderRecommendations(currentRecommendations);
}

// --- API Recommendations ---
async function fetchRecommendations() {
  const skillsText = skills.join(', ');
  const interestsText = interests.join(', ');
  const userId = currentUser ? currentUser.user_id : 'Guest';

  resultsDiv.innerHTML = `
    <div class="glass-card empty-state">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <h3>Analyzing Skills & Querying Vector Database...</h3>
      <p>Matching top accredited Philippine universities and leading employer requirements.</p>
    </div>
  `;

  activeExperienceFilter = document.getElementById('experience-filter').value;

  try {
    const response = await fetch(`${API_BASE_URL}/recommend_jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        student_id: userId,
        skills: skillsText,
        interests: interestsText,
        user_stage: currentStage,
        category_filter: activeCategoryFilter,
        experience_filter: activeExperienceFilter
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    currentRecommendations = data;
    renderRecommendations(data);

  } catch (err) {
    console.error('Fetch recommendations error:', err);
    resultsDiv.innerHTML = `
      <div class="glass-card empty-state">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--crimson-red);"></i>
        <h3>Connection Error</h3>
        <p>Could not connect to backend server on ${API_BASE_URL}.</p>
      </div>
    `;
  }
}

function renderRecommendations(jobs) {
  let filtered = jobs;
  if (searchQuery) {
    filtered = jobs.filter(j =>
      j.title.toLowerCase().includes(searchQuery) ||
      j.description.toLowerCase().includes(searchQuery) ||
      j.category.toLowerCase().includes(searchQuery) ||
      (j.recommended_degrees || []).some(d => d.toLowerCase().includes(searchQuery)) ||
      (j.top_recommended_universities || []).some(u => u.toLowerCase().includes(searchQuery)) ||
      (j.top_philippine_employers || []).some(e => e.toLowerCase().includes(searchQuery)) ||
      j.skills_required.some(s => s.toLowerCase().includes(searchQuery))
    );
  }

  resultsHeader.style.display = 'flex';
  resultsCount.textContent = `${filtered.length} career options matched`;

  if (filtered.length === 0) {
    resultsDiv.innerHTML = `
      <div class="glass-card empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <h3>No Careers Match Your Search "${searchQuery}"</h3>
        <p>Try searching for a different keyword or click "Clear Search".</p>
      </div>
    `;
    return;
  }

  resultsDiv.innerHTML = '';

  filtered.forEach((job, index) => {
    const card = document.createElement('div');
    card.className = 'glass-card job-card';

    const isBookmarked = savedBookmarks.includes(job.title);
    const isTarget = targetCareers.includes(job.title);

    const matchedChips = job.matched_skills.map(s => `<span class="skill-chip matched"><i class="fa-solid fa-check"></i> ${s}</span>`).join(' ');
    const missingChips = job.missing_skills.map(s => `<span class="skill-chip missing"><i class="fa-solid fa-lightbulb"></i> ${s}</span>`).join(' ');

    const employerChips = (job.top_philippine_employers || []).map(e => `<span class="meta-chip category"><i class="fa-solid fa-building"></i> ${e}</span>`).join(' ');
    
    // Explicit Degree Chips & University Chips
    const degreesList = job.recommended_degrees && job.recommended_degrees.length > 0
      ? job.recommended_degrees
      : ["Bachelor Degree in relevant domain"];
    const universitiesList = job.top_recommended_universities && job.top_recommended_universities.length > 0
      ? job.top_recommended_universities
      : ["Top CHED Accredited Universities"];

    const degreeChips = degreesList.map(d => `<span class="degree-chip"><i class="fa-solid fa-graduation-cap"></i> ${d}</span>`).join(' ');
    const universityChips = universitiesList.map(u => `<span class="university-chip"><i class="fa-solid fa-university"></i> ${u}</span>`).join(' ');
    
    const stageAdviceText = job.stage_advice ? (job.stage_advice[currentStage] || job.stage_advice["student"]) : "";

    card.innerHTML = `
      <div class="job-header">
        <div class="job-title-area">
          <h3>${job.title}</h3>
          <div class="job-meta-badges">
            <span class="meta-chip category"><i class="fa-solid fa-briefcase"></i> ${job.category}</span>
            <span class="meta-chip"><i class="fa-solid fa-layer-group"></i> ${job.experience_level}</span>
            <span class="meta-chip salary"><i class="fa-solid fa-money-bill-wave"></i> ${job.salary_range}</span>
            <span class="meta-chip"><i class="fa-solid fa-location-dot"></i> ${job.location}</span>
          </div>
        </div>

        <div class="match-score-badge">
          <div class="score-num">${job.overall_score}%</div>
          <span class="score-label">Match Score</span>
        </div>
      </div>

      <!-- Prominent 1: Recommended Degrees Callout Box -->
      <div class="prominent-degree-box">
        <div class="prominent-header"><i class="fa-solid fa-graduation-cap"></i> Recommended Degree Programs to Pursue:</div>
        <div>${degreeChips}</div>
      </div>

      <!-- Prominent 2: Top Accredited Universities Callout Box -->
      <div class="prominent-university-box">
        <div class="uni-header"><i class="fa-solid fa-university"></i> Top Accredited Philippine Universities (CHED COE, ABET, THE/QS):</div>
        <div>${universityChips}</div>
      </div>

      <!-- Top Employers in PH -->
      <div style="margin-bottom: 14px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--sky-blue); text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">
          <i class="fa-solid fa-building"></i> Top Hiring Employers in the Philippines:
        </span>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">${employerChips}</div>
      </div>

      <!-- Stage-Specific Advisory Banner -->
      ${stageAdviceText ? `
        <div style="background: rgba(251, 191, 36, 0.12); border-left: 4px solid var(--amber-gold); padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 14px; color: var(--text-main);">
          <strong style="color: var(--amber-gold);"><i class="fa-solid fa-user-graduate"></i> Stage Guidance (${currentStage.replace('_', ' ').toUpperCase()}):</strong> ${stageAdviceText}
        </div>
      ` : ''}

      <!-- Skill Gap Analysis -->
      <div class="skill-gap-section">
        <div class="skills-group">
          <label>Skills You Have:</label>
          <div>${matchedChips || '<span class="text-muted">None matched yet</span>'}</div>
        </div>
        <div class="skills-group">
          <label>Skills to Learn:</label>
          <div>${missingChips || '<span class="text-muted">You meet core requirements!</span>'}</div>
        </div>
      </div>

      <p class="job-desc" style="color: var(--text-muted); font-size: 13.5px; margin-bottom: 16px;">${job.description}</p>

      <!-- Feedback Actions -->
      <div class="job-actions">
        <div class="feedback-buttons">
          <button class="action-btn like" onclick="sendFeedback('${job.title}', 'like')">
            <i class="fa-solid fa-thumbs-up"></i> Like
          </button>
          <button class="action-btn dislike" onclick="sendFeedback('${job.title}', 'dislike')">
            <i class="fa-solid fa-thumbs-down"></i> Dislike
          </button>
          <button class="action-btn bookmark ${isBookmarked ? 'bookmarked' : ''}" onclick="sendFeedback('${job.title}', 'bookmark')">
            <i class="fa-solid fa-bookmark"></i> ${isBookmarked ? 'Saved' : 'Bookmark'}
          </button>
          <button class="action-btn target ${isTarget ? 'targeted' : ''}" onclick="sendFeedback('${job.title}', 'target')">
            <i class="fa-solid fa-bullseye"></i> ${isTarget ? 'Target Goal' : 'Set Goal'}
          </button>
        </div>
      </div>
    `;

    resultsDiv.appendChild(card);
  });
}

// --- Context-Aware AI Career Advisor Chat Widget ---
function toggleCardiChat() {
  cardiDrawer.style.display = cardiDrawer.style.display === 'none' ? 'flex' : 'none';
}

async function sendCardiMessage() {
  const input = document.getElementById('cardi-input');
  const text = input.value.trim();
  if (!text) return;

  const userMsg = document.createElement('div');
  userMsg.className = 'cardi-message user';
  userMsg.textContent = text;
  cardiMessages.appendChild(userMsg);
  input.value = '';
  cardiMessages.scrollTop = cardiMessages.scrollHeight;

  const botMsg = document.createElement('div');
  botMsg.className = 'cardi-message bot';
  botMsg.innerHTML = '🤖 <em>AI Advisor is analyzing your question...</em>';
  cardiMessages.appendChild(botMsg);
  cardiMessages.scrollTop = cardiMessages.scrollHeight;

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai_chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        skills: skills.join(', '),
        interests: interests.join(', '),
        user_stage: currentStage
      })
    });

    const data = await response.json();
    botMsg.innerHTML = data.reply.replace(/\n/g, '<br>');

  } catch (err) {
    botMsg.innerHTML = '🤖 <strong>AI Advisor:</strong> Sorry, I could not connect to my knowledge base right now.';
  }
  cardiMessages.scrollTop = cardiMessages.scrollHeight;
}

// --- Dynamic Adaptive AI Quiz ---
function openAdaptiveQuizModal() {
  quizModal.style.display = 'flex';
  quizStep = 0;
  quizPreviousAnswers = [];
  fetchAdaptiveQuizQuestion();
}

function closeQuizModal() {
  quizModal.style.display = 'none';
}

async function fetchAdaptiveQuizQuestion() {
  quizBody.innerHTML = `
    <div style="text-align: center; padding: 30px;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 32px; color: var(--sky-blue); margin-bottom: 12px;"></i>
      <p>Generating adaptive AI question...</p>
    </div>
  `;

  try {
    const response = await fetch(`${API_BASE_URL}/api/quiz/next_question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step: quizStep,
        previous_answers: quizPreviousAnswers
      })
    });

    currentQuizData = await response.json();

    if (currentQuizData.is_complete) {
      quizBody.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <i class="fa-solid fa-circle-check" style="font-size: 48px; color: var(--emerald-green); margin-bottom: 16px;"></i>
          <h3>Adaptive AI Assessment Complete!</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">${currentQuizData.message}</p>
          <button class="btn-primary" onclick="closeQuizModal(); fetchRecommendations();">View Personalized Recommendations</button>
        </div>
      `;
      return;
    }

    const optsHtml = currentQuizData.options.map((opt, i) => `
      <button class="stage-pill" style="margin-bottom: 8px; width: 100%; text-align: left; padding: 12px; font-size: 14px;" onclick="selectAdaptiveOptionByIndex(${i})">
        ${opt.label}
      </button>
    `).join('');

    quizBody.innerHTML = `
      <p style="font-size: 12px; color: var(--amber-gold); margin-bottom: 8px;">Adaptive Step ${currentQuizData.step + 1} of ${currentQuizData.total_steps}</p>
      <h3 style="margin-bottom: 16px; color: var(--text-main);">${currentQuizData.question}</h3>
      <div>${optsHtml}</div>
    `;

  } catch (err) {
    console.error('Quiz fetch error:', err);
    quizBody.innerHTML = `<p style="color: var(--crimson-red);">Could not load adaptive quiz question.</p>`;
  }
}

function selectAdaptiveOptionByIndex(index) {
  if (!currentQuizData || !currentQuizData.options || !currentQuizData.options[index]) return;
  const option = currentQuizData.options[index];
  
  quizPreviousAnswers.push(option);

  if (option.add_skills) {
    option.add_skills.forEach(s => {
      if (!skills.some(existing => existing.toLowerCase() === s.toLowerCase())) {
        skills.push(s);
      }
    });
  }

  if (option.add_interests) {
    option.add_interests.forEach(i => {
      if (!interests.some(existing => existing.toLowerCase() === i.toLowerCase())) {
        interests.push(i);
      }
    });
  }

  renderTags(skillTagsDiv, skills, 'skills');
  renderTags(interestTagsDiv, interests, 'interests');
  saveUserProfileState();

  quizStep++;
  fetchAdaptiveQuizQuestion();
}

// --- RL Feedback Call ---
async function sendFeedback(jobTitle, feedbackType) {
  const skillsText = skills.join(', ');
  const interestsText = interests.join(', ');
  const userId = currentUser ? currentUser.user_id : 'Guest';

  try {
    const response = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        skills: skillsText,
        interests: interestsText,
        action: jobTitle,
        feedback_type: feedbackType
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const newScore = data.result?.new_rl_score ?? 'updated';

    if (feedbackType === 'bookmark' && !savedBookmarks.includes(jobTitle)) {
      savedBookmarks.push(jobTitle);
    } else if (feedbackType === 'target' && !targetCareers.includes(jobTitle)) {
      targetCareers.push(jobTitle);
    }

    saveUserProfileState();
    showToast(`RL Model updated for "${jobTitle}"! Q-Value: ${newScore}`, 'success');
    fetchRecommendations();

  } catch (err) {
    console.error('Feedback error:', err);
    showToast(`Feedback recorded locally for ${jobTitle}.`, 'info');
  }
}

// --- Toast Helper ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'warning') icon = 'fa-triangle-exclamation';
  
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}