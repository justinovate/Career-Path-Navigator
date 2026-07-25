// ==========================================================================
// Career Path Navigator - Client Application Logic
// ==========================================================================

const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000'
  : window.location.origin;

let currentUser = null;
let skills = [];
let interests = [];
let activeCategoryFilter = 'All';
let activeExperienceFilter = 'All';
let searchQuery = '';
let currentRecommendations = [];
let savedBookmarks = [];
let targetCareers = [];
let salaryChartInstance = null;

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
const rlModal = document.getElementById('rl-modal');
const rlModalContent = document.getElementById('rl-modal-content');
const quizModal = document.getElementById('quiz-modal');
const quizBody = document.getElementById('quiz-body');
const chartsModal = document.getElementById('charts-modal');

// Check persistent session on load
window.addEventListener('DOMContentLoaded', () => {
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
    interests = ['AI/ML'];
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
  if (btnElement) {
    btnElement.classList.add('active');
  }
  fetchRecommendations();
}

function filterRecommendations() {
  searchQuery = document.getElementById('search-filter').value.toLowerCase().trim();
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
      <h3>Searching Vector Database & Calculating RAG Scores...</h3>
      <p>Expanding domain query terms and evaluating RL preference boosts.</p>
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
      j.skills_required.some(s => s.toLowerCase().includes(searchQuery))
    );
  }

  resultsHeader.style.display = 'flex';
  resultsCount.textContent = `${filtered.length} career options matched`;

  if (filtered.length === 0) {
    resultsDiv.innerHTML = `
      <div class="glass-card empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <h3>No Careers Match Your Search</h3>
        <p>Try selecting "All Careers" or adjusting your search filters.</p>
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

    const roadmapSteps = (job.career_roadmap || []).map(step => `
      <div class="roadmap-step">
        <div>
          <span class="step-stage">${step.stage}</span>
          <span class="step-time">${step.timeframe}</span>
        </div>
        <div class="step-focus">${step.focus}</div>
      </div>
    `).join('');

    const recommendedCourses = (job.recommended_courses || []).map(c => `<li>${c}</li>`).join('');

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

      <!-- Multi-Score Breakdown Bar -->
      <div class="score-breakdown-bar">
        <div class="score-item">
          <span class="score-item-title">Semantic Vector RAG: <strong>${job.semantic_score}%</strong></span>
          <div class="progress-bar-bg"><div class="progress-bar-fill semantic" style="width: ${job.semantic_score}%;"></div></div>
        </div>
        <div class="score-item">
          <span class="score-item-title">Skill Match: <strong>${job.skill_score}%</strong></span>
          <div class="progress-bar-bg"><div class="progress-bar-fill skill" style="width: ${job.skill_score}%;"></div></div>
        </div>
        <div class="score-item">
          <span class="score-item-title">RL Preference Boost: <strong>${job.rl_score > 0 ? '+' : ''}${job.rl_score}</strong></span>
          <div class="progress-bar-bg"><div class="progress-bar-fill rl" style="width: ${Math.min(100, Math.max(10, (job.rl_score + 0.25) * 200))}%;"></div></div>
        </div>
      </div>

      <!-- RAG Personalized Reason -->
      <div class="rag-reason-box">
        <div class="rag-reason-header"><i class="fa-solid fa-wand-magic-sparkles"></i> Why This Role Fits You (RAG Insights):</div>
        <p>${job.rag_reason}</p>
      </div>

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

      <!-- Feedback Actions & Roadmap Toggle -->
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
            <i class="fa-solid fa-bullseye"></i> ${isTarget ? 'Target Goal' : 'Set as Goal'}
          </button>
        </div>

        <div style="display: flex; gap: 8px;">
          <button class="action-btn pdf" onclick="exportRoadmapPDF('${job.title}')">
            <i class="fa-solid fa-file-pdf"></i> Export PDF
          </button>
          <button class="action-btn secondary" onclick="toggleRoadmap('roadmap-${index}')">
            <i class="fa-solid fa-route"></i> Roadmap
          </button>
        </div>
      </div>

      <!-- Expandable Career Roadmap -->
      <div id="roadmap-${index}" class="roadmap-expandable" style="display: none;">
        <h4 style="color: var(--amber-gold); margin-bottom: 8px;"><i class="fa-solid fa-road"></i> Career Progression Pathway</h4>
        <div class="roadmap-timeline">
          ${roadmapSteps || '<p>Standard industry progression applies.</p>'}
        </div>

        ${recommendedCourses ? `
          <div style="margin-top: 14px;">
            <h5 style="color: var(--sky-blue); margin-bottom: 6px;"><i class="fa-solid fa-graduation-cap"></i> Recommended Certifications:</h5>
            <ul style="padding-left: 20px; font-size: 13px; color: var(--text-muted);">${recommendedCourses}</ul>
          </div>
        ` : ''}
      </div>
    `;

    resultsDiv.appendChild(card);
  });
}

function toggleRoadmap(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
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

// --- Career Quiz Modal ---
const QUIZ_QUESTIONS = [
  {
    question: "What is your primary technical or professional domain?",
    options: [
      { text: "Software & Web Development", skills: ["Python", "JavaScript", "C++"], interests: ["Web Development"] },
      { text: "Artificial Intelligence & Data Science", skills: ["Python", "TensorFlow", "Machine Learning"], interests: ["AI/ML"] },
      { text: "User Interface & Product Design", skills: ["UX Design", "Figma", "UI Design"], interests: ["UI/UX Design"] },
      { text: "Cybersecurity & IT Infrastructure", skills: ["Network Security", "Linux", "Encryption"], interests: ["Cybersecurity"] },
      { text: "Mechanical or Civil Engineering", skills: ["CAD Software", "SolidWorks", "AutoCAD"], interests: ["Mechanical Systems"] }
    ]
  },
  {
    question: "What type of daily problem-solving excites you most?",
    options: [
      { text: "Building neural networks & AI data pipelines", skills: ["PyTorch", "Data Analysis"], interests: ["AI/ML"] },
      { text: "Designing elegant user interfaces & screen wireframes", skills: ["Adobe XD", "Wireframing"], interests: ["UI/UX Design"] },
      { text: "Architecting cloud systems & securing networks", skills: ["Cloud Computing", "Docker"], interests: ["Cloud & DevOps"] },
      { text: "Analyzing financial risk & market forecasts", skills: ["Financial Analysis", "Excel"], interests: ["Fintech & Investment"] }
    ]
  }
];

let currentQuizIndex = 0;

function openQuizModal() {
  quizModal.style.display = 'flex';
  currentQuizIndex = 0;
  renderQuizQuestion();
}

function closeQuizModal() {
  quizModal.style.display = 'none';
}

function renderQuizQuestion() {
  if (currentQuizIndex >= QUIZ_QUESTIONS.length) {
    quizBody.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <i class="fa-solid fa-circle-check" style="font-size: 48px; color: var(--emerald-green); margin-bottom: 16px;"></i>
        <h3>Assessment Complete!</h3>
        <p style="color: var(--text-muted); margin-bottom: 20px;">Your skills and career interests have been updated based on your responses.</p>
        <button class="btn-primary" onclick="closeQuizModal(); fetchRecommendations();">View Updated Recommendations</button>
      </div>
    `;
    return;
  }

  const q = QUIZ_QUESTIONS[currentQuizIndex];
  const optsHtml = q.options.map((opt, i) => `
    <button class="quiz-opt-btn" onclick="selectQuizOption(${i})">${opt.text}</button>
  `).join('');

  quizBody.innerHTML = `
    <p style="font-size: 12px; color: var(--amber-gold); margin-bottom: 8px;">Question ${currentQuizIndex + 1} of ${QUIZ_QUESTIONS.length}</p>
    <div class="quiz-question-title">${q.question}</div>
    <div class="quiz-options">${optsHtml}</div>
  `;
}

function selectQuizOption(optIndex) {
  const opt = QUIZ_QUESTIONS[currentQuizIndex].options[optIndex];
  
  opt.skills.forEach(s => {
    if (!skills.some(existing => existing.toLowerCase() === s.toLowerCase())) {
      skills.push(s);
    }
  });

  opt.interests.forEach(i => {
    if (!interests.some(existing => existing.toLowerCase() === i.toLowerCase())) {
      interests.push(i);
    }
  });

  renderTags(skillTagsDiv, skills, 'skills');
  renderTags(interestTagsDiv, interests, 'interests');
  saveUserProfileState();

  currentQuizIndex++;
  renderQuizQuestion();
}

// --- Salary Charts Modal (Chart.js) ---
function openChartsModal() {
  chartsModal.style.display = 'flex';
  renderSalaryChart();
}

function closeChartsModal() {
  chartsModal.style.display = 'none';
}

function renderSalaryChart() {
  const ctx = document.getElementById('salaryChart').getContext('2d');
  if (salaryChartInstance) salaryChartInstance.destroy();

  const labels = currentRecommendations.slice(0, 6).map(j => j.title);
  const minSalaries = currentRecommendations.slice(0, 6).map(j => (j.salary_min || 35000) / 1000);
  const maxSalaries = currentRecommendations.slice(0, 6).map(j => (j.salary_max || 60000) / 1000);

  salaryChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Min Salary (k PHP/mo)',
          data: minSalaries,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: '#6366f1',
          borderWidth: 1
        },
        {
          label: 'Max Salary (k PHP/mo)',
          data: maxSalaries,
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
          borderColor: '#10b981',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11 } }
        }
      },
      plugins: {
        legend: { labels: { color: '#ffffff' } }
      }
    }
  });
}

// --- Export Career Roadmap PDF (jsPDF) ---
function exportRoadmapPDF(jobTitle) {
  const job = currentRecommendations.find(j => j.title === jobTitle);
  if (!job) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(99, 102, 241);
  doc.text("Career Path Roadmap Report", 20, 20);

  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text(`Role: ${job.title} (${job.overall_score}% Match)`, 20, 32);
  doc.text(`Category: ${job.category} | Salary: ${job.salary_range}`, 20, 40);

  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 45, 190, 45);

  doc.setFont("helvetica", "bold");
  doc.text("Why This Role Fits You (RAG Rationale):", 20, 55);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const splitReason = doc.splitTextToSize(job.rag_reason, 170);
  doc.text(splitReason, 20, 62);

  let currentY = 62 + (splitReason.length * 5) + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Skill Gap Breakdown:", 20, currentY);
  currentY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Matched Skills: ${job.matched_skills.join(', ') || 'None'}`, 20, currentY);
  currentY += 6;
  doc.text(`Skills to Acquire: ${job.missing_skills.join(', ') || 'None'}`, 20, currentY);
  currentY += 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Career Path Progression Stages:", 20, currentY);
  currentY += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  (job.career_roadmap || []).forEach(step => {
    doc.text(`• ${step.stage} (${step.timeframe}): ${step.focus}`, 20, currentY);
    currentY += 7;
  });

  doc.save(`${job.title.replace(/\s+/g, '_')}_Career_Roadmap.pdf`);
  showToast(`Exported PDF for ${job.title}!`, 'success');
}

// --- RL Modal ---
async function openRLModal() {
  rlModal.style.display = 'flex';
  rlModalContent.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Fetching Q-Table metrics...</p>';

  const userId = currentUser ? currentUser.user_id : 'Guest';

  try {
    const response = await fetch(`${API_BASE_URL}/student/${userId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    
    const bookmarksList = (data.saved_bookmarks || []).map(b => `<span class="tag-chip">${b}</span>`).join(' ');
    const targetsList = (data.target_careers || []).map(t => `<span class="tag-chip interest">${t}</span>`).join(' ');

    const prefRows = (data.learned_preferences || []).map(p => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid var(--border-glass); font-size: 13px;">${p.job_title}</td>
        <td style="padding: 8px; border-bottom: 1px solid var(--border-glass); font-size: 13px; color: ${p.q_value >= 0 ? 'var(--emerald-green)' : 'var(--crimson-red)'}; font-weight: bold;">
          ${p.q_value > 0 ? '+' : ''}${p.q_value}
        </td>
      </tr>
    `).join('');

    rlModalContent.innerHTML = `
      <div style="margin-bottom: 16px;">
        <h4 style="color: var(--amber-gold); margin-bottom: 6px;">Saved Target Goals & Bookmarks:</h4>
        <p style="font-size: 13px; margin-bottom: 6px;"><strong>Target Careers:</strong> ${targetsList || 'None set yet'}</p>
        <p style="font-size: 13px;"><strong>Bookmarks:</strong> ${bookmarksList || 'None saved yet'}</p>
      </div>

      <div>
        <h4 style="color: var(--sky-blue); margin-bottom: 8px;">Learned Q-Table Adaptations:</h4>
        ${prefRows ? `
          <table style="width: 100%; text-align: left; border-collapse: collapse;">
            <thead>
              <tr style="color: var(--text-muted); font-size: 12px;">
                <th style="padding: 6px;">Career Title</th>
                <th style="padding: 6px;">Learned Q-Value Adjustment</th>
              </tr>
            </thead>
            <tbody>
              ${prefRows}
            </tbody>
          </table>
        ` : '<p style="font-size: 13px; color: var(--text-muted);">No Q-value adjustments stored for current state yet. Provide feedback using 👍, 👎, 🔖, 🎯 buttons to train your RL agent.</p>'}
      </div>
    `;

  } catch (err) {
    console.error('RL Modal fetch error:', err);
    rlModalContent.innerHTML = '<p style="color: var(--crimson-red);">Could not load Q-Table stats from server.</p>';
  }
}

function closeRLModal() {
  rlModal.style.display = 'none';
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