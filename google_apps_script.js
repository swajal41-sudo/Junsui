function doPost(e) {
  try {
    // We parse the incoming string data from the POST request
    var data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      // Fallback if data is sent via parameter
      data = JSON.parse(e.parameter.data);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Create or get the sheet named after the subject + date
    var sheetName = data.sheetName || "Attendance";
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear(); // Clear old data if same sheet exists
    }

    // Set the 2D array of data (Junsui Format)
    if (data.wsData && data.wsData.length > 0) {
      // Ensure all rows in wsData have the same length so setValues doesn't crash
      var maxCols = 0;
      for (var r = 0; r < data.wsData.length; r++) {
        if (data.wsData[r].length > maxCols) {
          maxCols = data.wsData[r].length;
        }
      }
      for (var r = 0; r < data.wsData.length; r++) {
        while (data.wsData[r].length < maxCols) {
          data.wsData[r].push("");
        }
      }
      
      sheet.getRange(1, 1, data.wsData.length, maxCols).setValues(data.wsData);
    }

    // Apply cell merges to match the Junsui UI format
    if (data.merges && data.merges.length > 0) {
      for (var i = 0; i < data.merges.length; i++) {
        var m = data.merges[i];
        // SheetJS merges use 0-indexed, Google Sheets uses 1-indexed
        var startRow = m.s.r + 1;
        var startCol = m.s.c + 1;
        var numRows = m.e.r - m.s.r + 1;
        var numCols = m.e.c - m.s.c + 1;
        
        sheet.getRange(startRow, startCol, numRows, numCols).merge();
      }
    }

    // Basic styling
    sheet.getRange("A1:Z5").setHorizontalAlignment("center").setFontWeight("bold");

    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Data added successfully!" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  // If someone accidentally opens the Web App URL in browser, returning simple text avoids showing a weird website.
  return ContentService.createTextOutput("Junsui Google Sheets API is running securely.")
    .setMimeType(ContentService.MimeType.TEXT);
}
