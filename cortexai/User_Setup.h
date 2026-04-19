// ╔══════════════════════════════════════════════════════╗
// ║  TFT_eSPI User_Setup.h - CortexAI POS v5.0          ║
// ║  Driver : ILI9341   |  SPI  |  240x320 portrait      ║
// ║  MCU    : ESP32-S3-N16R8                             ║
// ╚══════════════════════════════════════════════════════╝

#define ILI9341_DRIVER
#define TFT_WIDTH  240
#define TFT_HEIGHT 320

// SPI pins (ESP32-S3)
#define TFT_MOSI  11
#define TFT_SCLK  12
#define TFT_MISO  13   // necessário para XPT2046 no mesmo barramento

// Display control pins
#define TFT_CS    10
#define TFT_DC     9
#define TFT_RST    8

// Backlight (controlado por PWM no firmware)
#define TFT_BL    46
#define TFT_BACKLIGHT_ON HIGH

// Touch (XPT2046 - CS definido no firmware como PIN_TOUCH_CS = 5)
#define TOUCH_CS   5

// Frequências SPI
#define SPI_FREQUENCY       40000000   // 40 MHz para o display
#define SPI_READ_FREQUENCY  20000000   // 20 MHz para leitura
#define SPI_TOUCH_FREQUENCY  2500000   //  2.5 MHz para o touch

// Fontes incluídas
#define LOAD_GLCD    // Fonte padrão 5x7
#define LOAD_FONT2   // Fonte menor
#define LOAD_FONT4   // Fonte média
#define LOAD_FONT6   // Fonte grande
#define LOAD_FONT7   // 7-segment
#define LOAD_FONT8   // Fonte grande
#define LOAD_GFXFF   // FreeFonts
#define SMOOTH_FONT
