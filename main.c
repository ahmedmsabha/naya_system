#include <LPC11xx.h>

#define GPIO2DIR  (*((volatile unsigned long *)0x50028000))
#define GPIO2DATA (*((volatile unsigned long *)0x50023FFC))
#define GPIO0DIR  (*((volatile unsigned long *)0x50008000))
#define GPIO0DATA (*((volatile unsigned long *)0x50003FFC))

int dec_to_7seg[] = {
    0b0111111, 0b0000110, 0b1011011, 0b1001111, 0b1100110,
    0b1101101, 0b1111101, 0b0000111, 0b1111111, 0b1101111
};

void displayTwoDigits(int number);

int main () {
    GPIO0DIR = 0b110;
    GPIO2DIR = 0b1111111;

    GPIO0DATA = 0b000;
    GPIO2DATA = 0b0000000;

    while(1) {
        displayTwoDigits(25);
    }
}

void displayTwoDigits (int number) {
    int j = 0;

    GPIO0DATA = 0b100;
    GPIO2DATA = dec_to_7seg[(number / 10) % 10];
    for (j=0; j<100; j++);

    GPIO0DATA = 0b010;
    GPIO2DATA = dec_to_7seg[number % 10];
    for (j=0; j<100; j++);
}
