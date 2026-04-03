// ── GOOGLE SHEETS SYNC ───────────────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzhhxcvCB4-M_e7XeWYqg3IxHX68Jz9RimkCpMQKCDJ26P3sTlj31it90qu87TWo8hs/exec";

async function getJunsuiExportData() {
  const students = studentsList;
  let allRecords = await db.attendance.toArray();

  if (sessionSubject && sessionSubject !== 'Unknown') {
    allRecords = allRecords.filter(r => r.subject === sessionSubject);
  }
  if (sessionBranch && sessionBranch !== 'Unknown') {
    allRecords = allRecords.filter(r => r.branch === sessionBranch);
  }

  const uniqueDates = [...new Set(allRecords.map(r => r.date))].sort();
  const wsData = [];

  wsData.push(["⛩ JUNSUI — ATTENDANCE REGISTER"]);
  wsData.push([`Year: 2025–26 | Sem: II | Branch: ${sessionBranch || "N/A"}`]);
  wsData.push([`Subject: ${sessionSubject || "N/A"}`, "", "", `Month: ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`]);
  wsData.push([]);

  const dateColsCount = Math.max(1, uniqueDates.length);
  const row1 = ["Student Info", ""];
  row1.push("Lecture Dates");
  for (let i = 1; i < dateColsCount; i++) row1.push("");
  row1.push("Summary", "");
  wsData.push(row1);

  const row2 = ["R.No.", "Name of Student"];
  if (uniqueDates.length > 0) {
    uniqueDates.forEach(d => {
      const parts = d.split('-');
      row2.push(parts.length === 3 ? parseInt(parts[2]).toString() : d);
    });
  } else {
    row2.push("-");
  }
  row2.push("Total Present", "%");
  wsData.push(row2);

  for (const s of students) {
    const studentRecords = allRecords.filter(r => r.studentId === s.id);
    const dateMap = {};
    studentRecords.forEach(r => { dateMap[r.date] = r.status; });

    let rnoDisplay = s.rollNo;
    if (s.rollNo.includes('-')) rnoDisplay = parseInt(s.rollNo.split('-').pop()) || s.rollNo;

    const row = [rnoDisplay, s.name];
    let presentCount = 0;

    if (uniqueDates.length > 0) {
      uniqueDates.forEach(d => {
        const st = dateMap[d];
        if (st === 'Present') { row.push('P'); presentCount++; }
        else if (st === 'Absent') { row.push('A'); }
        else if (st === 'Late') { row.push('L'); presentCount++; }
        else if (st === 'Leave') { row.push('Lv'); }
        else { row.push('-'); }
      });
    } else {
      row.push("-");
    }

    const totalLectures = uniqueDates.length;
    row.push(totalLectures > 0 ? `${presentCount} / ${totalLectures}` : '-');
    row.push(totalLectures > 0 ? Math.round((presentCount / totalLectures) * 100) + '%' : '-');

    wsData.push(row);
  }

  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
    { s: { r: 2, c: 3 }, e: { r: 2, c: 5 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
  ];

  if (uniqueDates.length > 0) {
    merges.push({ s: { r: 4, c: 2 }, e: { r: 4, c: 1 + uniqueDates.length } });
    merges.push({ s: { r: 4, c: 2 + uniqueDates.length }, e: { r: 4, c: 3 + uniqueDates.length } });
  } else {
    merges.push({ s: { r: 4, c: 2 }, e: { r: 4, c: 2 } });
    merges.push({ s: { r: 4, c: 3 }, e: { r: 4, c: 4 } });
  }

  return { wsData, merges, uniqueDates };
}

async function sendToSheets() {
  const data = await getJunsuiExportData();
  if (!data.wsData || data.wsData.length === 0) {
    showToast("No data to send!");
    return;
  }

  try {
    showToast("Sending Junsui data to Google Sheets...");
    const payload = JSON.stringify({
      sheetName: sessionSubject || "Attendance",
      wsData: data.wsData,
      merges: data.merges
    });

    // mode: 'no-cors' prevents the browser from doing a preflight OPTIONS check 
    // and blocks following any redirects (preventing "vo website pe na jaye").
    await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain",
      },
      body: payload
    });

    // mode: no-cors gives an opaque response, so we optimistically show success
    showToast("✅ Register synced via Apps Script!");
  } catch (err) {
    showToast("❌ Failed to send!");
    console.error(err);
  }
}

// Initialize Dexie JS Database
const db = new Dexie("AttendanceDB");
db.version(1).stores({
  students: "++id, rollNo, name, totalClasses, attendedClasses",
  attendance: "++id, studentId, date, status, timestamp, subject, timeSlot",
  queue: "++id, studentId, date, status, timestamp, subject, timeSlot"
});
db.version(3).stores({
  students: "++id, rollNo, name, totalClasses, attendedClasses",
  attendance: "++id, studentId, date, status, timestamp, subject, timeSlot, branch",
  queue: "++id, studentId, date, status, timestamp, subject, timeSlot, branch",
  student_registry: "[branch+rollNo], branch, rollNo, name"
});

// State variables
let studentsList = [];
let currentIndex = 0;
let sessionBranch = "";
let sessionSubject = "";
let sessionTimeSlot = "";
let sessionDate = "";

// DOM Elements
const screens = {
  setup: document.getElementById('setup-screen'),
  call: document.getElementById('call-screen'),
  complete: document.getElementById('complete-screen'),
  report: document.getElementById('report-screen')
};

const setupBtn = document.getElementById('start-btn');
const cardContainer = document.getElementById('card-container');
const progressBar = document.getElementById('progress-bar');
const toast = document.getElementById('toast');

// Actions
const btnPresent = document.getElementById('present-btn');
const btnAbsent = document.getElementById('absent-btn');
const btnLate = document.getElementById('late-btn');
const btnLeave = document.getElementById('leave-btn');
const btnUndoList = document.querySelectorAll('.undo-btn, #complete-undo-btn');

const btnExportList = document.querySelectorAll('#export-btn, #complete-export-btn');
const btnNewSession = document.getElementById('new-session-btn');

// Show Toast message
function showToast(msg) {
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Haptic feedback API
function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate(50);
  }
}

// Switch between screens
function switchScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// Setup the database with students
async function initializeStudents(count) {
  await db.students.clear();
  const currentBranch = branchSelect.value;

  const registryEntries = await db.student_registry.where('branch').equals(currentBranch).toArray();
  const nameMap = {};
  registryEntries.forEach(r => {
    nameMap[r.rollNo] = r.name;
  });

  const newStudents = [];
  const prefix = currentBranch === 'Other' ? '' : currentBranch;

  for (let i = 1; i <= count; i++) {
    const shortRoll = String(i);
    const fullRoll = prefix ? `${prefix}-${String(i).padStart(3, '0')}` : String(i);

    let displayName = nameMap[fullRoll] || nameMap[shortRoll];

    if (!displayName) {
      if (currentBranch === 'CSE' && CSE_STUDENTS[i - 1]) displayName = CSE_STUDENTS[i - 1];
      else if (currentBranch === 'ETC' && ETC_STUDENTS[i - 1]) displayName = ETC_STUDENTS[i - 1];
      else if (currentBranch === 'CSE-CS' && CSECS_STUDENTS[i - 1]) displayName = CSECS_STUDENTS[i - 1];
    }

    displayName = displayName || `Student ${i}`;

    newStudents.push({
      rollNo: fullRoll,
      name: displayName,
      totalClasses: 0,
      attendedClasses: 0
    });
  }
  await db.students.bulkAdd(newStudents);
  studentsList = await db.students.toArray();
}

const subjectSelect = document.getElementById('subject');
const customSubjectGroup = document.getElementById('custom-subject-group');
const customSubjectInput = document.getElementById('custom-subject');
const branchSelect = document.getElementById('branch');
const numStudentsInput = document.getElementById('num-students');

// Default student count per branch
const branchStudentCount = {
  'CSE': 44,
  'CSE-DS': 60,
  'CSE-CS': 48,
  'AIML': 60,
  'IT': 60,
  'MECH': 60,
  'CIVIL': 60,
  'EE': 60,
  'ETC': 51,
  'Other': 60,
};

const CSE_STUDENTS = [
  "Aaditya Anil Wankhede", "Aditya Pankaj Fule", "Aditya Rajesh Khalode", "Aditya Sunil Dafade",
  "Anjali Sanjay Chutke", "Anjali Vikram Tapre", "Anushka Ravindra Askar", "Ashish Subhashrao Date",
  "Atharvi Rakesh Nandgaonkar", "Ayush Jagdish Kekan", "Bhushan Kedar Shende", "Buddhabhushan Vijay Bhalerao",
  "Chaitali Sanjay Adbale", "Darshan Rajendra Rakshak", "Dipali Shivraj Awadhut", "Harshada Sevak Kolhe",
  "Komal Sanjay Pund", "Krushika Raju Masram", "Kuber Nilkanth Peddiwar", "Lucky Ashok Patil",
  "Neha Sitaram Bedre", "Prem Siddharth Tayade", "Prerna Shankar Sasane", "Priyanshu Dhanraj Yerpude",
  "Rohan Ramkishan Khandare", "Sagar Sanjay Chandewar", "Samiksha Gaynath Ingle", "Samir Sudhir Sonune",
  "Samyak Vijay Khobragade", "Sanket Sanjay Pandit", "Sejal Raju Thakare", "Shruti Chandrabhan Raut",
  "Soham Khote", "Soumya Niraj Sable", "Swajal Sandesh Indorkar", "Swarnim Maruti Wadgule",
  "Tanmay Arvind Rithe", "Tanvi Devanand Bhowate", "Triveni Manohar Tarale", "Vedangi Pravin Diware",
  "Vedant Hiralal Patil", "Vidanshu Arun Choudhari", "Yash Suresh Ingale", "Yash Tulshiram Bobade"
];

const ETC_STUDENTS = [
  "Aditya Prabhakar Dahare", "Akansha Rajendra Bhaisare", "Anushka Narendra Godbole", "Anushka Naresh Khadse",
  "Aryan Sunil Patil", "Dhruv Vinod Bhagwat", "Dipti Kishor Nimje", "Divyanshu Raghunath Randkhe",
  "Janvi Santoshsing Chavan", "Jay Anil Bhalerao", "Jitesh Kapil Sangole", "Kartik Anil Prajapati",
  "Khushi Purushottam Ghodakade", "Khushi Santosh Supare", "Krushna Bhaskar Gawande", "Kuljot Gurwant Atwal",
  "Kunal Kailas Nandane", "Lavannya Govind Kaulakar", "Madhuri Gajananrao Hargode", "Mayank Ravindra Chalkhor",
  "Minal Baliram Kirnapure", "Mohit Vilas Meshram", "Namrata Ashokrao Pande", "Nandini Janrao Shindemeshram",
  "Nirbhay Sunil Wankhede", "Nivedita Pankaj Kindarle", "Piyush Awadhut Joge", "Pooja Rajesh Choudhary",
  "Pranay Naresh Bawane", "Prathamesh Yogeshrao Chopkar", "Pratik Prakash Sarode", "Prerna Prakash Kadak",
  "Radha Raorao Padole", "Rohit Rameshwar Ingle", "Rudranee Namdeo Hete", "Ruth Taresh Tayde",
  "Rutushri Harishrao Shembekar", "Sahil Naresh Bhoyar", "Sahil Pandit Meshram", "Samiksha Naresh Kale",
  "Samiksha Satish Meshram", "Sanket Sanjay Chaudhari", "Sayali Teiram Gondule", "Shantanu Vijay Raskar",
  "Sujal Atul Parunde", "Swanandi Nitin Nerkar", "Tejal Pradip Raut", "Tejas Dilip Kailuke",
  "Vaishnavi Ramchandra Ambilkar", "Vanshika Vilas Waghmare", "Vedika Anil Nakshane"
];

const CSECS_STUDENTS = [
  "Abhijit Sudhakar Sonone", "Aishika Pravin Dhongade", "Akhilesh Suresh Gawande", "Aman Sabir Shaha",
  "Arshu Jitendra Meshram", "Ashi Kumari", "Ayush Sandip Kshirsagar", "Ayushi Rajesh Ukey",
  "Bhavesh Prakash Khare", "Bhumika Nayan Thote", "Gaurav Sachin Meshram", "Gitesh Mahendra Bagde",
  "Harshal Ajay Sontakke", "Isha Awadhut Raut", "Ishika Sameer Wankar", "Kasturi Sukesh Damdu",
  "Krish Rahul Landge", "Kunjan Anil Matte", "Lukesh Rajesh Nevait", "Mokshita Santosh Kawale",
  "Nidhi Deepak Zoting", "Parivesh Ravi Mahajan", "Parth Hemantkumar Chapke", "Prachi Kamlesh Rahangdale",
  "Prasad Motiram Vatade", "Prathmesh Vijay Burse", "Pratik Gajanan Lokhande", "Pratik Keshav Nimje",
  "Rajesh Pandurang Rathod", "Rashi Bhupesh Wakale", "Riya Singh", "Rushikesh Gangadhar Kunte",
  "Saksham Bharat Gajbhiye", "Samiksha Dhiraj Nitnaware", "Shantanu Samadhan Shirale", "Sharbani Rakesh Lonare",
  "Shreyas Sunil Puri", "Siddhi Ravindra Meshram", "Srushti Pradip Dange", "Subodh Davanand Bhagat",
  "Suraj Rajesh Misewar", "Swayam Vinod Ghadse", "Tanushree Nishant Bhasarkar", "Tanushree Sachin Borkar",
  "Tejaswini Sunil Dhote", "Vansh Prabhakar Khapekar", "Yamini Ravishankar Rane", "Yash Purushottam Nagpure"
];

// Set initial value on page load
numStudentsInput.value = branchStudentCount[branchSelect.value] || 60;

branchSelect.addEventListener('change', () => {
  const count = branchStudentCount[branchSelect.value] || 60;
  numStudentsInput.value = count;
});

if (subjectSelect) {
  subjectSelect.addEventListener('change', (e) => {
    if (e.target.value === 'Other') {
      customSubjectGroup.style.display = 'flex';
    } else {
      customSubjectGroup.style.display = 'none';
      customSubjectInput.value = '';
    }
  });
}

function recalcEndTime() {
  const duration = parseInt(document.getElementById('duration').value) || 60;
  const sh = parseInt(document.getElementById('start-h').value);
  const sm = parseInt(document.getElementById('start-m').value);
  if (isNaN(sh) || isNaN(sm)) return;
  const endTotalMins = sh * 60 + sm + duration;
  document.getElementById('end-h').value = Math.floor(endTotalMins / 60) % 24;
  document.getElementById('end-m').value = endTotalMins % 60;
}

(function setDefaultTimes() {
  const now = new Date();
  const totalMins = now.getHours() * 60 + now.getMinutes();
  const slotMins = Math.floor(totalMins / 45) * 45;
  document.getElementById('start-h').value = Math.floor(slotMins / 60);
  document.getElementById('start-m').value = slotMins % 60;
  recalcEndTime();
})();

document.getElementById('duration').addEventListener('change', recalcEndTime);
document.getElementById('start-h').addEventListener('input', recalcEndTime);
document.getElementById('start-m').addEventListener('input', recalcEndTime);

setupBtn.addEventListener('click', async () => {
  sessionBranch = branchSelect.value || 'Unknown';
  sessionSubject = subjectSelect.value;
  if (sessionSubject === 'Other') {
    sessionSubject = customSubjectInput.value || 'Custom Subject';
  }

  const sh = parseInt(document.getElementById('start-h').value) || 0;
  const sm = parseInt(document.getElementById('start-m').value) || 0;
  const eh = parseInt(document.getElementById('end-h').value) || 0;
  const em = parseInt(document.getElementById('end-m').value) || 0;
  const fmt = (h, m) => `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  sessionTimeSlot = `${fmt(sh, sm)} - ${fmt(eh, em)}`;
  sessionDate = new Date().toISOString().split('T')[0];

  const numStudents = Math.max(1, parseInt(document.getElementById('num-students').value) || 60);

  setupBtn.innerHTML = 'Loading...';
  setupBtn.disabled = true;

  await initializeStudents(numStudents);
  currentIndex = 0;

  setupBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span> Start Attendance';
  setupBtn.disabled = false;

  renderCard();
  switchScreen('call');
});

function renderCard() {
  progressBar.style.width = `${(currentIndex / studentsList.length) * 100}%`;

  if (currentIndex >= studentsList.length) {
    switchScreen('complete');
    return;
  }

  const student = studentsList[currentIndex];
  const percentage = student.totalClasses === 0 ? 100 : ((student.attendedClasses / student.totalClasses) * 100).toFixed(1);
  const isDefaulter = percentage < 75;

  const cardHtml = `
    <div class="student-card ${isDefaulter ? 'defaulter' : ''} slide-in" id="current-card">
      <div class="card-roll">${student.rollNo}</div>
      <div class="card-name">${student.name}</div>
      <div class="card-status" style="color: ${isDefaulter ? 'var(--absent-btn)' : 'var(--present-btn)'}">
        <span class="material-symbols-outlined">${isDefaulter ? 'warning' : 'check_circle'}</span>
        ${percentage}% Attendance
      </div>
    </div>
  `;

  cardContainer.innerHTML = cardHtml;
}

async function recordAttendance(status, isPresent) {
  triggerHaptic();

  if (currentIndex >= studentsList.length) return;

  const student = studentsList[currentIndex];
  const dateStr = sessionDate;
  const timestampObj = new Date().toISOString();

  await db.attendance.add({
    studentId: student.id,
    date: dateStr,
    status: status,
    timestamp: timestampObj,
    subject: sessionSubject,
    timeSlot: sessionTimeSlot,
    branch: sessionBranch
  });

  await db.queue.add({
    studentId: student.id,
    date: dateStr,
    status: status,
    timestamp: timestampObj,
    subject: sessionSubject,
    timeSlot: sessionTimeSlot,
    branch: sessionBranch
  });

  const updateObj = { totalClasses: student.totalClasses + 1 };
  if (isPresent) updateObj.attendedClasses = student.attendedClasses + 1;
  await db.students.update(student.id, updateObj);

  studentsList[currentIndex] = await db.students.get(student.id);

  const currentCard = document.getElementById('current-card');
  if (currentCard) {
    currentCard.classList.remove('slide-in');
    currentCard.classList.add(status === 'Absent' ? 'slide-out-left' : 'slide-out-right');
  }

  setTimeout(() => {
    currentIndex++;
    renderCard();
  }, 200);
}

btnPresent.addEventListener('click', () => recordAttendance('Present', true));
btnAbsent.addEventListener('click', () => recordAttendance('Absent', false));
btnLate.addEventListener('click', () => recordAttendance('Late', false));
btnLeave.addEventListener('click', () => recordAttendance('Leave', false));

async function undoLast() {
  const lastRecord = await db.queue.orderBy('id').last();
  if (!lastRecord) {
    showToast('Nothing to undo in sync queue');
    return;
  }

  triggerHaptic();

  await db.queue.delete(lastRecord.id);
  const logMatches = await db.attendance.where({ studentId: lastRecord.studentId }).toArray();
  if (logMatches.length > 0) {
    const lastLog = logMatches[logMatches.length - 1];
    await db.attendance.delete(lastLog.id);
  }

  const student = await db.students.get(lastRecord.studentId);
  const isPresent = lastRecord.status === 'Present';
  const updateObj = { totalClasses: Math.max(0, student.totalClasses - 1) };
  if (isPresent) updateObj.attendedClasses = Math.max(0, student.attendedClasses - 1);
  await db.students.update(student.id, updateObj);

  studentsList = await db.students.toArray();

  if (currentIndex > 0) {
    currentIndex--;
  }

  switchScreen('call');
  renderCard();
  showToast(`Undid action for Student ${student.rollNo}`);
}

btnUndoList.forEach(btn => btn.addEventListener('click', undoLast));

async function exportExcel() {
  const { wsData, merges, uniqueDates } = await getJunsuiExportData();

  if (wsData.length === 0) {
    showToast("No data to export!");
    return;
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 10 },
    { wch: 30 },
    ...uniqueDates.map(() => ({ wch: 5 })),
    { wch: 15 },
    { wch: 10 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  const dateStr = new Date().toISOString().split('T')[0];
  const safeSubject = (sessionSubject || "Class").replace(/[^a-z0-9]/gi, '_');
  XLSX.writeFile(wb, `Junsui_Register_${safeSubject}_${dateStr}.xlsx`);

  showToast("Excel downloaded successfully!");
}

btnExportList.forEach(btn => btn.addEventListener('click', exportExcel));
document.getElementById('report-export-btn').addEventListener('click', exportExcel);
document.getElementById('report-pdf-btn').addEventListener('click', exportPDF);

btnNewSession.addEventListener('click', () => {
  switchScreen('setup');
});

// ── REPORT SCREEN ────────────────────────────────────────────
const statusCycle = ['Present', 'Absent', 'Late', 'Leave'];
const statusShort = { 'Present': 'P', 'Absent': 'A', 'Late': 'L', 'Leave': 'Lv', null: 'N/A' };
const statusClass = { 'Present': 'status-P', 'Absent': 'status-A', 'Late': 'status-L', 'Leave': 'status-Lv', null: 'status-NA' };

async function renderReport() {
  const students = await db.students.toArray();
  let allRecords = await db.attendance.toArray();
  if (sessionSubject && sessionSubject !== 'Unknown') {
    allRecords = allRecords.filter(r => r.subject === sessionSubject);
  }
  if (sessionBranch && sessionBranch !== 'Unknown') {
    allRecords = allRecords.filter(r => r.branch === sessionBranch);
  }

  const uniqueDates = [...new Set(allRecords.map(r => r.date))].sort();

  document.getElementById('junsui-reg-branch').innerHTML = `Year: 2025–26 &nbsp;|&nbsp; Sem: II &nbsp;|&nbsp; Branch: ${sessionBranch || 'N/A'}`;
  document.getElementById('junsui-reg-subject').textContent = sessionSubject || '-';
  document.getElementById('junsui-reg-timeSlot').textContent = sessionTimeSlot || '-';
  document.getElementById('junsui-reg-dates').textContent = uniqueDates.length;

  const thead = document.getElementById('junsui-thead');
  const tbody = document.getElementById('junsui-tableBody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  const dateColsCount = Math.max(1, uniqueDates.length);

  const tr1 = document.createElement('tr');
  tr1.innerHTML = `
    <th colspan="2" class="col-name">Student Info</th>
    <th colspan="${dateColsCount}">Lecture Dates</th>
    <th colspan="2">Summary</th>
  `;
  thead.appendChild(tr1);

  const tr2 = document.createElement('tr');
  let tr2Html = `<th class="col-rno">R.No.</th><th class="col-name">Name of Student</th>`;
  if (uniqueDates.length > 0) {
    uniqueDates.forEach(d => {
      const parts = d.split('-');
      const day = parts.length === 3 ? parseInt(parts[2]).toString() : d;
      tr2Html += `<th>${day}</th>`;
    });
  } else {
    tr2Html += `<th>-</th>`;
  }
  tr2Html += `<th>Total<br>Present</th><th>%</th>`;
  tr2.innerHTML = tr2Html;
  thead.appendChild(tr2);

  students.forEach(s => {
    const studentRecords = allRecords.filter(r => r.studentId === s.id);
    const dateMap = {};
    studentRecords.forEach(r => { dateMap[r.date] = r.status || r.statusShort; });

    let presentCount = 0;
    const tr = document.createElement('tr');

    let rnoDisplay = s.rollNo;
    if (s.rollNo && s.rollNo.includes('-')) {
      const parsed = parseInt(s.rollNo.split('-').pop());
      if (!isNaN(parsed)) rnoDisplay = parsed;
    }

    let cells = `<td class="rno">${rnoDisplay}</td><td class="name">${s.name || '—'}</td>`;

    if (uniqueDates.length > 0) {
      uniqueDates.forEach(d => {
        const st = dateMap[d];
        if (st === 'Present') { cells += `<td class="present">P</td>`; presentCount++; }
        else if (st === 'Absent') { cells += `<td class="absent">A</td>`; }
        else if (st === 'Late') { cells += `<td class="late">L</td>`; presentCount++; }
        else if (st === 'Leave') { cells += `<td style="color:#3b82f6;font-weight:600">Lv</td>`; }
        else { cells += `<td style="color:#ccc">—</td>`; }
      });
    } else {
      cells += `<td style="color:#ccc">—</td>`;
    }

    const totalLectures = uniqueDates.length;
    const pct = totalLectures > 0 ? Math.round((presentCount / totalLectures) * 100) : 0;

    cells += `<td class="total-col">${totalLectures > 0 ? presentCount + ' / ' + totalLectures : '—'}</td>`;

    if (totalLectures > 0) {
      let pClass = pct >= 75 ? 'percent-good' : pct >= 60 ? 'percent-warn' : 'percent-bad';
      cells += `<td class="percent-col ${pClass}">${pct}%</td>`;
    } else {
      cells += `<td class="percent-col" style="color:#ccc">—</td>`;
    }

    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
}

function openReport() {
  renderReport();
  switchScreen('report');
}

document.getElementById('report-btn').addEventListener('click', openReport);
document.getElementById('complete-report-btn').addEventListener('click', openReport);
document.getElementById('report-back-btn').addEventListener('click', () => {
  if (currentIndex >= studentsList.length) {
    switchScreen('complete');
  } else {
    switchScreen('call');
  }
});

// ── PDF EXPORT ────────────────────────────────────────────────
async function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const dateStr = sessionDate;
  const students = await db.students.toArray();
  let allRecords = await db.attendance.toArray();
  allRecords = allRecords.filter(r => r.date === dateStr && r.subject === sessionSubject && r.branch === sessionBranch && r.timeSlot === sessionTimeSlot);

  const logoUrl = 'gnit_logo.png';
  let logoBase64 = null;
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    logoBase64 = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) { }

  const pageW = doc.internal.pageSize.getWidth();
  if (logoBase64) doc.addImage(logoBase64, 'PNG', 10, 8, 22, 22);

  doc.setFontSize(14).setFont('helvetica', 'bold');
  doc.text('GURU NANAK INSTITUTE OF TECHNOLOGY', pageW / 2, 14, { align: 'center' });

  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('NAAC ACCREDITED', pageW / 2, 19, { align: 'center' });

  doc.setFontSize(9).setFont('helvetica', 'normal');
  doc.text('Dahegaon, Kalmeshwar Road, Nagpur 441501', pageW / 2, 24, { align: 'center' });
  doc.text('Academic Session 2025-26 (EVEN)', pageW / 2, 28, { align: 'center' });

  doc.setLineWidth(0.5);
  doc.line(10, 32, pageW - 10, 32);

  doc.setFontSize(10).setFont('helvetica', 'bold');
  const sessionTitle = `ROLL LIST - IInd SEM ${sessionBranch === 'CSE' ? 'COMPUTER SCIENCE ENGINEERING' : sessionBranch}`;
  doc.text(sessionTitle, pageW / 2, 40, { align: 'center' });

  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text(`Subject: ${sessionSubject}`, 12, 48);
  doc.text(`Date: ${dateStr}`, 148, 48);
  doc.text(`Time Slot: ${sessionTimeSlot}`, 12, 53);

  const presentCount = allRecords.filter(r => r.status === 'Present').length;
  doc.text(`Present: ${presentCount} / ${students.length}`, 148, 53);

  const tableBody = students.map((s, i) => {
    const rec = allRecords.find(r => r.studentId === s.id);
    const status = rec ? rec.status : 'N/A';

    let rollDisplay = s.rollNo;
    if (sessionBranch === 'CSE') {
      const num = s.rollNo.split('-').pop();
      rollDisplay = `25CSE${num.slice(-2)}`;
    } else if (sessionBranch === 'ETC') {
      const num = s.rollNo.split('-').pop();
      rollDisplay = `25ETC${num.slice(-2)}`;
    } else if (sessionBranch === 'CSE-CS') {
      const num = s.rollNo.split('-').pop();
      rollDisplay = `25CSECS${num.slice(-2)}`;
    }

    const shortStatus = { 'Present': 'P', 'Absent': 'A', 'Late': 'L', 'Leave': 'Lv', 'N/A': '-' }[status] || '-';
    const mark = status === 'Present' ? '✓' : (status === 'N/A' ? '-' : '✗');

    return [i + 1, rollDisplay, s.name, shortStatus, mark];
  });

  doc.autoTable({
    startY: 58,
    head: [['Sr. No.', 'Roll No.', 'Student Name', 'Status', 'Mark']],
    body: tableBody,
    styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1 },
    bodyStyles: { lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 90 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' }
    },
    margin: { left: 10, right: 10 },
  });

  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('Class Teacher', 30, finalY);
  doc.text('HoD', 160, finalY);

  const safeSubject = (sessionSubject || 'Class').replace(/[^a-z0-9]/gi, '_');
  doc.save(`GNIT_Attendance_${sessionBranch}_${safeSubject}_${dateStr}.pdf`);
  showToast('PDF downloaded!');
}

document.getElementById('complete-pdf-btn').addEventListener('click', exportPDF);
