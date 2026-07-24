# Career Path Navigator

Built using **Retrieval-Augmented Generation (RAG)** for personalized job recommendations. Leverages **reinforcement learning (RL)** to adapt suggestions based on user feedback. Helps students explore career paths aligned with their skills and interests.

---

## 🌟 Key Features

- **Personalized RAG Job Recommendations**: Combines dense vector embedding search (`SentenceTransformer` / TF-IDF vector space modeling) with structured RAG rationale synthesis ("Why This Role Fits You").
- **Q-Learning Reinforcement Learning Adaptation**: Adapts candidate job rankings dynamically based on student feedback (👍 Like, 👎 Dislike, 🔖 Bookmark, 🎯 Target Goal) via normalized Q-table state updates.
- **Skill Gap & Career Path Roadmaps**: Visualizes skills possessed vs missing skills required, alongside step-by-step career progression pathways (Entry $\rightarrow$ Mid $\rightarrow$ Senior) and recommended certifications.
- **Modern Glassmorphic UI**: High-performance dashboard built with Google Fonts (`Outfit` & `Inter`), quick-select skill chips, multi-score breakdown progress bars, category filter tabs, search filters, and an RL Insights panel.

---

## 📁 Repository Structure

```text
Career-Path-Navigator/
├── backend/
│   ├── main.py              # Flask server, REST API endpoints, static web app server
│   ├── job_recommender.py   # RAG vector retrieval, skill gap analyzer, Q-learning RL engine
│   ├── jobs.json            # Enriched dataset of career paths, skills, and roadmaps
│   └── q_table.json         # Persisted Q-table state for reinforcement learning
├── frontend/
│   ├── index.html           # Modern glassmorphism UI layout
│   ├── styles.css           # Custom CSS design system
│   └── script.js            # Client-side state management & async API integration
└── README.md
```

---

## 🚀 How to Run Locally

### 1. Install Backend Dependencies
```bash
pip install flask flask-cors sentence-transformers scikit-learn
```

### 2. Launch the Application Server
```bash
cd backend
python main.py
```

### 3. Open in Browser
Navigate to **[http://localhost:5000](http://localhost:5000)** in your web browser.
