# 🎓 GNIT Attendance Pro 📊

**A premium, offline-first attendance management system for Guru Nanak Institute of Technology.**

Built with a focus on speed, aesthetics, and accuracy, this tool allows faculty to mark attendance quickly through an interactive card-swipe interface and generate official department reports instantly.

---

## 🌟 Vision
This project was developed to eliminate the friction of manual attendance paper-sheets. It’s not just a demo; it’s a **production-ready tool** that I use daily for taking real-time attendance in my classes. The design is inspired by modern glassmorphism trends to make a "boring" task feel futuristic and engaging.

## 🚀 Key Highlights

### ⚡ Performance & UX
- **Card-Style Marking**: Mark attendance using an interactive UI—swipe or tap for Present/Absent.
- **Glassmorphism Design**: High-end visuals using translucent panels, background blurs, and HSL-tailored colors.
- **Haptic Feedback**: Integrated vibration cues for every action, providing a tactile feel on mobile devices.

### 💾 Engineering Excellence
- **True Offline Support**: Powered by **Dexie.js (IndexedDB)**. Your data lives in the browser; no internet, no problem.
- **Multi-Department Support**: Pre-seeded with official rosters for:
  - **CSE 2nd Sem** (44 students)
  - **Cyber Security** (Complete batch)
  - **Additional branches** ready for expansion




### 📄 Official Compliance
- **One-Click PDF Export**: Generates a PDF formatted exactly like the official GNIT roll-lists, including:
  - Department Header (NAAC Accredited branding).
  - Academic Session details.
  - Signature blocks for Class Teacher and HoD.
- **Excel Export**: Clean `.xlsx` spreadsheets for HOD/Office submissions.

### ☁️ Cloud Integration
- **Google Sheets Sync**: Seamlessly sync attendance data to Google Sheets via Google Apps Script Web App integration.
- **Real-time Backup**: Your attendance records are automatically backed up to the cloud while maintaining offline-first functionality.
- **Collaborative Access**: Share live attendance sheets with HODs and administrative staff.

## 🛠️ Tech Stack
- **Languages**: HTML5, CSS3, JavaScript (ES6+).
- **Frameworks**: None! (Vanilla JS for maximum performance).
- **Database**: [Dexie.js](https://dexie.org/) (IndexedDB wrapper).
- **Reporting**: [SheetJS](https://sheetjs.com/) (Excel) & [jsPDF](https://github.com/parallax/jsPDF) (PDF).

## 📥 Installation & Deployment
Since this is a client-side application, you can deploy it for free on **GitHub Pages**:
1. Push this repository to GitHub.
2. Go to **Settings > Pages**.
3. Select the `main` branch and `/root` folder.
4. Your site is live!

---
- **Cloud Integration**: Google Apps Script Web App for Sheets API integration.


## 👨‍💻 Developer
Developed and maintained by **Swajal Indorkar**  
*Dept. of Computer Science & Engineering, GNIT Nagpur*

> "Building tools that solve real-world problems, one line of code at a time."

---
*License: MIT | © 2026 Swajal*
