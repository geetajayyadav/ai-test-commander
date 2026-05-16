# 🚀 AI Test Commander

An automated test orchestration system integrating Jenkins, Selenium, Jira, and Xray.

---

## 🎯 Objective

To automate:
- Test execution (Jenkins)
- Bug creation (Jira)
- Test management (Xray)

---

## 🧩 Architecture

UI → Node.js → Jenkins → Test Execution → Jira → Xray

---

## ⚙️ Tech Stack

- Node.js (Backend)
- Express.js
- Jenkins (CI/CD)
- Selenium + Cucumber
- Jira (Bug Tracking)
- Xray (Test Management)

---

## 🚀 Features

✅ Trigger automated test execution  
✅ Monitor Jenkins build status  
✅ Auto-create Jira bugs on failure  
✅ Update Xray execution results  
✅ Link bugs with test cases  

---

## 🔧 Setup

### 1. Install dependencies
```bash
npm install


2. Add .env file
JENKINS_URL=http://localhost:8080
JOB_NAME=autelite-mcp-pipeline
JENKINS_USER=your_user
JENKINS_TOKEN=your_token

JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your_email
JIRA_TOKEN=your_token
PROJECT_KEY=JSR

XRAY_URL=https://eu.xray.cloud.getxray.app/api/v2
XRAY_CLIENT_ID=your_id
XRAY_CLIENT_SECRET=your_secret
3. Run server
node server.js
🧪 API Usage
POST /command
{
  "testCase": "JSR-2",
  "execution": "JSR-43",
  "forceFail": true
}
📈 Future Scope
AI-based test selection
LLM-generated bug reports
LangChain integration
MCP-based architecture
👨‍💻 Author

Ajay Yadav