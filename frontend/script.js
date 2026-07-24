// ==========================================================================
// Career Path Navigator - Frontend Application Logic
// ==========================================================================

const API_BASE_URL = 'http://localhost:5000';

let studentId = '';
let skills = [];
let interests = [];
let activeCategoryFilter = 'All';
let activeExperienceFilter = 'All';
let searchQuery = '';
let currentRecommendations = [];
let savedBookmarks = [];
let targetCareers = [];

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

// --- Authentication & Session ---
async function login() {
  const inputId = document.getElementById('student-id').value.trim();
  if (!inputId) {
    showToast('Please enter a valid Student ID.', 'warning');
    return;
  }
  studentId = inputId;
  
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId })
    });
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    
    // Set user data
    studentDisplay.textContent = `ID: ${studentId}`;
    savedBookmarks = data.saved_bookmarks || [];
    targetCareers = data.target_careers || [];
    
    // Parse existing skills and interests if available
    if (data.skills) {
      skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      skills = ['Python', 'Data Structures']; // Default initial suggestions
    }
    
    if (data.interests) {
      interests = data.interests.split(',').map(i => i.trim()).filter(Boolean);
    } else {
      interests = ['AI & Machine Learning'];
    }

    renderTags(skillTagsDiv, skills, 'skills');
    renderTags(interestTagsDiv, interests, 'interests');

    // Switch Screens
    loginScreen.style.display = 'none';
    topBar.style.display = 'flex';
    dashboardWorkspace.style.display = 'grid';

    showToast(`Welcome back, Student ${studentId}! Profile loaded.`, 'success');
    
    // Fetch initial recommendations
    fetchRecommendations();

  } catch (err) {
    console.error('Login error:', err);
    // Fallback if backend server not running yet
    studentDisplay.textContent = `ID: ${studentId}`;
    loginScreen.style.display = 'none';
    topBar.style.display = 'flex';
    dashboardWorkspace.style.display = 'grid';
    showToast(`Logged in as ${studentId} (Offline mode).`, 'info');
    fetchRecommendations();
  }
}

function quickLogin(id) {
  document.getElementById('student-id').value = id;
  login();
}

function logout() {
  studentId = '';
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
      <p>Add your skills and interests in the left panel to generate recommendations.</p>
    </div>
  `;
  resultsHeader.style.display = 'none';
  showToast('Logged out successfully.', 'info');
}

// --- Skill & Interest Tag Management ---
function addSkill() {
  const input = document.getElementById('skill-input');
  const value = input.value.trim();
  if (value && !skills.some(s => s.toLowerCase() === value.toLowerCase())) {
    skills.push(value);
    renderTags(skillTagsDiv, skills, 'skills');
  }
  input.value = '';
}

function quickAddSkill(skillName) {
  if (!skills.some(s => s.toLowerCase() === skillName.toLowerCase())) {
    skills.push(skillName);
    renderTags(skillTagsDiv, skills, 'skills');
    showToast(`Added ${skillName} to your skills!`, 'info');
    fetchRecommendations();
  }
}

function addInterest() {
  const input = document.getElementById('interest-input');
  const value = input.value.trim();
  if (value && !interests.some(i => i.toLowerCase() === value.toLowerCase())) {
    interests.push(value);
    renderTags(interestTagsDiv, interests, 'interests');
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

// --- Category & Search Filters ---
function setCategoryFilter(category, btnElement) {
  activeCategoryFilter = category;
  
  // Highlight active tab
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

// --- API Interactions & Recommendation Logic ---
async function fetchRecommendations() {
  const skillsText = skills.join(', ');
  const interestsText = interests.join(', ');

  resultsDiv.innerHTML = `
    <div class="glass-card empty-state">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <h3>Analyzing Skills & Querying RAG Embeddings...</h3>
      <p>Searching job vector database and running Q-Learning score adjustments.</p>
    </div>
  `;

  activeExperienceFilter = document.getElementById('experience-filter').value;

  try {
    const response = await fetch(`${API_BASE_URL}/recommend_jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        skills: skillsText,
        interests: interestsText,
        category_filter: activeCategoryFilter,
        experience_filter: activeExperienceFilter
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    currentRecommendations = data;
    renderRecommendations(data);

  } catch (err) {
    console.error('Fetch recommendations error:', err);
    resultsDiv.innerHTML = `
      <div class="glass-card empty-state">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--crimson-red);"></i>
        <h3>Backend API Connection Error</h3>
        <p>Could not connect to Flask backend on ${API_BASE_URL}. Please verify backend/main.py is running.</p>
      </div>
    `;
  }
}

function renderRecommendations(jobs) {
  // Apply client-side search query filter if typed
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
        <h3>No Careers Match Your Filters</h3>
        <p>Try clearing your search query or selecting "All Careers".</p>
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

    // Skill Gap Chips HTML
    const matchedChips = job.matched_skills.map(s => `<span class="skill-chip matched"><i class="fa-solid fa-check"></i> ${s}</span>`).join(' ');
    const missingChips = job.missing_skills.map(s => `<span class="skill-chip missing"><i class="fa-solid fa-lightbulb"></i> ${s}</span>`).join(' ');

    // Career Roadmap HTML
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
          <span class="score-label">Overall Match</span>
        </div>
      </div>

      <!-- Multi-Score Breakdown Progress Bars -->
      <div class="score-breakdown-bar">
        <div class="score-item">
          <span class="score-item-title">Semantic RAG: <strong>${job.semantic_score}%</strong></span>
          <div class="progress-bar-bg"><div class="progress-bar-fill semantic" style="width: ${job.semantic_score}%;"></div></div>
        </div>
        <div class="score-item">
          <span class="score-item-title">Skill Overlap: <strong>${job.skill_score}%</strong></span>
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
          <div>${missingChips || '<span class="text-muted">You meet all core skill requirements!</span>'}</div>
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

        <button class="action-btn secondary" onclick="toggleRoadmap('roadmap-${index}')">
          <i class="fa-solid fa-route"></i> Career Roadmap & Courses
        </button>
      </div>

      <!-- Expandable Career Roadmap -->
      <div id="roadmap-${index}" class="roadmap-expandable" style="display: none;">
        <h4 style="color: var(--amber-gold); margin-bottom: 8px;"><i class="fa-solid fa-road"></i> Career Progression Pathway</h4>
        <div class="roadmap-timeline">
          ${roadmapSteps || '<p>Standard industry progression applies.</p>'}
        </div>

        ${recommendedCourses ? `
          <div style="margin-top: 14px;">
            <h5 style="color: var(--sky-blue); margin-bottom: 6px;"><i class="fa-solid fa-graduation-cap"></i> Recommended Certifications & Courses:</h5>
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
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}

// --- Reinforcement Learning Feedback Endpoint Call ---
async function sendFeedback(jobTitle, feedbackType) {
  const skillsText = skills.join(', ');
  const interestsText = interests.join(', ');

  try {
    const response = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        skills: skillsText,
        interests: interestsText,
        action: jobTitle,
        feedback_type: feedbackType
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const newScore = data.result?.new_rl_score ?? 'updated';

    if (feedbackType === 'bookmark' && !savedBookmarks.includes(jobTitle)) {
      savedBookmarks.push(jobTitle);
    } else if (feedbackType === 'target' && !targetCareers.includes(jobTitle)) {
      targetCareers.push(jobTitle);
    }

    showToast(`RL Model updated for "${jobTitle}"! Q-Value: ${newScore}`, 'success');

    // Re-fetch recommendations to show updated RL ranking boost
    fetchRecommendations();

  } catch (err) {
    console.error('Feedback error:', err);
    showToast(`Feedback recorded locally for ${jobTitle}.`, 'info');
  }
}

// --- RL Insights Modal ---
async function openRLModal() {
  rlModal.style.display = 'flex';
  rlModalContent.innerHTML = '<p><i class="fa-solid fa-spinner fa-spin"></i> Fetching student Q-Table state metrics...</p>';

  try {
    const response = await fetch(`${API_BASE_URL}/student/${studentId}`);
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
    rlModalContent.innerHTML = '<p style="color: var(--crimson-red);">Could not load student Q-Table stats from server.</p>';
  }
}

function closeRLModal() {
  rlModal.style.display = 'none';
}

// --- Toast Notification Helper ---
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