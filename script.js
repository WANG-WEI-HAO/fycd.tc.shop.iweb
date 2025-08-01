// script.js - 前端應用程式的所有 JavaScript 邏輯

// ★★★ 重要：替換為您的 Apps Script 後端部署的 /exec URL ★★★
// 這是在 Apps Script 編輯器中部署 mainApp.gs 為 Web 應用程式後獲取的 URL。
// 格式通常為：https://script.google.com/macros/s/AKfycbz_XYZABC/exec
const APPS_SCRIPT_API_EXEC_URL = 'YOUR_DEPLOYED_APPS_SCRIPT_EXEC_URL_HERE'; 

// DOM 元素引用
const appContent = document.getElementById('app-content');
const loaderOverlay = document.getElementById('loader-overlay');
const loaderMessage = document.getElementById('loader-message');


// 應用程式初始化檢查
document.addEventListener('DOMContentLoaded', () => {
    // 檢查 Apps Script 後端 URL 是否已正確配置
    if (APPS_SCRIPT_API_EXEC_URL === 'YOUR_DEPLOYED_APPS_SCRIPT_EXEC_URL_HERE' || 
        !APPS_SCRIPT_API_EXEC_URL.startsWith('https://script.google.com/macros/s/') || 
        !APPS_SCRIPT_API_EXEC_URL.endsWith('/exec')) {
        // 如果 URL 未正確配置，顯示致命錯誤訊息並阻止應用程式運行
        appContent.innerHTML = `
            <div class="alert alert-danger mx-auto mt-5 text-center">
                <h3><i class="fas fa-exclamation-triangle"></i> 配置錯誤：</h3>
                <p>請打開 `+"`script.js`"+` 檔案，<br>將部署後 Web App 的 <strong>"/exec" URL</strong> 填寫到 `+"`APPS_SCRIPT_API_EXEC_URL`"+` 常數中。</p>
                <small class="text-muted">（這個錯誤在實際部署後也會出現，直到 URL 填寫正確為止）</small>
            </div>`;
        loaderOverlay.classList.add('hidden'); // 隱藏載入疊層
        // 不應繼續執行任何可能觸發網絡請求的腳本
        throw new Error("Apps Script Web App EXEC URL 未正確配置或格式錯誤！請檢查 script.js。");
    }

    // 初始化路由，根據是否有 Session Token 載入 Public 或 Admin 頁面
    const sessionToken = localStorage.getItem('sessionToken');
    const initialPage = sessionToken ? 'Admin' : 'Public';
    loadPage(initialPage);
});

/**
 * 顯示應用程式載入疊層和訊息。
 * @param {string} message - 顯示給用戶的訊息。
 */
function showLoader(message = '載入中...') {
  loaderMessage.textContent = message;
  loaderOverlay.classList.remove('hidden'); // 移除隱藏類別，顯示載入器
}

/**
 * 隱藏應用程式載入疊層。
 */
function hideLoader() {
  loaderOverlay.classList.add('hidden'); // 加入隱藏類別，使載入器淡出
}

/**
 * 通用的 API 呼叫器。所有前端與 Apps Script 後端的通訊都透過此函式進行。
 * 此函式將 API URL 寫死，不再依賴 `google.script.url`。
 * @param {string} action - 後端要執行的 API Action 名稱 (e.g., 'getProducts', 'saveProduct')。
 * @param {object} params - 傳遞給後端 Action 的參數物件。
 * @returns {Promise<any>} Promise，成功時返回後端 `data` 部分，失敗時拋出錯誤。
 */
async function callApi(action, params = {}) {
  // 驗證 Action 名稱必須是字串
  if (typeof action !== 'string' || !action) {
    console.error("callApi 錯誤：'action' 必須是非空字串。", { action, params });
    throw new Error("API 呼叫錯誤：Action 名稱格式不正確。");
  }
  
  // 自動附加 Session Token (如果存在於 localStorage)
  const token = localStorage.getItem('sessionToken');
  if (token) params.token = token; 
  
  // 將請求的 Action 和參數物件轉換為 JSON 字串作為請求體
  const requestBody = JSON.stringify({ action, params });

  // 發送 Fetch API 請求到 Apps Script 後端
  try {
    const response = await fetch(APPS_SCRIPT_API_EXEC_URL, { 
      method: "POST", // Apps Script 後端統一使用 POST 方法
      headers: { "Content-Type": "application/json" }, // 設置 Content-Type 告知後端傳送的是 JSON
      body: requestBody // 傳送 JSON 格式的請求體
    });

    // 檢查 HTTP 響應的狀態碼。如果 response.ok 為 false (即 4xx 或 5xx 錯誤)
    if (!response.ok) { 
      // 嘗試讀取伺服器回傳的錯誤文字，以提供更詳細的錯誤信息
      const errorResponseText = await response.text(); 
      console.error(`伺服器 HTTP 錯誤 ${response.status}:`, errorResponseText);
      throw new Error(`伺服器連線錯誤：狀態碼 ${response.status}。\n詳細：${errorResponseText.substring(0,200)}...`);
    }
    
    // 解析伺服器回傳的 JSON 數據
    const result = await response.json();
    // 檢查後端業務邏輯層的 `success` 狀態。如果後端明確標示業務失敗
    if (!result.success) { 
      throw new Error(result.message || 'API 請求處理失敗，後端未提供具體錯誤訊息。');
    }
    return result.data; // 返回成功請求的 `data` 部分
  } catch (networkOrParsingError) {
    // 捕獲因網絡問題、JSON 解析失敗等引起的錯誤
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
    const htmlContent = await callApi('getPageContent', { pageName }); // 透過 API 獲取頁面的 HTML 內容片段
    appContent.innerHTML = htmlContent; // 將 HTML 內容注入到 `appContent` 元素中

    // 移除載入疊層 (如果有的話)
    hideLoader();

    // 尋找並執行內嵌在頁面 HTML 中的 `<script class="page-script"></script>` 腳本
    const pageScriptElement = appContent.querySelector('script.page-script');
    if (pageScriptElement) { 
      try {
        // 將 `callApi` 函式作為參數傳遞給這個腳本的執行環境，以便頁面邏輯可以調用 API
        new Function('callApi', pageScriptElement.textContent)(callApi); 
      } 
      catch (e) { 
        console.error(`執行 ${pageName} 頁面腳本出錯:`, e);
        // 如果腳本執行出錯，嘗試在頁面頂部顯示錯誤提示
        const pageSpecificErrorBanner = document.querySelector('.page-specific-error-banner');
        if (pageSpecificErrorBanner) {
            pageSpecificErrorBanner.className = `alert mt-3 alert-danger`;
            pageSpecificErrorBanner.textContent = `頁面 ${pageName} 的腳本執行失敗：${e.message}。`;
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
            <p>請檢查您的 Apps Script 後端服務是否已正確部署並正在運行。</p>
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
  // 導航到管理頁面，無需重新檢查路由，因為已經知道登入成功
  loadPage('Admin'); 
};

/**
 * 用戶登出函式。清除 Session Token 並導航回公共頁面。
 */
window.handleLogout = () => { 
  localStorage.removeItem('sessionToken'); // 從本地儲存中移除 Token
  loadPage('Public'); // 導航回公共頁面
};

/**
 * 導航到登入頁面。供頁面元素呼叫。
 */
window.switchToLoginView = () => loadPage('Login');


// End of script.js
