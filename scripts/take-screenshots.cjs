const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000';
const SCREENSHOTS_DIR = path.join(__dirname, '../docs/screenshots');

// ─── Dummy XML payloads ───────────────────────────────────────────────────────

const SKILLS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<skills>
  <skill><skillId>101</skillId><skillName>English</skillName></skill>
  <skill><skillId>102</skillId><skillName>Spanish</skillName></skill>
  <skill><skillId>103</skillId><skillName>Technical Support</skillName></skill>
  <skill><skillId>104</skillId><skillName>Billing Enquiries</skillName></skill>
  <skill><skillId>105</skillId><skillName>Sales</skillName></skill>
  <skill><skillId>106</skillId><skillName>Retention</skillName></skill>
</skills>`;

const RESOURCES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<resources>
  <resource>
    <userID>jsmith</userID>
    <firstName>John</firstName>
    <lastName>Smith</lastName>
    <extension>5001</extension>
    <alias>John Smith</alias>
    <type>AGENT</type>
    <autoAvailable>true</autoAvailable>
  </resource>
  <resource>
    <userID>emartinez</userID>
    <firstName>Elena</firstName>
    <lastName>Martinez</lastName>
    <extension>5002</extension>
    <alias>Elena Martinez</alias>
    <type>AGENT</type>
    <autoAvailable>true</autoAvailable>
  </resource>
  <resource>
    <userID>bchang</userID>
    <firstName>Brian</firstName>
    <lastName>Chang</lastName>
    <extension>5003</extension>
    <alias>Brian Chang</alias>
    <type>AGENT</type>
    <autoAvailable>false</autoAvailable>
  </resource>
  <resource>
    <userID>sproctor</userID>
    <firstName>Sarah</firstName>
    <lastName>Proctor</lastName>
    <extension>5004</extension>
    <alias>Sarah Proctor</alias>
    <type>AGENT</type>
    <autoAvailable>true</autoAvailable>
  </resource>
  <resource>
    <userID>dlee</userID>
    <firstName>David</firstName>
    <lastName>Lee</lastName>
    <extension>5005</extension>
    <alias>David Lee</alias>
    <type>AGENT</type>
    <autoAvailable>true</autoAvailable>
  </resource>
</resources>`;

const TEAMS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<teams>
  <team>
    <teamId>201</teamId>
    <teamname>Tier 1 Support</teamname>
  </team>
  <team>
    <teamId>202</teamId>
    <teamname>Billing Team</teamname>
  </team>
  <team>
    <teamId>203</teamId>
    <teamname>Sales Team</teamname>
  </team>
</teams>`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiPost(url, body, token, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...headers },
    body: JSON.stringify(body),
  });
  return res;
}

async function apiPostForm(url, formData, token, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, ...extraHeaders },
    body: formData,
  });
  return res;
}

function xmlFormData(fieldName, filename, xmlContent, extra = {}) {
  const fd = new FormData();
  fd.append(fieldName, new Blob([xmlContent], { type: 'application/xml' }), filename);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
}

async function seedData(token) {
  console.log('\nSeeding demo data...');

  // 1. Create project
  let projectId;
  {
    const r = await apiPost(`${BASE_URL}/api/projects`, {
      name: 'London CC Migration',
      description: 'Migration of the London Contact Centre to UCCX 12.5',
      isActive: true,
    }, token);
    const j = await r.json();
    projectId = j.id;
    console.log(`  ✓ Project created: ${projectId}`);
  }

  const projectHeader = { 'x-project-id': projectId };

  // 2. Create source server connection
  {
    const r = await fetch(`${BASE_URL}/api/uccx-connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-project-id': projectId },
      body: JSON.stringify({
        name: 'UCCX-LON-01 (Source)',
        host: '10.10.1.50',
        port: 443,
        username: 'uccxadmin',
        password: 'Cisco@1234',
        useHttps: true,
        isSource: true,
        isActive: true,
        projectId,
      }),
    });
    const j = await r.json();
    console.log(`  ✓ Source server: ${j.name || j.id}`);
  }

  // 3. Create target server connection
  {
    const r = await fetch(`${BASE_URL}/api/uccx-connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-project-id': projectId },
      body: JSON.stringify({
        name: 'UCCX-LON-02 (Target)',
        host: '10.10.2.50',
        port: 443,
        username: 'uccxadmin',
        password: 'Cisco@1234',
        useHttps: true,
        isSource: false,
        isActive: true,
        projectId,
      }),
    });
    const j = await r.json();
    console.log(`  ✓ Target server: ${j.name || j.id}`);
  }

  // 4. Import Skills via XML
  {
    const fd = xmlFormData('skillsFile', 'skills.xml', SKILLS_XML);
    const r = await apiPostForm(`${BASE_URL}/api/skills/import`, fd, token, { 'x-project-id': projectId });
    const j = await r.json();
    console.log(`  ✓ Skills imported: ${j.imported ?? j.total ?? JSON.stringify(j).slice(0, 60)}`);
  }

  // 5. Create Resource Groups
  for (const [idx, name] of [
    [301, 'Tier 1 Agents'],
    [302, 'Billing Specialists'],
    [303, 'Sales Agents'],
  ]) {
    const r = await fetch(`${BASE_URL}/api/resource-groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-project-id': projectId },
      body: JSON.stringify({ resourceGroupId: idx, name, projectId }),
    });
    const j = await r.json();
    console.log(`  ✓ Resource group: ${j.name || name}`);
  }

  // 6. Import Resources via XML
  {
    const fd = xmlFormData('resourcesFile', 'resources.xml', RESOURCES_XML);
    const r = await apiPostForm(`${BASE_URL}/api/resources/import`, fd, token, { 'x-project-id': projectId });
    const j = await r.json();
    console.log(`  ✓ Resources imported: ${j.imported ?? j.total ?? JSON.stringify(j).slice(0, 60)}`);
  }

  // 7. Import Teams via XML
  {
    const fd = xmlFormData('teamsFile', 'teams.xml', TEAMS_XML);
    const r = await apiPostForm(`${BASE_URL}/api/teams/import`, fd, token, { 'x-project-id': projectId });
    const j = await r.json();
    console.log(`  ✓ Teams imported: ${j.imported ?? j.total ?? JSON.stringify(j).slice(0, 60)}`);
  }

  // 8. Create CSQs
  for (const csq of [
    { csqId: 'CSQ-401', name: 'English General Enquiries', queueType: 'SKILL_BASED', routingType: 'LINEAR', enabled: true, serviceLevel: 20, serviceLevelPercentage: 80, projectId },
    { csqId: 'CSQ-402', name: 'Spanish Support',           queueType: 'SKILL_BASED', routingType: 'LINEAR', enabled: true, serviceLevel: 25, serviceLevelPercentage: 75, projectId },
    { csqId: 'CSQ-403', name: 'Technical Support L1',      queueType: 'SKILL_BASED', routingType: 'MOST_SKILLED', enabled: true, serviceLevel: 30, serviceLevelPercentage: 85, projectId },
    { csqId: 'CSQ-404', name: 'Billing & Payments',        queueType: 'SKILL_BASED', routingType: 'LEAST_SKILLED', enabled: true, serviceLevel: 15, serviceLevelPercentage: 90, projectId },
    { csqId: 'CSQ-405', name: 'Sales Inbound',             queueType: 'RESOURCE_GROUP', routingType: 'LINEAR', enabled: true, serviceLevel: 10, serviceLevelPercentage: 95, projectId },
  ]) {
    const r = await fetch(`${BASE_URL}/api/csqs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-project-id': projectId },
      body: JSON.stringify(csq),
    });
    const j = await r.json();
    console.log(`  ✓ CSQ: ${j.name || csq.name}`);
  }

  // 9. Create Applications
  for (const app of [
    { applicationName: 'IVR_MainMenu',     script: 'MainMenu.aef',      type: 'Cisco Script Application', description: 'Main IVR entry point', maxsession: 300, enabled: true, projectId },
    { applicationName: 'IVR_Billing',      script: 'BillingFlow.aef',   type: 'Cisco Script Application', description: 'Billing self-service IVR', maxsession: 100, enabled: true, projectId },
    { applicationName: 'IVR_TechSupport',  script: 'TechSupport.aef',   type: 'Cisco Script Application', description: 'Technical support queue', maxsession: 150, enabled: true, projectId },
    { applicationName: 'IVR_Sales',        script: 'SalesQueue.aef',    type: 'Cisco Script Application', description: 'Inbound sales queue', maxsession: 80, enabled: true, projectId },
  ]) {
    const r = await fetch(`${BASE_URL}/api/applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-project-id': projectId },
      body: JSON.stringify(app),
    });
    const j = await r.json();
    console.log(`  ✓ Application: ${j.applicationName || app.applicationName}`);
  }

  // 10. Create Triggers
  for (const trigger of [
    { directoryNumber: '+442071234500', applicationName: 'IVR_MainMenu',    deviceName: 'CTIPort_Main',    description: 'Main inbound number', triggerEnabled: true, maxNumOfSessions: 300, projectId },
    { directoryNumber: '+442071234501', applicationName: 'IVR_Billing',     deviceName: 'CTIPort_Billing', description: 'Billing direct line', triggerEnabled: true, maxNumOfSessions: 100, projectId },
    { directoryNumber: '+442071234502', applicationName: 'IVR_TechSupport', deviceName: 'CTIPort_Tech',    description: 'Tech support line',   triggerEnabled: true, maxNumOfSessions: 150, projectId },
    { directoryNumber: '+442071234503', applicationName: 'IVR_Sales',       deviceName: 'CTIPort_Sales',   description: 'Sales hotline',        triggerEnabled: true, maxNumOfSessions: 80, projectId },
  ]) {
    const r = await fetch(`${BASE_URL}/api/triggers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-project-id': projectId },
      body: JSON.stringify(trigger),
    });
    const j = await r.json();
    console.log(`  ✓ Trigger: ${j.directoryNumber || trigger.directoryNumber}`);
  }

  console.log(`\nDemo data seeded. Project ID: ${projectId}`);
  return projectId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // ── Step 1: Get API token ──────────────────────────────────────────────────
  console.log('Authenticating via API...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  if (!token) throw new Error('No token returned — check credentials: ' + JSON.stringify(loginData));
  console.log('  ✓ API token obtained');

  // ── Step 2: Seed dummy data ────────────────────────────────────────────────
  const projectId = await seedData(token);

  // ── Step 3: Launch browser ─────────────────────────────────────────────────
  const browser = await chromium.launch({
    executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // ── Step 4: Browser login ──────────────────────────────────────────────────
  console.log('\nTaking screenshots...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[data-testid="input-username"]', { timeout: 10000 });

  // Login page (before filling)
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-login.jpg'), type: 'jpeg', quality: 90 });
  console.log('  ✓ 01-login');

  await page.fill('[data-testid="input-username"]', 'admin');
  await page.fill('[data-testid="input-password"]', 'admin123');
  await page.click('[data-testid="button-login"]');
  await page.waitForURL('**/projects', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Stamp the correct project into localStorage so all pages use the seeded project
  await page.evaluate((pid) => {
    localStorage.setItem('uccx_current_project_id', pid);
  }, projectId);

  // Projects page (reload so the UI reflects the stamped project)
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-projects.jpg'), type: 'jpeg', quality: 90 });
  console.log('  ✓ 02-projects');

  // Pages to capture once a project is open
  const pages = [
    { file: '03-dashboard',      path: '/dashboard' },
    { file: '04-servers',        path: '/servers' },
    { file: '05-import',         path: '/import' },
    { file: '06-configurations', path: '/configurations' },
    { file: '07-skills',         path: '/configurations/skills' },
    { file: '08-csqs',           path: '/configurations/csqs' },
    { file: '09-resources',      path: '/configurations/resources' },
    { file: '10-teams',          path: '/configurations/teams' },
    { file: '11-applications',   path: '/configurations/applications' },
    { file: '12-triggers',       path: '/configurations/triggers' },
    { file: '13-migration',      path: '/migration' },
    { file: '14-logs',           path: '/logs' },
    { file: '15-users',          path: '/users' },
    { file: '16-branding',       path: '/branding' },
  ];

  for (const pg of pages) {
    try {
      await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${pg.file}.jpg`), type: 'jpeg', quality: 90 });
      console.log(`  ✓ ${pg.file}`);
    } catch (err) {
      console.error(`  ✗ ${pg.file}: ${err.message.split('\n')[0]}`);
    }
  }

  await browser.close();
  console.log('\nAll screenshots saved to docs/screenshots/');
}

run().catch(err => { console.error(err); process.exit(1); });
