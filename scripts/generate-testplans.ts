import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const outputDir = './test-plans';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

interface TestCase {
  id: string;
  feature: string;
  testCase: string;
  preconditions: string;
  steps: string;
  expectedResult: string;
  priority: string;
  status: string;
}

function createWorkbook(sheetName: string, testCases: TestCase[]): XLSX.WorkBook {
  const headers = ['Test ID', 'Feature', 'Test Case', 'Preconditions', 'Steps', 'Expected Result', 'Priority', 'Status'];
  const data = [headers, ...testCases.map(tc => [
    tc.id, tc.feature, tc.testCase, tc.preconditions, tc.steps, tc.expectedResult, tc.priority, tc.status
  ])];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 50 }, { wch: 40 }, { wch: 10 }, { wch: 10 }
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

// 1. User Management Test Plan
const userManagementTests: TestCase[] = [
  { id: 'UM-001', feature: 'Login', testCase: 'Valid user login', preconditions: 'User account exists and is active', steps: '1. Navigate to login page\n2. Enter valid username\n3. Enter valid password\n4. Click Login button', expectedResult: 'User is logged in and redirected to dashboard', priority: 'High', status: 'Not Started' },
  { id: 'UM-002', feature: 'Login', testCase: 'Invalid password login', preconditions: 'User account exists', steps: '1. Navigate to login page\n2. Enter valid username\n3. Enter invalid password\n4. Click Login button', expectedResult: 'Error message displayed: Invalid credentials', priority: 'High', status: 'Not Started' },
  { id: 'UM-003', feature: 'Login', testCase: 'Invalid username login', preconditions: 'None', steps: '1. Navigate to login page\n2. Enter non-existent username\n3. Enter any password\n4. Click Login button', expectedResult: 'Error message displayed: Invalid credentials', priority: 'High', status: 'Not Started' },
  { id: 'UM-004', feature: 'Login', testCase: 'Inactive user login', preconditions: 'User account exists but is inactive', steps: '1. Navigate to login page\n2. Enter inactive user credentials\n3. Click Login button', expectedResult: 'Error message displayed: Account is inactive', priority: 'Medium', status: 'Not Started' },
  { id: 'UM-005', feature: 'Logout', testCase: 'User logout', preconditions: 'User is logged in', steps: '1. Click user menu in header\n2. Click Logout option', expectedResult: 'User is logged out and redirected to login page', priority: 'High', status: 'Not Started' },
  { id: 'UM-006', feature: 'Create User', testCase: 'Create new user with all fields', preconditions: 'Admin user is logged in', steps: '1. Navigate to Users page\n2. Click Add User button\n3. Fill in username, password, email, first name, last name\n4. Select role\n5. Click Create User', expectedResult: 'User created successfully, appears in user list', priority: 'High', status: 'Not Started' },
  { id: 'UM-007', feature: 'Create User', testCase: 'Create user with minimum fields', preconditions: 'Admin user is logged in', steps: '1. Navigate to Users page\n2. Click Add User button\n3. Fill in username and password only\n4. Click Create User', expectedResult: 'User created successfully with default role', priority: 'Medium', status: 'Not Started' },
  { id: 'UM-008', feature: 'Create User', testCase: 'Create user with duplicate username', preconditions: 'Admin user is logged in, user "testuser" exists', steps: '1. Navigate to Users page\n2. Click Add User button\n3. Enter existing username\n4. Fill other required fields\n5. Click Create User', expectedResult: 'Error message: Username already exists', priority: 'High', status: 'Not Started' },
  { id: 'UM-009', feature: 'Edit User', testCase: 'Edit user first and last name', preconditions: 'Admin user is logged in, target user exists', steps: '1. Navigate to Users page\n2. Click Edit button for target user\n3. Change first name and last name\n4. Click Save Changes', expectedResult: 'User updated, name displayed in table', priority: 'Medium', status: 'Not Started' },
  { id: 'UM-010', feature: 'Edit User', testCase: 'Change user password', preconditions: 'Admin user is logged in, target user exists', steps: '1. Navigate to Users page\n2. Click Edit button for target user\n3. Enter new password\n4. Click Save Changes', expectedResult: 'Password updated, user can login with new password', priority: 'High', status: 'Not Started' },
  { id: 'UM-011', feature: 'Edit User', testCase: 'Change user role', preconditions: 'Admin user is logged in, regular user exists', steps: '1. Navigate to Users page\n2. Click Edit button for user\n3. Change role from User to Admin\n4. Click Save Changes', expectedResult: 'User role updated, badge shows Admin', priority: 'High', status: 'Not Started' },
  { id: 'UM-012', feature: 'Edit User', testCase: 'Deactivate user', preconditions: 'Admin user is logged in, active user exists', steps: '1. Navigate to Users page\n2. Click Edit button for user\n3. Toggle Active switch off\n4. Click Save Changes', expectedResult: 'User marked inactive, status shows Inactive', priority: 'High', status: 'Not Started' },
  { id: 'UM-013', feature: 'Delete User', testCase: 'Delete existing user', preconditions: 'Admin user is logged in, target user exists', steps: '1. Navigate to Users page\n2. Click Delete button for target user\n3. Confirm deletion in dialog', expectedResult: 'User deleted, removed from user list', priority: 'High', status: 'Not Started' },
  { id: 'UM-014', feature: 'Delete User', testCase: 'Cannot delete own account', preconditions: 'Admin user is logged in', steps: '1. Navigate to Users page\n2. Try to click Delete button for own account', expectedResult: 'Delete button is disabled for own account', priority: 'Medium', status: 'Not Started' },
  { id: 'UM-015', feature: 'Header Display', testCase: 'Display full name in header', preconditions: 'User with first/last name is logged in', steps: '1. Login as user with first and last name set', expectedResult: 'Header shows full name instead of username', priority: 'Medium', status: 'Not Started' },
];

// 2. Project Management Test Plan
const projectManagementTests: TestCase[] = [
  { id: 'PM-001', feature: 'Create Project', testCase: 'Create new project', preconditions: 'User is logged in', steps: '1. Navigate to Projects page\n2. Click New Project button\n3. Enter project name and description\n4. Click Create', expectedResult: 'Project created, appears in project list', priority: 'High', status: 'Not Started' },
  { id: 'PM-002', feature: 'Create Project', testCase: 'Create project with name only', preconditions: 'User is logged in', steps: '1. Navigate to Projects page\n2. Click New Project button\n3. Enter project name only\n4. Click Create', expectedResult: 'Project created with no description', priority: 'Medium', status: 'Not Started' },
  { id: 'PM-003', feature: 'View Projects', testCase: 'View project list with statistics', preconditions: 'User has projects', steps: '1. Navigate to Projects page', expectedResult: 'Projects displayed with owner, connection counts, config counts, migration stats', priority: 'High', status: 'Not Started' },
  { id: 'PM-004', feature: 'Open Project', testCase: 'Open and select project', preconditions: 'User has projects', steps: '1. Navigate to Projects page\n2. Click Open Project button', expectedResult: 'Project selected, user redirected to dashboard with project context', priority: 'High', status: 'Not Started' },
  { id: 'PM-005', feature: 'Edit Project', testCase: 'Edit project name and description', preconditions: 'User owns the project', steps: '1. Navigate to Projects page\n2. Click Edit button for project\n3. Change name and description\n4. Click Save', expectedResult: 'Project details updated', priority: 'Medium', status: 'Not Started' },
  { id: 'PM-006', feature: 'Delete Project', testCase: 'Delete owned project', preconditions: 'User owns the project', steps: '1. Navigate to Projects page\n2. Click Delete button for project\n3. Confirm deletion', expectedResult: 'Project deleted, removed from list', priority: 'High', status: 'Not Started' },
  { id: 'PM-007', feature: 'Project Members', testCase: 'Add member to project', preconditions: 'User is project admin, other users exist', steps: '1. Open project settings\n2. Click Add Member\n3. Select user\n4. Set permissions\n5. Click Add', expectedResult: 'Member added with specified permissions', priority: 'High', status: 'Not Started' },
  { id: 'PM-008', feature: 'Project Members', testCase: 'Edit member permissions', preconditions: 'User is project admin, member exists', steps: '1. Open project settings\n2. Click Edit for member\n3. Change permissions\n4. Click Save', expectedResult: 'Member permissions updated', priority: 'Medium', status: 'Not Started' },
  { id: 'PM-009', feature: 'Project Members', testCase: 'Remove member from project', preconditions: 'User is project admin, member exists', steps: '1. Open project settings\n2. Click Remove for member\n3. Confirm removal', expectedResult: 'Member removed from project', priority: 'Medium', status: 'Not Started' },
  { id: 'PM-010', feature: 'Project Isolation', testCase: 'Data isolation between projects', preconditions: 'User has multiple projects with data', steps: '1. Select Project A\n2. Note configurations count\n3. Select Project B\n4. Verify different configurations count', expectedResult: 'Each project shows its own isolated data', priority: 'High', status: 'Not Started' },
];

// 3. UCCX Connections Test Plan
const connectionTests: TestCase[] = [
  { id: 'CN-001', feature: 'Create Connection', testCase: 'Create source UCCX connection', preconditions: 'Project is selected', steps: '1. Navigate to Servers page\n2. Click Add Connection\n3. Enter name, host, port, credentials\n4. Mark as Source\n5. Click Create', expectedResult: 'Source connection created, appears in list', priority: 'High', status: 'Not Started' },
  { id: 'CN-002', feature: 'Create Connection', testCase: 'Create destination UCCX connection', preconditions: 'Project is selected', steps: '1. Navigate to Servers page\n2. Click Add Connection\n3. Enter name, host, port, credentials\n4. Mark as Destination\n5. Click Create', expectedResult: 'Destination connection created, appears in list', priority: 'High', status: 'Not Started' },
  { id: 'CN-003', feature: 'Test Connection', testCase: 'Test valid connection', preconditions: 'Valid UCCX server available', steps: '1. Navigate to Servers page\n2. Click Test for connection', expectedResult: 'Connection test successful message', priority: 'High', status: 'Not Started' },
  { id: 'CN-004', feature: 'Test Connection', testCase: 'Test invalid connection', preconditions: 'Invalid connection configured', steps: '1. Navigate to Servers page\n2. Click Test for invalid connection', expectedResult: 'Connection test failed with error message', priority: 'Medium', status: 'Not Started' },
  { id: 'CN-005', feature: 'Edit Connection', testCase: 'Edit connection details', preconditions: 'Connection exists', steps: '1. Navigate to Servers page\n2. Click Edit for connection\n3. Change host and credentials\n4. Click Save', expectedResult: 'Connection updated successfully', priority: 'Medium', status: 'Not Started' },
  { id: 'CN-006', feature: 'Delete Connection', testCase: 'Delete connection', preconditions: 'Connection exists', steps: '1. Navigate to Servers page\n2. Click Delete for connection\n3. Confirm deletion', expectedResult: 'Connection deleted, removed from list', priority: 'Medium', status: 'Not Started' },
  { id: 'CN-007', feature: 'Connection Isolation', testCase: 'Connections isolated by project', preconditions: 'Different connections in different projects', steps: '1. Select Project A, view connections\n2. Select Project B, view connections', expectedResult: 'Each project shows only its own connections', priority: 'High', status: 'Not Started' },
];

// 4. Import Configuration Test Plan
const importTests: TestCase[] = [
  { id: 'IM-001', feature: 'XML Upload', testCase: 'Upload valid XML configuration file', preconditions: 'Project selected, valid XML file ready', steps: '1. Navigate to Import page\n2. Select File Upload tab\n3. Drag/select XML file\n4. Click Import', expectedResult: 'File uploaded, configurations parsed and stored', priority: 'High', status: 'Not Started' },
  { id: 'IM-002', feature: 'XML Upload', testCase: 'Upload invalid XML file', preconditions: 'Project selected, invalid XML file ready', steps: '1. Navigate to Import page\n2. Select File Upload tab\n3. Drag/select invalid XML file\n4. Click Import', expectedResult: 'Error message: Invalid XML format', priority: 'Medium', status: 'Not Started' },
  { id: 'IM-003', feature: 'XML Upload', testCase: 'Upload non-XML file', preconditions: 'Project selected', steps: '1. Navigate to Import page\n2. Select File Upload tab\n3. Try to upload non-XML file', expectedResult: 'File rejected with error message', priority: 'Medium', status: 'Not Started' },
  { id: 'IM-004', feature: 'API Import', testCase: 'Import Skills from UCCX API', preconditions: 'Project selected, source connection configured', steps: '1. Navigate to Import page\n2. Select API Import tab\n3. Select source connection\n4. Check Skills checkbox\n5. Click Import', expectedResult: 'Skills imported from UCCX server', priority: 'High', status: 'Not Started' },
  { id: 'IM-005', feature: 'API Import', testCase: 'Import Resource Groups from API', preconditions: 'Project selected, source connection configured', steps: '1. Navigate to Import page\n2. Select API Import tab\n3. Select source connection\n4. Check Resource Groups checkbox\n5. Click Import', expectedResult: 'Resource Groups imported from UCCX server', priority: 'High', status: 'Not Started' },
  { id: 'IM-006', feature: 'API Import', testCase: 'Import multiple configuration types', preconditions: 'Project selected, source connection configured', steps: '1. Navigate to Import page\n2. Select API Import tab\n3. Select source connection\n4. Check multiple configuration types\n5. Click Import', expectedResult: 'All selected configuration types imported', priority: 'High', status: 'Not Started' },
  { id: 'IM-007', feature: 'API Import', testCase: 'Import with invalid connection', preconditions: 'Project selected, invalid connection configured', steps: '1. Navigate to Import page\n2. Select API Import tab\n3. Select invalid connection\n4. Click Import', expectedResult: 'Error message about connection failure', priority: 'Medium', status: 'Not Started' },
];

// 5. Skills Management Test Plan
const skillsTests: TestCase[] = [
  { id: 'SK-001', feature: 'View Skills', testCase: 'View skills list', preconditions: 'Project selected with imported skills', steps: '1. Navigate to Skills page', expectedResult: 'Skills table displayed with all columns', priority: 'High', status: 'Not Started' },
  { id: 'SK-002', feature: 'View Skills', testCase: 'View skill details', preconditions: 'Skills exist in project', steps: '1. Navigate to Skills page\n2. Click View for a skill', expectedResult: 'Skill details dialog opens with full information', priority: 'Medium', status: 'Not Started' },
  { id: 'SK-003', feature: 'Edit Skill', testCase: 'Edit skill name', preconditions: 'Skills exist in project', steps: '1. Navigate to Skills page\n2. Click Edit for a skill\n3. Change skill name\n4. Click Save', expectedResult: 'Skill updated successfully', priority: 'Medium', status: 'Not Started' },
  { id: 'SK-004', feature: 'Delete Skill', testCase: 'Delete single skill', preconditions: 'Skills exist in project', steps: '1. Navigate to Skills page\n2. Click Delete for a skill\n3. Confirm deletion', expectedResult: 'Skill deleted from project', priority: 'Medium', status: 'Not Started' },
  { id: 'SK-005', feature: 'Bulk Operations', testCase: 'Select multiple skills', preconditions: 'Multiple skills exist', steps: '1. Navigate to Skills page\n2. Check multiple skill checkboxes', expectedResult: 'Multiple skills selected, bulk action buttons appear', priority: 'Medium', status: 'Not Started' },
  { id: 'SK-006', feature: 'Bulk Operations', testCase: 'Bulk delete skills', preconditions: 'Multiple skills selected', steps: '1. Select multiple skills\n2. Click Bulk Delete\n3. Confirm deletion', expectedResult: 'All selected skills deleted', priority: 'Medium', status: 'Not Started' },
  { id: 'SK-007', feature: 'View Raw XML', testCase: 'View skill raw XML', preconditions: 'Skills exist in project', steps: '1. Navigate to Skills page\n2. Click View for a skill\n3. Click Raw XML tab', expectedResult: 'Raw XML configuration displayed', priority: 'Low', status: 'Not Started' },
];

// 6. Resource Groups Test Plan
const resourceGroupsTests: TestCase[] = [
  { id: 'RG-001', feature: 'View Resource Groups', testCase: 'View resource groups list', preconditions: 'Project selected with imported resource groups', steps: '1. Navigate to Resource Groups page', expectedResult: 'Resource groups table displayed', priority: 'High', status: 'Not Started' },
  { id: 'RG-002', feature: 'View Resource Groups', testCase: 'View resource group details', preconditions: 'Resource groups exist', steps: '1. Navigate to Resource Groups page\n2. Click View for a resource group', expectedResult: 'Resource group details dialog opens', priority: 'Medium', status: 'Not Started' },
  { id: 'RG-003', feature: 'Edit Resource Group', testCase: 'Edit resource group', preconditions: 'Resource groups exist', steps: '1. Navigate to Resource Groups page\n2. Click Edit for a resource group\n3. Modify fields\n4. Click Save', expectedResult: 'Resource group updated', priority: 'Medium', status: 'Not Started' },
  { id: 'RG-004', feature: 'Delete Resource Group', testCase: 'Delete resource group', preconditions: 'Resource groups exist', steps: '1. Navigate to Resource Groups page\n2. Click Delete\n3. Confirm', expectedResult: 'Resource group deleted', priority: 'Medium', status: 'Not Started' },
];

// 7. Resources Test Plan
const resourcesTests: TestCase[] = [
  { id: 'RS-001', feature: 'View Resources', testCase: 'View resources list', preconditions: 'Project selected with imported resources', steps: '1. Navigate to Resources page', expectedResult: 'Resources table displayed with agent details', priority: 'High', status: 'Not Started' },
  { id: 'RS-002', feature: 'View Resources', testCase: 'View resource details', preconditions: 'Resources exist', steps: '1. Navigate to Resources page\n2. Click View for a resource', expectedResult: 'Resource details dialog opens with skills and teams', priority: 'Medium', status: 'Not Started' },
  { id: 'RS-003', feature: 'Edit Resource', testCase: 'Edit resource', preconditions: 'Resources exist', steps: '1. Navigate to Resources page\n2. Click Edit for a resource\n3. Modify fields\n4. Click Save', expectedResult: 'Resource updated', priority: 'Medium', status: 'Not Started' },
  { id: 'RS-004', feature: 'Delete Resource', testCase: 'Delete resource', preconditions: 'Resources exist', steps: '1. Navigate to Resources page\n2. Click Delete\n3. Confirm', expectedResult: 'Resource deleted', priority: 'Medium', status: 'Not Started' },
];

// 8. Teams Test Plan
const teamsTests: TestCase[] = [
  { id: 'TM-001', feature: 'View Teams', testCase: 'View teams list', preconditions: 'Project selected with imported teams', steps: '1. Navigate to Teams page', expectedResult: 'Teams table displayed', priority: 'High', status: 'Not Started' },
  { id: 'TM-002', feature: 'View Teams', testCase: 'View team details', preconditions: 'Teams exist', steps: '1. Navigate to Teams page\n2. Click View for a team', expectedResult: 'Team details dialog with resources/supervisors', priority: 'Medium', status: 'Not Started' },
  { id: 'TM-003', feature: 'Edit Team', testCase: 'Edit team', preconditions: 'Teams exist', steps: '1. Navigate to Teams page\n2. Click Edit\n3. Modify fields\n4. Save', expectedResult: 'Team updated', priority: 'Medium', status: 'Not Started' },
  { id: 'TM-004', feature: 'Delete Team', testCase: 'Delete team', preconditions: 'Teams exist', steps: '1. Navigate to Teams page\n2. Click Delete\n3. Confirm', expectedResult: 'Team deleted', priority: 'Medium', status: 'Not Started' },
];

// 9. CSQs Test Plan
const csqsTests: TestCase[] = [
  { id: 'CQ-001', feature: 'View CSQs', testCase: 'View CSQs list', preconditions: 'Project selected with imported CSQs', steps: '1. Navigate to CSQs page', expectedResult: 'CSQs table displayed with queue details', priority: 'High', status: 'Not Started' },
  { id: 'CQ-002', feature: 'View CSQs', testCase: 'View CSQ details', preconditions: 'CSQs exist', steps: '1. Navigate to CSQs page\n2. Click View for a CSQ', expectedResult: 'CSQ details dialog with skills and settings', priority: 'Medium', status: 'Not Started' },
  { id: 'CQ-003', feature: 'Edit CSQ', testCase: 'Edit CSQ', preconditions: 'CSQs exist', steps: '1. Navigate to CSQs page\n2. Click Edit\n3. Modify fields\n4. Save', expectedResult: 'CSQ updated', priority: 'Medium', status: 'Not Started' },
  { id: 'CQ-004', feature: 'Delete CSQ', testCase: 'Delete CSQ', preconditions: 'CSQs exist', steps: '1. Navigate to CSQs page\n2. Click Delete\n3. Confirm', expectedResult: 'CSQ deleted', priority: 'Medium', status: 'Not Started' },
];

// 10. Applications Test Plan
const applicationsTests: TestCase[] = [
  { id: 'AP-001', feature: 'View Applications', testCase: 'View applications list', preconditions: 'Project selected with imported applications', steps: '1. Navigate to Applications page', expectedResult: 'Applications table displayed', priority: 'High', status: 'Not Started' },
  { id: 'AP-002', feature: 'View Applications', testCase: 'View application details', preconditions: 'Applications exist', steps: '1. Navigate to Applications page\n2. Click View for an application', expectedResult: 'Application details dialog opens', priority: 'Medium', status: 'Not Started' },
  { id: 'AP-003', feature: 'Edit Application', testCase: 'Edit application', preconditions: 'Applications exist', steps: '1. Navigate to Applications page\n2. Click Edit\n3. Modify fields\n4. Save', expectedResult: 'Application updated', priority: 'Medium', status: 'Not Started' },
  { id: 'AP-004', feature: 'Delete Application', testCase: 'Delete application', preconditions: 'Applications exist', steps: '1. Navigate to Applications page\n2. Click Delete\n3. Confirm', expectedResult: 'Application deleted', priority: 'Medium', status: 'Not Started' },
];

// 11. Triggers Test Plan
const triggersTests: TestCase[] = [
  { id: 'TR-001', feature: 'View Triggers', testCase: 'View triggers list', preconditions: 'Project selected with imported triggers', steps: '1. Navigate to Triggers page', expectedResult: 'Triggers table displayed', priority: 'High', status: 'Not Started' },
  { id: 'TR-002', feature: 'View Triggers', testCase: 'View trigger details', preconditions: 'Triggers exist', steps: '1. Navigate to Triggers page\n2. Click View for a trigger', expectedResult: 'Trigger details dialog opens', priority: 'Medium', status: 'Not Started' },
  { id: 'TR-003', feature: 'Edit Trigger', testCase: 'Edit trigger', preconditions: 'Triggers exist', steps: '1. Navigate to Triggers page\n2. Click Edit\n3. Modify fields\n4. Save', expectedResult: 'Trigger updated', priority: 'Medium', status: 'Not Started' },
  { id: 'TR-004', feature: 'Delete Trigger', testCase: 'Delete trigger', preconditions: 'Triggers exist', steps: '1. Navigate to Triggers page\n2. Click Delete\n3. Confirm', expectedResult: 'Trigger deleted', priority: 'Medium', status: 'Not Started' },
];

// 12. Migration Jobs Test Plan
const migrationTests: TestCase[] = [
  { id: 'MJ-001', feature: 'Create Migration', testCase: 'Create skill migration job', preconditions: 'Skills imported, destination connection configured', steps: '1. Navigate to Skills page\n2. Select skills to migrate\n3. Click Migrate\n4. Select destination\n5. Confirm', expectedResult: 'Migration job created and started', priority: 'High', status: 'Not Started' },
  { id: 'MJ-002', feature: 'Create Migration', testCase: 'Create bulk migration job', preconditions: 'Multiple config types imported', steps: '1. Navigate to Migration page\n2. Select configuration types\n3. Select destination\n4. Click Start Migration', expectedResult: 'Bulk migration job created', priority: 'High', status: 'Not Started' },
  { id: 'MJ-003', feature: 'View Migrations', testCase: 'View migration job list', preconditions: 'Migration jobs exist', steps: '1. Navigate to Migration page', expectedResult: 'Migration jobs table with status displayed', priority: 'High', status: 'Not Started' },
  { id: 'MJ-004', feature: 'View Migrations', testCase: 'View migration job details', preconditions: 'Migration jobs exist', steps: '1. Navigate to Migration page\n2. Click View for a job', expectedResult: 'Job details with progress and logs', priority: 'Medium', status: 'Not Started' },
  { id: 'MJ-005', feature: 'Cancel Migration', testCase: 'Cancel running migration', preconditions: 'Migration job is running', steps: '1. Navigate to Migration page\n2. Click Cancel for running job\n3. Confirm', expectedResult: 'Migration job cancelled', priority: 'Medium', status: 'Not Started' },
  { id: 'MJ-006', feature: 'ID Mapping', testCase: 'Verify ID mapping after migration', preconditions: 'Migration job completed', steps: '1. Navigate to Migration page\n2. View completed job details\n3. Check ID mappings', expectedResult: 'Source to target ID mappings displayed', priority: 'High', status: 'Not Started' },
];

// 13. Dashboard Test Plan
const dashboardTests: TestCase[] = [
  { id: 'DB-001', feature: 'Statistics Display', testCase: 'View project statistics', preconditions: 'Project selected with data', steps: '1. Navigate to Dashboard', expectedResult: 'Statistics cards show correct counts', priority: 'High', status: 'Not Started' },
  { id: 'DB-002', feature: 'Statistics Display', testCase: 'View configuration summary', preconditions: 'Project with imported configs', steps: '1. Navigate to Dashboard\n2. View Configuration Summary card', expectedResult: 'Breakdown by config type displayed', priority: 'Medium', status: 'Not Started' },
  { id: 'DB-003', feature: 'Active Migrations', testCase: 'View active migrations', preconditions: 'Migration job running', steps: '1. Navigate to Dashboard', expectedResult: 'Active migrations widget shows running jobs', priority: 'Medium', status: 'Not Started' },
  { id: 'DB-004', feature: 'No Project', testCase: 'Dashboard with no project selected', preconditions: 'No project selected', steps: '1. Navigate to Dashboard without selecting project', expectedResult: 'Message to select a project displayed', priority: 'Medium', status: 'Not Started' },
];

// 14. Audit Logs Test Plan
const auditLogsTests: TestCase[] = [
  { id: 'AL-001', feature: 'View Logs', testCase: 'View audit logs list', preconditions: 'Actions performed in project', steps: '1. Navigate to Audit Logs page', expectedResult: 'Audit logs table displayed with actions', priority: 'High', status: 'Not Started' },
  { id: 'AL-002', feature: 'Filter Logs', testCase: 'Filter logs by action type', preconditions: 'Various log entries exist', steps: '1. Navigate to Audit Logs page\n2. Select action type filter\n3. Apply filter', expectedResult: 'Only matching logs displayed', priority: 'Medium', status: 'Not Started' },
  { id: 'AL-003', feature: 'Filter Logs', testCase: 'Filter logs by date range', preconditions: 'Logs from various dates exist', steps: '1. Navigate to Audit Logs page\n2. Set date range filter\n3. Apply filter', expectedResult: 'Only logs in date range displayed', priority: 'Medium', status: 'Not Started' },
  { id: 'AL-004', feature: 'Log Details', testCase: 'View log entry details', preconditions: 'Log entries exist', steps: '1. Navigate to Audit Logs page\n2. Click on log entry', expectedResult: 'Log details with full information displayed', priority: 'Low', status: 'Not Started' },
];

// Generate all test plan files
const testPlans = [
  { name: '01-User-Management', tests: userManagementTests },
  { name: '02-Project-Management', tests: projectManagementTests },
  { name: '03-UCCX-Connections', tests: connectionTests },
  { name: '04-Import-Configuration', tests: importTests },
  { name: '05-Skills-Management', tests: skillsTests },
  { name: '06-Resource-Groups', tests: resourceGroupsTests },
  { name: '07-Resources', tests: resourcesTests },
  { name: '08-Teams', tests: teamsTests },
  { name: '09-CSQs', tests: csqsTests },
  { name: '10-Applications', tests: applicationsTests },
  { name: '11-Triggers', tests: triggersTests },
  { name: '12-Migration-Jobs', tests: migrationTests },
  { name: '13-Dashboard', tests: dashboardTests },
  { name: '14-Audit-Logs', tests: auditLogsTests },
];

testPlans.forEach(plan => {
  const wb = createWorkbook(plan.name.replace(/^\d+-/, ''), plan.tests);
  const filePath = path.join(outputDir, `${plan.name}-TestPlan.xlsx`);
  XLSX.writeFile(wb, filePath);
  console.log(`Created: ${filePath}`);
});

console.log('\nAll test plan files generated successfully!');
