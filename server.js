require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ==============================
// GLOBAL TIMEOUT (FIX ECONNRESET)
// ==============================
axios.defaults.timeout = 20000;

// ==============================
// ENV CONFIG (SECURE)
// ==============================

// Jenkins
const JENKINS_URL = process.env.JENKINS_URL;
const JOB_NAME = process.env.JOB_NAME;
const JENKINS_USER = process.env.JENKINS_USER;
const JENKINS_TOKEN = process.env.JENKINS_TOKEN;

// Jira
const JIRA_URL = process.env.JIRA_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_TOKEN = process.env.JIRA_TOKEN;
const PROJECT_KEY = process.env.PROJECT_KEY;

const JIRA_AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString("base64");

// Xray
const XRAY_URL = process.env.XRAY_URL;
const XRAY_CLIENT_ID = process.env.XRAY_CLIENT_ID;
const XRAY_CLIENT_SECRET = process.env.XRAY_CLIENT_SECRET;

// ==============================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ==============================
// RETRY FUNCTION
// ==============================
const retryRequest = async (fn, retries = 3) => {
    try {
        return await fn();
    } catch (err) {
        if (retries === 0) throw err;

        console.log(`⚠️ Retry... (${3 - retries + 1})`);
        await sleep(2000);

        return retryRequest(fn, retries - 1);
    }
};

// ==============================
// MAIN API
// ==============================
app.post("/command", async (req, res) => {

    const { testCase, execution, forceFail } = req.body;

    console.log("📩 Incoming Request:", req.body);

    try {

        // ==============================
        // TRIGGER JENKINS
        // ==============================
        await axios.post(
            `${JENKINS_URL}/job/${JOB_NAME}/buildWithParameters?FAIL=${forceFail}`,
            {},
            { auth: { username: JENKINS_USER, password: JENKINS_TOKEN } }
        );

        console.log("🚀 Jenkins Job Triggered");

        await sleep(3000);

        // ==============================
        // GET BUILD NUMBER
        // ==============================
        const jobInfo = await axios.get(
            `${JENKINS_URL}/job/${JOB_NAME}/api/json`,
            { auth: { username: JENKINS_USER, password: JENKINS_TOKEN } }
        );

        const buildNumber = jobInfo.data.lastBuild.number;

        let building = true;
        let result = "";

        // ==============================
        // WAIT FOR BUILD COMPLETION
        // ==============================
        while (building) {

            const buildInfo = await axios.get(
                `${JENKINS_URL}/job/${JOB_NAME}/${buildNumber}/api/json`,
                { auth: { username: JENKINS_USER, password: JENKINS_TOKEN } }
            );

            building = buildInfo.data.building;
            result = buildInfo.data.result;

            if (building) await sleep(3000);
        }

        console.log(`🏁 Build #${buildNumber} Result: ${result}`);

        let jiraBug = null;
        let executionKey = execution;

        // ==============================
        // FAILURE FLOW
        // ==============================
        if (forceFail === true || result === "FAILURE") {

            console.log("🔥 Failure detected → Creating bug + Xray execution");

            // ==============================
            // CREATE BUG
            // ==============================
            const bugRes = await axios.post(
                `${JIRA_URL}/rest/api/3/issue`,
                {
                    fields: {
                        project: { key: PROJECT_KEY },
                        summary: `Test Failed - ${testCase} (Build ${buildNumber})`,
                        issuetype: { name: "Bug" }
                    }
                },
                {
                    headers: {
                        Authorization: `Basic ${JIRA_AUTH}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            jiraBug = bugRes.data.key;
            console.log("✅ Bug Created:", jiraBug);

            // ==============================
            // CREATE EXECUTION IF NOT PROVIDED
            // ==============================
            if (!executionKey) {
                const execRes = await axios.post(
                    `${JIRA_URL}/rest/api/3/issue`,
                    {
                        fields: {
                            project: { key: PROJECT_KEY },
                            summary: `Execution for ${testCase}`,
                            issuetype: { name: "Test Execution" }
                        }
                    },
                    {
                        headers: {
                            Authorization: `Basic ${JIRA_AUTH}`,
                            "Content-Type": "application/json"
                        }
                    }
                );

                executionKey = execRes.data.key;
                console.log("✅ Created Execution:", executionKey);
            }

            // ==============================
            // XRAY AUTH
            // ==============================
            const authRes = await axios.post(`${XRAY_URL}/authenticate`, {
                client_id: XRAY_CLIENT_ID,
                client_secret: XRAY_CLIENT_SECRET
            });

            const XRAY_TOKEN = authRes.data;

            // ==============================
            // JUNIT XML (CRITICAL FIX)
            // ==============================
            const junitXML = `
<testsuite name="AI Test Commander" tests="1" failures="1">
    <testcase classname="AI" name="${testCase}">
        <properties>
            <property name="test_key" value="${testCase}"/>
        </properties>
        <failure message="Test Failed">
            Failure triggered from AI Commander
        </failure>
    </testcase>
</testsuite>
`;

            // ==============================
            // UPDATE XRAY
            // ==============================
            await retryRequest(() =>
                axios.post(
                    `${XRAY_URL}/import/execution/junit?projectKey=${PROJECT_KEY}&testExecKey=${executionKey}`,
                    junitXML,
                    {
                        headers: {
                            Authorization: `Bearer ${XRAY_TOKEN}`,
                            "Content-Type": "application/xml"
                        }
                    }
                )
            );

            console.log("✅ Xray Updated");

            // ==============================
            // LINK BUG TO TEST
            // ==============================
            await axios.post(
                `${JIRA_URL}/rest/api/3/issueLink`,
                {
                    type: { name: "Relates" },
                    inwardIssue: { key: jiraBug },
                    outwardIssue: { key: testCase }
                },
                {
                    headers: {
                        Authorization: `Basic ${JIRA_AUTH}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            console.log("✅ Bug Linked");
        }

        res.json({
            buildNumber,
            buildStatus: result,
            testCase,
            execution: executionKey,
            bug: jiraBug
        });

    } catch (err) {
        console.error("❌ ERROR:", err.response?.data || err.message);

        res.status(500).json({
            error: err.response?.data || err.message
        });
    }
});

// ==============================
app.listen(3000, () => {
    console.log("🚀 Server running on port 3000");
});