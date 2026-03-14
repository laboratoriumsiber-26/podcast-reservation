/**
 * PodReserve - Self-Initializing Backend
 * This script automatically creates the necessary Sheet and Folder if they don't exist.
 */

const CONFIG = {
  SPREADSHEET_NAME: "PodReserve_Database",
  UPLOADS_FOLDER_NAME: "PodReserve_Letters",
  SHEETS: {
    BOOKINGS: "Bookings",
    SETTINGS: "Settings",
    STUDIOS: "Studios"
  }
};

function init() {
  let ss;
  const files = DriveApp.getFilesByName(CONFIG.SPREADSHEET_NAME);
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
    console.log("Created new Spreadsheet: " + CONFIG.SPREADSHEET_NAME);
  }
  
  // Setup Bookings Sheet
  setupSheet(ss, CONFIG.SHEETS.BOOKINGS, [
    "ID", "Studio ID", "Student Name", "Student ID", "User Type", 
    "Phone", "Organization", "Letter URL", "Date", "Start Time", 
    "End Time", "Status", "Timestamp"
  ]);
  
  // Setup Settings Sheet
  let settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(CONFIG.SHEETS.SETTINGS);
    settingsSheet.appendRow(["Key", "Value"]);
    settingsSheet.appendRow(["available_dates", "[]"]);
    settingsSheet.setFrozenRows(1);
    settingsSheet.getRange(1, 1, 1, 2).setFontWeight("bold").setBackground("#f3f3f3");
  }
  
  // Setup Studios Sheet
  let studiosSheet = ss.getSheetByName(CONFIG.SHEETS.STUDIOS);
  let isNewStudiosSheet = !studiosSheet;
  if (!studiosSheet) {
    studiosSheet = ss.insertSheet(CONFIG.SHEETS.STUDIOS);
    studiosSheet.appendRow(["ID", "Name", "Description", "Image URL", "Capacity"]);
    studiosSheet.setFrozenRows(1);
    studiosSheet.getRange(1, 1, 1, 5).setFontWeight("bold").setBackground("#f3f3f3");
    
    // Seed data
    const seedStudios = [
      [1, "Podcast Studio 1", "Professional Setup: 4 Chairs, 3 Cameras, 2 Lighting, High Quality Audio Setup.", "https://picsum.photos/seed/studio1/800/600", 4],
      [2, "Podcast Studio 2", "Professional Setup: 4 Chairs, 3 Cameras, 2 Lighting, High Quality Audio Setup.", "https://picsum.photos/seed/studio2/800/600", 4],
      [3, "Podcast Studio 3", "Professional Setup: 4 Chairs, 3 Cameras, 2 Lighting, Video Podcast Ready.", "https://picsum.photos/seed/studio3/800/600", 4],
      [4, "Podcast Studio 4", "Relaxed Setup: Comfortable sofa, lounge atmosphere, great for casual talk and light discussion.", "https://picsum.photos/seed/studio4/800/600", 6]
    ];
    seedStudios.forEach(s => studiosSheet.appendRow(s));
  }
  
  // Setup Uploads Folder
  let folder;
  const folders = DriveApp.getFoldersByName(CONFIG.UPLOADS_FOLDER_NAME);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(CONFIG.UPLOADS_FOLDER_NAME);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    console.log("Created new Folder: " + CONFIG.UPLOADS_FOLDER_NAME);
  }
  
  // Store IDs in Script Properties for faster access
  const props = PropertiesService.getScriptProperties();
  props.setProperty('SS_ID', ss.getId());
  props.setProperty('FOLDER_ID', folder.getId());
  
  return {
    success: true,
    spreadsheetId: ss.getId(),
    folderId: folder.getId(),
    message: "Backend initialized successfully"
  };
}

function setupSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
  }
  return sheet;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const props = PropertiesService.getScriptProperties();
    
    if (!props.getProperty('SS_ID') || action === 'init') {
      const initResult = init();
      if (action === 'init') return jsonResponse(initResult);
    }
    
    const ss = SpreadsheetApp.openById(props.getProperty('SS_ID'));
    const folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID'));

    if (action === 'create') {
      const sheet = ss.getSheetByName(CONFIG.SHEETS.BOOKINGS);
      let fileUrl = "";
      
      if (data.fileData && data.fileName) {
        const blob = Utilities.newBlob(Utilities.base64Decode(data.fileData), 'application/pdf', data.fileName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();
      }
      
      const newId = new Date().getTime();
      
      sheet.appendRow([
        newId, data.studio_id, data.student_name, data.student_id, data.user_type,
        "'" + data.phone_number, data.organization, fileUrl, data.date, data.start_time,
        data.end_time, data.status || 'pending', new Date()
      ]);
      return jsonResponse({ result: 'success', success: true, fileUrl: fileUrl, id: newId });
    }

    if (action === 'updateStatus' || action === 'update') {
      const sheet = ss.getSheetByName(CONFIG.SHEETS.BOOKINGS);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0].toString() === data.id.toString()) {
          sheet.getRange(i + 1, 12).setValue(data.status);
          return jsonResponse({ result: 'success', success: true });
        }
      }
      return jsonResponse({ error: 'Booking ID not found' });
    }

    if (action === 'delete') {
      const sheet = ss.getSheetByName(CONFIG.SHEETS.BOOKINGS);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0].toString() === data.id.toString()) {
          sheet.deleteRow(i + 1);
          return jsonResponse({ result: 'success', success: true });
        }
      }
      return jsonResponse({ error: 'Booking ID not found' });
    }

    if (action === 'updateAvailableDates') {
      const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
      sheet.getRange("B2").setValue(JSON.stringify(data.dates));
      return jsonResponse({ success: true });
    }

    if (action === 'createStudio') {
      const sheet = ss.getSheetByName(CONFIG.SHEETS.STUDIOS);
      const newId = new Date().getTime();
      sheet.appendRow([
        newId, data.name, data.description, data.image_url || `https://picsum.photos/seed/${newId}/800/600`, data.capacity || 4
      ]);
      return jsonResponse({ result: 'success', success: true, id: newId });
    }

    if (action === 'updateStudio') {
      const sheet = ss.getSheetByName(CONFIG.SHEETS.STUDIOS);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0].toString() === data.id.toString()) {
          sheet.getRange(i + 1, 2).setValue(data.name);
          sheet.getRange(i + 1, 3).setValue(data.description);
          if (data.image_url) sheet.getRange(i + 1, 4).setValue(data.image_url);
          sheet.getRange(i + 1, 5).setValue(data.capacity);
          return jsonResponse({ result: 'success', success: true });
        }
      }
      return jsonResponse({ error: 'Studio ID not found' });
    }

    if (action === 'deleteStudio') {
      const bookingsSheet = ss.getSheetByName(CONFIG.SHEETS.BOOKINGS);
      const bRows = bookingsSheet.getDataRange().getValues();
      for (let i = 1; i < bRows.length; i++) {
        if (bRows[i][1].toString() === data.id.toString()) {
          return jsonResponse({ success: false, error: 'Cannot delete studio with existing bookings.' }, 400); 
        }
      }
      
      const sheet = ss.getSheetByName(CONFIG.SHEETS.STUDIOS);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0].toString() === data.id.toString()) {
          sheet.deleteRow(i + 1);
          return jsonResponse({ result: 'success', success: true });
        }
      }
      return jsonResponse({ error: 'Studio ID not found' });
    }

    return jsonResponse({ error: 'Invalid action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet(e) {
  try {
    // Handling preflight for some environments, though GAS manages this mostly
    const action = e.parameter.action;
    const props = PropertiesService.getScriptProperties();
    let ssId = props.getProperty('SS_ID');
    
    if (!ssId) {
      const initResult = init();
      ssId = initResult.spreadsheetId;
    }
    
    const ss = SpreadsheetApp.openById(ssId);

    if (action === 'read' || action === 'getBookings') {
      const sheet = ss.getSheetByName(CONFIG.SHEETS.BOOKINGS);
      const rows = sheet.getDataRange().getValues();
      const data = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        data.push({
          id: row[0],
          studio_id: row[1],
          student_name: row[2],
          student_id: row[3],
          user_type: row[4],
          phone_number: row[5].toString().replace(/^'/, ''),
          organization: row[6],
          drive_url: row[7],
          date: row[8] instanceof Date ? Utilities.formatDate(row[8], Session.getScriptTimeZone(), "yyyy-MM-dd") : row[8],
          start_time: row[9],
          end_time: row[10],
          status: row[11]
        });
      }
      return jsonResponse(data);
    }
    
    if (action === 'getStudios') {
      const sheet = ss.getSheetByName(CONFIG.SHEETS.STUDIOS);
      const rows = sheet.getDataRange().getValues();
      const data = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        data.push({
          id: row[0],
          name: row[1],
          description: row[2],
          image_url: row[3],
          capacity: row[4]
        });
      }
      return jsonResponse(data);
    }

    if (action === 'getSettings') {
      const sheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
      const data = sheet.getDataRange().getValues();
      return jsonResponse({ available_dates: data.length > 1 ? data[1][1] : "[]" });
    }
    
    // Fallback if no action is provided (just for health check)
    if (!action) {
      return jsonResponse({ status: "Google Apps Script Backend is Running" });
    }
    
    return jsonResponse({ error: 'Invalid action: ' + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(obj, statusCode) {
  // We can't actually set HTTP status codes manually in GAS easily like Express,
  // but we return the object as JSON.
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
