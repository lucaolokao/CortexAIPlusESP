/**
 * CortexAI POS - ESP32-S3 Firmware v5.0
 * Hardware: ESP32-S3-N16R8 + ILI9341 TFT 2.8" SPI (240x320) + XPT2046 Touch
 * Adaptado de v4.0 (SSD1306 + joystick) para tela colorida touch
 * TCC - Sistema Profissional de Ponto de Venda
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <XPT2046_Touchscreen.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <ArduinoOTA.h>

// ╔════════════════════════════════════════╗
// ║        PINOS E CONFIGURAÇÕES           ║
// ╚════════════════════════════════════════╝

// Pinos SPI (FSPI padrão do ESP32-S3)
#define PIN_TFT_SCLK  12
#define PIN_TFT_MOSI  11
#define PIN_TFT_MISO  13
#define PIN_TFT_CS    10
#define PIN_TFT_DC     9
#define PIN_TFT_RST    8
#define PIN_TOUCH_CS   5
#define PIN_BL        46

// Botões físicos
#define PIN_CARRINHO   0   // INPUT_PULLUP, boot-safe, active LOW — abre carrinho / hold = reset
#define PIN_BACK       1   // INPUT_PULLUP, active LOW — voltar/sair de qualquer tela

// Timings
#define BAUD_RATE           115200
#define DEBOUNCE            50
#define HEARTBEAT_INTERVALO 5000
#define REFRESH_INTERVALO   30000
#define WIFI_CHECK_INTERVALO 10000
#define TIMEOUT_TELA        30000
#define LONG_PRESS          5000    // 5s = factory reset
#define SLEEP_DIM_TIMEOUT   60000
#define SLEEP_OFF_TIMEOUT   120000
// #define WDT_TIMEOUT removed — WDT gerenciado pelo ESP-IDF padrão

// Dimensões da tela
#define TFT_W 240
#define TFT_H 320

// ╔════════════════════════════════════════╗
// ║        ALIASES DE COR (RGB565)         ║
// ╚════════════════════════════════════════╝

#define TFT_BLACK   0x0000
#define TFT_NAVY    0x000F
#define TFT_WHITE   0xFFFF
#define TFT_GREEN   0x07E0
#define TFT_RED     0xF800
#define TFT_YELLOW  0xFFE0
#define TFT_CYAN    0x07FF

// ╔════════════════════════════════════════╗
// ║   PALETA MODERNA RGB565 — CortexAI v6  ║
// ╚════════════════════════════════════════╝

// Estrutura
#define C_BG    0x0841   // Azul-preto escuro (fundo)
#define C_HDR   0x1249   // Azul petróleo (header / sub-header)
#define C_TXT   0xFFFF   // Branco puro

// Seleção
#define C_SEL   0x2B7F   // Azul brilhante (item selecionado)
#define C_HILI  0x07FF   // Destaque ciano

// Status
#define C_OK    0x07E0   // Verde vivo
#define C_ERR   0xF800   // Vermelho vivo
#define C_YEL   0xFFE0   // Amarelo quente
#define C_CYAN  0x07FF   // Ciano
#define C_ORNG  0xFD20   // Laranja vivo (badge / acento)
#define C_MINT  0x47EF   // Verde-menta (acento)

// Botões
#define C_DGRN  0x0340   // Verde escuro (fundo botão OK)
#define C_DRED  0x8000   // Vermelho escuro (fundo botão ERR)

// Neutros
#define C_GRAY  0x7BCF   // Cinza médio
#define C_DGRAY 0x2945   // Cinza-azul escuro (cards)
#define C_MGRAY 0x4208   // Cinza médio-escuro (separadores)

// ╔════════════════════════════════════════╗
// ║        CALIBRAÇÃO TOUCH                ║
// ╚════════════════════════════════════════╝

#define TOUCH_X_MIN    500    // sy esquerda medida=706, com margem
#define TOUCH_X_MAX   3700    // sy direita medida=3547, com margem
#define TOUCH_Y_MIN    800    // sx fundo medida=993, com margem
#define TOUCH_Y_MAX   3900    // sx topo medida=3697, com margem
#define TOUCH_SWAP_XY  true

// Descomente para mostrar coordenadas na tela (remover após calibrar)
// #define TOUCH_CALIBRATE_MODE

// Zonas de toque (portrait 240x320)
#define ZONE_UP_Y_MAX    80
#define ZONE_DOWN_Y_MIN  240
#define ZONE_LEFT_X_MAX  48
#define ZONE_RIGHT_X_MIN 192

// ╔════════════════════════════════════════╗
// ║        ENUMS E STRUCTS                 ║
// ╚════════════════════════════════════════╝

enum MetodoPagamento { PAG_DINHEIRO, PAG_PIX, PAG_CARTAO };

enum TouchZone { ZONE_NONE, ZONE_UP, ZONE_DOWN, ZONE_LEFT, ZONE_RIGHT, ZONE_CENTER };

struct TouchPt { int x; int y; bool valid; };

struct Config {
  char ssid[32];
  char password[64];
  char server[64];   // expandido: suporta domínios Railway/Render (ex: cortexai.up.railway.app)
  uint16_t port;
  bool configured;
};

struct Produto {
  char nome[20];
  int estoque;
  float preco;
};

struct ItemCarrinho {
  char nome[20];
  int quantidade;
  float preco;
};

struct Estatisticas {
  int vendas_dia;
  int produtos_vendidos;
  float receita_dia;
  unsigned long tempo_ultima_venda;
};

struct LogEntry {
  char msg[24];
  unsigned long timestamp;
};

struct VendaPendente {
  char produto[20];
  int qtd;
  float preco;
  uint8_t pagamento;
};

// ╔════════════════════════════════════════╗
// ║        OBJETOS GLOBAIS                 ║
// ╚════════════════════════════════════════╝

SPIClass tftSPI(FSPI);
Adafruit_ILI9341 tft(&tftSPI, PIN_TFT_DC, PIN_TFT_CS, PIN_TFT_RST);
XPT2046_Touchscreen ts(PIN_TOUCH_CS);
WebServer webServer(80);

// ╔════════════════════════════════════════╗
// ║        VARIÁVEIS GLOBAIS               ║
// ╚════════════════════════════════════════╝

Config config;
Produto produtos[25];
ItemCarrinho carrinho[20];
Estatisticas stats = {0, 0, 0.0, 0};
LogEntry logBuffer[10];
VendaPendente vendasPendentes[10];

// Estado
bool wifiConectado    = false;
bool servidorOnline   = false;
bool botaoVendaAtivo  = false;
bool displayLigado    = true;
bool reconectando     = false;

// Contadores
int totalProdutos  = 0;
int totalCarrinho  = 0;
int totalPendentes = 0;
int logHead        = 0;
int logCount       = 0;

// Timers
unsigned long bootTime         = 0;
unsigned long ultimoHeartbeat  = 0;
unsigned long ultimoRefresh    = 0;
unsigned long ultimoWifiCheck  = 0;
unsigned long botaoPressionadoEm = 0;
unsigned long ultimoInput      = 0;

// Menu
int menuIndex = 0;
int menuAtivo = 0;

const char MENU_PRINCIPAL[][16] = {
  "Dashboard",
  "Estoque",
  "Nova Venda",
  "Ver Carrinho",
  "Historico",
  "WiFi",
  "Sistema"
};
const int MENU_SIZE = 7;

// ╔════════════════════════════════════════╗
// ║        HELPER URL / HTTP               ║
// ╚════════════════════════════════════════╝

// Monta URL da API respeitando porta (443 = HTTPS sem porta explícita)
void buildApiUrl(char* buf, size_t bufLen, const char* endpoint) {
  if (config.port == 443) {
    snprintf(buf, bufLen, "https://%s%s", config.server, endpoint);
  } else if (config.port == 80) {
    snprintf(buf, bufLen, "http://%s%s", config.server, endpoint);
  } else {
    snprintf(buf, bufLen, "http://%s:%d%s", config.server, (int)config.port, endpoint);
  }
}

// Inicia HTTPClient (HTTPS automático quando porta 443)
// Retorna ponteiro para WiFiClientSecure alocado (libere com delete) ou nullptr se HTTP
WiFiClientSecure* beginHttp(HTTPClient& http, const char* url) {
  if (config.port == 443) {
    WiFiClientSecure* sc = new WiFiClientSecure();
    sc->setInsecure(); // TCC: sem verificação de certificado
    http.begin(*sc, url);
    return sc;
  }
  http.begin(url);
  return nullptr;
}

// ╔════════════════════════════════════════╗
// ║        PORTAL WEB MINIFICADO           ║
// ╚════════════════════════════════════════╝

void handleConfigPortal() {
  const char html[] = R"rawliteral(
<!DOCTYPE html><html><head><meta charset=UTF-8><meta name=viewport content="width=device-width,initial-scale=1"><title>CortexAI POS</title><style>*{margin:0;padding:0}body{font-family:Segoe UI,sans-serif;background:linear-gradient(135deg,#0d47a1,#1a73e8);min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}.glass{background:rgba(255,255,255,.95);backdrop-filter:blur(10px);border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);padding:40px;max-width:500px;width:100%}h1{color:#0d47a1;margin-bottom:30px;text-align:center}label{display:block;margin-bottom:8px;color:#333;font-weight:600;font-size:14px}input{width:100%;padding:12px;border:2px solid #e0e0e0;border-radius:8px;margin-bottom:15px;font-size:14px}input:focus{outline:0;border-color:#1a73e8}button{width:100%;padding:14px;background:linear-gradient(135deg,#0d47a1,#1a73e8);color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer}.status{text-align:center;margin-top:20px;padding:12px;border-radius:8px;display:none;font-size:14px}.ok{background:#e8f5e9;color:#388e3c}.err{background:#ffebee;color:#c62828}</style></head><body><div class=glass><h1>CortexAI POS</h1><form id=f><label>WiFi SSID:</label><input type=text id=s required><label>Senha:</label><input type=password id=p required><label>Servidor IP ou Dom&iacute;nio:</label><input type=text id=i placeholder="ex: cortexai.up.railway.app" required><label>Porta (3000=local, 443=HTTPS Railway):</label><input type=number id=pt value=3000><button>Salvar</button></form><div id=st class=status></div></div><script>document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();const st=document.getElementById('st');st.className='status';st.textContent='Salvando...';try{const r=await fetch('/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ssid:document.getElementById('s').value,password:document.getElementById('p').value,server:document.getElementById('i').value,port:parseInt(document.getElementById('pt').value)})});st.className=r.ok?'status ok':'status err';st.textContent=r.ok?'Sucesso! Reiniciando...':'Erro'}catch(e){st.className='status err';st.textContent='Erro: '+e.message}});fetch('/api/config').then(r=>r.json()).then(d=>{if(d.ssid)document.getElementById('s').value=d.ssid;if(d.server)document.getElementById('i').value=d.server}).catch(()=>{})</script></body></html>
)rawliteral";
  webServer.send(200, "text/html", html);
}

void handleConfig() {
  if(webServer.method() == HTTP_POST && webServer.hasArg("plain")) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, webServer.arg("plain"));
    strlcpy(config.ssid,     doc["ssid"]     | "", 32);
    strlcpy(config.password, doc["password"] | "", 64);
    strlcpy(config.server,   doc["server"]   | "", 64);
    config.port       = doc["port"] | 3000;
    config.configured = 1;
    salvarConfig();
    webServer.send(200, "application/json", "{\"ok\":true}");
    delay(1000);
    ESP.restart();
  } else {
    StaticJsonDocument<128> doc;
    doc["ssid"]   = config.ssid;
    doc["server"] = config.server;
    doc["port"]   = config.port;
    String json;
    serializeJson(doc, json);
    webServer.send(200, "application/json", json);
  }
}

// ╔════════════════════════════════════════╗
// ║        GERENCIAMENTO DE CONFIGURAÇÃO   ║
// ╚════════════════════════════════════════╝

void carregarConfig() {
  EEPROM.begin(512);
  if(EEPROM.read(226) == 1) {
    for(int i = 0; i < 32; i++) config.ssid[i]     = EEPROM.read(i);
    for(int i = 0; i < 64; i++) config.password[i] = EEPROM.read(32 + i);
    for(int i = 0; i < 64; i++) config.server[i]   = EEPROM.read(96 + i);
    config.port       = (EEPROM.read(224) << 8) | EEPROM.read(225);
    config.configured = 1;
  } else {
    config.configured = 0;
  }
}

void salvarConfig() {
  EEPROM.begin(512);
  for(int i = 0; i < 32; i++) EEPROM.write(i,      config.ssid[i]);
  for(int i = 0; i < 64; i++) EEPROM.write(32 + i, config.password[i]);
  for(int i = 0; i < 64; i++) EEPROM.write(96 + i, config.server[i]);
  EEPROM.write(224, (config.port >> 8) & 0xFF);
  EEPROM.write(225,  config.port       & 0xFF);
  EEPROM.write(226, 1);
  EEPROM.commit();
}

void limparConfig() {
  EEPROM.begin(512);
  for(int i = 0; i < 512; i++) EEPROM.write(i, 0);
  EEPROM.commit();
  ESP.restart();
}

// ╔════════════════════════════════════════╗
// ║   PERSISTÊNCIA DE ESTATÍSTICAS EEPROM  ║
// ╚════════════════════════════════════════╝

void carregarStats() {
  EEPROM.begin(512);
  int32_t vd, pv;
  float rd;
  EEPROM.get(228, vd);
  EEPROM.get(232, pv);
  EEPROM.get(236, rd);
  if(vd > 0 && vd < 100000) stats.vendas_dia = vd;
  if(pv > 0 && pv < 100000) stats.produtos_vendidos = pv;
  if(rd > 0.0f && rd < 9999999.0f) stats.receita_dia = rd;
  Serial.println("Stats carregadas: vendas=" + String(stats.vendas_dia));
}

void salvarStats() {
  EEPROM.begin(512);
  int32_t vd = stats.vendas_dia;
  int32_t pv = stats.produtos_vendidos;
  float   rd = stats.receita_dia;
  EEPROM.put(228, vd);
  EEPROM.put(232, pv);
  EEPROM.put(236, rd);
  EEPROM.commit();
  Serial.println("Stats salvas");
}

void resetarStats() {
  stats.vendas_dia         = 0;
  stats.produtos_vendidos  = 0;
  stats.receita_dia        = 0.0f;
  stats.tempo_ultima_venda = 0;
  salvarStats();
  registrarLog("Stats resetadas");
  Serial.println("Estatisticas resetadas");
}

// ╔════════════════════════════════════════╗
// ║        LOG DE EVENTOS CIRCULAR         ║
// ╚════════════════════════════════════════╝

void registrarLog(const char* msg) {
  strncpy(logBuffer[logHead].msg, msg, 23);
  logBuffer[logHead].msg[23] = '\0';
  logBuffer[logHead].timestamp = millis();
  logHead = (logHead + 1) % 10;
  if(logCount < 10) logCount++;
  Serial.print("LOG: ");
  Serial.println(msg);
}

// ╔════════════════════════════════════════╗
// ║        BUZZER (sem buzzer no S3)       ║
// ╚════════════════════════════════════════╝

void beepOk()    {}
void beepErro()  {}
void beepVenda() {}

// ╔════════════════════════════════════════╗
// ║        BRILHO / SLEEP / SCREENSAVER    ║
// ╚════════════════════════════════════════╝

void setBrightness(uint8_t val) {
  ledcWrite(PIN_BL, val);
}

void verificarSleep() {
  unsigned long semInput = millis() - ultimoInput;
  if(semInput > SLEEP_OFF_TIMEOUT && displayLigado) {
    setBrightness(0);
    displayLigado = false;
    Serial.println("Display OFF (screensaver)");
  } else if(semInput > SLEEP_DIM_TIMEOUT && semInput <= SLEEP_OFF_TIMEOUT && displayLigado) {
    setBrightness(30);
  } else if(semInput <= SLEEP_DIM_TIMEOUT && !displayLigado) {
    setBrightness(255);
    displayLigado = true;
  } else if(semInput <= SLEEP_DIM_TIMEOUT) {
    setBrightness(255);
  }
}

void ativarDisplay() {
  if(!displayLigado) {
    setBrightness(255);
    displayLigado = true;
  }
  ultimoInput = millis();
}

// ╔════════════════════════════════════════╗
// ║        LEITURA DE TOUCH                ║
// ╚════════════════════════════════════════╝

// Aguarda soltar o toque com timeout (evita bloqueio por ruído)
static inline void waitForRelease() {
  unsigned long t = millis();
  while(ts.touched() && millis() - t < 500) delay(10);
}

TouchPt readTouch() {
  TouchPt p = {0, 0, false};

  // Lê direto sem ts.touched() — alguns módulos têm z abaixo do limiar da lib
  TS_Point s1 = ts.getPoint();

  if(s1.z < 200) return p;

  delay(10);
  TS_Point s2 = ts.getPoint();
  if(s2.z < 200) return p;

  // Consistência entre as duas leituras
  if(abs(s1.x - s2.x) > 400 || abs(s1.y - s2.y) > 400) return p;

  int rx = (s1.x + s2.x) / 2;
  int ry = (s1.y + s2.y) / 2;

  Serial.printf("RAW: x=%d y=%d z=%d\n", rx, ry, s1.z);

  // Swap eixos para orientação portrait
  if(TOUCH_SWAP_XY) { int tmp = rx; rx = ry; ry = tmp; }

  // Rejeita coordenadas fora da área calibrada
  if(rx < TOUCH_X_MIN || rx > TOUCH_X_MAX) return p;
  if(ry < TOUCH_Y_MIN || ry > TOUCH_Y_MAX) return p;

  p.x = map(rx, TOUCH_X_MIN, TOUCH_X_MAX, 0, TFT_W - 1);
  p.y = map(ry, TOUCH_Y_MAX, TOUCH_Y_MIN, 0, TFT_H - 1);  // Y invertido: alto raw = topo
  p.x = constrain(p.x, 0, TFT_W - 1);
  p.y = constrain(p.y, 0, TFT_H - 1);
  p.valid = true;

#ifdef TOUCH_CALIBRATE_MODE
  char _dbuf[32];
  // raw antes do swap: s1.x → screen Y, s1.y → screen X (com SWAP_XY=true)
  sprintf(_dbuf, "sx=%d sy=%d", s1.x, s1.y);
  tft.fillRect(0, 304, TFT_W, 16, TFT_BLACK);
  tft.setTextColor(TFT_YELLOW, TFT_BLACK);
  tft.setTextSize(1);
  tft.setCursor(2, 307);
  tft.print(_dbuf);
#endif

  Serial.printf("Touch: x=%d y=%d z=%d\n", p.x, p.y, s1.z);
  return p;
}

// Aguarda um toque e solta, retorna coordenada (bloqueante).
// Retorna valid=false se: timeout OR botão BACK pressionado.
TouchPt waitForTap() {
  static unsigned long lastTouch = 0;
  TouchPt p = {0, 0, false};
  unsigned long start = millis();
  while(millis() - start < TIMEOUT_TELA) {
    // Checa botão BACK — sai imediatamente
    if(botaoPressionado(PIN_BACK)) return p;  // valid=false → sai da tela

    p = readTouch();
    if(p.valid && (millis() - lastTouch) > 180) {
      lastTouch = millis();
      waitForRelease();
      ativarDisplay();
      return p;
    }
    delay(20);
  }
  return p; // valid=false = timeout
}

// Helper: true se o botão BACK (PIN_BACK) for pressionado
inline bool backPressionado() {
  return botaoPressionado(PIN_BACK);
}

// Retorna zona de toque sem bloquear muito tempo
TouchZone getTouchZone() {
  static unsigned long lastTouch = 0;
  if((millis() - lastTouch) < 180) return ZONE_NONE;
  TouchPt p = readTouch();
  if(!p.valid) return ZONE_NONE;
  lastTouch = millis();
  waitForRelease();
  ativarDisplay();

  if(p.y < ZONE_UP_Y_MAX)    return ZONE_UP;
  if(p.y > ZONE_DOWN_Y_MIN)  return ZONE_DOWN;
  if(p.x < ZONE_LEFT_X_MAX)  return ZONE_LEFT;
  if(p.x > ZONE_RIGHT_X_MIN) return ZONE_RIGHT;
  return ZONE_CENTER;
}

// ╔════════════════════════════════════════╗
// ║   BARRA DE STATUS — 30 px topo         ║
// ╚════════════════════════════════════════╝

// Helper: desenha barras de sinal WiFi (4 barras, bottom-align)
static void drawWiFiBars(int x, int rssi) {
  int bars = (rssi > -60) ? 4 : (rssi > -70 ? 3 : (rssi > -80 ? 2 : 1));
  uint16_t col = (bars >= 3) ? C_OK : (bars >= 2 ? C_YEL : C_ERR);
  for (int b = 0; b < 4; b++) {
    int bx = x + b * 6;
    int bh = 5 + b * 4;  // alturas: 5, 9, 13, 17
    int by = 26 - bh;    // bottom-align em y=26
    tft.fillRect(bx, by, 4, bh, (b < bars) ? col : C_MGRAY);
  }
}

void drawStatusBar() {
  // Fundo e linha de destaque
  tft.fillRect(0, 0, TFT_W, 30, C_HDR);
  tft.drawLine(0, 29, TFT_W, 29, C_CYAN);

  // Logo
  tft.setTextColor(C_TXT, C_HDR);
  tft.setTextSize(2);
  tft.setCursor(6, 7);
  tft.print("CortexAI");

  // Badge do carrinho
  if (totalCarrinho > 0) {
    tft.fillRoundRect(102, 6, 26, 17, 4, C_ORNG);
    tft.setTextColor(C_BG, C_ORNG);
    tft.setTextSize(1);
    char cBuf[4];
    snprintf(cBuf, sizeof(cBuf), "%d", totalCarrinho);
    tft.setCursor((totalCarrinho < 10) ? 111 : 107, 11);
    tft.print(cBuf);
  }

  // Sinal WiFi (barras)
  if (wifiConectado) {
    drawWiFiBars(148, WiFi.RSSI());
  } else if (reconectando) {
    tft.setTextColor(C_YEL, C_HDR);
    tft.setTextSize(1);
    tft.setCursor(148, 11);
    tft.print("...");
  } else {
    // Ícone X (sem WiFi)
    tft.setTextColor(C_ERR, C_HDR);
    tft.setTextSize(1);
    tft.setCursor(148, 11);
    tft.print("x");
  }

  // Indicador do servidor (pílula colorida)
  uint16_t svrBg  = servidorOnline ? C_DGRN : C_DRED;
  uint16_t svrBdr = servidorOnline ? C_OK   : C_ERR;
  tft.fillRoundRect(172, 7, 64, 16, 5, svrBg);
  tft.drawRoundRect(172, 7, 64, 16, 5, svrBdr);
  tft.setTextColor(C_TXT, svrBg);
  tft.setTextSize(1);
  tft.setCursor(177, 11);
  tft.print(servidorOnline ? "SRV: OK " : "SRV: ---");
}

// ╔════════════════════════════════════════╗
// ║   SUB-CABEÇALHO DAS TELAS              ║
// ╚════════════════════════════════════════╝

void drawSubHeader(const char* title) {
  tft.fillRect(0, 30, TFT_W, 28, C_HDR);
  tft.setTextColor(C_YEL, C_HDR);
  tft.setTextSize(2);
  tft.setCursor(12, 37);
  tft.print(title);
  tft.drawLine(0, 57, TFT_W, 57, C_CYAN);
  tft.drawLine(0, 58, TFT_W, 58, C_DGRAY);
}

// ╔════════════════════════════════════════╗
// ║   ANIMAÇÕES DE TRANSIÇÃO               ║
// ╚════════════════════════════════════════╝

// Varredura horizontal (entrada de tela) — wipe da direita para esquerda
// Rápido: 12 faixas de 20px cada
void transitionIn() {
  for(int x = TFT_W; x >= 0; x -= 20) {
    tft.fillRect(x, 0, 20, TFT_H, C_HDR);
    delay(6);
  }
  // Apaga com o fundo — a tela será redesenhada na sequência
  tft.fillScreen(C_BG);
}

// Varredura saindo (saída de tela) — wipe da esquerda para direita
void transitionOut() {
  for(int x = 0; x < TFT_W; x += 20) {
    tft.fillRect(x, 0, 20, TFT_H, C_HDR);
    delay(6);
  }
}

// ╔════════════════════════════════════════╗
// ║        MENU PRINCIPAL (7 itens)        ║
// ╚════════════════════════════════════════╝

void drawMenu() {
  tft.fillScreen(C_BG);
  drawStatusBar();

  // Cores de acento por item do menu
  const uint16_t accents[] = {
    0x07FF,  // Dashboard  — ciano
    0x07E0,  // Estoque    — verde
    0xFFE0,  // Nova Venda — amarelo
    0xFD20,  // Carrinho   — laranja
    0xC21F,  // Historico  — roxo
    0x065F,  // WiFi       — azul claro
    0x7BCF,  // Sistema    — cinza
  };
  // Ícones ASCII por item
  const char icons[] = { '@', '#', '+', '>', '~', 'W', '*' };

  // 7 itens × 41px = 287px na área de conteúdo (y=30..319)
  for (int i = 0; i < MENU_SIZE; i++) {
    int y   = 30 + i * 41;
    bool sel = (i == menuIndex);
    uint16_t acc = accents[i];
    uint16_t cardBg = sel ? C_SEL : C_DGRAY;

    // Card arredondado
    tft.fillRoundRect(3, y + 2, TFT_W - 6, 37, 7, cardBg);
    tft.drawRoundRect(3, y + 2, TFT_W - 6, 37, 7, sel ? acc : C_MGRAY);

    // Barra de acento esquerda
    tft.fillRoundRect(3, y + 2, 6, 37, 4, acc);

    // Ícone
    tft.setTextSize(2);
    tft.setTextColor(acc, cardBg);
    tft.setCursor(17, y + 14);
    tft.write(icons[i]);

    // Texto do item
    tft.setTextColor(sel ? C_YEL : C_TXT, cardBg);
    tft.setTextSize(2);
    tft.setCursor(38, y + 14);
    tft.print(MENU_PRINCIPAL[i]);

    // Seta de seleção
    if (sel) {
      tft.setTextColor(acc, cardBg);
      tft.setCursor(TFT_W - 22, y + 14);
      tft.print(">");
    }
  }

  // Legenda de controles (rodapé mini)
  tft.setTextColor(C_MGRAY, C_BG);
  tft.setTextSize(1);
  tft.setCursor(4, 319);
  tft.print("^v:nav | BACK:P1 | CART:P0");
}

// ╔════════════════════════════════════════╗
// ║        TELA DASHBOARD                  ║
// ╚════════════════════════════════════════╝

void telaDashboard() {
  tft.fillScreen(C_BG);
  drawStatusBar();

  unsigned long tempoEntrada = millis();
  bool precisaAtualizar = true;

  while((millis() - tempoEntrada) < TIMEOUT_TELA) {

    if(precisaAtualizar) {
      tft.fillRect(0, 30, TFT_W, TFT_H - 30, C_BG);
      drawSubHeader("DASHBOARD");

      // Card arredondado com acento lateral
      auto drawCard = [](int y, const char* label, const char* val, uint16_t cor) {
        tft.fillRoundRect(5, y, TFT_W - 10, 36, 7, C_DGRAY);
        tft.drawRoundRect(5, y, TFT_W - 10, 36, 7, cor);
        tft.fillRoundRect(5, y, 5, 36, 3, cor);   // acento esquerdo
        tft.setTextColor(C_GRAY, C_DGRAY);
        tft.setTextSize(1);
        tft.setCursor(16, y + 5);
        tft.print(label);
        tft.setTextColor(cor, C_DGRAY);
        tft.setTextSize(2);
        tft.setCursor(16, y + 17);
        tft.print(val);
      };

      char buf[20];
      // Status servidor
      drawCard(62,  "SERVIDOR",   servidorOnline ? "ONLINE" : "OFFLINE", servidorOnline ? C_OK : C_ERR);
      // Produtos
      snprintf(buf, sizeof(buf), "%d", totalProdutos);
      drawCard(102, "PRODUTOS",   buf, C_CYAN);
      // Carrinho
      snprintf(buf, sizeof(buf), "%d itens", totalCarrinho);
      drawCard(142, "CARRINHO",   buf, C_YEL);
      // Vendas
      snprintf(buf, sizeof(buf), "%d", stats.vendas_dia);
      drawCard(182, "VENDAS HOJE",buf, C_OK);
      // Receita
      dtostrf(stats.receita_dia, 6, 2, buf);
      char rbuf[24];
      snprintf(rbuf, sizeof(rbuf), "R$ %s", buf);
      drawCard(222, "RECEITA",    rbuf, C_OK);
      // Pendentes
      if(totalPendentes > 0) {
        snprintf(buf, sizeof(buf), "%d", totalPendentes);
        drawCard(262, "PENDENTES", buf, C_ERR);
      }

      // Heap bar
      uint32_t heap      = ESP.getFreeHeap();
      uint32_t heapTotal = ESP.getHeapSize();
      int barW = (int)(((float)heap / heapTotal) * (TFT_W - 20));
      tft.drawRect(10, 305, TFT_W - 20, 10, C_DGRAY);
      tft.fillRect(10, 305, barW, 10, heap > 50000 ? C_DGRN : C_DRED);
      tft.setTextColor(C_GRAY, C_BG);
      tft.setTextSize(1);
      tft.setCursor(10, 316);
      tft.print("Heap:");
      tft.print(heap / 1024);
      tft.print("KB");

      precisaAtualizar = false;
    }

    TouchZone z = getTouchZone();
    if(z != ZONE_NONE) break;
    if(botaoPressionado(PIN_CARRINHO) || backPressionado()) break;
    delay(200);
  }
}

// ╔════════════════════════════════════════╗
// ║        TELA ESTOQUE                    ║
// ╚════════════════════════════════════════╝

void telaEstoque() {
  atualizarProdutos();
  int offset = 0;
  unsigned long tempoEntrada = millis();

  while((millis() - tempoEntrada) < TIMEOUT_TELA) {
    tft.fillScreen(C_BG);
    drawStatusBar();

    // Sub-cabeçalho com contagem
    char hdr[22];
    snprintf(hdr, sizeof(hdr), "ESTOQUE (%d)", totalProdutos);
    drawSubHeader(hdr);

    // 5 produtos × 50px — área y=62..312
    for(int i = 0; i < 5 && (offset + i) < totalProdutos; i++) {
      int idx = offset + i;
      int y   = 62 + i * 50;
      bool baixo = (produtos[idx].estoque < 5);
      uint16_t acento = baixo ? C_ERR : C_OK;

      tft.fillRoundRect(4, y, TFT_W - 8, 47, 7, C_DGRAY);
      tft.drawRoundRect(4, y, TFT_W - 8, 47, 7, baixo ? C_ERR : C_MGRAY);
      // Barra de acento
      tft.fillRoundRect(4, y, 5, 47, 3, acento);

      // Nome
      tft.setTextColor(C_TXT, C_DGRAY);
      tft.setTextSize(2);
      tft.setCursor(16, y + 6);
      char nomeShort[11];
      strncpy(nomeShort, produtos[idx].nome, 10);
      nomeShort[10] = '\0';
      tft.print(nomeShort);

      // Preço
      tft.setTextSize(1);
      tft.setTextColor(C_CYAN, C_DGRAY);
      tft.setCursor(16, y + 31);
      char pbuf[8];
      dtostrf(produtos[idx].preco, 5, 2, pbuf);
      tft.print("R$ ");
      tft.print(pbuf);

      // Estoque
      tft.setTextColor(baixo ? C_ERR : C_GRAY, C_DGRAY);
      tft.setCursor(145, y + 31);
      tft.print("Stk: ");
      tft.print(produtos[idx].estoque);
    }

    // Navegação
    tft.setTextColor(C_MGRAY, C_BG);
    tft.setTextSize(1);
    tft.setCursor(10, 316);
    tft.print("Cima/Baixo: rolar  |  Esq: Sair");

    TouchZone z = getTouchZone();
    if(z == ZONE_DOWN && offset + 5 < totalProdutos) { offset++; ultimoInput = millis(); }
    else if(z == ZONE_UP && offset > 0)               { offset--; ultimoInput = millis(); }
    else if(z == ZONE_LEFT || z == ZONE_RIGHT)         break;

    if(botaoPressionado(PIN_CARRINHO) || backPressionado()) break;
    delay(50);
  }
}

// ╔════════════════════════════════════════╗
// ║        TELA HISTÓRICO                  ║
// ╚════════════════════════════════════════╝

void telaHistorico() {
  unsigned long tempoEntrada = millis();

  while((millis() - tempoEntrada) < TIMEOUT_TELA) {
    tft.fillScreen(C_BG);
    drawStatusBar();
    drawSubHeader("HISTORICO");

    // Linha de dado arredondada
    auto infoCard = [](int y, const char* label, const char* val, uint16_t cor) {
      tft.fillRoundRect(5, y, TFT_W - 10, 38, 7, C_DGRAY);
      tft.fillRoundRect(5, y, 5, 38, 3, cor);
      tft.setTextColor(C_GRAY, C_DGRAY);
      tft.setTextSize(1);
      tft.setCursor(16, y + 5);
      tft.print(label);
      tft.setTextColor(cor, C_DGRAY);
      tft.setTextSize(2);
      tft.setCursor(16, y + 17);
      tft.print(val);
    };

    char buf[16];
    snprintf(buf, sizeof(buf), "%d", stats.vendas_dia);
    infoCard(63,  "VENDAS HOJE",       buf,  C_OK);
    snprintf(buf, sizeof(buf), "%d", stats.produtos_vendidos);
    infoCard(106, "ITENS VENDIDOS",    buf,  C_CYAN);
    dtostrf(stats.receita_dia, 7, 2, buf);
    char rbuf[20];
    snprintf(rbuf, sizeof(rbuf), "R$ %s", buf);
    infoCard(149, "RECEITA TOTAL",     rbuf, C_YEL);
    snprintf(buf, sizeof(buf), "%d", totalPendentes);
    infoCard(192, "VENDAS PENDENTES",  buf,  totalPendentes > 0 ? C_ERR : C_GRAY);

    // Log recente
    tft.drawLine(0, 235, TFT_W, 235, C_MGRAY);
    tft.setTextColor(C_CYAN, C_BG);
    tft.setTextSize(1);
    tft.setCursor(10, 240);
    tft.print("LOG RECENTE:");
    for(int i = 0; i < min(logCount, 3); i++) {
      int idx = ((logHead - 1 - i) + 10) % 10;
      tft.setTextColor(C_GRAY, C_BG);
      tft.setCursor(10, 252 + i * 16);
      tft.print(logBuffer[idx].msg);
    }

    TouchZone z = getTouchZone();
    if(z != ZONE_NONE) break;
    if(botaoPressionado(PIN_CARRINHO) || backPressionado()) break;
    delay(200);
  }
}

// ╔════════════════════════════════════════╗
// ║        TELA WIFI                       ║
// ╚════════════════════════════════════════╝

void telaWiFi() {
  unsigned long tempoEntrada = millis();

  while((millis() - tempoEntrada) < TIMEOUT_TELA) {
    tft.fillScreen(C_BG);
    drawStatusBar();
    drawSubHeader("WIFI INFO");

    auto infoCard = [](int y, const char* label, const char* val, uint16_t cor) {
      tft.fillRoundRect(5, y, TFT_W - 10, 38, 7, C_DGRAY);
      tft.fillRoundRect(5, y, 5, 38, 3, cor);
      tft.setTextColor(C_GRAY, C_DGRAY);
      tft.setTextSize(1);
      tft.setCursor(16, y + 5);
      tft.print(label);
      tft.setTextColor(cor, C_DGRAY);
      tft.setTextSize(2);
      tft.setCursor(16, y + 17);
      tft.print(val);
    };

    infoCard(63,  "REDE",    config.ssid,                      wifiConectado ? C_OK : C_ERR);
    infoCard(106, "IP",      WiFi.localIP().toString().c_str(), C_CYAN);

    char rssiBuf[12];
    snprintf(rssiBuf, sizeof(rssiBuf), "%d dBm", WiFi.RSSI());
    uint16_t rssiCor = (WiFi.RSSI() > -60) ? C_OK : (WiFi.RSSI() > -75 ? C_YEL : C_ERR);
    infoCard(149, "SINAL",  rssiBuf, rssiCor);

    infoCard(192, "MAC",    WiFi.macAddress().c_str(), C_GRAY);

    char svr[72];
    if (config.port == 443 || config.port == 80) {
      snprintf(svr, sizeof(svr), "%s", config.server);
    } else {
      snprintf(svr, sizeof(svr), "%s:%d", config.server, config.port);
    }
    infoCard(235, "SERVIDOR", svr, servidorOnline ? C_OK : C_ERR);

    tft.setTextColor(C_MGRAY, C_BG);
    tft.setTextSize(1);
    tft.setCursor(10, 310);
    tft.print("Qualquer toque para sair");

    TouchZone z = getTouchZone();
    if(z != ZONE_NONE) break;
    if(botaoPressionado(PIN_CARRINHO) || backPressionado()) break;
    delay(200);
  }
}

// ╔════════════════════════════════════════╗
// ║        DIÁLOGO YES/NO NA TELA          ║
// ╚════════════════════════════════════════╝

// Retorna true = SIM, false = NAO/timeout
bool dialogSimNao(const char* pergunta) {
  tft.fillRoundRect(8, 95, TFT_W - 16, 130, 10, C_DGRAY);
  tft.drawRoundRect(8, 95, TFT_W - 16, 130, 10, C_YEL);

  tft.setTextColor(C_TXT, C_DGRAY);
  tft.setTextSize(2);
  tft.setCursor(18, 108);
  tft.print(pergunta);

  // Botão NAO (vermelho)
  tft.fillRoundRect(14, 172, 97, 38, 8, C_DRED);
  tft.drawRoundRect(14, 172, 97, 38, 8, C_ERR);
  tft.setTextColor(C_TXT, C_DRED);
  tft.setTextSize(2);
  tft.setCursor(30, 183);
  tft.print("NAO");

  // Botão SIM (verde)
  tft.fillRoundRect(129, 172, 97, 38, 8, C_DGRN);
  tft.drawRoundRect(129, 172, 97, 38, 8, C_OK);
  tft.setTextColor(C_TXT, C_DGRN);
  tft.setTextSize(2);
  tft.setCursor(148, 183);
  tft.print("SIM");

  // Barra de timeout
  tft.drawRect(15, 217, TFT_W - 30, 5, C_DGRAY);

  unsigned long inicio = millis();
  const unsigned long timeout = 5000;

  while(millis() - inicio < timeout) {
    // Atualizar barra de tempo
    int restante = TFT_W - 30 - (int)(((float)(millis() - inicio) / timeout) * (TFT_W - 30));
    tft.fillRect(15, 217, restante, 5, C_YEL);

    TouchPt p = readTouch();
    if(p.valid) {
      waitForRelease();
      if(p.y >= 175 && p.y <= 211) {
        if(p.x < 120) return false; // NAO
        if(p.x >= 120) return true; // SIM
      }
    }
    delay(50);
  }
  return false; // timeout = NAO
}

// ╔════════════════════════════════════════╗
// ║        TELA SISTEMA                    ║
// ╚════════════════════════════════════════╝

void telaSistema() {
  unsigned long tempoEntrada = millis();

  while((millis() - tempoEntrada) < TIMEOUT_TELA) {
    tft.fillScreen(C_BG);
    drawStatusBar();
    drawSubHeader("SISTEMA");

    // Uptime
    unsigned long uptime = (millis() - bootTime) / 1000;
    uint32_t ud = uptime / 86400;
    uint32_t uh = (uptime % 86400) / 3600;
    uint32_t um = (uptime % 3600) / 60;
    char uptBuf[24];
    snprintf(uptBuf, sizeof(uptBuf), "%lud %luh %lum", ud, uh, um);

    auto infoCard = [](int y, const char* label, const char* val, uint16_t cor) {
      tft.fillRoundRect(5, y, TFT_W - 10, 36, 7, C_DGRAY);
      tft.fillRoundRect(5, y, 5, 36, 3, cor);
      tft.setTextColor(C_GRAY, C_DGRAY);
      tft.setTextSize(1);
      tft.setCursor(16, y + 5);
      tft.print(label);
      tft.setTextColor(cor, C_DGRAY);
      tft.setTextSize(2);
      tft.setCursor(16, y + 17);
      tft.print(val);
    };

    infoCard(62,  "VERSAO",    "CortexAI v5.0", C_CYAN);
    infoCard(102, "UPTIME",     uptBuf,          C_MINT);

    char heapBuf[20];
    snprintf(heapBuf, sizeof(heapBuf), "%dKB / %dKB",
      ESP.getFreeHeap() / 1024, ESP.getHeapSize() / 1024);
    infoCard(142, "HEAP LIVRE", heapBuf, ESP.getFreeHeap() > 50000 ? C_OK : C_ERR);

    char macBuf[20];
    strncpy(macBuf, WiFi.macAddress().c_str(), 19);
    macBuf[19] = '\0';
    infoCard(182, "MAC", macBuf, C_GRAY);

    if(totalPendentes > 0) {
      char pBuf[8];
      snprintf(pBuf, sizeof(pBuf), "%d", totalPendentes);
      infoCard(222, "PENDENTES OFFLINE", pBuf, C_ERR);
    }

    // Botão RESETAR STATS
    tft.fillRoundRect(10, 248, TFT_W - 20, 34, 8, C_DRED);
    tft.drawRoundRect(10, 248, TFT_W - 20, 34, 8, C_ERR);
    tft.setTextColor(C_TXT, C_DRED);
    tft.setTextSize(2);
    tft.setCursor(20, 258);
    tft.print("RESETAR STATS");

    // Botão VOLTAR
    tft.fillRoundRect(10, 286, TFT_W - 20, 30, 8, C_DGRAY);
    tft.drawRoundRect(10, 286, TFT_W - 20, 30, 8, C_GRAY);
    tft.setTextColor(C_TXT, C_DGRAY);
    tft.setTextSize(2);
    tft.setCursor(68, 294);
    tft.print("VOLTAR");

    TouchPt p = waitForTap();
    if(!p.valid) break;

    if(p.y >= 248 && p.y <= 282) {
      if(dialogSimNao("Resetar estatisticas?")) {
        resetarStats();
        beepOk();
        registrarLog("Stats resetadas");
        tft.fillScreen(C_BG);
        drawStatusBar();
        tft.setTextColor(C_OK, C_BG);
        tft.setTextSize(2);
        tft.setCursor(30, 150);
        tft.print("Resetado!");
        delay(1200);
      }
      tempoEntrada = millis();
      continue;
    }
    if(p.y >= 286) break;
    if(botaoPressionado(PIN_CARRINHO) || backPressionado()) break;
  }
}

// ╔════════════════════════════════════════╗
// ║        TELA VER CARRINHO               ║
// ╚════════════════════════════════════════╝

void telaVerCarrinho() {
  if(totalCarrinho == 0) {
    tft.fillScreen(C_BG);
    drawStatusBar();
    tft.setTextColor(C_YEL, C_BG);
    tft.setTextSize(2);
    tft.setCursor(30, 150);
    tft.print("Carrinho");
    tft.setCursor(50, 175);
    tft.print("vazio!");
    delay(1500);
    return;
  }

  int sel    = 0;
  int offset = 0;
  unsigned long tempoEntrada = millis();

  while((millis() - tempoEntrada) < TIMEOUT_TELA) {

    // Calcular total
    float total = 0;
    for(int i = 0; i < totalCarrinho; i++) {
      total += carrinho[i].quantidade * carrinho[i].preco;
    }

    tft.fillScreen(C_BG);
    drawStatusBar();

    char hdrBuf[18];
    snprintf(hdrBuf, sizeof(hdrBuf), "CARRINHO (%d)", totalCarrinho);
    drawSubHeader(hdrBuf);

    // 4 itens × 44px (y=62..237)
    if(sel >= offset + 4) offset = sel - 3;
    if(sel < offset)      offset = sel;

    for(int i = 0; i < 4 && (offset + i) < totalCarrinho; i++) {
      int idx = offset + i;
      int y   = 62 + i * 44;
      bool eSel = (idx == sel);

      tft.fillRoundRect(4, y, TFT_W - 8, 42, 7, eSel ? C_SEL : C_DGRAY);
      tft.drawRoundRect(4, y, TFT_W - 8, 42, 7, eSel ? C_CYAN : C_MGRAY);
      tft.fillRoundRect(4, y, 5, 42, 3, eSel ? C_CYAN : C_ORNG);

      char nomeShort[11];
      strncpy(nomeShort, carrinho[idx].nome, 10);
      nomeShort[10] = '\0';
      tft.setTextColor(eSel ? C_YEL : C_TXT, eSel ? C_SEL : C_DGRAY);
      tft.setTextSize(2);
      tft.setCursor(10, y + 5);
      tft.print(nomeShort);

      tft.setTextSize(1);
      tft.setTextColor(C_CYAN, eSel ? C_SEL : C_DGRAY);
      tft.setCursor(10, y + 28);
      tft.print("x");
      tft.print(carrinho[idx].quantidade);
      tft.print("  R$ ");
      char pbuf[8];
      dtostrf(carrinho[idx].quantidade * carrinho[idx].preco, 5, 2, pbuf);
      tft.print(pbuf);
    }

    // Total
    tft.drawLine(0, 240, TFT_W, 240, C_DGRAY);
    tft.setTextColor(C_YEL, C_BG);
    tft.setTextSize(2);
    tft.setCursor(10, 246);
    tft.print("TOTAL: R$");
    char tbuf[10];
    dtostrf(total, 6, 2, tbuf);
    tft.print(tbuf);

    // Botões arredondados
    tft.fillRoundRect(5,   274, 108, 40, 8, C_DRED);
    tft.drawRoundRect(5,   274, 108, 40, 8, C_ERR);
    tft.setTextColor(C_TXT, C_DRED);
    tft.setTextSize(2);
    tft.setCursor(12, 287);
    tft.print("REMOVER");

    tft.fillRoundRect(127, 274, 108, 40, 8, C_DGRAY);
    tft.drawRoundRect(127, 274, 108, 40, 8, C_GRAY);
    tft.setTextColor(C_TXT, C_DGRAY);
    tft.setTextSize(2);
    tft.setCursor(140, 287);
    tft.print("VOLTAR");

    // Dica toque UP/DOWN
    tft.setTextColor(C_MGRAY, C_BG);
    tft.setTextSize(1);
    tft.setCursor(10, 316);
    tft.print("Cima/Baixo: navegar");

    TouchPt p = waitForTap();
    if(!p.valid) break; // timeout

    if(p.y < 240) {
      // Selecionou um item na lista
      int tocado = offset + (p.y - 62) / 44;
      if(tocado >= 0 && tocado < totalCarrinho) {
        sel = tocado;
        tempoEntrada = millis();
      }
      continue;
    }

    if(p.y >= 274) {
      if(p.x < 120) {
        // Botão REMOVER
        char pergunta[32];
        snprintf(pergunta, sizeof(pergunta), "Remover %s?", carrinho[sel].nome);
        if(dialogSimNao(pergunta)) {
          for(int i = sel; i < totalCarrinho - 1; i++) carrinho[i] = carrinho[i + 1];
          totalCarrinho--;
          if(sel >= totalCarrinho && sel > 0) sel--;
          registrarLog("Item removido");
          if(totalCarrinho == 0) break;
        }
        tempoEntrada = millis();
      } else {
        break; // VOLTAR
      }
    }

    // Zonas UP/DOWN para navegar
    TouchZone z = getTouchZone();
    if(z == ZONE_UP   && sel > 0)              { sel--; tempoEntrada = millis(); }
    if(z == ZONE_DOWN && sel < totalCarrinho-1){ sel++; tempoEntrada = millis(); }

    if(botaoPressionado(PIN_CARRINHO) || backPressionado()) break;
  }
}

// ╔════════════════════════════════════════╗
// ║        TELA RESUMO DE VENDA            ║
// ╚════════════════════════════════════════╝

bool telaResumoVenda() {
  float total = 0;
  for(int i = 0; i < totalCarrinho; i++) {
    total += carrinho[i].quantidade * carrinho[i].preco;
  }

  int offset = 0;
  unsigned long tempoEntrada = millis();

  while((millis() - tempoEntrada) < TIMEOUT_TELA) {
    tft.fillScreen(C_BG);
    drawStatusBar();
    drawSubHeader("RESUMO VENDA");

    // 4 itens × 44px
    for(int i = 0; i < 4 && (offset + i) < totalCarrinho; i++) {
      int idx = offset + i;
      int y   = 62 + i * 44;
      tft.fillRoundRect(4, y, TFT_W - 8, 42, 7, C_DGRAY);
      tft.fillRoundRect(4, y, 5, 42, 3, C_ORNG);

      char nomeShort[11];
      strncpy(nomeShort, carrinho[idx].nome, 10);
      nomeShort[10] = '\0';
      tft.setTextColor(C_TXT, C_DGRAY);
      tft.setTextSize(2);
      tft.setCursor(16, y + 5);
      tft.print(nomeShort);

      tft.setTextSize(1);
      tft.setTextColor(C_CYAN, C_DGRAY);
      tft.setCursor(16, y + 28);
      char line[24];
      char pbuf[8];
      dtostrf(carrinho[idx].quantidade * carrinho[idx].preco, 5, 2, pbuf);
      snprintf(line, sizeof(line), "x%d = R$%s", carrinho[idx].quantidade, pbuf);
      tft.print(line);
    }

    tft.drawLine(0, 242, TFT_W, 242, C_YEL);
    tft.setTextColor(C_YEL, C_BG);
    tft.setTextSize(2);
    char tbuf[12];
    dtostrf(total, 7, 2, tbuf);
    tft.setCursor(10, 248);
    tft.print("TOTAL: R$");
    tft.print(tbuf);

    // Botões arredondados
    tft.fillRoundRect(5,   278, 108, 38, 8, C_DRED);
    tft.drawRoundRect(5,   278, 108, 38, 8, C_ERR);
    tft.setTextColor(C_TXT, C_DRED);
    tft.setTextSize(2);
    tft.setCursor(10, 290);
    tft.print("CANCELAR");

    tft.fillRoundRect(127, 278, 108, 38, 8, C_DGRN);
    tft.drawRoundRect(127, 278, 108, 38, 8, C_OK);
    tft.setTextColor(C_TXT, C_DGRN);
    tft.setTextSize(2);
    tft.setCursor(145, 290);
    tft.print("PAGAR");

    tft.setTextColor(C_MGRAY, C_BG);
    tft.setTextSize(1);
    tft.setCursor(10, 318);
    tft.print("Cima/Baixo: rolar itens");

    TouchPt p = waitForTap();
    if(!p.valid) return false;

    if(p.y >= 278) {
      if(p.x < 120) { beepErro(); return false; }
      else           { beepOk();  return true;  }
    }

    // Scroll lista
    TouchZone z = getTouchZone();
    if(z == ZONE_DOWN && offset + 4 < totalCarrinho) offset++;
    if(z == ZONE_UP   && offset > 0)                  offset--;

    if(botaoPressionado(PIN_CARRINHO) || backPressionado()) return false;
  }
  return false;
}

// ╔════════════════════════════════════════╗
// ║        SELEÇÃO DE PAGAMENTO            ║
// ╚════════════════════════════════════════╝

MetodoPagamento telaSelecaoPagamento() {
  tft.fillScreen(C_BG);
  drawStatusBar();
  drawSubHeader("PAGAMENTO");

  // 3 cards de pagamento com cores distintas e ícones
  const char* metodos[]    = { "DINHEIRO", "PIX",    "CARTAO"  };
  const char* subtitulos[] = { "Especie",  "QR Code","Debito/Credito" };
  const uint16_t cardBg[]  = { 0x0340,    0x0019,   0x1806    };
  const uint16_t bordas[]  = { C_OK,      C_CYAN,   0x065F    };
  const char     iconChars[] = { '$',      'P',      'C'       };

  // 3 cards × 82px cada (y=62..308)
  for(int i = 0; i < 3; i++) {
    int y = 62 + i * 82;
    tft.fillRoundRect(8, y, TFT_W - 16, 78, 10, cardBg[i]);
    tft.drawRoundRect(8, y, TFT_W - 16, 78, 10, bordas[i]);
    // ícone
    tft.setTextSize(3);
    tft.setTextColor(bordas[i], cardBg[i]);
    tft.setCursor(20, y + 20);
    tft.write(iconChars[i]);
    // nome
    tft.setTextSize(2);
    tft.setTextColor(C_TXT, cardBg[i]);
    tft.setCursor(60, y + 18);
    tft.print(metodos[i]);
    // subtítulo
    tft.setTextSize(1);
    tft.setTextColor(C_GRAY, cardBg[i]);
    tft.setCursor(60, y + 46);
    tft.print(subtitulos[i]);
  }

  unsigned long tempoEntrada = millis();
  while((millis() - tempoEntrada) < TIMEOUT_TELA) {
    TouchPt p = waitForTap();
    if(!p.valid) return PAG_DINHEIRO;
    if(p.y >= 62 && p.y < 308) {
      int idx = (p.y - 62) / 82;
      if(idx >= 0 && idx < 3) {
        beepOk();
        return (MetodoPagamento)idx;
      }
    }
    if(botaoPressionado(PIN_CARRINHO) || backPressionado()) return PAG_DINHEIRO;
  }
  return PAG_DINHEIRO;
}

// ╔════════════════════════════════════════╗
// ║        SISTEMA DE CARRINHO (NOVA VENDA)║
// ╚════════════════════════════════════════╝

void telaCarrinho() {
  int itemSelecionado = 0;
  int quantidadeAtual = 1;
  bool selecionandoQtd = false;
  unsigned long tempoEntrada = millis();

  while((millis() - tempoEntrada) < TIMEOUT_TELA) {

    if(totalProdutos == 0) {
      tft.fillScreen(C_BG);
      drawStatusBar();
      tft.setTextColor(C_YEL, C_BG);
      tft.setTextSize(2);
      tft.setCursor(20, 150);
      tft.print("Nenhum Produto!");
      tft.setTextColor(C_GRAY, C_BG);
      tft.setTextSize(1);
      tft.setCursor(30, 180);
      tft.print("Toque para sair");
      TouchPt p = waitForTap();
      if(p.valid || botaoPressionado(PIN_CARRINHO)) break;
      continue;
    }

    if(!selecionandoQtd) {
      // ── Seleção de produto ──────────────────────────────
      tft.fillScreen(C_BG);
      drawStatusBar();

      char hdrProd[20];
      snprintf(hdrProd, sizeof(hdrProd), "PROD %d/%d", itemSelecionado + 1, totalProdutos);
      drawSubHeader(hdrProd);

      // Nome do produto (grande)
      tft.setTextSize(3);
      tft.setTextColor(C_TXT, C_BG);
      tft.setCursor(10, 68);
      char nomeShort[11];
      strncpy(nomeShort, produtos[itemSelecionado].nome, 10);
      nomeShort[10] = '\0';
      tft.print(nomeShort);

      // Preço
      tft.setTextSize(2);
      tft.setTextColor(C_YEL, C_BG);
      tft.setCursor(10, 112);
      char pbuf[10];
      dtostrf(produtos[itemSelecionado].preco, 6, 2, pbuf);
      tft.print("R$ ");
      tft.print(pbuf);

      // Estoque
      tft.setTextSize(2);
      bool baixo = (produtos[itemSelecionado].estoque < 5);
      tft.setTextColor(baixo ? C_ERR : C_GRAY, C_BG);
      tft.setCursor(10, 140);
      tft.print("Estoque: ");
      tft.print(produtos[itemSelecionado].estoque);

      // Botões navegar arredondados
      tft.fillRoundRect(5,   172, 108, 78, 10, C_DGRAY);
      tft.drawRoundRect(5,   172, 108, 78, 10, C_CYAN);
      tft.setTextColor(C_CYAN, C_DGRAY);
      tft.setTextSize(3);
      tft.setCursor(36, 199);
      tft.print("<");

      tft.fillRoundRect(127, 172, 108, 78, 10, C_DGRAY);
      tft.drawRoundRect(127, 172, 108, 78, 10, C_CYAN);
      tft.setTextColor(C_CYAN, C_DGRAY);
      tft.setTextSize(3);
      tft.setCursor(158, 199);
      tft.print(">");

      // Botão SELECIONAR
      tft.fillRoundRect(5, 262, TFT_W - 10, 44, 10, C_DGRN);
      tft.drawRoundRect(5, 262, TFT_W - 10, 44, 10, C_OK);
      tft.setTextColor(C_TXT, C_DGRN);
      tft.setTextSize(2);
      tft.setCursor(50, 277);
      tft.print("SELECIONAR");

      tft.setTextColor(C_MGRAY, C_BG);
      tft.setTextSize(1);
      tft.setCursor(10, 310);
      tft.print("Botao fisico: Sair");

      TouchPt p = waitForTap();
      if(!p.valid) break;

      if(p.y >= 168 && p.y < 248) {
        if(p.x < 120) {
          itemSelecionado = (itemSelecionado - 1 + totalProdutos) % totalProdutos;
        } else {
          itemSelecionado = (itemSelecionado + 1) % totalProdutos;
        }
        ultimoInput = millis();
        tempoEntrada = millis();
      } else if(p.y >= 262) {
        selecionandoQtd = true;
        quantidadeAtual = 1;
        tempoEntrada = millis();
      }

      if(botaoPressionado(PIN_CARRINHO) || backPressionado()) break;

    } else {
      // ── Seleção de quantidade ───────────────────────────
      tft.fillScreen(C_BG);
      drawStatusBar();

      char hdrQtd[20];
      snprintf(hdrQtd, sizeof(hdrQtd), "QTDE: %.9s", produtos[itemSelecionado].nome);
      drawSubHeader(hdrQtd);

      // Botão +
      tft.fillRoundRect(5, 62, TFT_W - 10, 64, 10, C_DGRN);
      tft.drawRoundRect(5, 62, TFT_W - 10, 64, 10, C_OK);
      tft.setTextColor(C_TXT, C_DGRN);
      tft.setTextSize(4);
      tft.setCursor(100, 80);
      tft.print("+");

      // Quantidade atual (grande, centro)
      tft.setTextSize(4);
      tft.setTextColor(C_TXT, C_BG);
      int xNum = (quantidadeAtual < 10) ? 100 : (quantidadeAtual < 100 ? 84 : 66);
      tft.setCursor(xNum, 140);
      tft.print(quantidadeAtual);

      // Preço total desta linha
      tft.setTextSize(2);
      tft.setTextColor(C_YEL, C_BG);
      char pbuf[12];
      dtostrf(quantidadeAtual * produtos[itemSelecionado].preco, 7, 2, pbuf);
      tft.setCursor(10, 188);
      tft.print("= R$ ");
      tft.print(pbuf);

      // Botão -
      tft.fillRoundRect(5, 194, TFT_W - 10, 64, 10, C_DRED);
      tft.drawRoundRect(5, 194, TFT_W - 10, 64, 10, C_ERR);
      tft.setTextColor(C_TXT, C_DRED);
      tft.setTextSize(4);
      tft.setCursor(100, 212);
      tft.print("-");

      // Botões VOLTAR e ADICIONAR
      tft.fillRoundRect(5,   268, 108, 44, 8, C_DGRAY);
      tft.drawRoundRect(5,   268, 108, 44, 8, C_GRAY);
      tft.setTextColor(C_TXT, C_DGRAY);
      tft.setTextSize(2);
      tft.setCursor(14, 283);
      tft.print("VOLTAR");

      tft.fillRoundRect(127, 268, 108, 44, 8, C_DGRN);
      tft.drawRoundRect(127, 268, 108, 44, 8, C_OK);
      tft.setTextColor(C_TXT, C_DGRN);
      tft.setTextSize(2);
      tft.setCursor(130, 283);
      tft.print("ADICIONAR");

      TouchPt p = waitForTap();
      if(!p.valid) break;

      if(p.y >= 62 && p.y < 126) {
        // Botão +
        if(quantidadeAtual < produtos[itemSelecionado].estoque) {
          quantidadeAtual++;
          ultimoInput = millis();
        }
        tempoEntrada = millis();

      } else if(p.y >= 194 && p.y < 258) {
        // Botão -
        if(quantidadeAtual > 1) {
          quantidadeAtual--;
          ultimoInput = millis();
        }
        tempoEntrada = millis();

      } else if(p.y >= 268) {
        if(p.x < 120) {
          // VOLTAR
          selecionandoQtd = false;
          tempoEntrada = millis();
        } else {
          // ADICIONAR ao carrinho
          bool existe = false;
          for(int i = 0; i < totalCarrinho; i++) {
            if(strcmp(carrinho[i].nome, produtos[itemSelecionado].nome) == 0) {
              carrinho[i].quantidade += quantidadeAtual;
              existe = true;
              break;
            }
          }
          if(!existe && totalCarrinho < 20) {
            strncpy(carrinho[totalCarrinho].nome, produtos[itemSelecionado].nome, 19);
            carrinho[totalCarrinho].nome[19] = '\0';
            carrinho[totalCarrinho].quantidade = quantidadeAtual;
            carrinho[totalCarrinho].preco      = produtos[itemSelecionado].preco;
            totalCarrinho++;
          }

          // Feedback visual
          tft.fillScreen(C_BG);
          drawStatusBar();
          tft.setTextColor(C_OK, C_BG);
          tft.setTextSize(2);
          tft.setCursor(30, 130);
          tft.print("Adicionado!");
          tft.setTextSize(2);
          tft.setTextColor(C_YEL, C_BG);
          tft.setCursor(10, 165);
          tft.print(produtos[itemSelecionado].nome);
          tft.setCursor(10, 190);
          tft.print("x");
          tft.print(quantidadeAtual);
          tft.setCursor(10, 215);
          tft.print("Carrinho: ");
          tft.print(totalCarrinho);
          tft.print(" itens");
          beepOk();
          delay(1000);

          selecionandoQtd = false;
          tempoEntrada = millis();
        }
      }

      if(botaoPressionado(PIN_CARRINHO) || backPressionado()) { selecionandoQtd = false; break; }
    }
  }

  // Fluxo de finalização de venda
  if(totalCarrinho > 0) {
    if(!telaResumoVenda()) return;

    MetodoPagamento pag = telaSelecaoPagamento();
    sincronizarVenda(pag);

    tft.fillScreen(C_BG);
    drawStatusBar();
    tft.setTextColor(C_OK, C_BG);
    tft.setTextSize(3);
    tft.setCursor(30, 120);
    tft.print("VENDA OK!");
    const char* metStr[] = {"DINHEIRO", "PIX", "CARTAO"};
    tft.setTextSize(2);
    tft.setTextColor(C_CYAN, C_BG);
    tft.setCursor(10, 170);
    tft.print(metStr[pag]);
    beepVenda();
    delay(1800);
  }
}

// ╔════════════════════════════════════════╗
// ║        SINCRONIZAÇÃO DE VENDA          ║
// ╚════════════════════════════════════════╝

void sincronizarVenda(MetodoPagamento pagamento) {
  const char* metStr[] = {"dinheiro", "pix", "cartao"};

  if(!wifiConectado || !servidorOnline) {
    for(int i = 0; i < totalCarrinho && totalPendentes < 10; i++) {
      strncpy(vendasPendentes[totalPendentes].produto, carrinho[i].nome, 19);
      vendasPendentes[totalPendentes].produto[19] = '\0';
      vendasPendentes[totalPendentes].qtd      = carrinho[i].quantidade;
      vendasPendentes[totalPendentes].preco     = carrinho[i].preco;
      vendasPendentes[totalPendentes].pagamento = (uint8_t)pagamento;
      totalPendentes++;
    }
    Serial.println("Venda salva offline. Pendentes: " + String(totalPendentes));
    registrarLog("Venda salva offline");
    beepErro();
  } else {
    for(int i = 0; i < totalCarrinho; i++) {
      HTTPClient http;
      char url[120];
      buildApiUrl(url, sizeof(url), "/api/venda");
      WiFiClientSecure* sc = beginHttp(http, url);
      http.setTimeout(2000);
      http.addHeader("Content-Type", "application/json");

      StaticJsonDocument<128> doc;
      doc["produto"]    = carrinho[i].nome;
      doc["quantidade"] = carrinho[i].quantidade;
      doc["preco"]      = carrinho[i].preco;
      doc["pagamento"]  = metStr[pagamento];

      String json;
      serializeJson(doc, json);
      Serial.println("POST: " + json);
      int code = http.POST(json);
      Serial.println("HTTP: " + String(code));
      http.end();
      if (sc) delete sc;
      delay(100);
    }
    registrarLog("Venda sincronizada");
  }

  stats.vendas_dia++;
  for(int i = 0; i < totalCarrinho; i++) {
    stats.produtos_vendidos += carrinho[i].quantidade;
    stats.receita_dia       += carrinho[i].quantidade * carrinho[i].preco;
  }
  stats.tempo_ultima_venda = millis();
  salvarStats();

  totalCarrinho  = 0;
  ultimoRefresh  = 0; // forçar refresh
}

void tentarSyncPendentes() {
  if(totalPendentes == 0 || !wifiConectado || !servidorOnline) return;
  const char* metStr[] = {"dinheiro", "pix", "cartao"};

  Serial.println("Tentando sync de " + String(totalPendentes) + " pendentes...");
  int syncOk = 0;

  for(int i = 0; i < totalPendentes; i++) {
    HTTPClient http;
    char url[120];
    buildApiUrl(url, sizeof(url), "/api/venda");
    WiFiClientSecure* sc = beginHttp(http, url);
    http.setTimeout(2000);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<128> doc;
    doc["produto"]    = vendasPendentes[i].produto;
    doc["quantidade"] = vendasPendentes[i].qtd;
    doc["preco"]      = vendasPendentes[i].preco;
    doc["pagamento"]  = metStr[vendasPendentes[i].pagamento < 3 ? vendasPendentes[i].pagamento : 0];
    if(vendasPendentes[i].pagamento >= 3) {
      Serial.println("pagamento corrompido: " + String(vendasPendentes[i].pagamento) + " -> dinheiro");
    }

    String json;
    serializeJson(doc, json);
    int code = http.POST(json);
    http.end();
    if (sc) delete sc;

    if(code == 200 || code == 201) syncOk++;
    else break;
    delay(100);
  }

  if(syncOk > 0) {
    int restantes = totalPendentes - syncOk;
    for(int i = 0; i < restantes; i++) vendasPendentes[i] = vendasPendentes[i + syncOk];
    totalPendentes = restantes;
    registrarLog("Pendentes sincron.");
    Serial.println("Sync OK: " + String(syncOk) + " vendas. Restam: " + String(totalPendentes));
  }
}

// ╔════════════════════════════════════════╗
// ║        COMUNICAÇÃO COM SERVIDOR        ║
// ╚════════════════════════════════════════╝

void enviarHeartbeat() {
  if(!wifiConectado) {
    servidorOnline    = false;
    ultimoHeartbeat   = millis();
    return;
  }

  HTTPClient http;
  char url[120];
  buildApiUrl(url, sizeof(url), "/api/heartbeat");
  WiFiClientSecure* sc = beginHttp(http, url);
  http.setTimeout(2000);

  int code      = http.POST("");
  bool wasOnline = servidorOnline;
  servidorOnline = (code == 200);
  http.end();
  if (sc) delete sc;
  ultimoHeartbeat = millis();

  if(!wasOnline && servidorOnline) {
    Serial.println("Servidor online - sync pendentes");
    registrarLog("Servidor online");
    tentarSyncPendentes();
  } else if(wasOnline && !servidorOnline) {
    Serial.println("Servidor offline");
    registrarLog("Servidor offline");
  }
}

void atualizarProdutos() {
  if(!wifiConectado) return;

  HTTPClient http;
  char url[120];
  buildApiUrl(url, sizeof(url), "/api/produtos");
  WiFiClientSecure* sc = beginHttp(http, url);
  http.setTimeout(5000);

  int code = http.GET();
  if(code == 200) {
    Serial.print("Heap antes parse: ");
    Serial.print(ESP.getFreeHeap());
    Serial.println(" bytes");
    DynamicJsonDocument* doc = new DynamicJsonDocument(3072);
    if(doc) {
      DeserializationError err = deserializeJson(*doc, http.getStream());
      if(!err) {
        totalProdutos = 0;
        for(JsonObject p : doc->as<JsonArray>()) {
          if(totalProdutos < 25) {
            const char* n = p["nome"] | "";
            strncpy(produtos[totalProdutos].nome, n, 19);
            produtos[totalProdutos].nome[19] = '\0';
            produtos[totalProdutos].estoque  = p["estoque"] | 0;
            // Resilient price parsing: Prisma Decimal may arrive as a JSON string
            JsonVariant precoV = p["preco"];
            produtos[totalProdutos].preco = precoV.is<const char*>()
              ? (float)atof(precoV.as<const char*>()) : precoV.as<float>();
            totalProdutos++;
          }
        }
        Serial.println("Produtos: " + String(totalProdutos));
      } else {
        Serial.println("JSON parse error: " + String(err.c_str()));
        registrarLog("Erro parse produtos");
      }
      delete doc;
    } else {
      Serial.println("Heap insuf. DynamicJsonDocument");
      registrarLog("Heap insuf. produtos");
    }
  } else {
    Serial.println("GET produtos: " + String(code));
  }
  http.end();
  if (sc) delete sc;
  ultimoRefresh = millis();
}

// ╔════════════════════════════════════════╗
// ║        GERENCIAMENTO DE WIFI           ║
// ╚════════════════════════════════════════╝

void conectarWiFi() {
  if(!config.configured || strlen(config.ssid) == 0) {
    WiFi.softAP("CortexAI Setup");
    webServer.on("/",           handleConfigPortal);
    webServer.on("/config",     HTTP_POST, handleConfig);
    webServer.on("/api/config", HTTP_GET,  handleConfig);
    webServer.begin();

    tft.fillScreen(C_BG);
    drawStatusBar();
    tft.setTextColor(C_YEL, C_BG);
    tft.setTextSize(2);
    tft.setCursor(10, 50);
    tft.print("PORTAL DE SETUP");
    tft.drawLine(0, 72, TFT_W, 72, C_DGRAY);

    tft.setTextColor(C_TXT, C_BG);
    tft.setTextSize(1);
    tft.setCursor(10, 85);
    tft.print("Conecte ao WiFi:");
    tft.setTextColor(C_CYAN, C_BG);
    tft.setTextSize(2);
    tft.setCursor(10, 98);
    tft.print("CortexAI Setup");

    tft.setTextColor(C_TXT, C_BG);
    tft.setTextSize(1);
    tft.setCursor(10, 130);
    tft.print("Acesse no navegador:");
    tft.setTextColor(C_YEL, C_BG);
    tft.setTextSize(2);
    tft.setCursor(10, 143);
    tft.print("192.168.4.1");

    tft.setTextColor(C_GRAY, C_BG);
    tft.setTextSize(1);
    tft.setCursor(10, 185);
    tft.print("Configure SSID, senha,");
    tft.setCursor(10, 200);
    tft.print("IP do servidor e porta.");

    while(true) {
      webServer.handleClient();
      delay(10);
    }
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(config.ssid, config.password);
  int tentativas = 0;
  while(WiFi.status() != WL_CONNECTED && tentativas < 20) {
    delay(500);
    tentativas++;
  }

  wifiConectado = (WiFi.status() == WL_CONNECTED);
  if(wifiConectado) {
    Serial.println("WiFi conectado: " + WiFi.localIP().toString());
    registrarLog("WiFi conectado");
  } else {
    Serial.println("WiFi falhou");
    registrarLog("WiFi falhou no boot");
  }
}

void verificarWiFi() {
  if(millis() - ultimoWifiCheck < WIFI_CHECK_INTERVALO) return;
  ultimoWifiCheck = millis();

  bool statusAtual = (WiFi.status() == WL_CONNECTED);

  if(!statusAtual && wifiConectado) {
    Serial.println("WiFi desconectado! Reconectando...");
    registrarLog("WiFi desconectado");
    wifiConectado = false;
    servidorOnline = false;
  }

  if(!statusAtual) {
    reconectando = true;
    int tentativas = 0;
    WiFi.disconnect();
    delay(100);
    WiFi.mode(WIFI_STA);
    WiFi.begin(config.ssid, config.password);
    while(WiFi.status() != WL_CONNECTED && tentativas < 10) {
      delay(500);
      tentativas++;
    }
    reconectando = false;

    if(WiFi.status() == WL_CONNECTED) {
      wifiConectado = true;
      Serial.println("WiFi reconectado: " + WiFi.localIP().toString());
      registrarLog("WiFi reconectado");
    } else {
      Serial.println("Reconexao falhou");
    }
  } else {
    wifiConectado = true;
  }
}

// ╔════════════════════════════════════════╗
// ║        ENTRADA - BOTÃO FÍSICO          ║
// ╚════════════════════════════════════════╝

// Detecta toque simples no botão (bloqueante até soltar)
bool botaoPressionado(int pino) {
  if(digitalRead(pino) == LOW) {
    delay(DEBOUNCE);
    if(digitalRead(pino) == LOW) {
      while(digitalRead(pino) == LOW) delay(10);
      delay(DEBOUNCE);
      ultimoInput = millis();
      ativarDisplay();
      return true;
    }
  }
  return false;
}

// Gerencia botão do carrinho no loop principal:
// Pressão curta (<5s) → abre carrinho
// Pressão longa (≥5s) → factory reset
void handleBotaoCarrinho() {
  bool pressionado = (digitalRead(PIN_CARRINHO) == LOW);

  if(pressionado && !botaoVendaAtivo) {
    botaoVendaAtivo    = true;
    botaoPressionadoEm = millis();
  } else if(!pressionado && botaoVendaAtivo) {
    botaoVendaAtivo = false;
    unsigned long tempo = millis() - botaoPressionadoEm;

    if(tempo < LONG_PRESS) {
      // Pressão curta → abrir carrinho
      ativarDisplay();
      transitionIn();
      menuAtivo = 1;
      telaCarrinho();
      menuAtivo = 0;
      transitionOut();
      drawMenu();
    }
  }

  // Pressão longa → factory reset
  if(pressionado && botaoVendaAtivo && (millis() - botaoPressionadoEm) >= LONG_PRESS) {
    tft.fillScreen(C_BG);
    drawStatusBar();
    tft.setTextColor(C_ERR, C_BG);
    tft.setTextSize(3);
    tft.setCursor(20, 130);
    tft.print("RESETANDO");
    tft.setCursor(50, 165);
    tft.print("...");
    delay(500);
    limparConfig();
  }
}

void executarOpcaoMenu() {
  ativarDisplay();
  transitionIn();
  switch(menuIndex) {
    case 0: telaDashboard();    break;
    case 1: telaEstoque();      break;
    case 2: telaCarrinho();     break;
    case 3: telaVerCarrinho();  break;
    case 4: telaHistorico();    break;
    case 5: telaWiFi();         break;
    case 6: telaSistema();      break;
  }
  transitionOut();
  drawMenu();
}

// ╔════════════════════════════════════════╗
// ║        SETUP                           ║
// ╚════════════════════════════════════════╝

void setup() {
  Serial.begin(BAUD_RATE);
  delay(1000);

  Serial.println("\n╔══════════════════════════════╗");
  Serial.println("║  CortexAI POS v5.0           ║");
  Serial.println("║  ESP32-S3 + ILI9341 TFT      ║");
  Serial.println("╚══════════════════════════════╝\n");


  // Pinos
  pinMode(PIN_CARRINHO, INPUT_PULLUP);
  pinMode(PIN_BACK,     INPUT_PULLUP);

  // SPI compartilhado: display e touch no mesmo barramento
  tftSPI.begin(PIN_TFT_SCLK, PIN_TFT_MISO, PIN_TFT_MOSI, PIN_TFT_CS);

  // Backlight via LEDC
  ledcAttach(PIN_BL, 5000, 8);
  ledcWrite(PIN_BL, 255);

  // Inicializar display
  tft.begin(20000000);  // 20 MHz — mais estável, menos EMI no touch
  tft.setRotation(0);   // portrait 240x320
  tft.fillScreen(C_BG);

  // Inicializar touch (mesmo barramento SPI, CS separado)
  ts.begin(tftSPI);
  ts.setRotation(1);

  // Timers
  bootTime        = millis();
  ultimoHeartbeat = bootTime;
  ultimoRefresh   = bootTime;
  ultimoWifiCheck = bootTime;
  ultimoInput     = bootTime;

  // ── Boot animation ──────────────────────────────────────
  // Logo backdrop
  tft.fillRoundRect(20, 70, TFT_W - 40, 120, 16, C_HDR);
  tft.drawRoundRect(20, 70, TFT_W - 40, 120, 16, C_CYAN);

  // Title
  tft.setTextSize(3);
  tft.setTextColor(C_TXT, C_HDR);
  tft.setCursor(34, 90);
  tft.print("CortexAI");

  // Accent line
  tft.drawLine(34, 118, TFT_W - 34, 118, C_CYAN);

  // Subtitle
  tft.setTextSize(2);
  tft.setTextColor(C_ORNG, C_HDR);
  tft.setCursor(62, 126);
  tft.print("POS v6.0");

  // Hardware tag
  tft.setTextSize(1);
  tft.setTextColor(C_GRAY, C_HDR);
  tft.setCursor(44, 158);
  tft.print("ESP32-S3  |  ILI9341 TFT");

  // Progress bar
  tft.drawRoundRect(20, 210, TFT_W - 40, 16, 8, C_MGRAY);
  for(int i = 0; i <= (TFT_W - 44); i += 4) {
    uint16_t barColor = (i < (TFT_W - 44) / 3) ? C_CYAN :
                        (i < (TFT_W - 44) * 2 / 3) ? C_ORNG : C_OK;
    tft.fillRoundRect(22, 212, i, 12, 6, barColor);
    delay(12);
  }

  // Footer
  tft.setTextColor(C_MGRAY, C_BG);
  tft.setTextSize(1);
  tft.setCursor(50, 238);
  tft.print("Iniciando sistema...");
  // ────────────────────────────────────────────────────────

  carregarConfig();
  carregarStats();
  registrarLog("Boot v6.0");
  conectarWiFi();

  // OTA
  if(wifiConectado) {
    ArduinoOTA.setHostname("CortexAI-POS");

    ArduinoOTA.onStart([]() {
      tft.fillScreen(C_BG);
      drawStatusBar();
      tft.setTextColor(C_YEL, C_BG);
      tft.setTextSize(2);
      tft.setCursor(20, 100);
      tft.print("OTA Update...");
      tft.drawRect(20, 130, TFT_W - 40, 16, C_DGRAY);
      Serial.println("OTA Start");
    });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
      int pct    = progress / (total / 100);
      int barW   = (int)(((float)pct / 100) * (TFT_W - 40));
      tft.fillRect(20, 130, barW, 16, C_CYAN);
      tft.setTextColor(C_TXT, C_BG);
      tft.setTextSize(2);
      tft.setCursor(100, 158);
      tft.setTextColor(C_TXT, C_BG);
      tft.fillRect(90, 155, 60, 20, C_BG);
      tft.setCursor(90, 158);
      tft.print(pct);
      tft.print("%");
    });

    ArduinoOTA.onEnd([]() {
      tft.fillScreen(C_BG);
      drawStatusBar();
      tft.setTextColor(C_OK, C_BG);
      tft.setTextSize(2);
      tft.setCursor(20, 130);
      tft.print("OTA Concluido!");
      Serial.println("OTA End");
    });

    ArduinoOTA.onError([](ota_error_t error) {
      Serial.println("OTA Error: " + String(error));
      registrarLog("Erro OTA");
    });

    ArduinoOTA.begin();
    Serial.println("OTA pronto. Hostname: CortexAI-POS");
  }

  atualizarProdutos();
  beepOk();
  drawMenu();

  // Inicia tarefa de rede no Core 0 — libera Core 1 para UI/touch
  xTaskCreatePinnedToCore(
    [](void*) {
      for(;;) {
        if(wifiConectado) {
          if(millis() - ultimoHeartbeat > HEARTBEAT_INTERVALO) enviarHeartbeat();
          if(millis() - ultimoRefresh   > REFRESH_INTERVALO)   atualizarProdutos();
        }
        verificarWiFi();
        vTaskDelay(pdMS_TO_TICKS(200));
      }
    },
    "netTask", 8192, NULL, 1, NULL, 0  // Core 0
  );
}

// ╔════════════════════════════════════════╗
// ║        LOOP PRINCIPAL                  ║
// ╚════════════════════════════════════════╝

void loop() {

  if(wifiConectado) ArduinoOTA.handle();
  webServer.handleClient();

  verificarSleep();

  // Navegação por toque no menu
  TouchZone z = getTouchZone();
  if(z == ZONE_DOWN) {
    ativarDisplay();
    menuIndex = (menuIndex + 1) % MENU_SIZE;
    drawMenu();
  } else if(z == ZONE_UP) {
    ativarDisplay();
    menuIndex = (menuIndex - 1 + MENU_SIZE) % MENU_SIZE;
    drawMenu();
  } else if(z == ZONE_CENTER || z == ZONE_RIGHT) {
    executarOpcaoMenu();
  }

  // Botão BACK no menu principal → acorda display / volta ao topo do menu
  if(botaoPressionado(PIN_BACK)) {
    ativarDisplay();
    menuIndex = 0;
    drawMenu();
  }

  // Botão físico do carrinho
  handleBotaoCarrinho();

  delay(5);
}
