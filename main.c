#include <LPC11xx.h>

#define GPIO0DIR  (*((volatile unsigned long *)0x50008000))
#define GPIO0DATA (*((volatile unsigned long *)0x50003FFC))
#define GPIO2DIR  (*((volatile unsigned long *)0x50028000))
#define GPIO2DATA (*((volatile unsigned long *)0x50023FFC))

void delay(int count) {
    int i = 0;
    for(i = 0; i <= count; i++);
}

void send_cmd_4bit(unsigned char cmd) {
    GPIO0DATA = 0b000;

    GPIO2DATA = (cmd & 0xF0);

    GPIO0DATA = 0b100;
    delay(1000);
    GPIO0DATA = 0b000;
    delay(1000);

    GPIO2DATA = ((cmd << 4) & 0xF0);

    GPIO0DATA = 0b100;
    delay(1000);
    GPIO0DATA = 0b000;
    delay(1000);
}

void send_letter_4bit(unsigned char letter) {
    GPIO0DATA = 0b010;

    GPIO2DATA = (letter & 0xF0);

    GPIO0DATA = 0b110;
    delay(1000);
    GPIO0DATA = 0b010;
    delay(1000);

    GPIO2DATA = ((letter << 4) & 0xF0);

    GPIO0DATA = 0b110;
    delay(1000);
    GPIO0DATA = 0b010;
    delay(1000);
}

void send_string(char* string) {
    while(*string != '\0') {
        send_letter_4bit(*string);
        string++;
    }
}

void lcd_init_4bit() {
    delay(15000);

    GPIO0DATA = 0b000;
    GPIO2DATA = 0x20;
    GPIO0DATA = 0b100; // E=1
    delay(1000);
    GPIO0DATA = 0b000; // E=0
    delay(1000);

    send_cmd_4bit(0x28);
    send_cmd_4bit(0x0C);
    send_cmd_4bit(0x06);
    send_cmd_4bit(0x01);
    delay(5000);
}

int main(void) {
    GPIO0DIR |= 0b110;
    GPIO2DIR |= 0b11110000;

    GPIO0DATA = 0;
    GPIO2DATA = 0;

    lcd_init_4bit();

    // 2. Print the name on the first line
    send_string("Ahmed Abu Sabha");

    send_cmd_4bit(0xC0);

    // 4. Print the ID
    send_string("120220304");

    while(1);
    return 0;
}
