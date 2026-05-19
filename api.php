<?php
// api.php - v3.24 (通用資料儲存版)
// 這個版本可以接收任何 JSON 資料 (包含新的 teacherEvents)，並寫入 schedule_data.json

header('Content-Type: application/json; charset=utf-8');

// 1. CORS 設定：允許跨網域存取 (解決從 Localhost 連線 NAS 的問題)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 2. 處理預檢請求 (Preflight Options Request)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 關閉錯誤顯示，避免 PHP 錯誤訊息破壞 JSON 回傳格式
error_reporting(0);
ini_set('display_errors', 0);

// 資料存檔名稱
$filename = 'schedule_data.json';

// --- 檔案初始化與權限檢查 ---
if (!file_exists($filename)) {
    // 若檔案不存在，嘗試建立
    if (file_put_contents($filename, '') === false) {
        http_response_code(500);
        echo json_encode([
            'status' => 'error', 
            'message' => '無法建立檔案 (Permission Denied)，請檢查 NAS 資料夾權限 (需允許 http/www 群組寫入)'
        ]);
        exit;
    }
    // 嘗試設定權限為可讀寫
    @chmod($filename, 0666);
} else {
    // 若檔案存在，嘗試修正權限，失敗也不報錯
    @chmod($filename, 0666);
}

// --- 功能 A: 讀取資料 (GET) ---
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $content = file_get_contents($filename);
    
    // 若檔案為空或讀取失敗
    if (empty($content)) {
        echo json_encode([
            'status' => 'empty', 
            'message' => '尚無資料', 
            'timestamp' => 0
        ]);
    } else {
        // 確保輸出的內容是合法的 JSON
        $decoded = json_decode($content);
        if ($decoded === null) {
             // 檔案損毀時
             echo json_encode([
                 'status' => 'empty', 
                 'message' => '檔案內容損毀 (JSON Error)，將視為空資料', 
                 'timestamp' => 0
             ]);
        } else {
             // 直接回傳檔案內容
             echo $content;
        }
    }
    exit;
}

// --- 功能 B: 寫入資料 (POST) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 取得前端傳來的原始 JSON 資料
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if ($data) {
        // 加入伺服器時間戳記 (用於版本比對)
        $data['timestamp'] = time();
        $data['last_updated_datetime'] = date('Y-m-d H:i:s');
        
        // 轉回 JSON 字串 (格式化以利閱讀)
        $jsonData = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        
        // 寫入檔案
        if (file_put_contents($filename, $jsonData) !== false) {
            echo json_encode([
                'status' => 'success', 
                'timestamp' => $data['timestamp'],
                'message' => '資料已成功儲存至伺服器'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                'status' => 'error', 
                'message' => '寫入失敗，請檢查磁碟空間或寫入權限'
            ]);
        }
    } else {
        http_response_code(400);
        echo json_encode([
            'status' => 'error', 
            'message' => '接收到的資料格式錯誤 (Invalid JSON)'
        ]);
    }
    exit;
}
?>