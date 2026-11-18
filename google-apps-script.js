/**
 * [밀리핏 트래커 - 구글 스프레드시트 웹 앱 호스팅 및 연동 Code.gs]
 */

function doGet(e) {
  // 사용자가 브라우저에서 웹 앱 링크(https://script.google.com/.../exec) 접속 시
  // 구글 클라우드에서 밀리핏 트래커 웹사이트를 실시간 호스팅하여 표출!
  return HtmlService.createHtmlOutputFromFile('Index')
  // 사용자가 대문자(Index), 소문자(index), 확장자(Index.html) 중 어떻게 만들었든 100% 자동 인식
  var output;
  try {
    output = HtmlService.createHtmlOutputFromFile('Index');
  } catch (err1) {
    try {
      output = HtmlService.createHtmlOutputFromFile('index');
    } catch (err2) {
      try {
        output = HtmlService.createHtmlOutputFromFile('Index.html');
      } catch (err3) {
        output = HtmlService.createHtmlOutput("<h3>[오류] 좌측 파일 목록에 Index HTML 파일이 없습니다.</h3><p>좌측 '+' 버튼 -> HTML 선택 -> 이름을 'Index'로 입력하고 gas-index.html 내용을 붙여넣어 주세요.</p>");
      }
    }
  }

  return output
    .setTitle('밀리핏 트래커 | 육군 3대 체력검정 & 체급 대시보드')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function setupHeadersIfNeeded(sheet) {
  if (sheet.getLastRow() === 0) {
    var headers = ["등록일시", "측정일자", "체중(kg)", "3km 뜀걸음", "3km 초", "팔굽혀펴기(회)", "윗몸일으키기(회)", "종합등급", "메모"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setBackground("#1E293B").setFontColor("#FFFFFF").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

// 웹 대시보드에서 새 기록 저장 시 호출 (다이렉트 서버 함수)
function addRecordServer(rec) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("체력기록") || ss.getSheets()[0];
  setupHeadersIfNeeded(sheet);
  sheet.appendRow([
    new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    rec.date,
    rec.weight,
    rec.runTimeFormatted,
    rec.runSec,
    rec.pushup,
    rec.situp,
    rec.overallGrade,
    rec.notes || ""
  ]);
  return { status: "success" };
}

// 웹 대시보드에서 기록 가져오기 시 호출
function getRecordsServer() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("체력기록") || ss.getSheets()[0];
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  return values.map(function(row, idx) {
    var d = row[1] instanceof Date ? Utilities.formatDate(row[1], "Asia/Seoul", "yyyy-MM-dd") : String(row[1]);
    return {
      id: "sheet_" + (idx + 1),
      date: d,
      weight: parseFloat(row[2]) || 0,
      runSec: parseInt(row[4], 10) || 0,
      pushup: parseInt(row[5], 10) || 0,
      situp: parseInt(row[6], 10) || 0,
      overallGrade: String(row[7] || ""),
      notes: String(row[8] || "")
    };
  });
}

// 일괄 동기화 시 호출
function batchSyncServer(records) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("체력기록") || ss.getSheets()[0];
  setupHeadersIfNeeded(sheet);
  records.forEach(function(rec) {
    sheet.appendRow([
      new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      rec.date,
      rec.weight,
      rec.runTimeFormatted,
      rec.runSec,
      rec.pushup,
      rec.situp,
      rec.overallGrade,
      rec.notes || ""
    ]);
  });
  return { status: "success", count: records.length };
}

// 외부 로컬 HTML에서 전송 시 호환성 유지
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === 'batchSync') {
      var res = batchSyncServer(data.records);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    } else {
      var r = data.record || data;
      var res = addRecordServer(r);
      return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
