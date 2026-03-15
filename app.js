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
  
  // Load existing names for this branch from registry
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
    
    // Check for custom name (priority: full roll -> short roll)
    let displayName = nameMap[fullRoll] || nameMap[shortRoll];
    
    // Auto-fill CSE names if not already set
    if (!displayName && currentBranch === 'CSE' && CSE_STUDENTS[i-1]) {
      displayName = CSE_STUDENTS[i-1];
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
  'CSE':    44,
  'CSE-DS': 60,
  'CS':     60,
  'AIML':   60,
  'IT':     60,
  'MECH':   60,
  'CIVIL':  60,
  'EE':     60,
  'ETC':    60,
  'Other':  60,
};

const CSE_STUDENTS = [
  "Aaditya Anil Wankhede", "Aditya Pankaj Fule", "Aditya Rajesh Khalode", "Aditya Sunil Dafade",
  "Anjali Sanjay Chutke", "Anjali Vikram Tapre", "Anushka Ravindra Askar", "Ashish Subhashrao Date",
  "Atharva Rakesh Nandgaonkar", "Ayush Jagdish Kekan", "Bhushan Kedar Shende", "Buddhabhushan Vijay Bhalerao",
  "Chaitali Sanjay Adbale", "Darshan Rajendra Rakshak", "Dipali Shivraj Awadhut", "Harshada Sevak Kolhe",
  "Komal Sanjay Pund", "Krushika Raju Masram", "Kuber Nilkanth Peddiwar", "Lucky Ashok Patil",
  "Neha Sitaram Bedre", "Prem Siddharth Tayade", "Prerna Shankar Sasane", "Priyanshu Dhanraj Yerpude",
  "Rohan Ramkishan Khandare", "Sagar Sanjay Chandewar", "Samiksha Gaynath Ingle", "Samir Sudhir Sonune",
  "Samyak Vijay Khobragade", "Sanket Sanjay Pandit", "Sejal Raju Thakare", "Shruti Chandrabhan Raut",
  "Soham Khote", "Soumya Niraj Sable", "Swajal Sandesh Indorkar", "Swarnim Maruti Wadgule",
  "Tanmay Arvind Rithe", "Tanvi Devanand Bhowate", "Triveni Manohar Tarale", "Vedangi Pravin Diware",
  "Vedant Hiralal Patil", "Vidanshu Arun Choudhari", "Yash Suresh Ingale", "Yash Tulshiram Bobade"
];

// Set initial value on page load
numStudentsInput.value = branchStudentCount[branchSelect.value] || 60;

// Default branching behavior
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

// Auto-fill current time snapped to nearest 45-min slot boundary
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

// When user changes duration or start time, auto-update end time
document.getElementById('duration').addEventListener('change', recalcEndTime);
document.getElementById('start-h').addEventListener('input', recalcEndTime);
document.getElementById('start-m').addEventListener('input', recalcEndTime);

// Setup screen flow
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
  const fmt = (h, m) => `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
  sessionTimeSlot = `${fmt(sh, sm)} - ${fmt(eh, em)}`;

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

// Render Student Card
function renderCard() {
  // Update progress
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

// Record Attendance Logic
async function recordAttendance(status, isPresent) {
  triggerHaptic();

  if (currentIndex >= studentsList.length) return;

  const student = studentsList[currentIndex];
  const dateStr = new Date().toISOString().split('T')[0];
  const timestampObj = new Date().toISOString();

  // Push to local DB
  await db.attendance.add({
    studentId: student.id,
    date: dateStr,
    status: status,
    timestamp: timestampObj,
    subject: sessionSubject,
    timeSlot: sessionTimeSlot,
    branch: sessionBranch
  });

  // Update offline queue
  await db.queue.add({
    studentId: student.id,
    date: dateStr,
    status: status,
    timestamp: timestampObj,
    subject: sessionSubject,
    timeSlot: sessionTimeSlot,
    branch: sessionBranch
  });

  // Update student table visually and DB
  const updateObj = { totalClasses: student.totalClasses + 1 };
  if (isPresent) updateObj.attendedClasses = student.attendedClasses + 1;
  await db.students.update(student.id, updateObj);
  
  // Update memory
  studentsList[currentIndex] = await db.students.get(student.id);

  // Transition Animation
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

// Bind attendance buttons
btnPresent.addEventListener('click', () => recordAttendance('Present', true));
btnAbsent.addEventListener('click', () => recordAttendance('Absent', false));
btnLate.addEventListener('click', () => recordAttendance('Late', false));
btnLeave.addEventListener('click', () => recordAttendance('Leave', false));

// Undo Functionality
async function undoLast() {
  const lastRecord = await db.queue.orderBy('id').last();
  if (!lastRecord) {
    showToast('Nothing to undo in sync queue');
    return;
  }

  triggerHaptic();

  // Delete from queue and log
  await db.queue.delete(lastRecord.id);
  const logMatches = await db.attendance.where({studentId: lastRecord.studentId}).toArray();
  if(logMatches.length > 0) {
    const lastLog = logMatches[logMatches.length - 1]; // naive fetch
    await db.attendance.delete(lastLog.id);
  }

  // Revert Student DB values
  const student = await db.students.get(lastRecord.studentId);
  const isPresent = lastRecord.status === 'Present';
  const updateObj = { totalClasses: Math.max(0, student.totalClasses - 1) };
  if (isPresent) updateObj.attendedClasses = Math.max(0, student.attendedClasses - 1);
  await db.students.update(student.id, updateObj);

  // Reload students buffer
  studentsList = await db.students.toArray();

  if (currentIndex > 0) {
    currentIndex--;
  }
  
  switchScreen('call');
  renderCard();
  showToast(`Undid action for Student ${student.rollNo}`);
}

btnUndoList.forEach(btn => btn.addEventListener('click', undoLast));

// Export Data
async function exportExcel() {
  const students = studentsList;
  let allRecords = await db.attendance.toArray();
  
  if (sessionSubject && sessionSubject !== 'Unknown') {
    allRecords = allRecords.filter(r => r.subject === sessionSubject);
  }
  if (sessionBranch && sessionBranch !== 'Unknown') {
    allRecords = allRecords.filter(r => r.branch === sessionBranch);
  }
  
  const data = [];
  
  for (const s of students) {
    const records = allRecords.filter(r => r.studentId === s.id);
    const totalClass = records.length;
    const attendedClass = records.filter(r => r.status === 'Present').length;
    const percentage = totalClass > 0 ? ((attendedClass / totalClass) * 100).toFixed(2) + '%' : '0.00%';
    
    const row = {
      "Roll No": s.rollNo,
      "Name": s.name,
      "Branch": sessionBranch || "N/A",
      "Total Classes": totalClass,
      "Attended": attendedClass,
      "Percentage": percentage
    };
    
    const statusMap = {
      "Present": "P",
      "Absent": "A",
      "Late": "L",
      "Leave": "Lv"
    };
    
    for (const r of records) {
      row[r.date] = statusMap[r.status] || "-";
    }
    
    data.push(row);
  }
  
  if (data.length === 0) {
    showToast("No data to export!");
    return;
  }
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  
  const dateStr = new Date().toISOString().split('T')[0];
  const safeSubject = (sessionSubject || "Class").replace(/[^a-z0-9]/gi, '_');
  XLSX.writeFile(wb, `RTMNU_Attendance_${safeSubject}_${dateStr}.xlsx`);
  
  showToast("Excel downloaded successfully!");
}

btnExportList.forEach(btn => btn.addEventListener('click', exportExcel));
document.getElementById('report-export-btn').addEventListener('click', exportExcel);
document.getElementById('report-pdf-btn').addEventListener('click', exportPDF);

// Reset Session
btnNewSession.addEventListener('click', () => {
  switchScreen('setup');
});

// ── REPORT SCREEN ────────────────────────────────────────────
const statusCycle = ['Present', 'Absent', 'Late', 'Leave'];
const statusShort = { 'Present': 'P', 'Absent': 'A', 'Late': 'L', 'Leave': 'Lv', null: 'N/A' };
const statusClass = { 'Present': 'status-P', 'Absent': 'status-A', 'Late': 'status-L', 'Leave': 'status-Lv', null: 'status-NA' };

async function renderReport() {
  const dateStr = new Date().toISOString().split('T')[0];
  const students = await db.students.toArray();
  let todayRecords = await db.attendance.toArray();
  todayRecords = todayRecords.filter(r =>
    r.date === dateStr &&
    r.subject === sessionSubject &&
    r.branch === sessionBranch
  );

  const meta = document.getElementById('report-meta');
  meta.textContent = `${sessionBranch} · ${sessionSubject} · ${sessionTimeSlot} · ${dateStr}`;

  const tbody = document.getElementById('report-body');
  tbody.innerHTML = '';

  students.forEach((s, idx) => {
    const rec = todayRecords.find(r => r.studentId === s.id) || null;
    const status = rec ? rec.status : null;
    const badge = statusShort[status];
    const cls = statusClass[status];

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${s.rollNo}</td>
      <td>${s.name}</td>
      <td>
        <span class="status-badge ${cls}" data-student-id="${s.id}" data-rec-id="${rec ? rec.id : ''}" data-status="${status || ''}">
          ${badge}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Inline edit: tap badge to cycle status
  tbody.querySelectorAll('.status-badge').forEach(badge => {
    badge.addEventListener('click', async () => {
      const studentId = parseInt(badge.dataset.studentId);
      const recId = parseInt(badge.dataset.recId) || null;
      const currentStatus = badge.dataset.status || null;

      const nextIdx = currentStatus ? (statusCycle.indexOf(currentStatus) + 1) % statusCycle.length : 0;
      const newStatus = statusCycle[nextIdx];
      const dateStr = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString();

      if (recId) {
        // Update existing record
        await db.attendance.update(recId, { status: newStatus });
        // Revert old student stat
        const student = await db.students.get(studentId);
        const wasPresent = currentStatus === 'Present';
        const isNowPresent = newStatus === 'Present';
        let totalDelta = 0, attendDelta = 0;
        if (wasPresent && !isNowPresent) attendDelta = -1;
        if (!wasPresent && isNowPresent) attendDelta = 1;
        await db.students.update(studentId, {
          attendedClasses: Math.max(0, student.attendedClasses + attendDelta)
        });
      } else {
        // First time marking this student
        const newId = await db.attendance.add({
          studentId, date: dateStr, status: newStatus,
          timestamp, subject: sessionSubject, timeSlot: sessionTimeSlot, branch: sessionBranch
        });
        badge.dataset.recId = newId;
        const student = await db.students.get(studentId);
        await db.students.update(studentId, {
          totalClasses: student.totalClasses + 1,
          attendedClasses: student.attendedClasses + (newStatus === 'Present' ? 1 : 0)
        });
      }

      // Update badge UI
      badge.dataset.status = newStatus;
      badge.textContent = statusShort[newStatus];
      badge.className = `status-badge ${statusClass[newStatus]}`;
      studentsList = await db.students.toArray();
      triggerHaptic();
    });
  });
}

// Wire up report button visibility
function openReport() {
  renderReport();
  switchScreen('report');
}

document.getElementById('report-btn').addEventListener('click', openReport);
document.getElementById('complete-report-btn').addEventListener('click', openReport);
document.getElementById('report-back-btn').addEventListener('click', () => {
  // Go back to wherever we came from
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

  const dateStr = new Date().toISOString().split('T')[0];
  const students = await db.students.toArray();
  let allRecords = await db.attendance.toArray();
  allRecords = allRecords.filter(r => r.subject === sessionSubject && r.branch === sessionBranch);

  // Load GNIT logo as base64
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
  } catch(e) {}

  // --- Header ---
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

  // --- Session Info ---
  doc.setFontSize(10).setFont('helvetica', 'bold');
  const sessionTitle = `ROLL LIST - IInd SEM ${sessionBranch === 'CSE' ? 'COMPUTER SCIENCE ENGINEERING' : sessionBranch}`;
  doc.text(sessionTitle, pageW / 2, 40, { align: 'center' });

  doc.setFontSize(9).setFont('helvetica', 'bold');
  doc.text(`Subject: ${sessionSubject}`, 12, 48);
  doc.text(`Date: ${dateStr}`, 148, 48);
  doc.text(`Time Slot: ${sessionTimeSlot}`, 12, 53);
  
  const presentCount = allRecords.filter(r => r.status === 'Present').length;
  doc.text(`Present: ${presentCount} / ${students.length}`, 148, 53);

  // --- Table ---
  const tableBody = students.map((s, i) => {
    const rec = allRecords.find(r => r.studentId === s.id);
    const status = rec ? rec.status : 'N/A';
    // Format roll like 25CSE01
    let rollDisplay = s.rollNo;
    if (sessionBranch === 'CSE') {
      const num = s.rollNo.split('-').pop();
      rollDisplay = `25CSE${num.slice(-2)}`;
    }

    return [
      i + 1,
      rollDisplay,
      s.name,
      status === 'Present' ? 'P' : (status === 'Absent' ? 'A' : (status === 'Late' ? 'L' : 'Lv')),
      status === 'Present' ? '✓' : '✗'
    ];
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

  // --- Footer ---
  const finalY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(10).setFont('helvetica', 'bold');
  doc.text('Class Teacher', 30, finalY);
  doc.text('HoD', 160, finalY);

  // Download
  const safeSubject = (sessionSubject || 'Class').replace(/[^a-z0-9]/gi, '_');
  doc.save(`GNIT_Attendance_${sessionBranch}_${safeSubject}_${dateStr}.pdf`);
  showToast('PDF downloaded!');
}

document.getElementById('complete-pdf-btn').addEventListener('click', exportPDF);

