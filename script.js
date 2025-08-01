// script.js - 前端應用程式的所有 JavaScript 邏輯 (部署於 GitHub Pages)

// ★★★ ！！！重要：請務必將此 URL 替換為您的 Apps Script 後端部署的 /exec URL ！！！ ★★★
// 格式通常為：https://script.google.com/macros/s/AKfycbz_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec
const APPS_SCRIPT_API_EXEC_URL = 'https://script.google.com/macros/s/AKfycbxp2WXQWDTFDTMlm7OLYNb7-XNxlbJ_Dm890sYNHBDaxGgFEeS3_YqM74tX65Q1Y8O9/exec'; 

// DOM 元素引用
const appContent = document.getElementById('app-content');
const loaderOverlay = document.getElementById('loader-overlay');
const loaderMessage = document.getElementById('loader-message');

/**
 * 顯示應用程式載入疊層和訊息。
 * @param {string} message - 顯示給用戶的訊息。
 */
function showLoader(message = '載入中...') {
  loaderMessage.textContent = message;
  loaderOverlay.classList.remove('hidden'); 
}

/**
 * 隱藏應用程式載入疊層。
 */
function hideLoader() {
  loaderOverlay.classList.add('hidden'); 
}

/**
 * 通用的 API 呼叫器。所有前端 (在 GitHub Pages 運行) 與 Apps Script 後端 (API) 的通訊都透過此函式進行。
 * @param {string} action - 後端要執行的 API Action 名稱。
 * @param {object} params - 傳遞給後端 Action 的參數物件。
 * @returns {Promise<any>} Promise，成功時返回後端 `data` 部分，失敗時拋出錯誤。
 */
async function callApi(action, params = {}) {
  // 在 API 呼叫前檢查後端 URL 是否已配置
  if (APPS_SCRIPT_API_EXEC_URL === 'YOUR_DEPLOYED_APPS_SCRIPT_EXEC_URL_HERE' || 
      !APPS_SCRIPT_API_EXEC_URL.startsWith('https://script.google.com/macros/s/') || 
      !APPS_SCRIPT_API_EXEC_URL.endsWith('/exec')) {
      throw new Error("後端 API URL 未正確配置！請打開 script.js 填寫 APPS_SCRIPT_API_EXEC_URL。");
  }

  // 驗證 `action` 參數必須是一個非空的字串
  if (typeof action !== 'string' || !action) {
    console.error("callApi 錯誤：'action' 必須是非空字串。", { action, params });
    throw new Error("API 呼叫錯誤：Action 名稱格式不正確。");
  }
  
  // 自動附加 Session Token (如果存在於 localStorage)
  const token = localStorage.getItem('sessionToken');
  if (token) params.token = token; 
  
  // 將請求的 Action 和參數物件轉換為 JSON 字串作為請求體
  const requestBody = JSON.stringify({ action, params });

  // 執行 Fetch API 請求
  try {
    const response = await fetch(APPS_SCRIPT_API_EXEC_URL, { 
      method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody
    });

    // 檢查 HTTP 響應的狀態碼。如果 `response.ok` 為 `false` (即 4xx 或 5xx 錯誤)
    if (!response.ok) { 
      const errorResponseText = await response.text(); // 嘗試讀取伺服器回傳的文字內容 (可能是 HTML 錯誤頁)
      console.error(`伺服器 HTTP 錯誤 ${response.status}:`, errorResponseText);
      throw new Error(`伺服器連線錯誤：狀態碼 ${response.status}。\n詳細：${errorResponseText.substring(0,200)}...`);
    }
    
    const result = await response.json(); // 解析伺服器回傳的 JSON 數據
    // 檢查後端業務邏輯層的 `success` 狀態。如果後端明確標示業務失敗
    if (!result.success) { 
      throw new Error(result.message || 'API 請求處理失敗，後端未提供具體錯誤訊息。');
    }
    return result.data; // 返回成功請求的 `data` 部分
  } catch (networkOrParsingError) {
    console.error("Fetch API 執行失敗:", networkOrParsingError);
    throw new Error(`網絡或 API 呼叫失敗：${networkOrParsingError.message}`);
  }
}

/**
 * 載入指定頁面（HTML 片段）的內容到主內容區域，並執行其內嵌腳本。
 * 此函式在單頁應用程式中實現前端路由。
 * @param {string} pageName - 要載入的頁面名稱 ('Public', 'Login', 'Admin')。
 */
async function loadPage(pageName) {
  showLoader(`載入 ${pageName} 頁面中...`); // 顯示載入動畫和訊息

  try {
    // 由於我們將頁面內容獨立成了 HTML 檔案（並會通過 `fetch` 載入），
    // 這裡 `callApi('getPageContent')` 的作用從 Apps Script 直接返回 HTML 片段
    // 轉變為從 GitHub Pages 加載相對路徑的 HTML 文件。
    // 但是為了與 Apps Script 的 API 模式兼容，並且讓這個 `script.js` 檔案能夠動態獲取頁面，
    // 我們可以模擬 `callApi('getPageContent')` 的行為，直接通過相對路徑獲取 HTML 檔案。

    let htmlContent;
    switch(pageName) {
      case 'Public': htmlContent = await fetch('pages/public.html').then(r => r.text()); break;
      case 'Login': htmlContent = await fetch('pages/login.html').then(r => r.text()); break;
      case 'Admin': htmlContent = await fetch('pages/admin.html').then(r => r.text()); break;
      default: throw new Error(`未知頁面：${pageName}`);
    }

    appContent.innerHTML = htmlContent; // 將 HTML 內容注入到 `appContent` 元素中

    hideLoader(); // 載入完成，隱藏載入疊層

    // 尋找並執行頁面中的內嵌腳本 (類別為 `page-script`)
    const pageScriptElement = appContent.querySelector('script.page-script');
    if (pageScriptElement) { 
      try {
        // 將 `callApi` 函式作為參數傳遞給這個頁面的腳本執行環境，供其內部使用
        new Function('callApi', 'Sortable', pageScriptElement.textContent)(callApi, Sortable); 
      } 
      catch (e) { 
        console.error(`執行頁面 '${pageName}' 腳本出錯:`, e);
        // 如果腳本執行出錯，嘗試在頁面頂部顯示錯誤提示
        const pageSpecificErrorBanner = document.querySelector('.page-specific-error-banner');
        if (pageSpecificErrorBanner) {
            pageSpecificErrorBanner.className = `alert mt-3 alert-danger`;
            pageSpecificErrorBanner.textContent = `頁面 '${pageName}' 的腳本執行失敗：${e.message}。`;
            pageSpecificErrorBanner.style.display = 'block';
        }
      }
    }
  } catch (error) { 
    hideLoader(); // 隱藏載入疊層
    // 在主內容區域顯示頁面載入失敗的錯誤訊息
    appContent.innerHTML = `
        <div class="alert alert-danger mx-auto mt-5 text-center">
            <h3><i class="fas fa-exclamation-triangle"></i> 頁面載入失敗：</h3>
            <p>${error.message}</p>
            <p>請確認您的 Apps Script 後端 API 是否已正確部署，並且此 GitHub Pages 網頁可以訪問。</p>
        </div>`;
    console.error(`載入頁面 '${pageName}' 時發生錯誤:`, error);
  }
}

// ----- 全局導航和登入/登出事件 (通過 window 物件暴露給所有頁面) -----

/**
 * 用戶登入成功後的回調函式 (從登入頁面呼叫)。
 * 儲存 Session Token，並觸發頁面重新導航到管理頁面。
 */
window.onLoginSuccess = (loginData) => { 
  localStorage.setItem('sessionToken', loginData.token); 
  loadPage('Admin'); 
};

/**
 * 用戶登出函式。清除 Session Token 並導航回公共頁面。
 */
window.handleLogout = () => { 
  localStorage.removeItem('sessionToken'); 
  loadPage('Public'); 
};

/**
 * 導航到登入頁面。供頁面元素呼叫。
 */
window.switchToLoginView = () => loadPage('Login');
