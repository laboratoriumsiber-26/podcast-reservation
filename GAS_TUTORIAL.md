# Google Sheets Integration Guide (Google Apps Script)

To ensure real-time data synchronization between the PodReserve web app and Google Sheets, follow these steps:

## 1. Prepare Google Sheets
1. Create a new Google Sheet.
2. You don't need to name the sheet or create headers; the script will do it for you!

## 2. Install Google Apps Script
1. In your Google Sheet, click **Extensions** > **Apps Script**.
2. Delete any existing code and replace it with the following:

```javascript
/**
 * Google Apps Script for PodReserve Studio System
 * Handles real-time synchronization and Google Drive uploads.
 */

// 1. Function to FETCH data from Spreadsheet to Application
function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var data = [];
  
  for (var i = 1; i < rows.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var headerName = headers[j];
      var value = rows[i][j];
      
      if (headerName === "ID Reservasi") obj.id = value;
      else if (headerName === "Nama Lengkap") obj.student_name = value;
      else if (headerName === "NIM") obj.student_id = value;
      else if (headerName === "Nomor WhatsApp") obj.phone_number = value;
      else if (headerName === "Organisasi/Identitas") obj.organization = value;
      else if (headerName === "Studio") obj.studio_name = value;
      else if (headerName === "Tanggal") {
        obj.date = value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd") : value;
      }
      else if (headerName === "Waktu Sesi") {
        var times = value.toString().split(" - ");
        if (times.length === 2) {
          obj.start_time = times[0];
          obj.end_time = times[1];
        }
      }
      else if (headerName === "Link Google Drive (PDF)") obj.drive_url = value;
      else if (headerName === "Status") {
        var s = value.toString().toLowerCase();
        obj.status = (s === 'acc' || s === 'confirmed') ? 'confirmed' : 'pending';
      }
    }
    data.push(obj);
  }
  
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// 2. Function to RECEIVE data from Application to Spreadsheet
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var folderName = "Surat Permohonan Studio";
  
  // Headers adjusted to include WhatsApp Number
  var headers = ["ID Reservasi", "Nama Lengkap", "NIM", "Nomor WhatsApp", "Organisasi/Identitas", "Studio", "Tanggal", "Waktu Sesi", "Link Google Drive (PDF)", "Status", "Waktu Input Data"];
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }
  
  try {
    var data = JSON.parse(e.postData.contents);
    var driveFileUrl = "No file";

    if (data.fileData && data.fileName) {
      var folders = DriveApp.getFoldersByName(folderName);
      var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
      var decodedFile = Utilities.base64Decode(data.fileData);
      var blob = Utilities.newBlob(decodedFile, 'application/pdf', data.fileName);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      driveFileUrl = file.getUrl();
    }
    
    // REVISION: Add ' prefix so leading zeros are not lost in Spreadsheet
    var safePhoneNumber = "'" + data.phone_number;
    
    var row = [
      data.id,
      data.student_name,
      data.student_id,
      safePhoneNumber, // WA Number is now safe as text
      data.organization,
      data.studio_name,
      data.date,
      data.start_time + " - " + data.end_time,
      driveFileUrl,
      "pending",
      new Date()
    ];
    
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({"result": "success", "fileUrl": driveFileUrl}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({"result": "error", "error": err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

## 3. Deploy Script
1. Click **Deploy** > **New deployment**.
2. Select **Web app**.
3. Description: "PodReserve API".
4. Execute as: **Me**.
5. Who has access: **Anyone**. (Crucial for the server to access it).
6. Click **Deploy**.
7. Copy the **Web App URL**.

## 4. Update Server Configuration
1. Open `server.ts` in your project.
2. Find the `SCRIPT_URL` variable and replace its value with your new Web App URL:
   `https://script.google.com/macros/s/AKfycbzhVBVOf2rih2yAq_7_Ogrwdig-0WCCD_ypKhf_av_ZaEHjv2uj3fnoIZnUw1kmC5GV/exec`

## 5. Done!
Now every new booking will be automatically synced to your Google Sheet in real-time. The system will create the "Bookings" sheet and all necessary headers automatically on the first request.
